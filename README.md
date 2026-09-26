# Ministerial Committee Portal

Public digital portal for the Ministerial Committee (اللجنة الوزارية للسلامة المرورية) — public portal and content-management backoffice in a single Next.js application.

**Greenfield status:** this repository is the production implementation. It is built incrementally from the frozen B1–B3 baseline; only the scope of completed increments exists here.

> The previous portal implementation (`../Web-MCTS-feat-gov-media-website/`, outside this repository) is **reference-only**. No code, configuration, schema or secrets are inherited from it.

## Authoritative specification

The binding architecture/design/CMS baseline lives outside this repository at:

```text
../docs/                      # PROJECT-BASELINE.md, B1–B3 sign-offs
../docs/architecture/         # B1 architecture detail
../docs/adr/                  # ADR-001 … ADR-010
../docs/design-system/        # B2 detail
../docs/cms/                  # B3 detail
../docs/implementation/       # Master plan, execution contract, tasks, reports
```

When sources conflict, the baseline wins. See `docs/PROJECT-BASELINE.md` for the authority order.

## Runtime

| Component       | Version                                           |
| --------------- | ------------------------------------------------- |
| Node.js         | 24 LTS (`.nvmrc`, `engines`)                      |
| Next.js         | 16.x stable (pinned)                              |
| React           | 19.x stable (pinned)                              |
| TypeScript      | 5.x, `strict`                                     |
| Package manager | npm (`package-lock.json` committed; use `npm ci`) |

## Prerequisites

- Node.js 24 (see `.nvmrc`)
- npm 11 (bundled with Node 24)

## Commands

```bash
npm ci                  # install (frozen lockfile)

npm run dev             # local development server
npm run build           # production build
npm run start           # serve the production build

npm run lint            # ESLint (includes architecture import rules)
npm run typecheck       # next typegen + tsc --noEmit
npm run format          # Prettier write
npm run format:check    # Prettier check (CI gate)

npm run test            # all Vitest suites
npm run test:unit       # unit tests (tests/unit)
npm run test:component  # React Testing Library tests (tests/component)
npm run test:architecture  # executable module-boundary checks
npm run test:e2e        # Playwright smoke against a production build
npm run test:a11y       # axe accessibility smoke (serious/critical)
npm run check           # aggregate local gate
```

E2E tests build the app (`next build`) and serve it with `next start` — they never run against the dev server. Playwright browsers: `npx playwright install chromium`.

## Source structure

```text
src/
├── app/          # Next.js App Router delivery layer (thin — no business logic)
├── modules/      # business capabilities (domain/application/infrastructure/presentation)
├── platform/     # technical infrastructure (database, auth, i18n, config, …)
├── shared/       # domain-neutral reusable code only
└── styles/

tests/
├── architecture/ # executable boundary rules (ADR-002)
├── component/    # React Testing Library
├── e2e/          # Playwright + axe
└── unit/         # Vitest
```

Cross-module access goes through a module's public contract (`@/modules/<name>`), never deep internals. Boundaries are enforced by ESLint `no-restricted-imports` **and** the architecture test suite — both fail CI on violations.

## CI

`.github/workflows/ci.yml` runs on pushes and PRs to `main` (least-privilege permissions, `npm ci`, Node 24):

- format check, lint, architecture tests, typecheck, unit/component tests
- production build, Playwright E2E smoke, axe accessibility smoke

## Current increment

- [x] **IMP-01** — Runtime, project structure & quality foundation

Later increments (database, auth, localization, design system, CMS) are intentionally not implemented yet — see `../docs/implementation/MASTER-IMPLEMENTATION-PLAN.md`.
