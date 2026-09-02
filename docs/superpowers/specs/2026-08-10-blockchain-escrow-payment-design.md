# Blockchain escrow payment — design

## Problem

Today, Prepaid bookings are settled by manual bank transfer: the organizer
sends money outside the app, then self-confirms `payment_status = 'complete'`
on the booking (`supabase/migrations/20260808091530_booking_payment_status.sql`).
There's no actual custody of funds by the platform — "confirm payment" is an
honor-system flag, not an enforced lock. This means the platform can't
guarantee a talent gets paid for a completed show, or that an organizer gets
their money back if a show is cancelled, without manual intervention entirely
outside the app.

This design replaces that trust gap with an on-chain escrow: the organizer
deposits 100% of the package price up front into a smart contract, the money
is locked until the show resolves, and only two things can release it — the
organizer confirming the show happened (pays the talent), or the platform
admin resolving a dispute (either direction). Users never touch a wallet
app, hold gas, or manage keys directly (unless they choose to export their
key) — the platform custodies wallets and sponsors every transaction fee.

## Scope

### In scope
- `EscrowManager` smart contract (Avalanche C-Chain, UUPS-upgradeable):
  register/deposit/release/refund state machine, per-booking commission,
  admin dispute override.
- Custodial wallet service: keypair generation per user, encrypted-at-rest
  private key storage, private key export.
- Gas-sponsorship relayer: EIP-2771 meta-transactions so organizers/talents
  never need AVAX; a platform relayer wallet pays gas for every user action.
- Supabase schema additions linking `package_bookings` to on-chain escrow
  state, plus a polling event indexer keeping that state in sync.
- New internal admin surface (`src/app/admin/`) for dispute resolution
  (release/refund) and per-talent commission-rate management. No admin
  concept exists in the app today — this introduces one via an allowlist
  table, not a new marketplace-facing role.
- Wiring into the existing booking lifecycle **for `Prepaid` packages
  only**: booking confirmed → escrow registered; organizer deposits;
  existing dual-confirmation Mark Complete flow → release; cancellation of
  a funded booking → routed to admin dispute queue (never auto-refunded).
  `Postpaid` bookings are untouched by this design — they're paid after
  the event happens, which doesn't fit an upfront-escrow model, and keep
  today's existing `payment_status` flow.

### Explicitly out of scope (future phases)
- **Fiat on/off-ramp.** How USDT/USDC actually gets into an organizer's
  custodial wallet, or how a talent converts it back to VND, is not
  designed here. Assumed: wallets are funded by some external transfer, and
  talents withdraw stablecoin out via a simple send-to-external-address
  action. A VND↔stablecoin bridge is a separate future project.
