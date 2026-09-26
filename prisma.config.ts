import path from "node:path";

import { defineConfig } from "prisma/config";

/**
 * Prisma 7 development-kit configuration.
 *
 * `schema` points at the schema *directory* — Prisma recursively loads
 * every *.prisma file in it (multi-file schema). The CLI datasource URL
 * is used only by migration/introspection commands and always resolves
 * the migration identity (see docs/database.md); it is never the
 * application runtime connection.
 *
 * `.env` is loaded for local development only (Node built-in — no
 * dependency); CI/production supply the variable directly. The URL is
 * left optional so non-database commands (format, validate, generate)
 * run without a live connection; `migrate` commands fail fast with a
 * clear error when it is unset.
 */
try {
  process.loadEnvFile();
} catch {
  // No .env file — expected in CI/production.
}

export default defineConfig({
  schema: path.join("prisma", "schema"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    url: process.env.DATABASE_MIGRATION_URL,
  },
});
