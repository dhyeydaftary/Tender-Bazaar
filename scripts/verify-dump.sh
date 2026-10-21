#!/bin/sh
# ---------------------------------------------------------------------------
# verify-dump.sh — validate a PostgreSQL backup archive before a release.
#
# Usage:  sh scripts/verify-dump.sh <dump-file>
#         exit 0 = the archive is READABLE
#         exit 1 = STOP. You do not have a usable backup.
#         exit 2 = usage error
#
# Handles BOTH backup formats this project produces:
#
#   *.sql.gz   plain SQL, gzipped — what scripts/backup.sh writes.
#              Validated with `gzip -t` plus a content check.
#   *.dump     custom format from `pg_dump -Fc`.
#              Validated with `pg_restore -l`.
#
# The format is detected, not assumed. An earlier version of this script only
# understood the custom format and reported a perfectly good .sql.gz from
# scripts/backup.sh as "the archive is unusable" — a false STOP that would
# either block a release on a healthy backup or push the operator away from
# scripts/backup.sh (which has integrity checks, never-overwrite and retention
# safety) towards an ad-hoc dump that has none. Measured: a 7,331-byte .sql.gz
# passed `gzip -t` and restored 26/26 tables through psql while this script
# exited 1.
#
# This validates that the archive PARSES. It is NOT a restore rehearsal and
# does not prove a restore will succeed — see section 10 of
# docs/release-runbook.md for that.
#
# Why a dedicated script rather than a one-liner: the runbook previously said
#
#     pg_restore -l "tb-${STAMP}.dump" | head
#
# which reports the exit status of `head`, not of `pg_restore`. Measured
# against a truncated archive, pg_restore printed "could not read from input
# file: end of file" and the pipeline still exited 0, so the check passed on a
# broken backup. `scripts/backup.sh` avoids the same class of bug with
# PIPESTATUS; this script avoids it by not using a pipeline at all.
#
# `pg_dump` exiting 0 is also not sufficient: it can exit 0 having written a
# short file if the disk filled or the stream was interrupted.
# ---------------------------------------------------------------------------
set -eu

if [ "$#" -ne 1 ]; then
  echo "usage: sh scripts/verify-dump.sh <dump-file>" >&2
  exit 2
fi

DUMP="$1"
WORK="$(mktemp)"
ERR="$(mktemp)"
trap 'rm -f "$WORK" "$ERR"' EXIT

note_not_proof() {
  echo ""
  echo "This proves the archive parses and lists the expected objects."
  echo "It does NOT prove that a restore will succeed, and the entry count is"
  echo "NOT a completeness check — a table dumped with zero rows still counts."
  echo "For a high-risk or destructive release, rehearse the restore into a"
  echo "scratch database first: docs/release-runbook.md section 10."
}

# ── 1. The file exists and is not zero-length ──────────────────────────────
if [ ! -s "$DUMP" ]; then
  echo "FATAL: '$DUMP' is missing or zero-length. STOP — you have no backup." >&2
  exit 1
fi

# ── 2. Detect the format by testing it, not by file extension ──────────────
# A gzip member answers `gzip -t`; a custom-format archive does not. Testing
# rather than trusting the name means a mislabelled file is still handled
# correctly. Each branch checks its own command's exit status directly.
if gzip -t "$DUMP" 2>"$ERR"; then
  FORMAT="plain-sql-gzip"
elif pg_restore -l "$DUMP" >"$WORK" 2>"$ERR"; then
  FORMAT="custom"
else
  echo "FATAL: '$DUMP' is neither a readable gzip archive nor a readable" >&2
  echo "       custom-format pg_dump archive. STOP — it is unusable." >&2
  sed -n '1,10p' "$ERR" >&2
  exit 1
fi

case "$FORMAT" in
  plain-sql-gzip)
    # gzip -t already proved the compressed stream is intact end to end.
    # Now confirm the SQL inside is a TenderBazaar dump with data in it.
    if ! gunzip -c "$DUMP" >"$WORK" 2>"$ERR"; then
      echo "FATAL: '$DUMP' passed gzip -t but could not be decompressed. STOP." >&2
      sed -n '1,10p' "$ERR" >&2
      exit 1
    fi

    if ! grep -q "_prisma_migrations" "$WORK"; then
      echo "FATAL: '_prisma_migrations' is not in the dump. STOP." >&2
      echo "       A restore from this backup would present as a database with" >&2
      echo "       tables but no migration history, which db-init treats as a" >&2
      echo "       baseline candidate. Recovering from it would be much harder." >&2
      exit 1
    fi

    # Data arrives as COPY blocks by default, or INSERTs with --inserts.
    DATA_COUNT=$(grep -c -E "^(COPY |INSERT INTO )" "$WORK" || true)
    if [ "${DATA_COUNT:-0}" -eq 0 ]; then
      echo "FATAL: the dump contains no data statements (schema-only?). STOP." >&2
      exit 1
    fi

    TABLES=$(grep -c -E "^CREATE TABLE " "$WORK" || true)
    SIZE=$(wc -c <"$DUMP" | tr -d ' ')
    echo "Archive READABLE (plain SQL, gzipped): ${DATA_COUNT} data statements,"
    echo "${TABLES} CREATE TABLE statements, ${SIZE} compressed bytes."
    note_not_proof
    echo ""
    echo "Restore this format with psql, NOT pg_restore:"
    echo "  gunzip -c '$DUMP' | psql -U postgres -d <new-database>"
    ;;

  custom)
    # $WORK already holds the complete `pg_restore -l` listing, captured with
    # no pipeline so pg_restore's own exit status was the one tested above.
    if ! grep -q "_prisma_migrations" "$WORK"; then
      echo "FATAL: '_prisma_migrations' is not in the archive. STOP." >&2
      echo "       A restore from this dump would present as a database with" >&2
      echo "       tables but no migration history, which db-init treats as a" >&2
      echo "       baseline candidate. Recovering from it would be much harder." >&2
      exit 1
    fi

    if ! grep -q "TABLE DATA" "$WORK"; then
      echo "FATAL: the archive contains no table data (schema-only dump?). STOP." >&2
      exit 1
    fi

    DATA_COUNT=$(grep -c "TABLE DATA" "$WORK" || true)
    TOC_LINES=$(wc -l <"$WORK" | tr -d ' ')
    echo "Archive READABLE (custom format): ${DATA_COUNT} TABLE DATA entries,"
    echo "${TOC_LINES} TOC lines."
    note_not_proof
    echo ""
    echo "Restore this format with pg_restore:"
    echo "  pg_restore -U postgres -d <new-database> --exit-on-error '$DUMP'"
    ;;
esac
