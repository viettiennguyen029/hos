# Secrets & Environment Variables

`.env` is a **temporary, gitignored file** — never a source of truth.

## Rules

- **Never hardcode secrets** in `.env`, source files, or commits
- **Never symlink or copy** `.env` from another checkout — each worktree
  generates its own
- <Fill in once you pick a secret store: "Always generate `.env` by running
  `bash scripts/onboard.sh`, which pulls from <AWS SSM / GCP Secret Manager /
  Doppler / 1Password>.">
- **Regenerate** whenever secrets change or a new worktree is created

## Secret storage hierarchy (fill in once decided)

| Location | Purpose |
|----------|---------|
| <your secret store> (e.g. AWS SSM Parameter Store) | Primary — all secrets live here |
| `.env` (local only) | Ephemeral — generated from the secret store, never committed |
| CI secrets (e.g. GitHub Actions secrets) | For pipeline credentials |

## Skip this rule when

- Working on non-secret config (ports, feature flags, public URLs)
- Reading or explaining code — no `.env` changes needed

## Blockchain wallet key encryption (`WALLET_MASTER_KEY`)

Custodial wallet private keys (see
`docs/superpowers/specs/2026-08-10-blockchain-escrow-payment-design.md`)
are encrypted at rest with AES-256-GCM using a single master key read from
the `WALLET_MASTER_KEY` env var — an interim choice made explicitly
because this project has not yet picked a cloud secret store (see the
placeholder above). Access is behind a `KeyEncryptionProvider` interface so
this can be swapped for a `CloudKmsKeyProvider` (AWS/GCP KMS envelope
encryption) later with no call-site changes. Until then,
`WALLET_MASTER_KEY` is itself the single highest-value secret in the
system — treat its rotation and access the same way you would a root
credential, and never let it touch a client bundle or log line.
