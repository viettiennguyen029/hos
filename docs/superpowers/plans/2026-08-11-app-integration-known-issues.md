# Blockchain Escrow Payment — Known Issues / Follow-ups

Tracks everything found during Plan 4's final whole-branch review and
per-task reviews that was consciously **deferred**, not fixed. The 3
Critical bugs from that review (unpersisted `escrow_booking_id`, the
relayed-`approve` allowance bug, `isPaid` misclassifying unfunded
bookings) are already fixed and re-reviewed clean — not listed here.

Source: final whole-branch review in
`.superpowers/sdd/2026-08-11-app-integration/progress.md`, plus
per-task review notes in the same ledger.

## Important — should fix before wider rollout

- **Silent 10% fee fallback on commission lookup failure.**
  `src/lib/supabase/package-actions.ts` (`confirmBookingOffer`'s crypto
  block) — `feeBps: talentProfile?.commission_bps ?? 1000`. The
  `Promise.all` entry that fetches `commission_bps` discards its query
  `error`, so a DB error silently falls back to a hardcoded 10% fee
  written immutably on-chain, defeating Task 15's whole point (admin
  per-talent commission control) at the one moment it's consumed. Per
  `no-silent-fallbacks`, should throw instead (the enclosing `try`
  already treats a throw as a best-effort skip, matching existing
  behavior for other failures in that block).

- **No way to notice a crypto booking stuck at `escrow_state: 'none'`.**
  If `confirmBookingOffer`'s on-chain registration silently fails
  (caught, logged via `console.error`, never re-surfaced), the booking
  has no admin view, cron, or alert that ever catches it — the dispute
  queue's filter (`escrow_state = 'funded'`) doesn't cover this state.
  Cheapest fix: widen the admin dispute page (or a sibling view) to also
  list `payment_channel = 'crypto' AND escrow_state = 'none' AND status
  IN ('confirmed', 'completed')`.

- **No pending-state UI between deposit submission and indexer
  confirmation.** `src/components/account/order-detail-content.tsx`
  (`handleDeposit`) toasts success and calls `router.refresh()`
  immediately, but `escrow_state` won't flip to `'funded'` until the
  next indexer poll (up to 5 minutes — see `vercel.json`'s cron
  schedule). The Deposit button re-renders enabled right below the
  success toast, inviting a second click that relays a second
  `deposit()` — funds are safe (the contract's state machine reverts
  it), but it wastes relayer gas and surfaces a raw revert string as a
  toast error. Needs an intermediate "awaiting confirmation" state
  (e.g. an `escrow_tx_hash` column, or a client-side "just submitted"
  flag) between click and the next successful indexer poll. Same shape
  affects the admin dispute queue after a resolution (see Minor below).

- **Indexer has no range-chunking for `eth_getLogs`.** The cursor is now
  seeded at the contract's actual deploy block (fixed), so the initial
  catch-up poll is small — but there's still no protection against a
  *future* large gap (e.g. the cron stops firing for an extended
  period, or a burst of on-chain activity accumulates many blocks
  between polls) exceeding an RPC provider's range cap and wedging the
  indexer again. `src/lib/chain/escrow-indexer.ts`'s `pollEscrowEvents`
  issues one unchunked `getLogs` call per event name across the whole
  `[fromBlock, toBlock]` span.

- **`escrow_events` has no dedup constraint.** If a poll throws partway
  through (e.g. Supabase write failure on event N of M), the cursor
  isn't advanced and the same block range gets reprocessed on retry —
  re-inserting already-recorded `escrow_events` rows (`escrow_state`
  itself stays correct/idempotent, so this is an audit-trail
  duplication issue, not a money-safety one). A unique index on
  `(tx_hash, event_type)` would close this — cheap to bundle into
  whichever migration eventually adds the range-chunking above.

- **`isCurrentUserAdmin` discards the `wallets`/`admin_users` query
  `error`.** `src/lib/supabase/admin.ts` — a real backend error (RLS
  misconfig, network blip) is indistinguishable from "not an admin" and
  resolves to `false` with no log line. Fail-closed (not a security
  bypass), but now load-bearing since Tasks 14/15 stacked money-moving
  admin actions on top of this gate — an admin locked out during an
  incident gets no diagnostic signal.

- **No Hardhat-level test proving a real viem-signed permit is accepted
  by the actual token contract.** `src/lib/chain/sign-permit.ts` is only
  proven correct via JS-side `recoverTypedDataAddress` checks; the final
  reviewer independently closed this gap by reading OpenZeppelin's
  `ERC20Permit.sol` source and confirming an exact match, so this is a
  coverage hole rather than a known defect. Recommended: one Hardhat
  test in `contracts/test/` that signs a permit and calls
  `MockERC20.permit()` directly, mirroring the existing meta-transaction
  test.

## Minor — nice-to-have / cosmetic