- **Cloud KMS.** Private keys are encrypted app-side (AES-256-GCM, master
  key from an env secret) for this phase. The encryption layer is built
  behind a `KeyEncryptionProvider` interface specifically so a
  `CloudKmsKeyProvider` can replace it later with no call-site changes —
  see [Key storage](#wallet-custody-service).
- **Multisig admin/upgrade authority.** Admin and upgrade permissions are
  held by a single backend-controlled EOA for this phase (explicit
  single-point-of-failure trade-off, accepted for now). Migrating to a
  Gnosis Safe later is a role-reassignment, not a contract change.
- **Partial-split dispute resolution.** Admin resolution is binary — full
  refund to organizer, or full release to talent (minus platform fee). No
  proportional splits.
- **Non-EOA / account-abstraction wallets.** Custodial wallets are plain
  EOAs. A user who exports their key gains a raw private key with no
  revocability; smart-contract wallets are not part of this phase.

## Architecture overview

```
Organizer/Talent (custodial wallet, key held by platform)
        │ (backend signs meta-tx on their behalf)
        ▼
   ERC2771Forwarder  ◄── Relayer wallet (pays AVAX gas, platform-owned)
        │ (verifies EIP-712 signature, forwards call,
        │  sets real signer as _msgSender())
        ▼
   EscrowManager (UUPS proxy)  ──holds──►  USDT/USDC per bookingId
        ▲
        │ (direct call — platform-owned identity, no relay needed)
   Admin EOA / Operator EOA (registerBooking, dispute resolution)
```

Four independently-testable pieces:
1. **`EscrowManager`** — the contract holding funds and enforcing the state
   machine.
2. **Wallet custody service** — generates and stores keys, offers export.
3. **Relayer** — moves organizer/talent-signed actions on-chain without
   them ever holding gas.
4. **App integration** — Supabase schema, event indexer, admin UI, and the
   hooks into the existing booking flow that call into 1–3.

## Smart contract: `EscrowManager`

**Pattern**: `UUPSUpgradeable` + `AccessControlUpgradeable` +
`ReentrancyGuardUpgradeable` + `PausableUpgradeable` +
`ERC2771ContextUpgradeable`. The trusted forwarder address is an immutable
set in the implementation contract's constructor, pointing at an
unmodified, standard OpenZeppelin `ERC2771Forwarder` (not itself upgradeable
— low-complexity, low-change-risk infrastructure; if it ever needs to
change, deploy a new implementation with a new immutable and upgrade the
proxy to it).

**Roles** (`AccessControl`):
- `DEFAULT_ADMIN_ROLE` — grant/revoke roles, authorize upgrades
  (`_authorizeUpgrade`). Held by the admin EOA.
- `ADMIN_ROLE` — dispute resolution (`refundOrganizer`,
  `releaseToTalent` override). Held by the same admin EOA today; kept as a
  distinct role so it can be reassigned (e.g. to a multisig) later without
  a contract change.
- `OPERATOR_ROLE` — registers new escrows with their locked-in terms. Held
  by the backend's platform operator key (may be the same EOA as admin
  initially).
- No blanket organizer/talent role — those identities are per-booking
  addresses checked against that booking's own escrow record.

**Per-booking state**:
```solidity
enum State { None, Registered, Funded, Released, Refunded }

struct Escrow {
    address organizer;
    address talent;
    address token;    // USDT or USDC address, fixed per escrow
    uint256 amount;    // total deposit required, smallest token unit
    uint16  feeBps;     // platform commission, applied only on release, 0-10000
    State   state;
}

mapping(bytes32 => Escrow) public escrows; // key = Supabase booking UUID,
                                            // right-padded to bytes32
```

**Functions**:
- `registerBooking(bytes32 bookingId, address organizer, address talent, address token, uint256 amount, uint16 feeBps)`
  — `onlyRole(OPERATOR_ROLE)`, `whenNotPaused`. Requires `state == None`,
  `feeBps <= 10000`, `amount > 0`. Sets `state = Registered`. Locks in
  parties and commission *before* any money moves, so the organizer's
  later `deposit()` call can't alter them.
- `deposit(bytes32 bookingId)` — callable only by `escrows[bookingId].organizer`
  (checked against `_msgSender()`, so it works through the forwarder).
  Requires `state == Registered`. Pulls `amount` via
  `transferFrom(organizer, address(this), amount)` — organizer must have
  approved the contract beforehand (also relayed). Sets `state = Funded`.
  Emits `Deposited(bookingId)`.
- `releaseToTalent(bytes32 bookingId)` — callable by
  `escrows[bookingId].organizer` **or** `ADMIN_ROLE`. Requires
  `state == Funded`. Computes `fee = amount * feeBps / 10000`, transfers
  `amount - fee` to `talent` and `fee` to `platformFeeRecipient`. Sets
  `state = Released`. Emits `Released(bookingId, fee)`. The contract, not
  the caller, computes the split from the immutable `feeBps` stored at
  registration — no way for a release call to shortchange the platform fee.
- `refundOrganizer(bytes32 bookingId)` — `onlyRole(ADMIN_ROLE)` only (never
  the organizer — the whole point of escrow is the organizer can't pull
  their own money back once locked). Requires `state == Funded`. Transfers
  full `amount` to `organizer`. Sets `state = Refunded`. Emits
  `Refunded(bookingId)`.
