#!/bin/sh
# ───────────────────────────────────────────────────────────────────────────
# db-init — database initialization for TenderBazaar
#
# Replaces the previous startup command:
#     prisma db push --skip-generate --accept-data-loss && prisma db seed
#
# which rewrote the live schema to match schema.prisma on every `compose up`
# (dropping whatever did not match, with no migration history) and then ran the
# seed, which reset administrator passwords and re-inserted demo tenders.
#
# This script instead:
#   1. validates that the connection URL is well-formed,
#   2. applies committed Prisma migrations with `migrate deploy`,
#      baselining a pre-migrations database when one is detected,
#   3. runs the seed ONLY when DB_INIT_SEED=true.
#
# It never drops, resets or force-pushes schema, and never prints secrets.
# ───────────────────────────────────────────────────────────────────────────
set -eu

log() { printf '[db-init] %s\n' "$1"; }
fail() { printf '[db-init] ERROR: %s\n' "$1" >&2; exit 1; }

[ -n "${DATABASE_URL:-}" ] || fail "DATABASE_URL is not set."

# ── Guard: URL-unsafe characters in the password ──────────────────────────
# docker-compose.yml builds DATABASE_URL by interpolating POSTGRES_PASSWORD.
# A password containing characters that are reserved in a URI (@ : / ? # etc.)
# silently truncates or re-targets the connection string, which surfaces much
# later as a confusing authentication or "database does not exist" error.
# Fail fast instead. The password itself is never echoed.
password=$(printf '%s' "$DATABASE_URL" | sed -n 's|^[a-zA-Z+]*://[^:/]*:\([^@]*\)@.*|\1|p')
if [ -n "$password" ] && printf '%s' "$password" | grep -q '[^A-Za-z0-9._~%-]'; then
  fail "the database password contains characters that are reserved in a URL.
       Use only A-Z a-z 0-9 - _ . ~ in POSTGRES_PASSWORD, or percent-encode it."
fi

# ── Apply migrations ──────────────────────────────────────────────────────
log "Probing current schema state..."
state=$(node /app/docker/db-init-check.js)

case "$state" in
  fresh)
    log "Empty database detected — applying all migrations."
    ;;
  baseline)
    log "Existing schema with no migration history detected (legacy 'db push' database)."

    # Verify the live schema actually matches schema.prisma BEFORE baselining.
    #
    # Baselining is an assertion: it tells Prisma "0_init is already applied"
    # without running it. If the live database drifted from the schema while it
    # was managed by `prisma db push` -- a column that was never pushed, a type
    # that differs, an index dropped by hand -- that assertion is false, and the
    # drift becomes invisible: every later `migrate deploy` builds on a starting
    # point that never existed, and fails somewhere far from the real cause (or
    # appears to succeed against a schema the code does not expect).
    #
    # `migrate diff` is read-only and needs no shadow database in this form: it
    # compares the live database against schema.prisma and exits 2 when they
    # differ. Refuse to baseline in that case rather than record a false
    # history. Reconciling it is a deliberate human decision.
    log "Checking the live schema matches schema.prisma before baselining..."
    set +e
    drift=$(npx prisma migrate diff       --from-url "$DATABASE_URL"       --to-schema-datamodel ./prisma/schema.prisma       --exit-code 2>&1)
    drift_status=$?
    set -e

    case "$drift_status" in
      0)
        log "Live schema matches schema.prisma."
        ;;
      2)
        printf '[db-init] %s
' "$drift" >&2
        fail "the existing database does NOT match schema.prisma (see the diff above).
       Baselining now would record a migration history that never happened and
       hide this drift from every later migration. Reconcile the schema by hand,
       or capture the real starting state as a migration, then retry.
       No changes have been made to the database."
        ;;
      *)
        printf '[db-init] %s
' "$drift" >&2
        fail "could not compare the existing database against schema.prisma.
       Refusing to baseline without that check. No changes have been made."
        ;;
    esac

    log "Baselining: marking 0_init as already applied. No tables are created or dropped."
    npx prisma migrate resolve --applied 0_init
    ;;
  deploy)
    log "Migration history present — applying pending migrations only."
    ;;
  *)
    fail "unexpected schema state '$state' from the probe."
    ;;
esac

npx prisma migrate deploy
log "Migrations applied."

# ── Optional seed ─────────────────────────────────────────────────────────
# Opt-in only. The seed creates administrator accounts and demo tenders, so it
# must never run as part of an ordinary production deploy or container restart.
if [ "${DB_INIT_SEED:-false}" = "true" ]; then
  log "DB_INIT_SEED=true — running seed (development/demo data)."
  npx prisma db seed
  log "Seed complete."
else
  log "DB_INIT_SEED is not 'true' — skipping seed (no administrator or demo data changes)."
fi

log "Database initialization finished successfully."
