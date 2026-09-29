# Hustle of Stars Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the app from "Heart of Stars" (dark, red-on-black, artist-career framing) to "Hustle of Stars" (light, warm-orange accent, side-income framing), including a new public landing page and consistent brand copy.

**Architecture:** The app's color system lives entirely in CSS custom properties in `src/app/globals.css`, consumed by shadcn/radix components via Tailwind's `@theme inline` mapping. The `:root` block already holds unused light-theme boilerplate; we overwrite it with the new brand palette and stop forcing `.dark` in `src/app/layout.tsx`, so the whole app repaints from dark to light through one file. However, ~40 custom (non-shadcn) components were hand-styled with hardcoded `bg-white/N`, `hover:bg-white/N`, and `border-[rgba(255,255,255,...)]` utility classes that assumed a black background — these render as invisible or broken on a white background and must be converted to semantic token classes (`bg-muted`, `hover:bg-accent`, `border-border`) file by file. A small number of `bg-black/N` + `text-white` overlays are intentional image-caption scrims (dark gradient behind light text, for legibility over a photo) and are explicitly preserved, not converted. A new marketing route is added ahead of the existing auth-redirect for signed-out visitors, and remaining "Heart of Stars" / "Heart of Show" copy is corrected to "Hustle of Stars" throughout.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4 (`@theme inline`), shadcn/radix UI, bun test + Testing Library (happydom).

**Spec:** `docs/superpowers/specs/2026-09-29-hustle-of-stars-rebrand-design.md`

## Global Constraints

- Package manager is bun — never npm/yarn/pnpm.
- New/changed color values: background `#FFFFFF`, foreground `#1A1512`, primary `#FF6B35`, destructive `#E5484D` (must differ from primary — current bug is both are `#db382c`), muted/secondary/accent fill `#F5F1ED`, border/input `#E8E2DC`, ring `rgba(255,107,53,0.5)`. Exact values from spec Section 2.
- No dark-mode toggle — `.dark` class is dropped from `<html>`, not made conditional.
- Brand name everywhere in copy/metadata: "Hustle of Stars" (fixing existing "HOS" / "Heart of Show" / "Heart of Stars" inconsistencies). "HOS" remains acceptable only as a compact abbreviation in tight UI chrome (nav wordmark, favicon), not in body copy or metadata description.
- Role structure (organizer/talent/agency/admin) is unchanged — only copy changes, no renaming or route changes to roles.
- Every new/modified source file needs a passing sibling test before commit (repo's pre-commit hook blocks otherwise) — `bun run test`, never bare `bun test` (mock leakage across files).
- `bg-black/N` + `text-white` image-caption overlays (dark gradient scrim behind text over a photo) are intentional and must NOT be converted — only page-chrome `bg-white/N` "panel" and "hover" fills convert to tokens.
- Typecheck (`bun run build` or project's typecheck script) and `bun run lint` must pass before each commit that touches `.tsx`/`.ts` files.

## Review Focus

- **Hardcoded-color conversions accidentally touching intentional dark-overlay scrims** — a reviewer should check that `bg-gradient-to-t from-black`, `bg-black/40`–`bg-black/60` on image captions, and their paired `text-white` were left untouched in every file in Tasks 4–7, not just spot-checked.
- **`--destructive` still equal to `--primary` after the token swap** — the current bug (`#db382c` doing double duty) must not reappear with the new orange; a delete confirmation dialog rendered in orange instead of red is a real regression a user could hit.
- **Landing page rendering for a signed-in visitor** — since `/` now branches on auth state, an authenticated user hitting `/` must still redirect straight to `/${role}` and never see the new marketing page; this is easy to get backwards when adding the new route.
- **Contrast/legibility of the new palette on hover/disabled states** — `hover:bg-accent`/`disabled:opacity-40` combinations that looked fine as white-on-black may be too low-contrast as light-gray-on-white; Task 8's manual browser check must include hover and disabled states, not just resting state.
- **Sign-up copy string changes breaking existing test assertions** — `sign-up/page.test.tsx` and `sign-in/page.test.tsx` query by visible text/placeholder in places; Task 3's copy changes must be checked against those existing tests, not just the new ones being added.

---

## Task 1: Color token system — light-first palette

**Files:**
- Modify: `src/app/globals.css:50-83` (the `:root` block)
- Test: `src/app/globals.test.ts` (new)

**Interfaces:**
- Produces: CSS custom properties `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--border`, `--input`, `--ring` on `:root`, consumed by every later task via Tailwind utility classes (`bg-background`, `text-foreground`, `bg-primary`, `bg-muted`, `hover:bg-accent`, `border-border`, etc.) and by shadcn components directly.

Since this is CSS, "test" means a lightweight assertion that the values landed correctly, parsed out of the source file — there's no runtime CSS test harness in this repo, so we assert against the file contents directly (this is the same spirit as testing a JSON config file).

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/globals.test.ts
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(import.meta.dir, "globals.css"), "utf-8");

function rootBlock(): string {
  const match = css.match(/:root\s*\{([^}]*)\}/);
  if (!match) throw new Error(":root block not found in globals.css");
  return match[1];
}

