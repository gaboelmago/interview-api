# interview-api

Simple REST API for a tree structure (NestJS + Postgres + Prisma).

## Ports

- API: `3000`
- Postgres: `5432`

## Quickstart

### Prereqs

- Docker + Docker Compose
- Node.js (for running tests locally)
- Optional but recommended: `just` (one-command workflows)

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

## Tests

- Run: `just test` (recommended) or `npm test`
- Style: integration-style tests boot a real Nest app via `@nestjs/testing` and hit it via `supertest`.
- DB: tests expect Postgres to be available and use Prisma; e2e tests reset state by truncating the `TreeNode` table.

## Lint

- Check: `npm run lint`
- Auto-fix: `npm run lint:fix`

## Git Hooks

- This repo uses Husky to run `npm run lint` and `npm test` on every commit.
- Hooks are installed automatically after `npm install` via the `prepare` script.
- To bypass hooks intentionally: `git commit --no-verify`

3. Install and run the API:

```bash
npm install
npm run start:dev
```

## Future Improvements

- Slim the API runtime Docker image: currently the runtime stage copies the full `node_modules` (including dev deps) so the Prisma CLI is available to run `prisma migrate deploy` on container start; reduce image size/attack surface by installing only production deps and/or using a dedicated migration step.
