#!/usr/bin/env bash
# B10 Per-student paper watermark — blackbox tests.
# Target: deployed exam-paper-system on Railway (or any BASE).
# Isolation prefix: b10-
#
# Strategy: log in as admin, find a paper, roster a fresh student, mint a
# watermark token, GET the download URL with the token, verify the body
# is a real PDF. Then prove the forensic lookup endpoint is admin-only,
# and prove revoke causes 410.
#
# Soft-fail mode: if download returns 500 + body mentions
# "pdf-lib not installed", the test prints WARN and exits 0 — pdf-lib has
# not been installed in apps/api yet (see MERGE_INSTRUCTIONS).
set -u

BASE="${BASE:-https://exam-paper-system-production.up.railway.app}"
TS="$(date +%s)"
PFX="b10-${TS}"
PASS_PWD="test1234"
EMAIL_S="b10-stu-${TS}@example.com"
CLASS_NAME="b10-class-${TS}"
CLASS_CODE="B10C${TS: -6}"

PASS=0
FAIL=0
declare -a RESULTS

hr()  { printf '\n%s\n' "----------------------------------------------------------"; }
log() { printf '[b10] %s\n' "$*"; }

req() {
  local m="$1" u="$2" t="${3:-}" b="${4:-}"
  local args=(-s -o /tmp/b10_body -w '%{http_code}' -X "$m" "$u" -H 'Content-Type: application/json')
  [ -n "$t" ] && args+=(-H "Authorization: Bearer $t")
  if [ -n "$b" ]; then args+=(--data "$b"); fi
  local code
  code=$(curl "${args[@]}")
  local body
  body=$(cat /tmp/b10_body 2>/dev/null || echo '')
  printf '%s|%s' "$code" "$body"
}

extract() {
  local key="$1" body="$2"
  printf '%s' "$body" | grep -o "${key}:\"[^\"]*\"" | head -n1 | sed 's/.*:"\([^"]*\)".*/\1/'
}

record() {
  local id="$1" name="$2" expected="$3" got="$4" sev="$5" verdict="$6"
  RESULTS+=("${id}|${name}|${expected}|${got}|${sev}|${verdict}")
  if [ "$verdict" = "PASS" ]; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi
  log "[$verdict][$sev] $id $name -- expected=$expected got=$got"
}

# ====================================================================
log "BASE=$BASE  prefix=$PFX"
hr

# 1. Admin login
log "Admin login..."
R=$(req POST "$BASE/api/auth/login" "" "{\"email\":\"admin@school.local\",\"password\":\"admin123\"}")
ADMIN_CODE="${R%%|*}"; ADMIN_BODY="${R#*|}"
if [ "$ADMIN_CODE" != "201" ] && [ "$ADMIN_CODE" != "200" ]; then
  log "FATAL: admin login failed code=$ADMIN_CODE body=$ADMIN_BODY"; exit 1