- `setPlatformFeeRecipient(address)` — `DEFAULT_ADMIN_ROLE`.
- `pause()` / `unpause()` — `DEFAULT_ADMIN_ROLE`. Pausing blocks
  `registerBooking`/`deposit` only — **never** `releaseToTalent` /
  `refundOrganizer` on an already-funded escrow, so a pause can never trap
  organizer funds mid-dispute.
- `_authorizeUpgrade(address)` — `onlyRole(DEFAULT_ADMIN_ROLE)`.

`nonReentrant` on `deposit` / `releaseToTalent` / `refundOrganizer`
(defense in depth even with standard ERC20 transfers). No sweep/rescue
function for arbitrary tokens — avoids an admin backdoor that isn't part of
the stated flow; the contract never holds value outside an `Escrow`
record's accounted amount.

## Wallet custody service

New Supabase table `wallets`:

| column | notes |
|---|---|
| `id` | uuid pk |
| `user_id` | nullable — null for platform wallets |
| `label` | nullable: `'admin' \| 'operator' \| 'relayer' \| 'fee_recipient'`, set only for platform wallets |
| `chain` | `'avalanche'` |
| `address` | unique |
| `encrypted_private_key` | jsonb: `{iv, authTag, ciphertext, keyVersion}` |
| `exported_at` | nullable timestamptz |
| `created_at` | timestamptz |

The base table has **no RLS policy granting any authenticated role
access** — only the server-side service-role key can read/write it. A
`wallet_addresses` view (`id, user_id, address, chain`) with an
own-row-only RLS policy lets the frontend show a user their own address
without ever exposing key material through PostgREST.

**Generation**: eager, at signup. Extends the existing `handle_new_user`
trigger flow (which already creates the `profiles` row) to also provision a
wallet for `organizer`/`talent` roles. Keypair generation is local and free
(no on-chain transaction needed to "create" a wallet).

**Key storage**: a `KeyEncryptionProvider` interface (`encrypt`/`decrypt`).
Ships now as `AppLevelKeyProvider` — AES-256-GCM, master key from a
`WALLET_MASTER_KEY` secret (resolves the placeholder in
`.claude/rules/env-secrets.md`, updated alongside this spec to document the
approach and the KMS migration path). A `CloudKmsKeyProvider` implementing
the same interface is the documented future swap-in.

**Export**: a re-authentication-gated endpoint (requires a fresh Supabase
session) decrypts and returns the raw key once, sets `exported_at`, and
audit-logs the event. The platform continues signing on the user's behalf
afterward for convenience; the UI notes the key is now also in the user's
hands (raw EOA export has no revocability — this is a known, accepted
limitation of this phase, see Scope).

**Platform wallets** (admin, operator, relayer, fee recipient) are rows in
the same table with `user_id = null` and a `label`, created once via a
setup script, not tied to Supabase auth.

## Gas-sponsorship relayer

Only the **organizer-signed** actions need relaying: ERC20 `approve()` and
`deposit()`/organizer-initiated `releaseToTalent()`. Admin/operator actions
(`registerBooking`, admin's `refundOrganizer`/`releaseToTalent`) are called
**directly** by the operator/admin wallets — those are platform-owned
identities with nothing to mask, and just hold a small, ops-topped-up AVAX
balance.

`src/lib/chain/relayer.ts` — `relayAsUser(userId, calldata)`:
1. Decrypt the user's private key in-memory (never logged, never sent to a
   client).
2. Read the current nonce from the `ERC2771Forwarder`, build and EIP-712
   sign a `ForwardRequest`.
3. Discard key material.
4. Submit `forwarder.execute(request, signature)` signed by the **relayer**
   wallet, which pays AVAX gas.
5. Return the tx hash. The UI treats the action as pending until the
   indexer (below) confirms it — no optimistic success state.

A scheduled balance check (Vercel Cron) alerts when the relayer or
operator/admin wallets drop below an AVAX threshold. Sponsorship failing is
loud (transactions simply fail) — there is no fallback to asking a user to
pay their own gas.

