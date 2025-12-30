# interview-api

Simple REST API for a tree structure (NestJS + Postgres + Prisma).

## Ports

- API: `3000`
- Postgres: `5432`

## Quickstart

## Prerequisites

- **[Docker & Docker Compose](https://docs.docker.com/get-docker/)**

  - Includes Docker Compose in Docker Desktop (macOS, Windows, Linux)

- **[asdf](https://asdf-vm.com/)** (recommended)

  - This repo pins Node version in `.tool-versions`
  - Install the Node.js plugin and run `asdf install`

- **[Node.js v22.15.0](https://nodejs.org/en/download)**

  - If you don’t use asdf, install Node manually

- **[`just`](https://github.com/casey/just#installation)**
  - A handy command runner for one-command workflows
  - Optional but recommended

### Run with Docker (recommended)

1. Copy env file (used automatically at runtime):

```bash
cp .env.example .env
```

2. Start the stack:

```bash
just up
```

If you don’t have `just` installed:

```bash
docker compose up -d --build
```

This starts Postgres, runs migrations via a one-shot `migrate` job, then starts the API.

3. Confirm it’s running:

```bash
curl -sS http://localhost:${API_PORT:-3000}/api/tree
```

### Run locally (without Docker for the API)

If you want to run the Nest app directly on your machine, you still need Postgres running (for example via `docker compose up -d db`).

```bash
npm install
npx prisma migrate deploy
npm run start:dev
```

## API

Base URL: `http://localhost:${API_PORT:-3000}`

- `GET /api/tree` — list trees (nested)
- `POST /api/tree` — create node under parent
- `GET /api/health` — liveness (process up)
- `GET /api/ready` — readiness (DB reachable)

## Phase 17 Notes (Pagination / Filtering)

`GET /api/tree` is intentionally **unpaginated and unfiltered by default** for this assignment:

- It returns **all root nodes**, each with **full nested children**.
- No query params are required or applied by default.

### Operational limits

`GET /api/tree` currently loads all nodes from the database and builds the nested response **in-memory**.

- Very large trees can increase memory usage and response size.
- This is acceptable for the assignment’s scope, but in a production setting you’d typically add guardrails (caps), timeouts, and/or opt-in root-level pagination.

Guardrails implemented in this repo (opt-in via env):

- `TREE_GET_MAX_NODES`: rejects `GET /api/tree` with 400 if total nodes exceeds the cap
- `TREE_GET_MAX_DEPTH`: rejects `GET /api/tree` with 400 if computed depth exceeds the cap

Additional hardening (Phase 17 Part C):

- **Node HTTP server timeouts** (configured in `src/main.ts` after `listen()`):
  - `SERVER_KEEP_ALIVE_TIMEOUT_MS`
  - `SERVER_HEADERS_TIMEOUT_MS` (must be greater than keep-alive; enforced)
  - `SERVER_REQUEST_TIMEOUT_MS`
- **Postgres statement timeout** (server-side):
  - `DB_STATEMENT_TIMEOUT_MS` injects `options=-c statement_timeout=...` into `DATABASE_URL` unless one is already present

## OpenAPI / Swagger

- Swagger UI: `GET /api/docs`
- OpenAPI JSON: `GET /api/openapi.json`

### Versioning

This API supports URI versioning:

- Versioned: `/api/v1/...` (recommended for clients)
- Unversioned: `/api/...` (kept for backwards compatibility)

### OpenAPI snapshot (CI guard)

This repo includes an OpenAPI snapshot to catch accidental contract drift.

- Check via tests: `npm test`
- Update the snapshot intentionally: `npm run openapi:snapshot`

## Error Responses

All API errors follow a single JSON envelope (clients can depend on these fields):

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["label should not be empty"],
  "path": "/api/tree",
  "timestamp": "2025-12-30T00:00:00.000Z",
  "requestId": "<id>"
}
```

Notes:

- `message` is either a string or a string array (validation errors are typically arrays).
- `requestId` is echoed from `X-Request-Id` when provided; otherwise generated.

### Examples

List all root trees (with nested children):

```bash
curl -sS http://localhost:${API_PORT:-3000}/api/tree
```

Create a child under an existing parent:

```bash
curl -sS -X POST http://localhost:${API_PORT:-3000}/api/tree \
	-H 'content-type: application/json' \
	-d '{"label":"child","parentId":1}'
```

## Notes

- **Tree model choice:** Adjacency list (`TreeNode` rows with an optional `parentId`) via a self-relation in Prisma.
- **Nested output approach:** `GET /api/tree` queries all nodes once and builds the nested response in-memory by mapping `id -> node` and attaching children to parents; only roots are returned.
- **Abuse protection:** request body size limit (`BODY_LIMIT`) and basic in-app throttling (`THROTTLE_TTL_SECONDS`, `THROTTLE_LIMIT`). Throttling is in-memory (single-instance) by design.

## Tests

- Fast (no DB): `npm run test:fast`
- Full (requires Postgres): `just test` (recommended) or `npm test`
- Style: integration-style tests boot a real Nest app via `@nestjs/testing` and hit it via `supertest`.
- DB: tests expect Postgres to be available and use Prisma; e2e tests reset state by truncating the `TreeNode` table.

## Lint

- Check: `npm run lint`
- Auto-fix: `npm run lint:fix`

## Git Hooks

- This repo uses a minimal `core.hooksPath` setup to run a pre-commit hook from `.githooks/`.
- Local pre-commit runs: `npm run lint` and `npm run test:fast` (DB-free).
- Hooks are configured automatically after `npm install` via the `prepare` script.
- To bypass hooks intentionally: `git commit --no-verify`

3. Install and run the API:

```bash
npm install
npm run start:dev
```

## Future Improvements

- Further tighten Docker production hardening (e.g., non-root user, read-only filesystem, and CI image scanning).
