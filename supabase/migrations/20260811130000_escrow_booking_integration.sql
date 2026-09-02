-- Links package_bookings to on-chain escrow state (blockchain escrow
-- payment feature, subsystem 4). payment_channel distinguishes the new
-- Fiat/Crypto choice at checkout from the existing Prepaid/Postpaid
-- payment_method -- checkout only ever creates 'Prepaid' bookings now,
-- and payment_channel says how that prepayment happens. Existing
-- Postpaid bookings (and old Prepaid ones from before this feature) have
-- payment_channel = null, which is fine: nothing in this feature ever
-- runs for them.
alter table public.package_bookings
  add column payment_channel text check (payment_channel in ('fiat', 'crypto')),
  add column escrow_booking_id text,
  add column escrow_state text not null default 'none'
    check (escrow_state in ('none', 'registered', 'funded', 'released', 'refunded')),
  add column commission_bps_snapshot integer;

create unique index package_bookings_escrow_booking_id_key
  on public.package_bookings (escrow_booking_id)
  where escrow_booking_id is not null;

alter table public.profiles
  add column commission_bps integer not null default 1000
    check (commission_bps between 0 and 10000);

-- Same reasoning as guard_escrow_fields below: commission_bps must only be
-- settable by an admin action (via the service-role client), never by the
-- talent themselves through their own RLS-scoped session, even though the
-- existing "Users can update their own profile" policy would otherwise
-- allow it.
create or replace function public.guard_commission_bps()
returns trigger as $$
begin
  if new.commission_bps is distinct from old.commission_bps
     and current_setting('role', true) <> 'service_role' then
    raise exception 'commission_bps can only be modified by the service role';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger guard_commission_bps_trigger
  before update on public.profiles
  for each row execute function public.guard_commission_bps();

-- Escrow fields are set exclusively by server-side flows (the
-- registerBooking trigger, the event indexer) using the service-role
-- client -- never directly by an organizer/talent's own RLS-scoped
-- session, even though existing policies already let them update other
-- columns on their own bookings. Same guard pattern as the role-change
-- guard in 0002_fix_rls_and_role_guard.sql.
create or replace function public.guard_escrow_fields()
returns trigger as $$
begin
  if (new.escrow_state is distinct from old.escrow_state
      or new.escrow_booking_id is distinct from old.escrow_booking_id
      or new.commission_bps_snapshot is distinct from old.commission_bps_snapshot
      or new.payment_channel is distinct from old.payment_channel)
     and current_setting('role', true) <> 'service_role' then
    raise exception 'escrow fields can only be modified by the service role';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger guard_escrow_fields_trigger
  before update on public.package_bookings
  for each row execute function public.guard_escrow_fields();

-- On-chain event audit trail, populated by the polling indexer.
create table public.escrow_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.package_bookings (id) on delete cascade,
  event_type text not null check (event_type in ('registered', 'deposited', 'released', 'refunded')),
  tx_hash text not null,
  block_number bigint not null,
  created_at timestamptz not null default now()
);

create index escrow_events_booking_id_idx on public.escrow_events (booking_id);
alter table public.escrow_events enable row level security;
-- Deliberately no policies -- service-role only, same reasoning as
-- public.wallets.

-- Singleton row tracking the indexer's polling cursor.
create table public.escrow_indexer_state (
  id boolean primary key default true,
  last_processed_block bigint not null default 0,
  constraint escrow_indexer_state_singleton check (id)
);
insert into public.escrow_indexer_state (id, last_processed_block) values (true, 0);
alter table public.escrow_indexer_state enable row level security;
-- Service-role only.

-- Internal ops allowlist -- NOT a public.role_type value, since admin is
-- an internal concept, not a marketplace-facing role (see design spec).
create table public.admin_users (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  granted_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
-- Service-role only for writes; a user may check their OWN membership
-- (needed to gate the admin UI), nothing else.
create policy "Users can check their own admin membership"
  on public.admin_users for select
  to authenticated
  using ((select auth.uid()) = user_id);