## Data model (Supabase)

- `package_bookings` gains: `escrow_booking_id` (bytes32 hex, derived from
  the booking UUID), `escrow_state`
  (`'none' | 'registered' | 'funded' | 'released' | 'refunded'`, default
  `'none'`), `commission_bps_snapshot`.
- `profiles` gains `commission_bps` (admin-editable per talent; used at
  `registerBooking` time, then snapshotted onto the booking).
- New `escrow_events` table (`booking_id, event_type, tx_hash,
  block_number, created_at`) — populated by a polling indexer.
- New `admin_users` allowlist table (`user_id` pk, `granted_at`) — gates
  the new admin surface. Not a new `role_type` enum value: admin is an
  internal ops concept, not a marketplace-facing role, so it doesn't belong
  in the same enum as `organizer`/`talent`/`agency`.

**Indexer**: `src/lib/chain/indexer.ts`, invoked by a Vercel Cron route.
Polls `getLogs` on `EscrowManager` since the last processed block (tracked
in a small config table), upserts `escrow_events`, and updates
`package_bookings.escrow_state`. This indexer — not the submitting call's
return value — is the source of truth for `escrow_state`; there are no
optimistic DB writes on tx-submit. (A persistent `watchContractEvent`
listener isn't a good fit for this app's serverless/Vercel deployment,
hence polling.)

## Flow wiring into existing booking lifecycle

- **Talent accepts a Prepaid booking** → `registerBooking` (operator,
  direct call), auto-creating wallets for organizer/talent if missing,
  `commission_bps` snapshotted from `profiles`.
- **New "Deposit Funds" step** in checkout/order-detail → `relayAsUser`
  (approve-if-needed, then `deposit`).
- **Existing dual-confirmation Mark Complete flow**
  (`talent_marked_complete_at` + organizer's final confirm, from
  `20260808100512_talent_marked_complete.sql`) → organizer's confirm step
  additionally triggers `releaseToTalent` via `relayAsUser`.
- **Cancellation of a funded booking** never auto-refunds — it routes into
  the admin dispute queue instead, since only admin can decide the outcome
  of a cancellation (organizer-cancel vs. talent-cancel have different
  fairness implications, and this design keeps that a human call).

## Admin surface

New `src/app/admin/` route group, gated server-side by membership in
`admin_users` (not `role_type`). Provides:
- Dispute queue: bookings with `escrow_state = 'funded'` and a cancellation
  flag — actions to release-to-talent or refund-organizer (direct
  operator/admin wallet calls, no relay needed).
- Per-talent commission-rate editor (writes `profiles.commission_bps`).

## Error handling & security

- On-chain call failures (revert, relay failure) surface as explicit
  errors (toast + log) — never a silent partial-success DB write.
- The contract's `state` guards make retries safe after an
  unknown-outcome transaction: a revert due to wrong state means the
  backend resyncs from chain rather than treating it as a hard failure.
- Private keys are decrypted only in-memory, per-operation, never logged,
  never sent to a client. Export requires re-authentication and is
  audit-logged.
- `WALLET_MASTER_KEY` rotation and the KMS migration path are noted in
  `.claude/rules/env-secrets.md`.
- Relayer/operator/admin AVAX balances are actively monitored; running dry
  fails loudly (transactions fail) rather than degrading silently.

## Testing

- **Contract** (Foundry or Hardhat): role checks per function; full
  state-machine transition coverage including reverts on wrong state; fee
  math including rounding at `feeBps` boundaries (0 and 10000); reentrancy
  attempt; pause blocks registration/deposit but not release/refund;
  storage-layout-safe upgrade test (OZ upgrades plugin).
- **Backend**: `KeyEncryptionProvider` encrypt/decrypt round-trip and
  tamper detection (corrupted `authTag` must fail to decrypt); relayer
  meta-tx construction against a mocked chain client; indexer event → DB
  state mapping.

Per this repo's TDD rule, each of the above starts RED (failing test) before
implementation.
