#!/usr/bin/env bash
#
# restore.sh — disaster-recovery restore for exam-paper-system
#
# DROPS and RECREATES the target database, then restores from a pg_dump custom
# format .dump file. Requires interactive "RESTORE" confirmation on stdin.
#
# Usage:
#   ./scripts/restore.sh ./backups/exam-paper-system-YYYYMMDD-HHMMSS.dump

set -euo pipefail

# ---------------------------------------------------------------------------
# Args + paths
# ---------------------------------------------------------------------------
if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <path-to-dump-file>" >&2
  exit 2
fi

DUMP_FILE="$1"

[[ -f "${DUMP_FILE}" ]] || { echo "ERROR: dump file not found: ${DUMP_FILE}" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"

# ---------------------------------------------------------------------------
# Load DATABASE_URL
# ---------------------------------------------------------------------------
[[ -f "${ENV_FILE}" ]] || { echo "ERROR: .env not found at ${ENV_FILE}" >&2; exit 1; }

DATABASE_URL="$(grep -E '^[[:space:]]*DATABASE_URL[[:space:]]*=' "${ENV_FILE}" \
  | tail -n 1 \
  | sed -E 's/^[[:space:]]*DATABASE_URL[[:space:]]*=[[:space:]]*//; s/^["'\'']//; s/["'\'']$//' \
  || true)"

[[ -n "${DATABASE_URL}" ]] || { echo "ERROR: DATABASE_URL missing in ${ENV_FILE}" >&2; exit 1; }

export DATABASE_URL

# ---------------------------------------------------------------------------
# Tool checks
# ---------------------------------------------------------------------------
for cmd in pg_restore psql; do
  command -v "${cmd}" >/dev/null 2>&1 || { echo "ERROR: ${cmd} not on PATH" >&2; exit 1; }
done

# ---------------------------------------------------------------------------
# Parse DATABASE_URL — postgresql://user:pass@host:port/dbname?args
# ---------------------------------------------------------------------------
# Strip scheme
URL_NO_SCHEME="${DATABASE_URL#*://}"
# Strip query string if any
URL_BASE="${URL_NO_SCHEME%%\?*}"

USERPASS_HOSTPORT="${URL_BASE%%/*}"
DBNAME_RAW="${URL_BASE#*/}"
DBNAME="${DBNAME_RAW%%\?*}"

# user[:pass]@host[:port]
if [[ "${USERPASS_HOSTPORT}" == *"@"* ]]; then
  USERPASS="${USERPASS_HOSTPORT%@*}"
  HOSTPORT="${USERPASS_HOSTPORT##*@}"
else
  USERPASS=""
  HOSTPORT="${USERPASS_HOSTPORT}"
fi

if [[ "${USERPASS}" == *":"* ]]; then
  DBUSER="${USERPASS%%:*}"
  DBPASS="${USERPASS#*:}"
else
  DBUSER="${USERPASS}"
  DBPASS=""
fi

if [[ "${HOSTPORT}" == *":"* ]]; then
  DBHOST="${HOSTPORT%%:*}"
  DBPORT="${HOSTPORT##*:}"
else
  DBHOST="${HOSTPORT}"
  DBPORT="5432"
fi

# URL-decode common percent escapes in password (basic — covers %40 / %23 / %2F)
url_decode() {
  local s="$1"
  s="${s//%40/@}"
  s="${s//%23/#}"
  s="${s//%2F/\/}"
  s="${s//%2f/\/}"
  s="${s//%3A/:}"
  s="${s//%3a/:}"
  printf '%s' "${s}"
}
DBPASS="$(url_decode "${DBPASS}")"

# Maintenance URL targets the "postgres" DB on the same server, so we can
# DROP/CREATE the application DB.
ADMIN_URL_BASE="postgresql://${USERPASS}@${DBHOST}:${DBPORT}"
ADMIN_URL="${ADMIN_URL_BASE}/postgres"

# ---------------------------------------------------------------------------
# Confirmation prompt
# ---------------------------------------------------------------------------
cat <<EOF

WARNING: This will DROP & RECREATE the database "${DBNAME}" at
  ${DBHOST}:${DBPORT}
and restore from:
  ${DUMP_FILE}

All current data in "${DBNAME}" will be LOST.

EOF

printf 'Type "RESTORE" to confirm: '
read -r CONFIRM
if [[ "${CONFIRM}" != "RESTORE" ]]; then
  echo "Aborted." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Terminate active connections, then DROP + CREATE
# ---------------------------------------------------------------------------
export PGPASSWORD="${DBPASS}"

echo ">> Terminating active connections to ${DBNAME}..."
psql "${ADMIN_URL}" -v ON_ERROR_STOP=1 -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE datname = '${DBNAME}' AND pid <> pg_backend_pid();
" >/dev/null

echo ">> Dropping database ${DBNAME} (if exists)..."
psql "${ADMIN_URL}" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${DBNAME}\";" >/dev/null

echo ">> Creating database ${DBNAME}..."
psql "${ADMIN_URL}" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${DBNAME}\";" >/dev/null

# ---------------------------------------------------------------------------
# pg_restore
# ---------------------------------------------------------------------------
echo ">> Restoring from ${DUMP_FILE}..."
# --clean --if-exists is safe even on a fresh DB; --no-owner avoids role mismatches.
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --dbname="${DATABASE_URL}" \
  "${DUMP_FILE}"

# ---------------------------------------------------------------------------
# Post-restore validation
# ---------------------------------------------------------------------------
echo ""
echo ">> Post-restore row counts:"

run_count() {
  local label="$1"
  local sql="$2"
  local result
  if result="$(psql "${DATABASE_URL}" -tAc "${sql}" 2>/dev/null)"; then
    printf '   %-32s %s\n' "${label}" "${result}"
  else
    printf '   %-32s %s\n' "${label}" "(table missing or query failed)"
  fi
}

run_count 'User'                'SELECT COUNT(*) FROM "User";'
run_count 'Subject'             'SELECT COUNT(*) FROM "Subject";'
run_count 'Question'            'SELECT COUNT(*) FROM "Question";'
run_count 'Paper'               'SELECT COUNT(*) FROM "Paper";'
run_count 'MorningQuizSession'  'SELECT COUNT(*) FROM "MorningQuizSession";'
run_count 'MorningQuizSubmission' 'SELECT COUNT(*) FROM "MorningQuizSubmission";'

unset PGPASSWORD

echo ""
echo ">> Restore complete."
echo ""
echo "Reminder: if the schema has drifted since this dump was taken, run:"
echo "    npx prisma generate"
echo "    npx prisma migrate deploy   # if new migrations exist"
echo ""
exit 0
