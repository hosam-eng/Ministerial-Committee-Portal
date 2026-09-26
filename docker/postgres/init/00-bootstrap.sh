#!/bin/sh
# Executed once by docker-entrypoint-initdb.d on first cluster init.
# Applies the shared role bootstrap with the database name bound in.
set -eu

psql -v ON_ERROR_STOP=1 \
  -v db="$POSTGRES_DB" \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  -f /mcp-sql/001-roles.sql
