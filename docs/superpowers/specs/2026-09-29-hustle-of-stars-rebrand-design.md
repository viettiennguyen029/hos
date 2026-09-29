# Hustle of Stars — Brand & Product Redesign

## Problem

The product formerly known as "Heart of Stars" (HOS) is repositioning from
an artist-career platform to "Hustle of Stars" — a side-hustle marketplace
where performers (singers, DJs, MCs, photographers, etc.) earn extra
income, rather than pursue an artist career. The current app has a dark,
red-on-black visual identity that reads as moody/exclusive/artist-branded,
which no longer fits the "everyday extra income" positioning. There is
currently no public marketing/landing page — the app redirects straight
from `/` to `/sign-in` for unauthenticated visitors — and copy throughout
is purely transactional with zero positioning or value-prop language
anywhere in the product.

This spec defines the new brand, visual system, and information
architecture so the app's look, name, and messaging consistently reflect
the new positioning.

## Current state (verified against the codebase)

- **Colors** — `src/app/globals.css`, Tailwind v4 `@theme inline` + shadcn
  tokens. The app is forced into `.dark` via `className="dark ..."` in
  `src/app/layout.tsx`. Key tokens: `--background: #000000`,
  `--foreground: #ffffff`, `--card`/`--popover: #0c0c0c`,
  `--primary`/`--destructive: #db382c` (the same red serves both roles — a
  design smell), `--secondary`/`--muted`/`--accent: rgba(255,255,255,0.05)`,
  `--border`/`--input: rgba(255,255,255,0.15)`,
  `--ring: rgba(219,56,44,0.5)`, `--radius: 0.625rem`. Font: Google "Be
  Vietnam Pro" (`--font-sans` = `--font-heading`). The `--sidebar-*` tokens
  still hold stale light-theme-era blue oklch values, unused and orphaned
  from an earlier design.
- **Branding** — `src/app/layout.tsx` metadata is internally inconsistent:
  `title: "HOS"`, `description: "Heart of Show"` (doesn't even match
  "Heart of Stars"). `README.md` says "HOS — Heart of Stars". Logo at
  `public/brand/logo.svg`: "HOS" wordmark in off-white (`#F5F5F5`) plus a
  geometric star mark in red (`#DB382C`) and light pink (`#E89290`).
- **No marketing page** — `src/app/page.tsx` redirects signed-in users to
  `/${role}`, everyone else straight to `/sign-in`. The `(auth)` route
  group (sign-in/sign-up/forgot-password) is the only public surface today.
- **Roles** — `src/app/{organizer,talent,agency,admin}/`. Talent and
  agency share `EventHomeContent`; organizer uses `HomeContent`. Sign-up
  copy (`src/app/(auth)/sign-up/page.tsx`) is purely functional: "Create
  talent account to find and apply events", etc. — no positioning language
  exists anywhere in the app today.

## Scope

### In scope
- Brand naming/positioning language (tagline direction, per-role copy
  re-framing)
- Full light-first color token system replacing the dark/red palette
- A new public marketing/landing page (none exists today)
- Logo recolor requirement
- Copy passes on sign-up, sign-in, talent home, organizer home

### Explicitly out of scope
- Renaming or restructuring the organizer/talent/agency role model — roles
  stay as-is, only their copy changes
- A dark-mode toggle — not a requested feature; the old dark theme is
  dropped, not preserved as an option
- Component-level / pixel-level screen redesigns — this spec defines the
  system (tokens, IA, positioning); a follow-up implementation plan
  enumerates file-by-file changes
- Actual SVG artwork for the recolored logo — this spec states the
  requirement; producing the asset is implementation-time work

## 1. Brand & positioning

- **Name**: "Hustle of Stars", abbreviated **HOS** in compact UI chrome
  (favicon, nav wordmark) — same abbreviation as before, so it doesn't need
  to change everywhere in the UI. All metadata must become internally
  consistent (fixing the current `"HOS"` / `"Heart of Show"` mismatch) to
  read "Hustle of Stars".
- **Tagline direction**: something in the family of *"Turn your talent into
  extra income"* or *"Your skills. Your schedule. Extra income."* —
  emphasizes flexibility and side-income over "career."
