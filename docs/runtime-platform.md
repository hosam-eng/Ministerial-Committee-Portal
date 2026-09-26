# Runtime Platform (IMP-03)

Cross-cutting runtime infrastructure: typed configuration, the error
model, structured logging, request/trace correlation, OpenTelemetry,
health endpoints, and graceful shutdown. All of it lives under
`src/platform/` and is enforced by ESLint plus the executable
architecture suite (`tests/architecture/`).

## Configuration

`src/platform/config` is the **only** place that reads `process.env`
(enforced by ESLint `no-restricted-syntax` and the boundary suite).

- `validateServerConfig(env)` — pure Zod 4 validation, fails fast with a
  `ConfigurationError` listing invalid setting **names only** (values,
  especially secrets, are never included in errors or logs).
- `getServerConfig()` — memoized process-wide `ServerConfig`, frozen.
- `getPublicConfig()` / `collectPublicEnv()` — public surface; only
  `NEXT_PUBLIC_*` keys can ever reach the browser. `getPublicConfig()`
  currently returns an empty object — no browser-visible configuration
  is required yet, and server-only values never cross this boundary.

Variables (see `.env.example`):

| Variable                      | Required | Notes                                                            |
| ----------------------------- | -------- | ---------------------------------------------------------------- |
| `NODE_ENV`                    | yes      | `development`/`test`/`production`                                |
| `APP_ENV`                     | yes      | `development`/`test`/`production` — required, never defaulted    |
| `LOG_LEVEL`                   | no       | defaults `info` (Pino levels)                                    |
| `DATABASE_URL`                | prod     | runtime role (`mcp_runtime`); required when `APP_ENV=production` |
| `DATABASE_MIGRATION_URL`      | no       | migration role — tooling only                                    |
| `OTEL_SERVICE_NAME`           | no       | defaults `ministerial-committee-portal`                          |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | no       | unset → SDK runs with no exporter                                |

Empty-string optional URLs are treated as unset — the only coercion.

Startup validation runs in `src/instrumentation.ts` (`register()`),
which executes once per Node.js server process — invalid config fails
before traffic is served.

## Errors — RFC 9457

- `AppError` — stable `code` + `httpStatus` + optional `publicMessage`;
  `cause` stays internal for logs.
- `toProblemDetails(error, ctx)` — safe body (`type`, `title`, `status`,
  `detail`, `code`, `requestId`, `instance`). Unknown errors map to a
  generic `INTERNAL_ERROR` — never the raw message, stack, or SQL.
- `problemResponse(error, ctx)` — `application/problem+json` Response
  with `cache-control: no-store` and `x-request-id`.

## Logging

`createLogger()` / `getLogger()` (`src/platform/logging`) — Pino 10,
JSON, ISO timestamps, `service`/`env` base fields, `err`/`error`
serializers, and a `mixin` that attaches `requestId`/`traceId`/`spanId`
when an async context or active span exists.

`redaction.ts` holds the centralized deny-list: authorization/cookie/
api-key headers, passwords, tokens, secrets, connection strings, and
database URLs are censored (`[REDACTED]`) at multiple depths. Request
bodies are never logged.

## Correlation

`src/platform/context` — `AsyncLocalStorage`-backed `RequestContext`
(`requestId`, `traceId`, `spanId`). `src/proxy.ts` (Next 16 convention)
reuses a well-formed inbound `x-request-id` or generates a UUID and
echoes it on the response; `withRequestContext()` scopes route handlers
so concurrent requests stay isolated. `currentTraceIds()` bridges to the
active OpenTelemetry span for log correlation.

## OpenTelemetry

`initTelemetry()` (`src/platform/telemetry`) starts `NodeSDK` once per
process. No vendor/backend is selected: an OTLP HTTP trace exporter is
attached **only** when `OTEL_EXPORTER_OTLP_ENDPOINT` is configured.
Without an endpoint, `spanProcessors`/`logRecordProcessors`/
`metricReaders` are explicitly empty — the SDK would otherwise
auto-configure default OTLP exporters, so the empty arrays are what
guarantee _no exporter, no outbound export attempt, no collector
required_. `getTelemetryState()` exposes whether an exporter was
configured.

## Health

| Route                   | DB? | Healthy               | Degraded                       |
| ----------------------- | --- | --------------------- | ------------------------------ |
| `GET /api/health/live`  | no  | `200 {"status":"ok"}` | —                              |
| `GET /api/health/ready` | yes | `200 {"status":"ok"}` | `503 application/problem+json` |

Readiness probes PostgreSQL through the **runtime** identity
(`DATABASE_URL` / `mcp_runtime`) via `checkDatabaseReadiness()` with a
bounded timeout. Output is intentionally minimal — no credentials, SQL,
or internals. Liveness never touches the database.

## Graceful shutdown

`src/platform/runtime/shutdown.ts` — named closers registered via
`registerShutdownHandler` (idempotent per name), run once via
`runShutdown`, each isolated so one failure can't block the rest, all
bounded by a timeout. `installSignalHandlers()` wires `SIGINT`/`SIGTERM`
once. `instrumentation.ts` registers the database pool and OTel SDK
shutdown.
