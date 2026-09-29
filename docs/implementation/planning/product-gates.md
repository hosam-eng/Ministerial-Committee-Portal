# Product and design gates (planning)

Lightweight record of cross-cutting acceptance gates. Not implementation tasks.

## UX-2 — Content-Complete Visual & Interaction Acceptance

**Status:** Planned — not started.

**Purpose:** Review the portal with realistic populated content and major composition capabilities in place. This is **not** final Launch QA.

**Expected timing:** After at least IMP-15 (Site Settings), IMP-16 (Navigation Management), and IMP-17 (Homepage Management); before final pre-IA / launch-readiness acceptance.

**In scope (indicative):** Public header with real MAIN navigation, homepage composition, news and managed pages density, footer/site settings content, AR/EN parity, responsive balance; admin editors, lists, workflow/status density.

**Constraint:** Reuse the CORR-2 Phase A frozen UI foundation unless a documented usability, accessibility, or product reason requires a controlled change.

## Sequence (reference)

1. **UX-1** — design intent and identity baseline
2. **CORR-2** — production UI foundation implementation (Phase A frozen on branch `imp/13-managed-pages-controlled-blocks`)
3. **UX-2** — content-complete visual and interaction acceptance
4. **Launch QA** — final technical, responsive, accessibility, browser, and content sanity
