#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# TenderBazaar — PostgreSQL backup
#
#   ./scripts/backup.sh                      # back up, keep the last 30
#   BACKUP_DIR=/mnt/backups ./scripts/backup.sh
#   RETAIN=60 ./scripts/backup.sh
#   PRUNE=false ./scripts/backup.sh          # never delete anything
#
# Reads DATABASE_URL from the environment, or from .env when it is not already
# set. Writes <BACKUP_DIR>/tenderbazaar_<timestamp>.sql.gz.
#
# Safety properties (the previous version had none of these):
#   * fails fast — `set -euo pipefail` plus an explicit check that pg_dump
#     succeeded. Before, `pg_dump | gzip` reported success whenever gzip
#     succeeded, so a failed dump produced a VALID, EMPTY .gz "backup" and the
#     retention step then deleted an older, good one.
#   * never overwrites — the filename includes seconds, and an existing file
#     with the same name aborts the run instead of being clobbered.
#   * writes to a temporary file and renames it into place only after a
#     successful dump, so an interrupted run cannot leave a half-written file
#     that looks like a backup.
#   * verifies the archive is readable (gzip -t) and non-trivial in size.
#   * prunes only AFTER a verified successful backup, only files matching this
#     script's own naming pattern, and only the oldest beyond RETAIN.
#   * never prints the connection string or the password.
#
# RESTORE (verify this on a disposable database before you need it):
#   createdb -U postgres tenderbazaar_restore_test
#   gunzip -c backups/tenderbazaar_<timestamp>.sql.gz \
#     | psql -U postgres -d tenderbazaar_restore_test
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETAIN="${RETAIN:-30}"
PRUNE="${PRUNE:-true}"
MIN_BYTES="${MIN_BYTES:-1024}"
PREFIX="tenderbazaar_"

log()  { printf '[backup] %s\n' "$1"; }
fail() { printf '[backup] ERROR: %s\n' "$1" >&2; exit 1; }

# ── Resolve DATABASE_URL without echoing it ────────────────────────────────
if [ -z "${DATABASE_URL:-}" ] && [ -f .env ]; then
  # shellcheck disable=SC2046
  DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | head -n1 | cut -d= -f2-)"
fi
[ -n "${DATABASE_URL:-}" ] || fail "DATABASE_URL is not set (and not found in .env)."

command -v pg_dump >/dev/null 2>&1 || fail "pg_dump is not installed or not on PATH."
command -v gzip    >/dev/null 2>&1 || fail "gzip is not installed or not on PATH."

mkdir -p "$BACKUP_DIR"

STAMP="$(date +%Y%m%d_%H%M%S)"
TARGET="${BACKUP_DIR}/${PREFIX}${STAMP}.sql.gz"
TEMP="${TARGET}.partial"

# ── Never overwrite ───────────────────────────────────────────────────────
[ -e "$TARGET" ] && fail "refusing to overwrite an existing backup: $TARGET"
[ -e "$TEMP" ]   && fail "a partial file already exists (another run in progress?): $TEMP"

cleanup() { [ -e "$TEMP" ] && rm -f "$TEMP"; }
trap cleanup EXIT

log "Dumping database to $(basename "$TARGET") ..."

# PIPESTATUS so a pg_dump failure is not masked by a successful gzip.
set +e
pg_dump --no-owner --no-privileges "$DATABASE_URL" | gzip > "$TEMP"
STATUS=("${PIPESTATUS[@]}")
set -e

[ "${STATUS[0]}" -eq 0 ] || fail "pg_dump failed (exit ${STATUS[0]}); no backup was written."
[ "${STATUS[1]}" -eq 0 ] || fail "gzip failed (exit ${STATUS[1]}); no backup was written."

# ── Verify before trusting it ─────────────────────────────────────────────
gzip -t "$TEMP" 2>/dev/null || fail "the archive failed its integrity check; no backup was written."

SIZE="$(wc -c < "$TEMP" | tr -d ' ')"
[ "$SIZE" -ge "$MIN_BYTES" ] || fail "the dump is implausibly small (${SIZE} bytes); treating it as a failure."

mv "$TEMP" "$TARGET"
trap - EXIT

log "Backup complete: $TARGET"
log "Size: $(du -h "$TARGET" | cut -f1)"

# ── Prune only after a verified success ───────────────────────────────────
if [ "$PRUNE" != "true" ]; then
  log "PRUNE=$PRUNE — keeping every existing backup."
  exit 0
fi

COUNT="$(find "$BACKUP_DIR" -maxdepth 1 -name "${PREFIX}*.sql.gz" -type f | wc -l | tr -d ' ')"
if [ "$COUNT" -le "$RETAIN" ]; then
  log "Retention: ${COUNT}/${RETAIN} backups kept; nothing to prune."
  exit 0
fi

log "Retention: ${COUNT} backups found, keeping the newest ${RETAIN}."
# Oldest first, drop everything past RETAIN. Only this script's own pattern.
find "$BACKUP_DIR" -maxdepth 1 -name "${PREFIX}*.sql.gz" -type f -print0 \
  | xargs -0 ls -1t 2>/dev/null \
  | tail -n "+$((RETAIN + 1))" \
  | while IFS= read -r old; do
      log "Pruning $(basename "$old")"
      rm -f -- "$old"
    done

log "Done."
