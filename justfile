set shell := ["bash", "-eu", "-o", "pipefail", "-c"]

# Ensure local environment variables exist.
check-env:
  test -f .env || { echo "Missing .env. Copy .env.example -> .env and set values." >&2; exit 1; }

# Start API + DB (builds API image).
up: check-env
  docker compose up -d --build

# Stop the stack.
down:
  docker compose down

# Follow logs for all services.
logs:
  docker compose logs -f --tail=200

# Apply migrations to the database.
migrate: check-env
  docker compose up -d db
  npx prisma migrate deploy

# Run the full test suite (ensures DB is up + migrated).
test: check-env
  docker compose up -d db
  npx prisma migrate deploy
  npm test
