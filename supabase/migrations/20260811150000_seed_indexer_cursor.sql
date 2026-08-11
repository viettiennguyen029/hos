-- Seed the escrow event indexer's cursor at the EscrowManager contract's
-- actual deployment block on Avalanche, instead of 0 -- starting at 0 on
-- a live chain exceeds every RPC provider's eth_getLogs range cap on the
-- very first poll and wedges the indexer permanently (flagged by the
-- final whole-branch review of
-- docs/superpowers/plans/2026-08-11-app-integration.md).
update public.escrow_indexer_state set last_processed_block = 57703642 where id = true;
alter table public.escrow_indexer_state alter column last_processed_block set default 57703642;