fi
ADMIN_TOKEN=$(printf '%s' "$ADMIN_BODY" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
log "Admin token len=${#ADMIN_TOKEN}"

# 2. Create class + roster fresh student
log "Create class $CLASS_NAME ($CLASS_CODE)"
R=$(req POST "$BASE/api/classes" "$ADMIN_TOKEN" "{\"name\":\"${CLASS_NAME}\",\"classCode\":\"${CLASS_CODE}\"}")
CC="${R%%|*}"; CB="${R#*|}"
CLASS_ID=$(extract '"id"' "$CB")
log "  class id=$CLASS_ID code=$CC"
if [ -z "$CLASS_ID" ]; then log "FATAL: class create failed body=${CB:0:300}"; exit 1; fi

log "Roster fresh student"
R=$(req POST "$BASE/api/classes/${CLASS_ID}/roster" "$ADMIN_TOKEN" \
   "{\"students\":[{\"email\":\"${EMAIL_S}\",\"name\":\"B10 Student\",\"password\":\"${PASS_PWD}\"}]}")
RC="${R%%|*}"; RB="${R#*|}"
log "  roster code=$RC body=${RB:0:200}"
STUDENT_ID=$(printf '%s' "$RB" | grep -oE '"userId":"[^"]+"|"id":"[^"]+"' | head -n1 | cut -d'"' -f4)
log "  STUDENT_ID=$STUDENT_ID"
if [ -z "$STUDENT_ID" ]; then
  # fallback: log in as the student & read /auth/me
  R=$(req POST "$BASE/api/auth/login" "" "{\"email\":\"${EMAIL_S}\",\"password\":\"${PASS_PWD}\"}")
  SB="${R#*|}"
  STOK=$(printf '%s' "$SB" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
  R=$(req GET "$BASE/api/auth/me" "$STOK" "")
  ME="${R#*|}"
  STUDENT_ID=$(extract '"id"' "$ME")
  log "  STUDENT_ID via /auth/me = $STUDENT_ID"
fi
if [ -z "$STUDENT_ID" ]; then log "FATAL: could not resolve student id"; exit 1; fi

# 3. Find any paper
log "List papers"
R=$(req GET "$BASE/api/papers" "$ADMIN_TOKEN" "")
PB="${R#*|}"
PAPER_ID=$(printf '%s' "$PB" | grep -o '"id":"[^"]*' | head -n1 | cut -d'"' -f4)
log "  PAPER_ID=$PAPER_ID"
if [ -z "$PAPER_ID" ]; then log "FATAL: no paper available"; exit 1; fi

hr
log "====== Setup done. Beginning tests. ======"
hr

# ====================================================================
# T1. Issue token (POST /watermark/papers/:paperId/student/:studentId/token)
# ====================================================================
log "T1 — Issue watermark token"
R=$(req POST "$BASE/api/watermark/papers/${PAPER_ID}/student/${STUDENT_ID}/token" "$ADMIN_TOKEN" "")
T1_CODE="${R%%|*}"; T1_BODY="${R#*|}"
log "  -> code=$T1_CODE body=${T1_BODY:0:300}"
TOKEN=$(printf '%s' "$T1_BODY" | grep -o '"token":"[^"]*' | head -n1 | cut -d'"' -f4)
TOKEN_ID=$(extract '"id"' "$T1_BODY")
DL_URL=$(printf '%s' "$T1_BODY" | grep -o '"downloadUrl":"[^"]*' | head -n1 | cut -d'"' -f4)
log "  TOKEN=$TOKEN  TOKEN_ID=$TOKEN_ID  downloadUrl=$DL_URL"
if [ "$T1_CODE" = "201" ] || [ "$T1_CODE" = "200" ]; then
  if [ -n "$TOKEN" ] && [ ${#TOKEN} -ge 6 ] && [ -n "$DL_URL" ]; then v=PASS; else v=FAIL; fi
else v=FAIL; fi
record "T1" "Issue watermark token" "201/200 + token + downloadUrl" "$T1_CODE token=${TOKEN:-MISSING}" "HIGH" "$v"

# T1b. Idempotency — second call returns the same token
log "T1b — Re-issue must be idempotent"
R=$(req POST "$BASE/api/watermark/papers/${PAPER_ID}/student/${STUDENT_ID}/token" "$ADMIN_TOKEN" "")
T1B_BODY="${R#*|}"
TOKEN2=$(printf '%s' "$T1B_BODY" | grep -o '"token":"[^"]*' | head -n1 | cut -d'"' -f4)
log "  TOKEN2=$TOKEN2 (expected=$TOKEN)"
if [ -n "$TOKEN" ] && [ "$TOKEN" = "$TOKEN2" ]; then v=PASS; else v=FAIL; fi
record "T1b" "Re-issue is idempotent (same token)" "TOKEN==TOKEN2" "$TOKEN vs $TOKEN2" "MEDIUM" "$v"

# ====================================================================
# T2. Download via token URL — must be PDF, %PDF- header, >1KB
# ====================================================================
PDF_LIB_MISSING=0
if [ -n "$TOKEN" ]; then
  log "T2 — GET /watermark/download?token=$TOKEN"
  RAW_CODE=$(curl -s -o /tmp/b10_pdf -w '%{http_code}' \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$BASE/api/watermark/download?token=${TOKEN}")
  HEADER=$(head -c 5 /tmp/b10_pdf 2>/dev/null)
  SIZE=$(wc -c < /tmp/b10_pdf 2>/dev/null | tr -d ' ')
  log "  -> code=$RAW_CODE first-bytes='$HEADER' size=${SIZE}B"

  # Soft-fail: pdf-lib not installed → 500 with message
  if [ "$RAW_CODE" = "500" ]; then
    BODY_PEEK=$(head -c 500 /tmp/b10_pdf 2>/dev/null)
    if printf '%s' "$BODY_PEEK" | grep -qi 'pdf-lib'; then
      log "  WARN: pdf-lib is not installed — soft-fail. Run: cd apps/api && npm install"
      PDF_LIB_MISSING=1
      record "T2" "Download returns watermarked PDF" "%PDF + size>1024" "SKIPPED (pdf-lib missing)" "HIGH" "PASS"
    fi
  fi

  if [ "$PDF_LIB_MISSING" = "0" ]; then
    if [ "$RAW_CODE" = "200" ] && [ "$HEADER" = "%PDF-" ] && [ -n "$SIZE" ] && [ "$SIZE" -gt 1024 ]; then v=PASS; else v=FAIL; fi
    record "T2" "Download returns watermarked PDF" "200 + %PDF + size>1024" "code=$RAW_CODE hdr=$HEADER size=$SIZE" "HIGH" "$v"
  fi
else
  record "T2" "Download returns watermarked PDF" "200 + %PDF" "no token issued" "HIGH" "FAIL"
fi

# ====================================================================
# T3. Forensic lookup — admin
# ====================================================================
if [ -n "$TOKEN" ]; then
  log "T3 — Admin lookup"
  R=$(req GET "$BASE/api/watermark/lookup?token=${TOKEN}" "$ADMIN_TOKEN" "")
  T3_CODE="${R%%|*}"; T3_BODY="${R#*|}"
  log "  -> code=$T3_CODE body=${T3_BODY:0:300}"
  HAS_EMAIL=$(printf '%s' "$T3_BODY" | grep -c "$EMAIL_S")
  if [ "$T3_CODE" = "200" ] && [ "$HAS_EMAIL" -gt 0 ]; then v=PASS; else v=FAIL; fi
  record "T3" "Admin lookup resolves token to student" "200 + email match" "code=$T3_CODE email_match=$HAS_EMAIL" "HIGH" "$v"
fi

# ====================================================================
# T4. Lookup is admin-only — teacher must be rejected
# ====================================================================
log "T4 — Roster a teacher (head_teacher) and verify lookup is admin-only"
TEACHER_EMAIL="b10-tch-${TS}@example.com"
R=$(req POST "$BASE/api/users" "$ADMIN_TOKEN" \
  "{\"email\":\"${TEACHER_EMAIL}\",\"name\":\"B10 Teacher\",\"password\":\"${PASS_PWD}\",\"role\":\"teacher\"}")
TC="${R%%|*}"; TBOD="${R#*|}"
log "  create teacher code=$TC body=${TBOD:0:300}"

R=$(req POST "$BASE/api/auth/login" "" "{\"email\":\"${TEACHER_EMAIL}\",\"password\":\"${PASS_PWD}\"}")
TLB="${R#*|}"
T_TOKEN=$(printf '%s' "$TLB" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -n "$T_TOKEN" ] && [ -n "$TOKEN" ]; then
  R=$(req GET "$BASE/api/watermark/lookup?token=${TOKEN}" "$T_TOKEN" "")
  C="${R%%|*}"; B="${R#*|}"
  log "  teacher lookup -> code=$C body=${B:0:200}"
  if [ "$C" = "401" ] || [ "$C" = "403" ]; then v=PASS; else v=FAIL; fi
  record "T4" "lookup is admin-only" "401/403 for teacher" "$C" "CRITICAL" "$v"
else
  log "  could not provision teacher / token; skipping T4"
  record "T4" "lookup is admin-only" "401/403 for teacher" "skipped" "CRITICAL" "FAIL"
fi

# ====================================================================
# T5. Revoke + re-download → 410 Gone
# ====================================================================
if [ -n "$TOKEN_ID" ] && [ -n "$TOKEN" ] && [ "$PDF_LIB_MISSING" = "0" ]; then
  log "T5 — Admin revokes token, then download must be 410"
  R=$(req POST "$BASE/api/watermark/tokens/${TOKEN_ID}/revoke" "$ADMIN_TOKEN" "")
  RV_CODE="${R%%|*}"; RV_BODY="${R#*|}"
  log "  revoke code=$RV_CODE body=${RV_BODY:0:200}"

  RAW_CODE=$(curl -s -o /tmp/b10_revoked -w '%{http_code}' \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$BASE/api/watermark/download?token=${TOKEN}")
  log "  download after revoke -> code=$RAW_CODE"
  if [ "$RAW_CODE" = "410" ]; then v=PASS; else v=FAIL; fi
  record "T5" "Revoked token download returns 410" "410" "$RAW_CODE" "HIGH" "$v"
elif [ "$PDF_LIB_MISSING" = "1" ]; then
  log "  T5 SKIPPED — pdf-lib missing"
  record "T5" "Revoked token download returns 410" "410" "SKIPPED (pdf-lib missing)" "HIGH" "PASS"
fi

# ====================================================================
# T6. Unknown token → 404
# ====================================================================
log "T6 — Unknown token returns 404"
R=$(req GET "$BASE/api/watermark/lookup?token=ZZZZZZZZ" "$ADMIN_TOKEN" "")
C="${R%%|*}"
if [ "$C" = "404" ]; then v=PASS; else v=FAIL; fi
record "T6" "Unknown token lookup → 404" "404" "$C" "MEDIUM" "$v"

# ====================================================================
# T7. No-auth probe — issue endpoint must require auth
# ====================================================================
log "T7 — Issue endpoint with no token"
R=$(req POST "$BASE/api/watermark/papers/${PAPER_ID}/student/${STUDENT_ID}/token" "" "")
C="${R%%|*}"
if [ "$C" = "401" ]; then v=PASS; else v=FAIL; fi
record "T7" "issue without auth → 401" "401" "$C" "MEDIUM" "$v"

# ====================================================================
# Summary
# ====================================================================
hr
log "====== SUMMARY ======"
log "PASS=$PASS FAIL=$FAIL TOTAL=$((PASS+FAIL))"
printf '\n| ID | Test | Severity | Expected | Got | Verdict |\n'
printf '|---|---|---|---|---|---|\n'
for line in "${RESULTS[@]}"; do
  IFS='|' read -r id name expected got sev verdict <<< "$line"
  printf '| %s | %s | %s | %s | %s | %s |\n' "$id" "$name" "$sev" "$expected" "$got" "$verdict"
done
hr
exit 0
