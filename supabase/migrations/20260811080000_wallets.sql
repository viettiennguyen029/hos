-- Custodial EVM wallets: one per organizer/talent (blockchain escrow
-- payment feature), plus platform-owned wallets (admin/operator/relayer/
-- fee_recipient, user_id null). Private keys are encrypted app-side
-- before insert -- this table is never readable by anon/authenticated
-- Postgres roles, only by the service role (which bypasses RLS by
-- default in Supabase), so a compromised anon/authenticated credential
-- can never read key material.
create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  label text check (label in ('admin', 'operator', 'relayer', 'fee_recipient')),
  chain text not null default 'avalanche',
  address text not null,
  encrypted_private_key jsonb not null,
  exported_at timestamptz,
  created_at timestamptz not null default now(),
  constraint wallets_user_id_or_label check (user_id is not null or label is not null)
);

create unique index wallets_address_key on public.wallets (chain, address);
create unique index wallets_user_id_chain_key on public.wallets (user_id, chain) where user_id is not null;
create unique index wallets_label_chain_key on public.wallets (label, chain) where label is not null;
create index wallets_user_id_idx on public.wallets (user_id);

alter table public.wallets enable row level security;
revoke all on public.wallets from anon, authenticated;
-- Deliberately no policies: this table is reachable only by the
-- service-role Postgres role (which bypasses RLS in Supabase), never by
-- anon or authenticated. See src/lib/supabase/service.ts.

-- Exposes each user's own wallet address (never the encrypted key) to
-- the frontend. This view intentionally runs with its owning role's
-- privileges (Postgres/Supabase default for views: security_invoker =
-- false), which is what lets it select from `wallets` despite that
-- table's RLS -- safe only because the WHERE clause is hard-coded to the
-- caller's own auth.uid() and the column list never includes
-- encrypted_private_key. Do NOT "fix" this to security_invoker = true if
-- a linter flags it as a security-definer view -- that would make every
-- select fail, since the invoking user's own RLS (which allows nothing)
-- would apply instead of the view owner's.
create view public.wallet_addresses as
  select id, user_id, address, chain, created_at
  from public.wallets
  where user_id = auth.uid();

grant select on public.wallet_addresses to authenticated;
