# Database — PostgreSQL 18 + Prisma 7

The portal's data platform is **PostgreSQL 18.x** accessed through
**Prisma ORM 7** on the **`@prisma/adapter-pg`** driver adapter (ADR-003).
This document covers the development workflow. No business models exist
yet — IMP-02 establishes the platform only.

## Requirements

- PostgreSQL 18.x (native `uuidv7()` — do not use UUIDv4 as the default)
- Node 24 (`.nvmrc`), npm, Docker (for the dev database and
  Testcontainers)

## Local development database

```bash
docker compose -f compose.dev.yml up -d --wait   # start + wait for health
docker compose -f compose.dev.yml ps             # status
docker compose -f compose.dev.yml logs postgres  # logs
docker compose -f compose.dev.yml down           # stop (data persists)
docker compose -f compose.dev.yml down -v        # stop + reset (drops volume)
```

- Image: `postgres:18.6` (pinned stable 18 tag — never `latest`)
- Database: `mcp_dev`, bound to `127.0.0.1:5432` only
- Credentials are **development-only** and disposable — never reuse them
- Server runs in **UTC** (`Etc/UTC`)
- First init runs `docker/postgres/init/00-bootstrap.sh` →
  `docker/postgres/sql/001-roles.sql`, creating the roles below

Copy `.env.example` → `.env` for matching connection URLs:

| Variable                 | Identity      | Purpose                        |
| ------------------------ | ------------- | ------------------------------ |
| `DATABASE_URL`           | `mcp_runtime` | Application runtime (DML only) |
| `DATABASE_MIGRATION_URL` | `mcp_migrate` | Prisma CLI schema evolution    |

## Roles

| Role          | Login | Rights                                           |
| ------------- | ----- | ------------------------------------------------ |
| `mcp_owner`   | no    | owns the database + all objects                  |
| `mcp_migrate` | yes   | member of `mcp_owner`; `CREATEDB` for shadow DBs |
| `mcp_runtime` | yes   | connect + DML only — **no DDL**                  |

The runtime role cannot `CREATE TABLE`, `CREATE SCHEMA`, `ALTER`, `DROP`,
`CREATE DATABASE`, or `CREATE ROLE`. Default privileges grant it DML on
objects the migration role creates later. Do **not** grant schema-owner
privileges to the runtime role to simplify Prisma.

## Prisma layout

```text
prisma.config.ts          # Prisma 7 dev-kit config (CLI datasource URL
                          #   = DATABASE_MIGRATION_URL, .env autoload)
prisma/
├── schema/               # multi-file schema directory
│   └── schema.prisma     # sole owner of datasource + generator
└── migrations/           # reviewed migration files (empty until the
                          #   first real bounded context arrives)
src/platform/database/
├── config.ts             # env seam → DatabaseConfig
├── client.ts             # createDatabase(): pool + adapter + client
├── generated/            # generated Prisma client (gitignored — run
│                         #   `npm run db:generate`)
└── index.ts              # public exports
```

Future model files split by bounded context — never one giant file, and
never CMS/Auth tables before their owning increments.

## Commands

```bash
npm run db:format           # prisma format
npm run db:validate         # prisma validate
npm run db:generate         # prisma generate → src/platform/database/generated
npm run db:migrate:dev      # prisma migrate dev   (DATABASE_MIGRATION_URL)
npm run db:migrate:deploy   # prisma migrate deploy (non-interactive)
npm run test:db             # Testcontainers PostgreSQL 18 suite
```

## Conventions

- **IDs:** UUIDv7 (`@db.Uuid`, database default `uuidv7()` where cleanly
  supported; explicit UUIDv7 values allowed when a use case requires).
- **Time:** `timestamptz` + UTC everywhere in storage;
  `Asia/Riyadh` is display-only, never storage semantics.
- **Schemas:** PostgreSQL schemas per _major bounded context_ when real
  contexts arrive — not per-table, not `public` as a dumping ground, no
  empty pre-created schemas.

## Migration policy

```text
development (migrate dev) → reviewed migration files → CI verification
→ prisma migrate deploy
```

Production policy is **Expand → Migrate → Switch → Contract**: every
change must be backward-compatible in two steps, never a breaking
single-step rewrite.

Hard rules — **no** production `db push`, **no** ad-hoc `ALTER TABLE` at
deploy, **no** schema mutation on application startup, **no** automatic
destructive repair, **no** reused legacy migrations.

## Testcontainers

`npm run test:db` (`tests/db/`) boots a real ephemeral `postgres:18.6`
container per run — no SQLite, no in-memory substitutes. It verifies the
PG18 version, UTC timezone, `uuidv7()`, adapter-pg connectivity,
timestamptz round-trip, runtime-role DDL denial, migration-identity
authentication, and clean client/pool shutdown. Requires a running
Docker daemon; CI provides one on `ubuntu-latest`.
