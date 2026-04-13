#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# TenderBazaar — Single-click Docker launcher
# Usage: ./scripts/docker-start.sh          (development)
#        ./scripts/docker-start.sh --prod   (production)
#        ./scripts/docker-start.sh --down   (stop everything)
#        ./scripts/docker-start.sh --reset  (destroy volumes & rebuild)
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${CYAN}[TenderBazaar]${NC} $1"; }
ok()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }

# ── Parse args ─────────────────────────────────────────────────
MODE="dev"
ACTION="up"
for arg in "$@"; do
  case $arg in
    --prod)  MODE="prod" ;;
    --down)  ACTION="down" ;;
    --reset) ACTION="reset" ;;
    --help|-h)
      echo "Usage: $0 [--prod] [--down] [--reset]"
      echo ""
      echo "  (default)  Build & start all services in development mode"
      echo "  --prod     Use production overrides (resource limits, no exposed infra ports)"
      echo "  --down     Stop all running containers"
      echo "  --reset    Stop containers, remove volumes, and rebuild from scratch"
      exit 0
      ;;
  esac
done

# ── Teardown actions ──────────────────────────────────────────
if [ "$ACTION" = "down" ]; then
  log "Stopping all TenderBazaar containers..."
  docker compose down
  ok "All containers stopped."
  exit 0
fi

if [ "$ACTION" = "reset" ]; then
  warn "This will destroy ALL data (database, redis, elasticsearch)."
  read -rp "Are you sure? (y/N) " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    log "Cancelled."
    exit 0
  fi
  log "Stopping containers and removing volumes..."
  docker compose down -v
  ok "Clean slate. Re-run without --reset to start fresh."
  exit 0
fi

# ── Pre-flight checks ────────────────────────────────────────
log "Running pre-flight checks..."

if ! command -v docker &>/dev/null; then
  err "Docker is not installed. Please install Docker Desktop: https://docs.docker.com/get-docker/"
  exit 1
fi

if ! docker info &>/dev/null 2>&1; then
  err "Docker daemon is not running. Please start Docker Desktop."
  exit 1
fi

if ! command -v docker compose version &>/dev/null 2>&1 && ! docker compose version &>/dev/null 2>&1; then
  err "Docker Compose is not available. Please update Docker Desktop."
  exit 1
fi

ok "Docker is running."

# ── Create .env if missing ───────────────────────────────────
if [ ! -f .env ]; then
  warn ".env file not found — copying from .env.example"
  cp .env.example .env
  ok "Created .env from .env.example"
  warn "Please review .env and fill in your API keys (Razorpay, Anthropic, etc.)"
  warn "Continuing with defaults — some features may not work without real keys."
  echo ""
fi

# ── Build compose command ────────────────────────────────────
COMPOSE_CMD="docker compose"
if [ "$MODE" = "prod" ]; then
  COMPOSE_CMD="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
  log "Using PRODUCTION configuration"
else
  log "Using DEVELOPMENT configuration"
fi

# ── Build & start ────────────────────────────────────────────
echo ""
log "${BOLD}Building Docker images...${NC} (this may take a few minutes on first run)"
echo ""

$COMPOSE_CMD build

echo ""
log "${BOLD}Starting all services...${NC}"
echo ""

$COMPOSE_CMD up -d

# ── Wait for health checks ───────────────────────────────────
log "Waiting for services to become healthy..."

wait_for_service() {
  local name=$1
  local max_wait=${2:-120}
  local elapsed=0

  while [ $elapsed -lt $max_wait ]; do
    status=$(docker inspect --format='{{.State.Health.Status}}' "$name" 2>/dev/null || echo "missing")
    case $status in
      healthy)
        ok "$name is healthy"
        return 0
        ;;
      unhealthy)
        err "$name is unhealthy — check logs with: docker logs $name"
        return 1
        ;;
      missing)
        # Container may not have health check (web, admin) — just check if running
        running=$(docker inspect --format='{{.State.Status}}' "$name" 2>/dev/null || echo "missing")
        if [ "$running" = "running" ]; then
          ok "$name is running"
          return 0
        fi
        ;;
    esac
    sleep 3
    elapsed=$((elapsed + 3))
  done

  warn "$name did not become healthy within ${max_wait}s"
  return 1
}

# Wait for infra first
wait_for_service "tenderbazaar-postgres" 60
wait_for_service "tenderbazaar-redis" 30
wait_for_service "tenderbazaar-elasticsearch" 90

# Wait for db-init to complete
log "Waiting for database migration & seed..."
MAX_INIT_WAIT=120
INIT_ELAPSED=0
while [ $INIT_ELAPSED -lt $MAX_INIT_WAIT ]; do
  init_status=$(docker inspect --format='{{.State.Status}}' "tenderbazaar-db-init" 2>/dev/null || echo "missing")
  init_exit=$(docker inspect --format='{{.State.ExitCode}}' "tenderbazaar-db-init" 2>/dev/null || echo "-1")
  if [ "$init_status" = "exited" ]; then
    if [ "$init_exit" = "0" ]; then
      ok "Database schema pushed & seeded successfully"
      break
    else
      err "Database init failed (exit code $init_exit). Check logs:"
      echo "  docker logs tenderbazaar-db-init"
      break
    fi
  fi
  sleep 3
  INIT_ELAPSED=$((INIT_ELAPSED + 3))
done

# Wait for app services
wait_for_service "tenderbazaar-api-server" 60
wait_for_service "tenderbazaar-ai-service" 60
wait_for_service "tenderbazaar-web" 60
wait_for_service "tenderbazaar-admin" 60
wait_for_service "tenderbazaar-scraper" 60

# ── Print access URLs ────────────────────────────────────────
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  TenderBazaar is running!${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${CYAN}Web App${NC}           http://localhost:3000"
echo -e "  ${CYAN}Admin Dashboard${NC}   http://localhost:3001"
echo -e "  ${CYAN}API Server${NC}        http://localhost:4000"
echo -e "  ${CYAN}AI Service${NC}        http://localhost:5050"
echo ""
if [ "$MODE" = "dev" ]; then
echo -e "  ${CYAN}PostgreSQL${NC}        localhost:5432  (user: postgres / pass: postgres)"
echo -e "  ${CYAN}Redis${NC}             localhost:6379"
echo -e "  ${CYAN}Elasticsearch${NC}     http://localhost:9200"
echo ""
fi
echo -e "  ${YELLOW}Stop:${NC}    ./scripts/docker-start.sh --down"
echo -e "  ${YELLOW}Reset:${NC}   ./scripts/docker-start.sh --reset"
echo -e "  ${YELLOW}Logs:${NC}    docker compose logs -f [service]"
echo ""