- **Role copy re-framing** (structure unchanged, only language changes):
  - **Talent** — shift from "find and apply to events" (career framing) to
    something like "Pick up gigs that fit your schedule, get paid"
    (side-income framing). This is the primary framing shift in the
    product, since talent/performers are the primary user this redesign is
    built for.
  - **Organizer** — "Book talent for your event" — stays close to current
    copy, low change needed.
  - **Agency** — "Manage your roster and book more gigs" — light tweak.

## 2. Visual system

Replace the token block in `src/app/globals.css` (light-first, single
accent color):

| Token | Current | Proposed |
|---|---|---|
| `--background` | `#000000` | `#FFFFFF` (or a very light warm gray, e.g. `#FFFBF8`) |
| `--foreground` | `#ffffff` | near-black, e.g. `#1A1512` |
| `--primary` | `#db382c` (red) | warm orange/coral, e.g. `#FF6B35` |
| `--destructive` | same red as primary | a **separate**, distinct red, e.g. `#E5484D` (fixes the primary/destructive collision) |
| `--card` / `--popover` | `#0c0c0c` | `#FFFFFF` with a subtle border/shadow |
| `--secondary` / `--muted` / `--accent` | `rgba(255,255,255,.05)` overlays | light warm-gray fills, e.g. `#F5F1ED` |
| `--border` / `--input` | `rgba(255,255,255,.15)` | light border, e.g. `#E8E2DC` |
| `--ring` | translucent red | translucent orange |
| Font | Be Vietnam Pro | unchanged — already modern and readable, no reason to swap |

Additional changes:
- Remove `.dark` forcing in `src/app/layout.tsx` (drop `"dark"` from the
  `<html className="dark ...">` string) — the app becomes light-only, no
  dark-mode toggle.
- The stale `--sidebar-*` blue oklch leftovers in `globals.css` are
  pre-existing dead code, unrelated to this rebrand; flag them for the
  implementer's awareness rather than silently deleting them as part of
  this change.
- **Logo** — `public/brand/logo.svg` needs at minimum a recolor: the star
  mark moves to the new orange accent, and the wordmark flips from
  off-white to dark since the background flips from black to white.

## 3. Information architecture — new public landing page

Today, `src/app/page.tsx` immediately redirects unauthenticated visitors to
`/sign-in` with zero public content. The new landing page replaces that for
unauthenticated visitors; signed-in users continue to redirect straight to
their role dashboard as they do today.

- **Hero** — headline (tagline), subhead, primary CTA ("Get Started" →
  sign-up), secondary CTA ("Sign In")
- **How it works** — 3 short steps aimed at the talent side (e.g. "1.
  Create your profile → 2. Get booked → 3. Get paid"), since talent is the
  primary user
- **Categories / social proof strip** — the kinds of gigs available
  (singing, DJing, MC, photography, etc.) to make "side hustle" concrete
  rather than abstract
- **Footer** — sign-in/sign-up links, plus an organizer/agency callout
  ("Hosting an event? Book talent →")

Structural change: a new route (e.g. `src/app/(marketing)/page.tsx` or a
similar route-group split) hosts this content; the existing auth-redirect
logic in `page.tsx` continues to apply only to already-authenticated
visitors.

## 4. Key app screens affected

Because color tokens are centralized in `globals.css` and shadcn/radix
components consume them via CSS variables, most of the app (dashboards,
forms, cards) inherits the new light theme without component-by-component
redesign. Screens needing copy/content changes beyond the palette swap:

- **Sign-up account-type step** (`src/app/(auth)/sign-up/page.tsx`) —
  update the 3 role descriptions per Section 1.
- **Sign-in page** — minor copy tone pass, low priority.
- **Talent home** (`EventHomeContent`, shared with agency) — copy /
  empty-state pass toward "gigs near you" / earnings framing rather than
  "events" framing. Component internals are not redesigned here — that's
  implementation-plan-level detail.
- **Organizer home** (`HomeContent`) — light copy pass only.

## Verification

- New light-theme tokens render correctly across the sign-in/sign-up flow
  and each role's home screen (manual check in the browser).
- No leftover references to the old red (`#db382c`) or black background
  remain in `globals.css` after the change (besides the already-orphaned,
  intentionally-untouched `--sidebar-*` values, which get called out in
  the PR description).
- `layout.tsx` metadata reads "Hustle of Stars" consistently (title +
  description).
- The landing page renders for a signed-out visitor at `/`, and a
  signed-in visitor still lands on their existing role dashboard.
- `bun run build` and `bun run lint` pass.