- `commission_bps_snapshot` column (added in Task 1's migration, guarded
  by the same trigger as the other escrow fields) is never written or
  read anywhere. Either wire it up alongside the fee-fallback fix above,
  or drop it — an unwritten guarded column reads as "the snapshot
  exists" to the next person who looks.
- Admin pages (`src/app/admin/disputes/page.tsx`,
  `src/app/admin/commissions/page.tsx`) both do `const { data } = await
  ...` and render `(data ?? [])` — a failed query renders as "No open
  disputes"/an empty list, indistinguishable from genuinely zero results
  on the one surface whose entire purpose is finding stuck funds.
- The dispute queue's Supabase query fetches
  `organizer:profiles!package_bookings_organizer_id_fkey(full_name)` but
  never renders it. Either display it (genuinely useful there) or drop
  the join.
- `VND_PER_USDT` can drift between `confirmBookingOffer` (registers the
  on-chain amount) and `depositBookingEscrow` (independently recomputes
  the same conversion for the permit/deposit amount) if the env var
  changes in between — the deposit would then not match the registered
  amount and revert. Fix: read the registered amount back from the
  contract (`escrows[bookingId].amount`) instead of recomputing, or
  snapshot the token amount alongside `escrow_booking_id`.
- Resolved admin disputes linger in the queue (both action buttons still
  live) until the next indexer poll re-syncs `escrow_state` — up to 5
  minutes. Same root cause as the deposit pending-state gap above.
- `getTalentWalletForBooking` and `organizerMarkComplete`'s
  `escrow_booking_id as \`0x${string}\`` casts (Tasks 11/12/14) are
  unchecked, but are now provably safe now that Bug A guarantees
  `escrow_booking_id` is always populated whenever `escrow_state` could
  reach `'registered'`/`'funded'` — no longer a real risk, just an
  unchecked-cast style note.
- `paymentChannel` in `checkoutCart` is derived via a bare `as` type
  assertion, not a runtime-validated parse — acceptable since an invalid
  value fails loud via the DB's check constraint.
- ABI structural tests (`erc20.test.ts`, `escrow-manager.test.ts`) assert
  shape (types/counts/mutability), not exact field names — fine unless
  these generated/hand-written files are ever edited without also
  updating the tests.
- `vndToTokenAmount` does float division before rounding to a bigint —
  negligible risk for realistic VND price ranges, hand-traced correct.
- Several direct on-chain calls pass `chain: null` to `writeContract`
  (vs. `chain: publicClient.chain` used elsewhere), causing a harmless
  extra `eth_chainId` RPC round-trip per call.
- No test coverage for Supabase error/not-found paths or `writeContract`
  rejection in `registerEscrowBooking`/`releaseEscrowAsAdmin`/
  `refundEscrowAsAdmin` — mirrors pre-existing relayer test scope.
- `readContract`'s bigint return casts throughout `src/lib/chain/*` are
  unchecked (viem's generic typing forces some cast either way).
- `.env.example`'s `CRON_SECRET` comment still only mentions
  `check-relayer-balance`, now stale since it also gates
  `poll-escrow-events`; the cron routes' 401 comparison isn't
  timing-safe (matches a pre-existing sibling pattern, not a
  regression).
- `PackageBookingRow`'s `escrow_state`/`payment_channel`/
  `escrow_booking_id` fields are typed optional even though
  `escrow_state` is DB `NOT NULL DEFAULT 'none'` — deliberate, to avoid
  touching unrelated test fixtures; current code treats `undefined` the
  same as `'none'` (fail-closed), so no live bug.
- Task 15's commission input has no client-side bound clamping (server
  check is authoritative and covered); `Number("")` → `NaN` passes the
  `< 0 || > 10000` guard (both comparisons are `false` for `NaN`), so a
  blanked input could attempt to write `commission_bps: NaN` — caught at
  the DB's `NOT NULL` constraint (fails loud), not silently wrong.
- `depositEscrow`'s permit branch passes `params.organizerAddress` as
  the on-chain `owner` arg while the signature's owner is
  `organizerAccount.address` — nothing asserts they're structurally
  equal (in practice always true, and a divergence would revert loudly
  via `ERC2612InvalidSigner`).
- `signPermit`'s EIP-712 domain `name` is read from the token's own
  `name()`, assuming that equals its EIP-712 domain name — true for
  OpenZeppelin `ERC20Permit` and most real tokens, but not guaranteed;
  no override exists for a non-conforming token.
- `src/lib/supabase/package-actions.test.ts`'s `depositEscrow` mock
  still returns a stale `approveTxHash: null` field (renamed to
  `permitTxHash` in the real return type) — harmless since the
  production caller discards the return value, but misdescribes the
  interface for the next person who touches that test.
- `depositEscrow`'s permit branch reads the token's `nonces()` and
  `name()` sequentially instead of concurrently, and `name()` is
  invariant per token so it could be cached/read once — negligible
  unless deposit latency becomes a concern.
