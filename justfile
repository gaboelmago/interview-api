set shell := ["bash", "-eu", "-o", "pipefail", "-c"]

DEFAULT_DATASET := "stress"
DEFAULT_MAX_NODES := "1000"
DEFAULT_VUS := "25"
DEFAULT_DURATION := "1m"

# Allow overrides via `just --set VAR VALUE <recipe>` by exporting.
# Example: `just --set MAX_NODES 2000 --set VUS 10 --set DURATION 30s load-small`
export DATASET := ""
export MAX_NODES := ""
export VUS := ""
export DURATION := ""

SMALL_MAX_NODES_DEFAULT := "500"
SMALL_VUS_DEFAULT := "10"
SMALL_DURATION_DEFAULT := "30s"

WIDE_MAX_NODES_DEFAULT := "2000"
WIDE_VUS_DEFAULT := "25"
WIDE_DURATION_DEFAULT := "1m"

DEEP_MAX_NODES_DEFAULT := "2000"
DEEP_VUS_DEFAULT := "25"
DEEP_DURATION_DEFAULT := "1m"

STRESS_MAX_NODES_DEFAULT := "5000"
STRESS_VUS_DEFAULT := "50"
STRESS_DURATION_DEFAULT := "2m"

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
  docker compose run --rm migrate

# Run the full test suite (ensures DB is up + migrated).
test: check-env
  docker compose up -d db
  docker compose run --rm migrate
  npm test

# --- Load testing (local) ---

wait-health:
  for i in {1..45}; do if curl -fsS http://localhost:3000/api/health >/dev/null; then echo "API ready"; exit 0; fi; echo "waiting for API... ($i/45)"; sleep 2; done; echo "API not ready" >&2; docker compose logs --no-color api db migrate; exit 1

load-tree-baseline:
  docker compose down -v || true
  docker compose up -d --build db migrate api
  just wait-health
  dataset="${DATASET:-{{DEFAULT_DATASET}}}"; max_nodes="${MAX_NODES:-{{DEFAULT_MAX_NODES}}}"; vus="${VUS:-{{DEFAULT_VUS}}}"; duration="${DURATION:-{{DEFAULT_DURATION}}}"; \
    DATASET="$dataset" MAX_NODES="$max_nodes" npm run seed:trees; \
    REPORT_NAME="tree-baseline-$dataset-$max_nodes-${vus}vus-$duration" VUS="$vus" DURATION="$duration" npm run load:tree
  docker compose down -v

load-small:
  DATASET=small MAX_NODES=${MAX_NODES:-{{SMALL_MAX_NODES_DEFAULT}}} VUS=${VUS:-{{SMALL_VUS_DEFAULT}}} DURATION=${DURATION:-{{SMALL_DURATION_DEFAULT}}} just load-tree-baseline

load-wide:
  DATASET=wide MAX_NODES=${MAX_NODES:-{{WIDE_MAX_NODES_DEFAULT}}} VUS=${VUS:-{{WIDE_VUS_DEFAULT}}} DURATION=${DURATION:-{{WIDE_DURATION_DEFAULT}}} just load-tree-baseline

load-deep:
  DATASET=deep MAX_NODES=${MAX_NODES:-{{DEEP_MAX_NODES_DEFAULT}}} VUS=${VUS:-{{DEEP_VUS_DEFAULT}}} DURATION=${DURATION:-{{DEEP_DURATION_DEFAULT}}} just load-tree-baseline

load-stress:
  DATASET=stress MAX_NODES=${MAX_NODES:-{{STRESS_MAX_NODES_DEFAULT}}} VUS=${VUS:-{{STRESS_VUS_DEFAULT}}} DURATION=${DURATION:-{{STRESS_DURATION_DEFAULT}}} just load-tree-baseline