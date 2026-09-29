# IMP-13 CORR-2 — Phase A UI foundation (owner visual checkpoint)

**Branch:** `imp/13-managed-pages-controlled-blocks`  
**Baseline parent:** `74f9a2eb87063d9d8e1c49c7dcff09c6c577f0e0`  
**Phase:** A — **OWNER ACCEPTED — FOUNDATION FREEZE** (2026-09-29). Phase B not started.

## 1. Purpose

Establish a shared production visual foundation (typography, containers, controls, shells) and three reference surfaces: **Public News**, **Admin Login (AuthShell)**, **Admin Home + Admin News list**. No domain, auth, RBAC, workflow, or route changes.

## 2. Owner visual checkpoint (mandatory)

Review full-page screenshots at **100% browser zoom** (do not crop proportions):

| File                          | Route                    | Viewport                  |
| ----------------------------- | ------------------------ | ------------------------- |
| `public-news-ar-390.png`      | `/ar/news`               | 390×844                   |
| `public-news-ar-1440.png`     | `/ar/news`               | 1440×900                  |
| `public-news-ar-1920.png`     | `/ar/news`               | 1920×1080                 |
| `public-home-ar-1440.png`     | `/ar`                    | 1440×900                  |
| `public-news-en-1440.png`     | `/en/news`               | 1440×900 (English sanity) |
| `admin-login-ar-1440.png`     | `/ar/admin/login`        | 1440×900                  |
| `admin-login-ar-1920.png`     | `/ar/admin/login`        | 1920×1080                 |
| `admin-home-ar-1440.png`      | `/ar/admin`              | 1440×900                  |
| `admin-home-ar-1920.png`      | `/ar/admin`              | 1920×1080                 |
| `admin-home-en-1440.png`      | `/en/admin`              | 1440×900                  |
| `admin-news-list-ar-1440.png` | `/ar/admin/content/news` | 1440×900                  |
| `admin-news-list-ar-1920.png` | `/ar/admin/content/news` | 1920×1080                 |
| `admin-news-list-ar-390.png`  | `/ar/admin/content/news` | 390×844                   |

**Evidence directory:** `docs/implementation/evidence/IMP-13/corr-2-phase-a/`

## 3. Diagnosis summary

### 3.1 Typography / scale

Pre–Phase A UI read as engineering scaffolding: rem-based portal rules without a deliberate document root and page-title scale; public logo and page titles were visually small relative to header chrome at desktop widths.

**Phase A fix:** `src/styles/ui-foundation.css` — `html { font-size: 16px }`, body/type tokens, `.ui-*` controls, tuned `.public-shell` / admin / auth surfaces.

### 3.2 CR084 overlay / watermark

Investigation at 100% zoom on reference routes:

- `document.body.innerText` does **not** contain `CR084`.
- No DOM nodes with CR084 text in application markup.
- **Classification:** external browser or capture-environment overlay (not application source). Re-check owner captures if watermark appears in PNGs.

## 4. BEFORE / AFTER computed styles (1440×900)

Source files:

- Before: `docs/implementation/evidence/IMP-13/corr-2-phase-a/computed-audit-before.json`
- After: `docs/implementation/evidence/IMP-13/corr-2-phase-a/computed-audit-after.json`

### 4.1 Public `/ar/news`

| Element             | Before       | After                         |
| ------------------- | ------------ | ----------------------------- |
| `html` font-size    | 16px         | 16px                          |
| `body` font-size    | 16px         | 17px                          |
| `body` line-height  | 25.6px       | 27.2px                        |
| Header inner height | ~72px        | 92px                          |
| Logo height         | 36px         | 60px                          |
| Page `h1` font-size | 30px         | 36px                          |
| Main max width      | 1280px token | 1280px (`--container-public`) |
| Nav link font-size  | 16px         | 16px                          |

### 4.2 Auth `/ar/admin/login`

| Element            | Before        | After                                          |
| ------------------ | ------------- | ---------------------------------------------- |
| Auth frame         | Legacy layout | `AuthShell` + `.auth-card` (448px card @ 1440) |
| Card `h1`          | ~30px         | 36px                                           |
| `.ui-input` height | ~44px         | ~49px                                          |
| Primary button     | generic       | `.ui-button-primary` 44px height               |

### 4.3 Admin home `/ar/admin` (authenticated)

