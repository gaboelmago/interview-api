# interview-api

Simple REST API for a tree structure (NestJS + Postgres + Prisma).

## Ports

- API: `3000`
- Postgres: `5432`

## Quickstart

1. Copy env file (used automatically at runtime):

```bash
cp .env.example .env
```

2. Start dependencies (TBD: Docker Compose will be added in later phases).

3. Install and run the API:

```bash
npm install
npm run start:dev
```

## API

- `GET /api/tree` — list trees (nested)
- `POST /api/tree` — create node under parent
