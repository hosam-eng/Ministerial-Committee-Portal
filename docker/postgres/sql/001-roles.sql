-- IMP-02 database role bootstrap (development/test clusters only).
--
-- Executed through docker/postgres/init/00-bootstrap.sh as:
--   psql -v ON_ERROR_STOP=1 -v db=<database name> -f 001-roles.sql
-- The :"db" identifier is substituted at runtime; this file is never
-- applied with production credentials.

-- Logical owner of all application objects (never logs in directly).
CREATE ROLE mcp_owner NOLOGIN;

-- Migration identity: performs schema evolution only (Prisma Migrate),
-- including shadow-database creation for `migrate dev`.
CREATE ROLE mcp_migrate LOGIN PASSWORD 'mcp_migrate_dev' CREATEDB;

-- Runtime identity: least-privilege application DML. No superuser, no
-- CREATEDB, no CREATEROLE, and — below — no schema-creation rights.
CREATE ROLE mcp_runtime LOGIN PASSWORD 'mcp_runtime_dev';

-- The database itself is owned by the NOLOGIN owner; the migration role
-- reaches owner-level schema-evolution rights strictly through membership.
ALTER DATABASE :"db" OWNER TO mcp_owner;
GRANT mcp_owner TO mcp_migrate;

-- Runtime: connect + use objects, nothing structural.
GRANT CONNECT ON DATABASE :"db" TO mcp_runtime;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO mcp_runtime;

-- Objects the migration role creates in the future become usable by the
-- runtime role automatically (bounded-context schemas included).
ALTER DEFAULT PRIVILEGES FOR ROLE mcp_migrate
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mcp_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE mcp_migrate
  GRANT USAGE, SELECT ON SEQUENCES TO mcp_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE mcp_migrate
  GRANT USAGE ON SCHEMAS TO mcp_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE mcp_migrate
  GRANT EXECUTE ON FUNCTIONS TO mcp_runtime;