| Element          | After (1440)                                                        |
| ---------------- | ------------------------------------------------------------------- |
| Workspace width  | 1132px (sidebar + main)                                             |
| Sidebar nav link | 16px, 224px column                                                  |
| Page `h1`        | 36px                                                                |
| Pattern          | Top bar + sidebar + destination cards (real RBAC destinations only) |

### 4.4 Admin news list `/ar/admin/content/news`

| Element        | After (1440)                              |
| -------------- | ----------------------------------------- |
| Page header    | `AdminPageHeader` + primary action button |
| Table/list     | `.admin-data-table` reference layout      |
| Primary button | 44px height, 15px label                   |

## 5. Implementation map (Phase A scope)

| Area   | Change                                                                                                                                                       |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shared | `src/styles/ui-foundation.css`, `.ui-*` buttons/inputs/surfaces                                                                                              |
| Public | Tune existing `PublicShell` via CSS; public News listing as reference                                                                                        |
| Auth   | `src/shared/ui/auth-shell.tsx` on login only                                                                                                                 |
| Admin  | `AdminShell` task shell (top bar, sidebar, mobile menu), `admin-page-header.tsx`, `admin-nav.ts`, `admin-shell-props.ts`, Admin Home cards, News list chrome |

**Explicitly not changed:** Prisma/DB, auth/MFA logic, RBAC, News/Managed Pages business logic, TipTap, preview security, routes, IMP-17 homepage content, MFA/editor/Managed Pages admin redesign (Phase B).

## 6. English sanity evidence

- `public-news-en-1440.png` — LTR News listing, English chrome strings.
- `admin-home-en-1440.png` — LTR admin home with English navigation labels.

## 7. Minimum verification (pre-screenshot only)

Executed for this checkpoint (no broad regression):

| Check                                              | Result                                       |
| -------------------------------------------------- | -------------------------------------------- |
| `npm run lint`                                     | Pass                                         |
| `npm run typecheck`                                | Pass                                         |
| Component tests (includes `public-shell-baseline`) | Pass                                         |
| Playwright `corr-2-phase-a-evidence.spec.ts`       | Pass — 13 PNGs + `computed-audit-after.json` |

**Deferred until after owner approval / Phase B:** full `test:e2e`, `test:a11y`, architecture/db CI matrix, push-for-green CI.

## 8. Known follow-ups (Phase B, not started)

- Propagate AuthShell/MFA pages, editors, Managed Pages admin UI, Users/Roles tables.
- Full accessibility and production hardening pass.
- Phase A commit + push + CI acceptance after owner sign-off on screenshots.

## 9. Phase A status

**IMP-13 CORR-2 PHASE A: OWNER ACCEPTED — FOUNDATION FREEZE**

CORR-2 Phase A is accepted as the **production UI foundation implementation**, not final portal visual acceptance. IMP-13 remains **open** until Phase B completes.

| Area                               | Status                    |
| ---------------------------------- | ------------------------- |
| Shared UI foundation               | ✅ Owner accepted         |
| PublicShell                        | ✅ Accepted as foundation |
| AuthShell                          | ✅ Accepted as foundation |
| AdminShell                         | ✅ Accepted as foundation |
| Typography / containers / controls | ✅ Frozen as foundation   |
| Final portal visual acceptance     | ⏳ Deferred (UX-2)        |
| Phase B                            | ❌ Not started            |
| IMP-13 overall                     | ⏳ Open                   |

## 28. Phase A Final Polish

- **Public Header zones:** Header inner layout split into identity / main navigation / utilities regions; desktop grid with nav separated from logo (padding + border-inline-start) while utilities stay end-aligned; RTL/LTR via logical properties. Mobile unchanged (drawer menu in utilities).
- **News listing container:** `--container-listing` (~64rem) applied via `.public-news-listing` on the News index only; `--container-reading` (~45rem) retained for News detail and long-form content.
- **Logout legacy style:** Replaced `dga-button-v2` neutral (black) with shared `.ui-button-secondary` compact control in the admin top bar.
- **Create News label root cause:** Legacy `.news-workspace a { color: var(--portal-identity) }` overrode `.ui-button-primary` link text to brand-primary on brand-primary background (invisible label). Fixed by removing `news-workspace` from the admin list page and scoping legacy rule to `a:not(.ui-button)`; explicit `.admin-page-header-action .ui-button-primary { color: white }` guard.
- **Admin typography density:** `--type-admin-page-title` 2rem (~32px), `--type-admin-body` 1rem (~16px), admin shell scoped; public keeps `--type-public-page-title` (~36px class).
- **News editor:** Not redesigned; Phase B rule recorded — editors use admin operational density, not public display scale.
- **Screenshots:** None generated by agent this pass.
- **Verification:** Fast safety checks only (lint, typecheck, public shell component test, production smoke spec).
- **Owner live visual review:** ✅ Accepted (foundation freeze closeout).

