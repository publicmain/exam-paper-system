#!/usr/bin/env bash
#
# backup.sh — daily PostgreSQL backup for exam-paper-system
#
# Reads DATABASE_URL from the project root .env, runs pg_dump in custom format
# (compressed level 9), rotates the 7 most recent dumps, and logs to
# ./backups/backup.log. Exits non-zero on any error so cron can detect failures.
#
# Usage:
#   ./scripts/backup.sh
#
# Cron (suggested):
#   0 3 * * * cd /path/to/exam-paper-system && ./scripts/backup.sh >> backups/cron.log 2>&1

set -euo pipefail

# ---------------------------------------------------------------------------
# Resolve project root (one level up from this script)
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_DIR="${PROJECT_ROOT}/backups"
LOG_FILE="${BACKUP_DIR}/backup.log"
ENV_FILE="${PROJECT_ROOT}/.env"
RETAIN_COUNT=7

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
timestamp() { date +'%Y-%m-%d %H:%M:%S'; }

log() {
  local msg="$1"
  mkdir -p "${BACKUP_DIR}"
  echo "[$(timestamp)] ${msg}" | tee -a "${LOG_FILE}"
}

die() {
  log "ERROR: $1"
  exit 1
}

# ---------------------------------------------------------------------------
# 1. Load DATABASE_URL from .env
# ---------------------------------------------------------------------------
[[ -f "${ENV_FILE}" ]] || die ".env not found at ${ENV_FILE}"

# Pull only the DATABASE_URL line, strip quotes and surrounding whitespace.
DATABASE_URL="$(grep -E '^[[:space:]]*DATABASE_URL[[:space:]]*=' "${ENV_FILE}" \
  | tail -n 1 \
  | sed -E 's/^[[:space:]]*DATABASE_URL[[:space:]]*=[[:space:]]*//; s/^["'\'']//; s/["'\'']$//' \
  || true)"

[[ -n "${DATABASE_URL}" ]] || die "DATABASE_URL is empty or missing in ${ENV_FILE}"

export DATABASE_URL

# ---------------------------------------------------------------------------
# 2. Verify pg_dump is on PATH
# ---------------------------------------------------------------------------
command -v pg_dump >/dev/null 2>&1 || die "pg_dump not found on PATH"

# ---------------------------------------------------------------------------
# 3. Ensure backup dir exists
# ---------------------------------------------------------------------------
mkdir -p "${BACKUP_DIR}"

# ---------------------------------------------------------------------------
# 4. Run pg_dump in custom format (allows parallel restore + selective restore)
# ---------------------------------------------------------------------------
OUTFILE="${BACKUP_DIR}/exam-paper-system-$(date +%Y%m%d-%H%M%S).dump"

log "Starting pg_dump -> ${OUTFILE}"

if ! pg_dump \
      --no-owner \
      --format=custom \
      --compress=9 \
      --file="${OUTFILE}" \
      "${DATABASE_URL}"; then
  die "pg_dump failed"
fi

# Size for the log (portable across GNU + BSD stat)
if SIZE_BYTES="$(stat -c%s "${OUTFILE}" 2>/dev/null)"; then
  :
else
  SIZE_BYTES="$(stat -f%z "${OUTFILE}" 2>/dev/null || echo '?')"
fi

log "Backup completed: ${OUTFILE} (${SIZE_BYTES} bytes)"

# ---------------------------------------------------------------------------
# 5. Rotation: keep the RETAIN_COUNT most recent .dump files
# ---------------------------------------------------------------------------
log "Rotating: retaining ${RETAIN_COUNT} most recent dumps"

# Use a sub-shell so we can cd safely; quoting + ls -t is acceptable here because
# our backup filenames are predictable timestamped names with no spaces.
(
  cd "${BACKUP_DIR}"
  # shellcheck disable=SC2012
  ls -t exam-paper-system-*.dump 2>/dev/null | tail -n +$((RETAIN_COUNT + 1)) | while IFS= read -r old; do
    [[ -n "${old}" ]] || continue
    log "Deleting old backup: ${old}"
    rm -f -- "${old}"
  done
)

log "Done."
exit 0