describe("globals.css :root theme", () => {
  it("uses a white background and dark foreground", () => {
    const root = rootBlock();
    expect(root).toContain("--background: #FFFFFF");
    expect(root).toContain("--foreground: #1A1512");
  });

  it("uses the new orange primary color", () => {
    expect(rootBlock()).toContain("--primary: #FF6B35");
  });

  it("keeps destructive distinct from primary", () => {
    const root = rootBlock();
    const primaryMatch = root.match(/--primary:\s*(#[0-9a-fA-F]{6})/);
    const destructiveMatch = root.match(/--destructive:\s*(#[0-9a-fA-F]{6})/);
    expect(primaryMatch).not.toBeNull();
    expect(destructiveMatch).not.toBeNull();
    expect(destructiveMatch![1]).not.toBe(primaryMatch![1]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test --isolate src/app/globals.test.ts`
Expected: FAIL — current `:root` still has the shadcn oklch boilerplate, not the new hex values.

- [ ] **Step 3: Replace the `:root` block**

Replace `src/app/globals.css:50-83` with:

```css
:root {
  --background: #FFFFFF;
  --foreground: #1A1512;
  --card: #FFFFFF;
  --card-foreground: #1A1512;
  --popover: #FFFFFF;
  --popover-foreground: #1A1512;
  --primary: #FF6B35;
  --primary-foreground: #FFFFFF;
  --secondary: #F5F1ED;
  --secondary-foreground: #1A1512;
  --muted: #F5F1ED;
  --muted-foreground: #7A6F68;
  --accent: #F5F1ED;
  --accent-foreground: #1A1512;
  --destructive: #E5484D;
  --border: #E8E2DC;
  --input: #E8E2DC;
  --ring: rgba(255, 107, 53, 0.5);
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --radius: 0.625rem;
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}
```

Leave the `.dark` block (`globals.css:85-117`) untouched for this task — it becomes dead/unused CSS once Task 2 removes the `dark` class from `<html>`, and per this repo's surgical-changes rule, pre-existing structure that isn't part of the requested change is flagged, not deleted. Note this in the Task 2 commit message.

`--muted-foreground: #7A6F68` is a new value not in the spec's table (the spec didn't specify it) — chosen as a mid-gray-brown with sufficient contrast against `#F5F1ED` and `#FFFFFF` per WCAG AA for secondary text; verify visually in Task 8.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test --isolate src/app/globals.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/app/globals.test.ts
git commit -m "feat: replace dark red-on-black theme with light warm-orange palette"
```

---

## Task 2: Stop forcing dark mode; fix app metadata

**Files:**
- Modify: `src/app/layout.tsx`
- Test: `src/app/layout.test.tsx` (new)

**Interfaces:**
- Consumes: nothing new (uses existing `Toaster` from `@/components/ui/sonner`).
- Produces: `metadata.title` = `"Hustle of Stars"`, `metadata.description` = `"Turn your talent into extra income"`, `<html>` className without the `dark` token.

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/layout.test.tsx
import { describe, expect, it } from "bun:test";
import RootLayout, { metadata } from "@/app/layout";
import { renderToStaticMarkup } from "react-dom/server";

describe("RootLayout", () => {
  it("sets consistent Hustle of Stars metadata", () => {
    expect(metadata.title).toBe("Hustle of Stars");
    expect(metadata.description).toBe("Turn your talent into extra income");
  });

  it("does not force the dark class on <html>", () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <div>child</div>
      </RootLayout>
    );
    expect(html).not.toContain('class="dark');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test --isolate src/app/layout.test.tsx`
Expected: FAIL — `metadata.title` is currently `"HOS"`, and the rendered `<html>` currently starts its class list with `"dark "`.

- [ ] **Step 3: Update `layout.tsx`**

In `src/app/layout.tsx`, change:

```typescript
export const metadata: Metadata = {
  title: "HOS",
  description: "Heart of Show",
};
```

to:

```typescript
export const metadata: Metadata = {
  title: "Hustle of Stars",
  description: "Turn your talent into extra income",
};
```

And change:

```typescript
    <html
      lang="en"
      className={`dark ${beVietnamPro.variable} h-full antialiased`}
    >
```

to:

```typescript
    <html
      lang="en"
      className={`${beVietnamPro.variable} h-full antialiased`}
    >
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test --isolate src/app/layout.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/app/layout.test.tsx
git commit -m "feat: drop forced dark mode, fix Hustle of Stars metadata"
```

---

## Task 3: Sign-up copy — side-income framing

**Files:**
- Modify: `src/app/(auth)/sign-up/page.tsx:36-75`
- Modify (existing test, verify still passes): `src/app/(auth)/sign-up/page.test.tsx`
- Test: extend `src/app/(auth)/sign-up/page.test.tsx` with new assertions

**Interfaces:**
- Consumes: existing `AccountTypeOption` local component (unchanged signature).
- Produces: nothing consumed by later tasks — this is copy-only.

- [ ] **Step 1: Read the existing test file to know what queries must keep passing**

Run: `cat "src/app/(auth)/sign-up/page.test.tsx"` — confirm which button/placeholder text the existing tests query by (from earlier exploration: `/next step/i` button, `"Organizer Test"` placeholder, `"test@gmail.com"` placeholder, `"••••••••••"` placeholder, `/^sign up$/i` button). None of these are part of the copy this task changes, so the existing tests should be unaffected — but re-run them after the change to confirm (Step 4).

- [ ] **Step 2: Write the failing test for new copy**

Append to `src/app/(auth)/sign-up/page.test.tsx`:

```typescript
describe("SignUpPage account-type copy", () => {
  it("frames the talent account around side income, not career", () => {
    render(<SignUpPage />);
    expect(
      screen.getByText(/pick up gigs that fit your schedule/i)
    ).toBeInTheDocument();
  });

  it("keeps organizer and agency descriptions close to current copy", () => {
    render(<SignUpPage />);
    expect(screen.getByText(/book talent for your event/i)).toBeInTheDocument();
    expect(screen.getByText(/manage your roster and book more gigs/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun run test --isolate "src/app/(auth)/sign-up/page.test.tsx"`
Expected: FAIL — current copy is "Create talent account to find and apply events", etc.

- [ ] **Step 4: Update the three `AccountTypeOption` descriptions**

In `src/app/(auth)/sign-up/page.tsx`, replace the three `description` props (lines ~48, ~55, ~62):

```typescript
          <AccountTypeOption
            icon={<Briefcase className="size-[22px]" />}
            title="Organizer Account"
            description="Book talent for your event"
            selected={accountType === "organizer"}
            onClick={() => setAccountType("organizer")}
          />
          <AccountTypeOption
            icon={<User className="size-[22px]" />}
            title="Talent Account"
            description="Pick up gigs that fit your schedule, get paid"
            selected={accountType === "talent"}
            onClick={() => setAccountType("talent")}
          />
          <AccountTypeOption
            icon={<Speaker className="size-[22px]" />}
            title="Agency Account"
            description="Manage your roster and book more gigs"
            selected={accountType === "agency"}
            onClick={() => setAccountType("agency")}
          />
```

Also fix the `AccountTypeOption` button styling on the same file (lines ~192-197) so it uses theme tokens instead of the hardcoded dark-mode overlay:

```typescript
      className={cn(
        "flex flex-1 items-start gap-3.5 rounded-[6px] border border-transparent bg-muted px-4 py-3.5 text-left transition-colors",
        selected && "border-primary bg-primary/5"
      )}
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-[4.5px] bg-muted text-foreground">
```

(This is the same `bg-white/5` → `bg-muted` conversion described in Task 4's mapping table — done here because it's in a file this task is already touching for copy reasons; Task 4 onward covers the remaining files.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run test --isolate "src/app/(auth)/sign-up/page.test.tsx"`
Expected: PASS — both new tests and the pre-existing ones (name/email/password flow, success step) all green.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(auth)/sign-up/page.tsx" "src/app/(auth)/sign-up/page.test.tsx"
git commit -m "feat: reframe sign-up copy around side income, use theme tokens"
```

---

## Task 4: Hardcoded-color conversion — shell/navigation components

**Context for every task from here through Task 7:** convert hardcoded dark-mode overlay utility classes to semantic tokens using this exact mapping, verified against this codebase's actual usage:

| Hardcoded (old) | Token replacement (new) | When |
|---|---|---|
| `bg-white/5` | `bg-muted` | resting-state panel/pill/button fill |
| `bg-white/10` | `bg-muted` | resting-state panel fill (slightly different old opacity, same new token — we're moving off opacity-based dark overlays to solid tokens) |
| `hover:bg-white/5` | `hover:bg-accent` | hover state on an interactive element |
| `hover:bg-white/10` | `hover:bg-accent` | hover state on an interactive element |
| `hover:bg-white/15` | `hover:bg-accent` | hover state on an interactive element |
| `border-white/30` | `border-border` | unselected radio/option border |
| `border-[rgba(255,255,255,0.15)]` | `border-border` | card/pill border |
| `text-white/60`, `text-white/50`, `text-white/20` (**outside** an image-caption block) | `text-muted-foreground` | secondary text on a plain panel |

**Do NOT convert** (leave exactly as-is): `bg-gradient-to-t from-black ...`, `bg-black/40`–`bg-black/60` used as an image caption scrim, and the `text-white` / `text-white/50` / `text-white/60` that sits on top of that same scrim (i.e., inside the same card as the gradient, captioning a photo). These are intentional — dark text-legibility overlays on a photo, correct regardless of page theme. Tasks 6 and 7 call out exactly which lines are image-caption blocks to skip.

**Files:**
- Modify: `src/components/shell/sidebar.tsx`
- Modify: `src/components/shell/profile-menu.tsx`
- Modify: `src/components/shell/cart-button.tsx`
- Modify: `src/components/shell/notification-button.tsx`
- Modify: `src/components/shell/search-bar.tsx`
- Modify: `src/components/shell/category-tabs.tsx`
- Modify: `src/components/shell/filter-pill.tsx`
- Modify: `src/components/shell/hashtag-filter.tsx`
- Modify: `src/components/shell/price-range-filter.tsx`
- Modify: `src/components/shell/time-range-filter.tsx`
- Modify: `src/components/shell/card-carousel.tsx`
- Test: `src/components/shell/theme-tokens.test.tsx` (new — a single grep-style regression test covering this task's files)

**Interfaces:**
- Consumes: none (pure className string edits, no signature changes).
- Produces: none consumed elsewhere — visual-only change.

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/shell/theme-tokens.test.tsx
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FILES = [
  "sidebar.tsx",
  "profile-menu.tsx",
  "cart-button.tsx",
  "notification-button.tsx",
  "search-bar.tsx",
  "category-tabs.tsx",
  "filter-pill.tsx",
  "hashtag-filter.tsx",
  "price-range-filter.tsx",
  "time-range-filter.tsx",
  "card-carousel.tsx",
];

const HARDCODED_PATTERN = /bg-white\/|hover:bg-white\/|border-white\/|border-\[rgba\(255/;

describe("shell nav/filter components use theme tokens, not hardcoded white overlays", () => {
  for (const file of FILES) {
    it(`${file} has no hardcoded white overlay classes`, () => {
      const source = readFileSync(join(import.meta.dir, file), "utf-8");
      expect(HARDCODED_PATTERN.test(source)).toBe(false);
    });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test --isolate src/components/shell/theme-tokens.test.tsx`
Expected: FAIL for every file in the list (all currently contain `bg-white/5` and/or similar).

- [ ] **Step 3: Convert each file per the mapping table**

For each of the 11 files, apply the mapping table above to every matching className. These are mechanical find/replace edits within `cn(...)` calls and plain `className="..."` strings — e.g. in `sidebar.tsx:83`, `hover:bg-white/5` becomes `hover:bg-accent`; in `search-bar.tsx:9`, `border-[rgba(255,255,255,0.15)]` becomes `border-border`. None of these files contain image-gradient/caption blocks (that pattern only appears in Tasks 6–7's files), so every hardcoded match in this task's file list converts per the table with no exceptions.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test --isolate src/components/shell/theme-tokens.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/shell/sidebar.tsx src/components/shell/profile-menu.tsx src/components/shell/cart-button.tsx src/components/shell/notification-button.tsx src/components/shell/search-bar.tsx src/components/shell/category-tabs.tsx src/components/shell/filter-pill.tsx src/components/shell/hashtag-filter.tsx src/components/shell/price-range-filter.tsx src/components/shell/time-range-filter.tsx src/components/shell/card-carousel.tsx src/components/shell/theme-tokens.test.tsx
git commit -m "feat: convert shell nav/filter components to theme tokens"
```

---

## Task 5: Hardcoded-color conversion — account/admin/organizer panels

**Files:**
- Modify: `src/app/admin/disputes/page.tsx`
- Modify: `src/app/organizer/account/events/page.tsx`
- Modify: `src/app/organizer/create/create-event-form.tsx`
- Modify: `src/components/account/billing-content.tsx`
- Modify: `src/components/account/event-applications-panel.tsx`
- Modify: `src/components/account/order-detail-content.tsx`
- Modify: `src/components/account/orders-content.tsx`
- Modify: `src/components/account/packages-content.tsx`
- Modify: `src/components/account/quotations-content.tsx`
- Modify: `src/components/account/schedule-content.tsx`
- Modify: `src/components/account/talents-content.tsx`
- Modify: `src/components/account/account-tabs.tsx`
- Modify: `src/components/admin/commission-row.tsx`
- Modify: `src/components/shared/pagination.tsx`
- Modify: `src/components/shared/step-indicator.tsx`
- Modify: `src/components/kyc/kyc-wizard.tsx`
- Test: extend `src/components/shell/theme-tokens.test.tsx` pattern into a second file

**Interfaces:**
- Consumes: same mapping table as Task 4.
- Produces: none consumed elsewhere.

One exception in this batch: `src/components/account/profile-content.tsx` has `bg-black/50`, `bg-black/60`, and `text-white` used as hover-reveal overlays on the cover-photo/avatar/gallery upload previews (lines ~207, ~236, ~358) — these are the same "dark scrim behind light icon/text on top of a photo" pattern and must be **excluded** from this task's conversion (left as-is). Everything else in `profile-content.tsx` (the panel `bg-white/5` fills) converts normally. Because of this mixed file, `profile-content.tsx` is handled in this task explicitly rather than by the blanket rule in Task 4 — see Step 3.

**Files (continued):**
- Modify: `src/components/account/profile-content.tsx` (partial — see above)

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/account/theme-tokens.test.tsx
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..", "..");

const FILES = [
  "src/app/admin/disputes/page.tsx",
  "src/app/organizer/account/events/page.tsx",
  "src/app/organizer/create/create-event-form.tsx",
  "src/components/account/billing-content.tsx",
  "src/components/account/event-applications-panel.tsx",
  "src/components/account/order-detail-content.tsx",
  "src/components/account/orders-content.tsx",
  "src/components/account/packages-content.tsx",
  "src/components/account/quotations-content.tsx",
  "src/components/account/schedule-content.tsx",
  "src/components/account/talents-content.tsx",
  "src/components/account/account-tabs.tsx",
  "src/components/admin/commission-row.tsx",
  "src/components/shared/pagination.tsx",
  "src/components/shared/step-indicator.tsx",
  "src/components/kyc/kyc-wizard.tsx",
];

const HARDCODED_PANEL_PATTERN = /bg-white\/|hover:bg-white\//;

describe("account/admin/organizer panels use theme tokens", () => {
  for (const file of FILES) {
    it(`${file} has no hardcoded white overlay classes`, () => {
      const source = readFileSync(join(ROOT, file), "utf-8");
      expect(HARDCODED_PANEL_PATTERN.test(source)).toBe(false);
    });
  }

  it("profile-content.tsx converts panel fills but keeps image-hover scrims", () => {
    const source = readFileSync(
      join(ROOT, "src/components/account/profile-content.tsx"),
      "utf-8"
    );
    expect(HARDCODED_PANEL_PATTERN.test(source)).toBe(false);
    // Cover/avatar/gallery hover-reveal scrims must remain untouched.
    expect(source).toContain("bg-black/50");
    expect(source).toContain("bg-black/60");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test --isolate src/components/account/theme-tokens.test.tsx`
Expected: FAIL — all 16 files (plus profile-content.tsx) still contain `bg-white/`.

- [ ] **Step 3: Convert each file**

For the 16 listed files, apply the Task 4 mapping table to every match — no exceptions in these files.

For `src/components/account/profile-content.tsx`: convert every `bg-white/5` and `bg-white/10` panel/avatar-placeholder fill to `bg-muted` (e.g. lines ~192, ~199, ~226, ~260, ~342, ~352, ~370, ~387, ~393, ~422, ~430, ~467, ~475, ~499, ~505, ~537) and every `hover:bg-white/10`/`hover:bg-white/15` to `hover:bg-accent`. Leave lines ~207, ~236, and ~358 (`bg-black/50`, `bg-black/50`, `bg-black/60` with `text-white`/`Camera` icon hover overlays) exactly as they are — these are the upload-preview hover scrims, not dark-mode leftovers.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test --isolate src/components/account/theme-tokens.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/disputes/page.tsx src/app/organizer/account/events/page.tsx src/app/organizer/create/create-event-form.tsx src/components/account/billing-content.tsx src/components/account/event-applications-panel.tsx src/components/account/order-detail-content.tsx src/components/account/orders-content.tsx src/components/account/packages-content.tsx src/components/account/quotations-content.tsx src/components/account/schedule-content.tsx src/components/account/talents-content.tsx src/components/account/account-tabs.tsx src/components/account/profile-content.tsx src/components/admin/commission-row.tsx src/components/shared/pagination.tsx src/components/shared/step-indicator.tsx src/components/kyc/kyc-wizard.tsx src/components/account/theme-tokens.test.tsx
git commit -m "feat: convert account/admin/organizer panels to theme tokens"
```

---

## Task 6: Hardcoded-color conversion — checkout, booking, and dialog panels

**Files:**
- Modify: `src/components/checkout/checkout-content.tsx`
- Modify: `src/components/create-package/create-package-dialog.tsx`
- Modify: `src/components/event-detail/apply-dialog.tsx`
- Modify: `src/components/event-detail/apply-panel.tsx`
- Modify: `src/components/talent-detail/booking-panel.tsx`
- Modify: `src/components/talent-detail/rating-review-card.tsx`
- Modify: `src/components/shared/upload-slot.tsx`
- Test: `src/components/checkout/theme-tokens.test.tsx` (new)

**Interfaces:**
- Consumes: same mapping table as Task 4.
- Produces: none consumed elsewhere.

`src/components/shared/upload-slot.tsx:49,66` has `bg-black/60` + `text-white` as an upload-preview hover overlay (same pattern as `profile-content.tsx` in Task 5) — exclude from conversion. Its line 39 `border-white/15 bg-white/5 hover:bg-white/10` (the empty-slot dashed-border state) **does** convert: `border-white/15` → `border-border`, `bg-white/5` → `bg-muted`, `hover:bg-white/10` → `hover:bg-accent`.

`src/components/talent-detail/rating-review-card.tsx:14` has `text-white/20` used for an unfilled star-rating icon (`i < count ? "fill-primary text-primary" : "text-white/20"`) — this is a resting-state icon color on a plain panel, not an image overlay, so it **does** convert: → `text-muted-foreground`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/checkout/theme-tokens.test.tsx
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..", "..");

const FILES = [
  "src/components/checkout/checkout-content.tsx",
  "src/components/create-package/create-package-dialog.tsx",
  "src/components/event-detail/apply-dialog.tsx",
  "src/components/event-detail/apply-panel.tsx",
  "src/components/talent-detail/booking-panel.tsx",
];

const HARDCODED_PATTERN = /bg-white\/|hover:bg-white\/|border-white\//;

describe("checkout/booking/dialog panels use theme tokens", () => {
  for (const file of FILES) {
    it(`${file} has no hardcoded white overlay classes`, () => {
      const source = readFileSync(join(ROOT, file), "utf-8");
      expect(HARDCODED_PATTERN.test(source)).toBe(false);
    });
  }

  it("rating-review-card.tsx converts the unfilled-star color to a token", () => {
    const source = readFileSync(
      join(ROOT, "src/components/talent-detail/rating-review-card.tsx"),
      "utf-8"
    );
    expect(source).not.toContain("text-white/20");
    expect(source).toContain("text-muted-foreground");
  });

  it("upload-slot.tsx converts the empty-slot state but keeps the preview hover scrim", () => {
    const source = readFileSync(
      join(ROOT, "src/components/shared/upload-slot.tsx"),
      "utf-8"
    );
    expect(source).not.toContain("border-white/15");
    expect(source).not.toContain("bg-white/5");
    expect(source).toContain("bg-black/60");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test --isolate src/components/checkout/theme-tokens.test.tsx`
Expected: FAIL — all files still contain the hardcoded patterns.

- [ ] **Step 3: Convert each file per the mapping table and the exceptions above**

Apply the Task 4 mapping table to all 7 files, respecting the two named exceptions (`upload-slot.tsx`'s preview scrim stays; its empty-slot state converts).

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test --isolate src/components/checkout/theme-tokens.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/checkout/checkout-content.tsx src/components/create-package/create-package-dialog.tsx src/components/event-detail/apply-dialog.tsx src/components/event-detail/apply-panel.tsx src/components/talent-detail/booking-panel.tsx src/components/talent-detail/rating-review-card.tsx src/components/shared/upload-slot.tsx src/components/checkout/theme-tokens.test.tsx
git commit -m "feat: convert checkout/booking/dialog panels to theme tokens"
```

---

## Task 7: Hardcoded-color conversion — image-hero cards (preserve caption scrims)

**Files:**
- Modify: `src/components/shell/event-listing-card.tsx`
- Modify: `src/components/shell/listing-card.tsx`
- Modify: `src/components/shell/promo-card.tsx`
- Modify: `src/components/event-detail/event-detail-content.tsx`
- Modify: `src/components/talent-detail/talent-detail-content.tsx`
- Modify: `src/components/shell/event-home-content.tsx`
- Test: `src/components/shell/image-card-tokens.test.tsx` (new)

**Interfaces:**
- Consumes: same mapping table as Task 4.
- Produces: none consumed elsewhere.

This is the most surgical task in the batch: each of these files mixes both patterns. Rule of thumb applied consistently below: if the class is inside the **image container** (the `relative`/`absolute` wrapper holding the photo, gradient, and caption text), it's a caption scrim → leave it. If the class is on a **sibling panel below/beside the image** (e.g. a `bg-white/5` review-summary block, a `bg-white/10` placeholder box for a *missing* image, or a card-list-row background), it's a page-chrome fill → convert.

- **`event-listing-card.tsx`**: keep lines with `bg-black/50`, `bg-gradient-to-t from-black`, `text-white`, `text-white/60`, `text-white/50`, `bg-black/40`, `group-hover:bg-white`/`group-hover:text-black` (the flip-on-hover day/time chip is a deliberate two-tone hover effect tied to the image card, not a dark-mode leftover — leave as-is). Convert line 17's `bg-white/10` (the "no image" placeholder box — this is a plain panel background, not a caption) → `bg-muted`. Convert line 62's `bg-white/10` (the card's own base background before the image loads) → `bg-muted`. Convert line 100's `bg-white/5` (the compact row variant's background) → `bg-muted`.
- **`listing-card.tsx`**: same pattern — keep all `black`/`text-white` inside the image-gradient card (lines ~36–52, ~90–115 gradient+caption block). Convert line 60's `bg-white/10` (base background) → `bg-muted`, line 86's `bg-white/10` (placeholder box) → `bg-muted`, line 106's `bg-white` (this is the *light* footer bar under the image on the second card variant — already correct for a light theme, leave as literal `bg-white` since it's meant to contrast against the photo above it, not a theme surface), line 141's `bg-white/10` → `bg-muted`, line 167's `bg-white/5` → `bg-muted`.
- **`promo-card.tsx`**: keep the gradient/caption block (lines 17–21). Convert line 30's `bg-white/5` (the non-image-background text-card variant) → `bg-muted`.
- **`event-detail-content.tsx`** / **`talent-detail-content.tsx`**: keep the hero gradient/caption block (both files' first ~15 lines of the hero section: `bg-white/10` placeholder-while-loading is the one exception — convert it, since it's a "no image yet" state box, not a caption — `bg-gradient-to-t from-black`, `text-white` heading, `text-white/60` subtext, `bg-black/50` badge chips). Convert every `bg-white/5` and `bg-white/10` elsewhere in these files (the tab-pill backgrounds, gallery grid item backgrounds, review-card backgrounds, badge pills below the hero) → `bg-muted`, and `hover:bg-white/10` → `hover:bg-accent`.
- **`event-home-content.tsx`**: line 16's `bg-white/10` is a placeholder box (no image loaded yet), not a caption → convert to `bg-muted`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/shell/image-card-tokens.test.tsx
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..", "..");

describe("image-hero cards convert panel fills but preserve caption scrims", () => {
  it("event-listing-card.tsx keeps the hover-flip chip and gradient scrim", () => {
    const source = readFileSync(
      join(ROOT, "src/components/shell/event-listing-card.tsx"),
      "utf-8"
    );
    expect(source).toContain("bg-gradient-to-t from-black");
    expect(source).toContain("group-hover:bg-white");
    expect(source).not.toMatch(/(?<!group-hover:)bg-white\/10/);
  });

  it("listing-card.tsx keeps the gradient scrim and light footer bar", () => {
    const source = readFileSync(
      join(ROOT, "src/components/shell/listing-card.tsx"),
      "utf-8"
    );
    expect(source).toContain("bg-gradient-to-t from-black");
    expect(source).toContain('bg-white px-4 py-3');
  });

  it("promo-card.tsx keeps the gradient scrim, converts the text-card variant", () => {
    const source = readFileSync(
      join(ROOT, "src/components/shell/promo-card.tsx"),
      "utf-8"
    );
    expect(source).toContain("bg-gradient-to-t from-black");
    expect(source).not.toContain("bg-white/5");
  });

  it("event-detail-content.tsx and talent-detail-content.tsx keep hero scrims, convert panels", () => {
    for (const file of [
      "src/components/event-detail/event-detail-content.tsx",
      "src/components/talent-detail/talent-detail-content.tsx",
    ]) {
      const source = readFileSync(join(ROOT, file), "utf-8");
      expect(source).toContain("bg-gradient-to-t from-black");
      expect(source).toContain("text-white");
      expect(source).not.toContain("bg-white/5");
    }
  });

  it("event-home-content.tsx converts its placeholder box", () => {
    const source = readFileSync(
      join(ROOT, "src/components/shell/event-home-content.tsx"),
      "utf-8"
    );
    expect(source).not.toContain("bg-white/10");
    expect(source).toContain("bg-muted");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test --isolate src/components/shell/image-card-tokens.test.tsx`
Expected: FAIL — panel fills not yet converted.

- [ ] **Step 3: Convert each file per the per-file notes above**

Apply exactly the conversions listed above per file — this task requires more judgment than Tasks 4–6 since each file mixes both patterns; follow the line-level notes precisely rather than a blanket find/replace.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test --isolate src/components/shell/image-card-tokens.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/shell/event-listing-card.tsx src/components/shell/listing-card.tsx src/components/shell/promo-card.tsx src/components/event-detail/event-detail-content.tsx src/components/talent-detail/talent-detail-content.tsx src/components/shell/event-home-content.tsx src/components/shell/image-card-tokens.test.tsx
git commit -m "feat: convert image-hero card panels to theme tokens, preserve caption scrims"
```

---

## Task 8: Fix remaining "Heart of Show" / "Heart of Stars" copy

**Files:**
- Modify: `src/components/shell/home-content.tsx:37`
- Modify: `README.md` (header only)
- Test: extend `src/components/shell/theme-tokens.test.tsx` (from Task 4) with a copy assertion, or add a small dedicated test

**Interfaces:**
- Consumes: none.
- Produces: none consumed elsewhere.

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/shell/home-content.test.tsx
import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

mock.module("@/lib/supabase/packages", () => ({
  listMostPopularPackages: async () => [],
  listEditorChoicePackages: async () => [],
  listRecentPackages: async () => [],
}));

import { HomeContent } from "@/components/shell/home-content";

afterEach(() => {
  cleanup();
});

describe("HomeContent branding copy", () => {
  it("does not reference the old Heart of Show name", async () => {
    const ui = await HomeContent({ role: "organizer" });
    render(ui);
    expect(screen.queryByText(/heart of show/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test --isolate src/components/shell/home-content.test.tsx`
Expected: FAIL — current carousel title is "Most Popular Talents in Heart of Show".

- [ ] **Step 3: Update the copy**

In `src/components/shell/home-content.tsx`, change:

```typescript
        <CardCarousel title="Most Popular Talents in Heart of Show" viewAllHref={`/${role}/discover`}>
```

to:

```typescript
        <CardCarousel title="Most Popular Talents on Hustle of Stars" viewAllHref={`/${role}/discover`}>
```

In `README.md`, change the header line from `# HOS — Heart of Stars` to `# HOS — Hustle of Stars`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test --isolate src/components/shell/home-content.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/shell/home-content.tsx src/components/shell/home-content.test.tsx README.md
git commit -m "fix: correct remaining Heart of Show/Stars references to Hustle of Stars"
```

---

## Task 9: New public landing page

**Files:**
- Create: `src/app/(marketing)/page.tsx`
- Create: `src/app/(marketing)/layout.tsx`
- Modify: `src/app/page.tsx`
- Test: `src/app/(marketing)/page.test.tsx` (new)

**Interfaces:**
- Consumes: `getCurrentProfile` from `@/lib/supabase/server` (existing, same signature used in `src/app/page.tsx` and `src/app/(auth)/layout.tsx`).
- Produces: route `/` renders marketing content for signed-out visitors; signed-in visitors still redirect to `/${role}`.

`src/app/page.tsx` currently redirects unconditionally. Since Next.js route groups (`(marketing)`, `(auth)`) don't affect the URL, both `src/app/page.tsx` and `src/app/(marketing)/page.tsx` would collide on `/` — so this task removes the redirect-only `src/app/page.tsx` and replaces it with the marketing page's own auth check, matching the pattern already used in `src/app/(auth)/layout.tsx` (check profile, redirect if present, render public content if not).

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/(marketing)/page.test.tsx
import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

const redirectCalls: string[] = [];
mock.module("next/navigation", () => ({
  redirect: (url: string) => {
    redirectCalls.push(url);
    throw new Error(`REDIRECT:${url}`);
  },
}));

let mockProfile: { role: string } | null = null;
mock.module("@/lib/supabase/server", () => ({
  getCurrentProfile: async () => mockProfile,
}));

import LandingPage from "@/app/(marketing)/page";

afterEach(() => {
  cleanup();
  redirectCalls.length = 0;
  mockProfile = null;
});

describe("Landing page", () => {
  it("renders marketing content for a signed-out visitor", async () => {
    mockProfile = null;
    const ui = await LandingPage();
    render(ui);
    expect(screen.getByText(/turn your talent into extra income/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /get started/i })).toHaveAttribute("href", "/sign-up");
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/sign-in");
  });

  it("redirects a signed-in visitor to their role dashboard instead of rendering", async () => {
    mockProfile = { role: "talent" };
    await expect(LandingPage()).rejects.toThrow("REDIRECT:/talent");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test --isolate "src/app/(marketing)/page.test.tsx"`
Expected: FAIL — `src/app/(marketing)/page.tsx` doesn't exist yet.

- [ ] **Step 3: Delete the old `src/app/page.tsx` and create the marketing route**

Delete `src/app/page.tsx` (its redirect-only responsibility moves into the new marketing page below — this file and the new one would otherwise both claim the `/` route).

Create `src/app/(marketing)/layout.tsx`:

```typescript
export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="flex min-h-screen w-full flex-col bg-background">{children}</div>;
}
```

Create `src/app/(marketing)/page.tsx`:

```typescript
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/supabase/server";

const CATEGORIES = ["Singing", "DJing", "MC / Hosting", "Photography", "Dance", "Live Music"];

export default async function LandingPage() {
  const profile = await getCurrentProfile();
  if (profile) redirect(`/${profile.role}`);

  return (
    <>
      <section className="flex flex-col items-center gap-6 px-4 py-24 text-center">
        <h1 className="max-w-2xl text-4xl font-bold tracking-[-0.03em] text-foreground sm:text-5xl">
          Turn your talent into extra income
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Your skills. Your schedule. Extra income. Find gigs that fit around your life.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/sign-up">Get Started</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/sign-in">Sign In</Link>
          </Button>
        </div>
      </section>

      <section className="flex flex-col items-center gap-10 px-4 py-16">
        <h2 className="text-2xl font-medium tracking-[-0.03em] text-foreground">How it works</h2>
        <div className="grid w-full max-w-3xl grid-cols-1 gap-8 sm:grid-cols-3">
          {[
            { step: "1", label: "Create your profile" },
            { step: "2", label: "Get booked" },
            { step: "3", label: "Get paid" },
          ].map(({ step, label }) => (
            <div key={step} className="flex flex-col items-center gap-2 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                {step}
              </span>
              <p className="text-sm font-medium text-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col items-center gap-6 px-4 py-16">
        <h2 className="text-2xl font-medium tracking-[-0.03em] text-foreground">
          Every kind of talent welcome
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {CATEGORIES.map((category) => (
            <span
              key={category}
              className="rounded-full bg-muted px-4 py-2 text-sm text-foreground"
            >
              {category}
            </span>
          ))}
        </div>
      </section>

      <footer className="flex flex-col items-center gap-3 border-t border-border px-4 py-10 text-sm text-muted-foreground">
        <p>
          Hosting an event?{" "}
          <Link href="/sign-up" className="text-primary underline">
            Book talent
          </Link>
        </p>
        <p>
          <Link href="/sign-in" className="underline">
            Sign in
          </Link>{" "}
          ·{" "}
          <Link href="/sign-up" className="underline">
            Sign up
          </Link>
        </p>
      </footer>
    </>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test --isolate "src/app/(marketing)/page.test.tsx"`
Expected: PASS

- [ ] **Step 5: Verify no route collision**

Run: `bun run build`
Expected: build succeeds with a single `/` route (confirms deleting `src/app/page.tsx` correctly avoided a duplicate-route error).

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx "src/app/(marketing)/page.tsx" "src/app/(marketing)/layout.tsx" "src/app/(marketing)/page.test.tsx"
git commit -m "feat: add public landing page with side-income positioning"
```

---

## Task 10: Logo recolor

**Files:**
- Modify: `public/brand/logo.svg`
- Test: `public/brand/logo.test.ts` (new)

**Interfaces:**
- Consumes: none.
- Produces: none consumed by other tasks (referenced by existing code wherever `logo.svg` is already used — no reference-site changes needed, just the asset's own colors).

- [ ] **Step 1: Read the current SVG**

Run: `cat public/brand/logo.svg` — confirm the exact fill values to replace (`#F5F5F5` wordmark, `#DB382C` and `#E89290` star mark, per the spec).

- [ ] **Step 2: Write the failing test**

```typescript
// public/brand/logo.test.ts
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const svg = readFileSync(join(import.meta.dir, "logo.svg"), "utf-8");

describe("brand logo colors", () => {
  it("no longer uses the old red/pink star colors", () => {
    expect(svg).not.toContain("#DB382C");
    expect(svg).not.toContain("#db382c");
    expect(svg).not.toContain("#E89290");
    expect(svg).not.toContain("#e89290");
  });

  it("no longer uses the old off-white wordmark color", () => {
    expect(svg).not.toContain("#F5F5F5");
    expect(svg).not.toContain("#f5f5f5");
  });

  it("uses the new orange accent for the star mark", () => {
    expect(svg.toUpperCase()).toContain("#FF6B35");
  });

  it("uses a dark color for the wordmark", () => {
    expect(svg.toUpperCase()).toContain("#1A1512");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun run test --isolate public/brand/logo.test.ts`
Expected: FAIL — SVG still has the old colors.

- [ ] **Step 4: Recolor the SVG**

Edit `public/brand/logo.svg`: replace every `#DB382C`/`#db382c` fill with `#FF6B35`, every `#E89290`/`#e89290` fill with a lighter tint of the same orange (e.g. `#FFB088`), and every `#F5F5F5`/`#f5f5f5` wordmark fill with `#1A1512`.

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test --isolate public/brand/logo.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add public/brand/logo.svg public/brand/logo.test.ts
git commit -m "feat: recolor brand logo for light theme"
```

---

## Task 11: Full-app manual verification pass

**Files:** none modified — verification only.

**Interfaces:** none.

- [ ] **Step 1: Run the full test suite**

Run: `bun run test`
Expected: all tests pass, including every test added in Tasks 1–10.

- [ ] **Step 2: Run the build**

Run: `bun run build`
Expected: succeeds with no type errors, no duplicate-route errors.

- [ ] **Step 3: Run lint**

Run: `bun run lint`
Expected: no errors.

- [ ] **Step 4: Start the dev server and manually verify in a browser**

Run: `bun run dev`

Check, per the Review Focus section above:
- `/` as a signed-out visitor shows the new landing page (light background, orange accent, "Turn your talent into extra income" headline, working Get Started / Sign In links).
- `/` as a signed-in visitor redirects straight to their role dashboard (no flash of marketing content).
- Sign-up account-type step shows the new side-income copy and renders correctly on light background (no invisible `bg-white/5` panels).
- At least one screen from each of Tasks 4–7's file groups (sidebar nav, an account panel like Orders, the checkout flow, an event-detail or talent-detail hero card) renders with visible borders/hover states and legible text — specifically hover over a nav item, a filter pill, and a card-list row to confirm `hover:bg-accent` is visible against the white background.
- Image-hero cards (event listing, talent listing, event/talent detail pages) still show light-colored caption text over a dark gradient scrim on the photo — confirms Task 7 didn't accidentally convert the intentional overlays.
- `--destructive` renders as a distinct red from `--primary`'s orange somewhere a destructive action exists (e.g. a delete/cancel button in Orders or Disputes).

- [ ] **Step 5: Stop the dev server**

No commit for this task — it's verification-only. If any check in Step 4 fails, return to the relevant task above, fix, and re-run its own test plus this task's full-suite check.