## 29. Foundation freeze (what it means)

Future increments must **reuse**: brand tokens; typography foundation; Public/Admin/Auth container roles; `.ui-*` button/field/surface/badge patterns; PublicShell, AdminShell, and AuthShell architectures; responsive philosophy; RTL/LTR rules; accessibility/focus behavior.

Future increments must **not** casually introduce parallel button/form systems, alternate shells, alternate typography scales, or alternate brand interpretation.

**Frozen as foundation** does **not** freeze every final pixel. Controlled refinement remains allowed when real content and feature density reveal issues that cannot be judged today.

## 30. Deferred product decisions

- **Homepage:** Intentionally content-incomplete; not final visual acceptance. **IMP-17** owns real homepage composition.
- **Footer:** Structural/visual foundation accepted; **IMP-15 / IMP-16** populate institutional and navigation data later.
- **Public News (Phase A polish):** Listing width (`--container-listing`) distinct from reading width; header identity / nav / utilities separated; only real nav targets exposed. No News business behavior changed.
- **Admin:** Task-oriented foundation accepted; admin H1 denser than public by design. Admin does not imitate public marketing scale.
- **News editor:** Phase B propagation pending. Principle: _Admin editors use the accepted Admin visual foundation with operational density and must not blindly inherit Public typography scale._

## 31. Public responsibility map (populate, do not redesign shell)

| Increment | Owns                                           |
| --------- | ---------------------------------------------- |
| IMP-15    | Site Settings / institutional data binding     |
| IMP-16    | CMS-managed MAIN / UTILITY / FOOTER navigation |
| IMP-17    | Homepage composition                           |
| B4        | Media capabilities                             |
| B6        | Search functionality                           |

## 32. UX-2 — Content-Complete Visual & Interaction Acceptance

**Status:** Planned, not started. **Target timing:** after IMP-15, IMP-16, IMP-17 (at minimum), before final pre-IA / launch-readiness acceptance.

UX-2 evaluates the **real product** with realistic content density (public header with full nav, homepage, news/managed pages, footer data, site settings, AR/EN parity, responsive balance; admin editors, lists, workflow density). UX-2 may refine proportions but must not casually replace the accepted shared foundation without documented usability/accessibility/product reason.

**Sequence:** UX-1 (design intent) → CORR-2 (production UI foundation) → **UX-2** (content-complete acceptance) → Launch QA (technical/responsive/a11y/browser/content). UX-2 is not a substitute for Launch QA.

See also: `docs/implementation/planning/product-gates.md`.

## 33. Project workflow — visual review

**Default:** Cursor implements + fast technical safety checks + stops. Owner runs the app locally, live visual review, optional manual screenshots, provides observations. Owner/architecture/product review decides acceptance.

Cursor must **not** routinely spend effort on owner-style visual narration, large screenshot evidence sets, or repeated Playwright visual captures unless explicitly requested. Automated screenshots only where a specific technical regression requires them.

## 34. Project workflow — testing cadence

- **Backend/architecture/data work:** Test aggressively during implementation (migrations, workflow, auth, persistence, security, boundaries).
- **UI/visual iteration:** Lint, typecheck, affected component tests, browser smoke → owner visual review → freeze → propagation → deep testing. Do not run expensive broad suites after every styling tweak.
- **Merge-candidate stabilization:** Full lint/typecheck, architecture, unit/component, DB/Testcontainers as required, auth/security E2E, a11y, production build, CI.

## 35. Git ownership

**Cursor/agent:** branch, implement, commit, push, report, stop. **Must not** merge to main or delete/clean branches after merge.

**Owner:** review, PR/merge, branch/local cleanup.

## 36. Phase A closeout verification (2026-09-29)

Pre-commit: `format:check`, `lint`, `typecheck`, public shell component tests. No new screenshots. Single commit: _Freeze CORR-2 Phase A production UI foundation_. Branch pushed; main not merged; Phase B not started.
