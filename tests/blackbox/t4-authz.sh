#!/usr/bin/env bash
# T4 Adversarial Security/Authorization tests
# Target: deployed exam-paper-system on Railway
# Isolation prefix: t4-
set -u

BASE="${BASE:-https://exam-paper-system-production.up.railway.app}"
TS="$(date +%s)"
PFX="t4-${TS}"
PASS_PWD="test1234"
EMAIL_A="t4-stu-A-${TS}@example.com"
EMAIL_B="t4-stu-B-${TS}@example.com"
CLASS_A_NAME="t4-class-A-${TS}"
CLASS_B_NAME="t4-class-B-${TS}"
CLASS_A_CODE="T4A${TS: -6}"
CLASS_B_CODE="T4B${TS: -6}"

PASS=0
FAIL=0
declare -a RESULTS

# helpers ------------------------------------------------------------
hr() { printf '\n%s\n' "----------------------------------------------------------"; }
log() { printf '[t4] %s\n' "$*"; }

# req METHOD URL TOKEN BODY
# echoes "<status>|<body>"
req() {
  local m="$1" u="$2" t="${3:-}" b="${4:-}"
  local args=(-s -o /tmp/t4_body -w '%{http_code}' -X "$m" "$u" -H 'Content-Type: application/json')
  [ -n "$t" ] && args+=(-H "Authorization: Bearer $t")
  if [ -n "$b" ]; then args+=(--data "$b"); fi
  local code
  code=$(curl "${args[@]}")
  local body
  body=$(cat /tmp/t4_body 2>/dev/null || echo '')
  printf '%s|%s' "$code" "$body"
}

# raw_req: identical but allows header overrides via $5
raw_req() {
  local m="$1" u="$2" h="${3:-}" b="${4:-}"
  local args=(-s -o /tmp/t4_body -w '%{http_code}' -X "$m" "$u")
  if [ -n "$h" ]; then
    while IFS= read -r line; do
      [ -n "$line" ] && args+=(-H "$line")
    done <<< "$h"
  fi
  if [ -n "$b" ]; then args+=(--data "$b"); fi
  local code
  code=$(curl "${args[@]}")
  local body
  body=$(cat /tmp/t4_body 2>/dev/null || echo '')
  printf '%s|%s' "$code" "$body"
}

record() {
  local id="$1" name="$2" expected="$3" got="$4" sev="$5" verdict="$6"
  RESULTS+=("${id}|${name}|${expected}|${got}|${sev}|${verdict}")
  if [ "$verdict" = "PASS" ]; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi
  log "[$verdict][$sev] $id $name -- expected=$expected got=$got"
}

extract() { # extract simple JSON field: extract '"id"' "$body"
  local key="$1" body="$2"
  printf '%s' "$body" | grep -o "${key}:\"[^\"]*\"" | head -n1 | sed 's/.*:"\([^"]*\)".*/\1/'
}

# ======================================================================
log "BASE=$BASE"
log "Prefix=$PFX"
hr

# 1. Admin login -------------------------------------------------------
log "Admin login..."
R=$(req POST "$BASE/api/auth/login" "" "{\"email\":\"admin@school.local\",\"password\":\"admin123\"}")
ADMIN_CODE="${R%%|*}"; ADMIN_BODY="${R#*|}"
if [ "$ADMIN_CODE" != "201" ] && [ "$ADMIN_CODE" != "200" ]; then
  log "FATAL: admin login failed code=$ADMIN_CODE body=$ADMIN_BODY"; exit 1
fi
ADMIN_TOKEN=$(printf '%s' "$ADMIN_BODY" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
log "Admin token obtained (len=${#ADMIN_TOKEN})"

# 2. Create class A ----------------------------------------------------
log "Create class A: $CLASS_A_NAME / code $CLASS_A_CODE"
R=$(req POST "$BASE/api/classes" "$ADMIN_TOKEN" "{\"name\":\"${CLASS_A_NAME}\",\"classCode\":\"${CLASS_A_CODE}\"}")
CA_CODE="${R%%|*}"; CA_BODY="${R#*|}"
log "  class A response code=$CA_CODE body=${CA_BODY:0:200}"
CLASS_A_ID=$(extract '"id"' "$CA_BODY")
log "  CLASS_A_ID=$CLASS_A_ID"

log "Create class B: $CLASS_B_NAME / code $CLASS_B_CODE"
R=$(req POST "$BASE/api/classes" "$ADMIN_TOKEN" "{\"name\":\"${CLASS_B_NAME}\",\"classCode\":\"${CLASS_B_CODE}\"}")
CB_CODE="${R%%|*}"; CB_BODY="${R#*|}"
log "  class B response code=$CB_CODE body=${CB_BODY:0:200}"
CLASS_B_ID=$(extract '"id"' "$CB_BODY")
log "  CLASS_B_ID=$CLASS_B_ID"

if [ -z "$CLASS_A_ID" ] || [ -z "$CLASS_B_ID" ]; then
  log "FATAL: class creation failed"; exit 1
fi

# 3. Bulk roster — students --------------------------------------------
log "Roster student A on class A"
R=$(req POST "$BASE/api/classes/${CLASS_A_ID}/roster" "$ADMIN_TOKEN" \
   "{\"students\":[{\"email\":\"${EMAIL_A}\",\"name\":\"Stu A\",\"password\":\"${PASS_PWD}\"}]}")
RA_CODE="${R%%|*}"; RA_BODY="${R#*|}"
log "  roster A code=$RA_CODE body=${RA_BODY:0:300}"

log "Roster student B on class B"
R=$(req POST "$BASE/api/classes/${CLASS_B_ID}/roster" "$ADMIN_TOKEN" \
   "{\"students\":[{\"email\":\"${EMAIL_B}\",\"name\":\"Stu B\",\"password\":\"${PASS_PWD}\"}]}")
RB_CODE="${R%%|*}"; RB_BODY="${R#*|}"
log "  roster B code=$RB_CODE body=${RB_BODY:0:300}"

# 4. Find a paper, assign to class A -----------------------------------
log "List papers (admin)"
R=$(req GET "$BASE/api/papers" "$ADMIN_TOKEN" "")
P_CODE="${R%%|*}"; P_BODY="${R#*|}"
PAPER_ID=$(printf '%s' "$P_BODY" | grep -o '"id":"[^"]*' | head -n1 | cut -d'"' -f4)
log "  PAPER_ID=$PAPER_ID  (papers list code=$P_CODE)"

if [ -z "$PAPER_ID" ]; then log "FATAL: no paper available"; exit 1; fi

log "Assign paper to class A"
R=$(req POST "$BASE/api/papers/${PAPER_ID}/assign" "$ADMIN_TOKEN" "{\"classId\":\"${CLASS_A_ID}\"}")
AS_CODE="${R%%|*}"; AS_BODY="${R#*|}"
log "  assign code=$AS_CODE body=${AS_BODY:0:300}"
ASSIGN_ID=$(extract '"id"' "$AS_BODY")
log "  ASSIGN_ID=$ASSIGN_ID"

# 5. Login as student A -------------------------------------------------
log "Login student A"
R=$(req POST "$BASE/api/auth/login" "" "{\"email\":\"${EMAIL_A}\",\"password\":\"${PASS_PWD}\"}")
SA_CODE="${R%%|*}"; SA_BODY="${R#*|}"
log "  student A login code=$SA_CODE"
TOKEN_A=$(printf '%s' "$SA_BODY" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
log "  TOKEN_A len=${#TOKEN_A}"

log "Student A: open submission"
R=$(req POST "$BASE/api/student/submissions" "$TOKEN_A" "{\"assignmentId\":\"${ASSIGN_ID}\"}")
OS_CODE="${R%%|*}"; OS_BODY="${R#*|}"
log "  open submission code=$OS_CODE body=${OS_BODY:0:400}"
SUB_A_ID=$(extract '"id"' "$OS_BODY")
log "  SUB_A_ID=$SUB_A_ID"

# pick a paperQuestion id from submission body
PQ_ID=$(printf '%s' "$OS_BODY" | grep -oE '"paperQuestionId":"[^"]+"' | head -n1 | cut -d'"' -f4)
[ -z "$PQ_ID" ] && PQ_ID=$(printf '%s' "$OS_BODY" | grep -oE '"pqId":"[^"]+"' | head -n1 | cut -d'"' -f4)
[ -z "$PQ_ID" ] && PQ_ID=$(printf '%s' "$OS_BODY" | grep -oE '"id":"[^"]+"' | sed -n '2p' | cut -d'"' -f4)
log "  PQ_ID=$PQ_ID"

if [ -n "$SUB_A_ID" ] && [ -n "$PQ_ID" ]; then
  log "Student A: save 1 answer"
  R=$(req PATCH "$BASE/api/student/submissions/${SUB_A_ID}/scripts" "$TOKEN_A" "{\"paperQuestionId\":\"${PQ_ID}\",\"selectedOption\":\"B\"}")
  SS_CODE="${R%%|*}"; SS_BODY="${R#*|}"
  log "  save script code=$SS_CODE body=${SS_BODY:0:200}"
fi

# 6. Login as student B -------------------------------------------------
log "Login student B"
R=$(req POST "$BASE/api/auth/login" "" "{\"email\":\"${EMAIL_B}\",\"password\":\"${PASS_PWD}\"}")
SB_CODE="${R%%|*}"; SB_BODY="${R#*|}"
log "  student B login code=$SB_CODE"
TOKEN_B=$(printf '%s' "$SB_BODY" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
log "  TOKEN_B len=${#TOKEN_B}"

hr
log "====== Setup done. Beginning tests. ======"
hr

# ======================================================================
# A. Cross-student data access (CRITICAL)
# ======================================================================
# 1. GET cross-student submission must NOT be 200
log "TEST A1 — student B GET student A's submission"
R=$(req GET "$BASE/api/student/submissions/${SUB_A_ID}" "$TOKEN_B" "")
C="${R%%|*}"; B="${R#*|}"
log "  -> code=$C body=${B:0:200}"
if [ "$C" = "403" ] || [ "$C" = "404" ]; then v=PASS; else v=FAIL; fi
record "A1" "Cross-student GET submission" "403/404" "$C" "CRITICAL" "$v"

# 2. PATCH cross-student script
log "TEST A2 — student B PATCH student A's script"
R=$(req PATCH "$BASE/api/student/submissions/${SUB_A_ID}/scripts" "$TOKEN_B" "{\"paperQuestionId\":\"${PQ_ID}\",\"selectedOption\":\"A\"}")
C="${R%%|*}"; B="${R#*|}"
log "  -> code=$C body=${B:0:200}"
if [ "$C" = "403" ] || [ "$C" = "404" ]; then v=PASS; else v=FAIL; fi
record "A2" "Cross-student PATCH script" "403/404" "$C" "CRITICAL" "$v"

# 3. POST submit cross-student
log "TEST A3 — student B POST submit on student A's submission"
R=$(req POST "$BASE/api/student/submissions/${SUB_A_ID}/submit" "$TOKEN_B" "")
C="${R%%|*}"; B="${R#*|}"
log "  -> code=$C body=${B:0:200}"
if [ "$C" = "403" ] || [ "$C" = "404" ]; then v=PASS; else v=FAIL; fi
record "A3" "Cross-student final submit" "403/404" "$C" "CRITICAL" "$v"

# ======================================================================
# B. Cross-class assignment (CRITICAL)
# ======================================================================
log "TEST B4 — student B opens student A's class assignment"
R=$(req POST "$BASE/api/student/submissions" "$TOKEN_B" "{\"assignmentId\":\"${ASSIGN_ID}\"}")
C="${R%%|*}"; B="${R#*|}"
log "  -> code=$C body=${B:0:200}"
if [ "$C" = "403" ] || [ "$C" = "404" ]; then v=PASS; else v=FAIL; fi
record "B4" "Cross-class submission open" "403/404" "$C" "CRITICAL" "$v"

# ======================================================================
# C. Student → teacher routes (HIGH)
# ======================================================================
declare -a TR=(
  "C5|GET|/api/papers"
  "C6|GET|/api/questions"
  "C7|GET|/api/sources"
  "C8|GET|/api/review/items"
)
for spec in "${TR[@]}"; do
  IFS='|' read -r tid mth path <<< "$spec"
  log "TEST $tid — student A $mth $path"
  R=$(req "$mth" "$BASE$path" "$TOKEN_A" "")
  C="${R%%|*}"; B="${R#*|}"
  log "  -> code=$C body=${B:0:200}"
  if [ "$C" = "403" ] || [ "$C" = "401" ]; then v=PASS;
  elif [ "$C" = "200" ]; then
    if printf '%s' "$B" | grep -qE '^\[\s*\]$'; then v=PASS; else v=FAIL; fi
  else v=FAIL; fi
  record "$tid" "student->$path" "403/empty" "$C" "HIGH" "$v"
done

# 9. POST /api/papers/generate (with VALID body so we don't get 400 short-circuit)
log "TEST C9 — student A POST /api/papers/generate (valid body)"
GEN_BODY='{"name":"t4-hack","subjectId":"cmojrm9ud0002cu6khrtv7p11","componentId":"cmojrm9uj0004cu6knt2kbg13","topics":[{"code":"CS.1","count":1}]}'
R=$(req POST "$BASE/api/papers/generate" "$TOKEN_A" "$GEN_BODY")
C="${R%%|*}"; B="${R#*|}"
log "  -> code=$C body=${B:0:200}"
if [ "$C" = "403" ] || [ "$C" = "401" ]; then v=PASS; else v=FAIL; fi
record "C9" "student->POST /papers/generate" "403" "$C" "HIGH" "$v"

# 10. POST /api/classes
log "TEST C10 — student A POST /api/classes"
R=$(req POST "$BASE/api/classes" "$TOKEN_A" "{\"name\":\"hack\",\"classCode\":\"HACK${TS: -4}\"}")
C="${R%%|*}"; B="${R#*|}"
log "  -> code=$C body=${B:0:200}"
if [ "$C" = "403" ] || [ "$C" = "401" ]; then v=PASS; else v=FAIL; fi
record "C10" "student->POST /classes" "403" "$C" "HIGH" "$v"

# 11. POST /api/ai/generate-questions (valid body so we test role check, not DTO)
log "TEST C11 — student A POST /api/ai/generate-questions (valid body)"
R=$(req POST "$BASE/api/ai/generate-questions" "$TOKEN_A" '{"syllabusCode":"9608","topicCode":"CS.1","count":1}')
C="${R%%|*}"; B="${R#*|}"
log "  -> code=$C body=${B:0:200}"
if [ "$C" = "403" ] || [ "$C" = "401" ]; then v=PASS; else v=FAIL; fi
record "C11" "student->POST /ai/generate-questions" "403" "$C" "HIGH" "$v"

# 11b. Confirm question detail leak (mark-scheme) — derived bug, but must record
log "TEST C6b — student A GET /api/questions/:id includes markScheme"
FIRST_Q_ID=$(curl -s -H "Authorization: Bearer $TOKEN_A" "$BASE/api/questions?pageSize=1" | grep -o '"id":"[^"]*' | head -n1 | cut -d'"' -f4)
if [ -n "$FIRST_Q_ID" ]; then
  R=$(req GET "$BASE/api/questions/${FIRST_Q_ID}" "$TOKEN_A" "")
  C="${R%%|*}"; B="${R#*|}"
  HAS_MS=$(printf '%s' "$B" | grep -c '"markScheme"')
  HAS_AC=$(printf '%s' "$B" | grep -c '"answerContent"')
  log "  -> code=$C  markScheme=$HAS_MS answerContent=$HAS_AC"
  if [ "$C" = "200" ] && { [ "$HAS_MS" -gt 0 ] || [ "$HAS_AC" -gt 0 ]; }; then v=FAIL; else v=PASS; fi
  record "C6b" "student->GET /questions/:id leaks markScheme/answerContent" "no leak" "code=$C MS=$HAS_MS" "CRITICAL" "$v"
fi

# 11c. PATCH /api/papers/:id (no role check)
log "TEST C9b — student A PATCH /api/papers/:id (admin-owned paper)"
R=$(req PATCH "$BASE/api/papers/${PAPER_ID}" "$TOKEN_A" "{\"name\":\"t4-pwn-${TS}\"}")
C="${R%%|*}"; B="${R#*|}"
log "  -> code=$C body=${B:0:200}"
if [ "$C" = "403" ] || [ "$C" = "401" ]; then v=PASS; else v=FAIL; fi
record "C9b" "student->PATCH /papers/:id (mutate admin paper)" "403" "$C" "CRITICAL" "$v"
# restore name if mutated
if [ "$C" = "200" ]; then
  log "  RESTORE: setting paper name back via admin"
  req PATCH "$BASE/api/papers/${PAPER_ID}" "$ADMIN_TOKEN" '{"name":"Phase 6-8 validation"}' >/dev/null
fi

# 11d. GET /api/papers/:id detail (no role check) — config / question content leak
log "TEST C9c — student A GET /api/papers/:id (admin-owned paper)"
R=$(req GET "$BASE/api/papers/${PAPER_ID}" "$TOKEN_A" "")
C="${R%%|*}"; B="${R#*|}"
log "  -> code=$C body=${B:0:160}"
if [ "$C" = "403" ] || [ "$C" = "401" ]; then v=PASS; else v=FAIL; fi
record "C9c" "student->GET /papers/:id detail" "403" "$C" "HIGH" "$v"

# 11e. POST /api/papers/:id/versions — student creates snapshot of admin paper
log "TEST C9d — student A POST /api/papers/:id/versions"
R=$(req POST "$BASE/api/papers/${PAPER_ID}/versions" "$TOKEN_A" '{"note":"t4 hax"}')
C="${R%%|*}"; B="${R#*|}"
log "  -> code=$C body=${B:0:200}"
if [ "$C" = "403" ] || [ "$C" = "401" ]; then v=PASS; else v=FAIL; fi
record "C9d" "student->POST /papers/:id/versions" "403" "$C" "HIGH" "$v"

# 11f. GET /api/papers/:id/export (answer key)
log "TEST C9e — student A GET /api/papers/:id/export?type=answer_key"
RAW_CODE=$(curl -s -o /tmp/t4_pdf -w '%{http_code}' -H "Authorization: Bearer $TOKEN_A" "$BASE/api/papers/${PAPER_ID}/export?type=answer_key")
HEADER=$(head -c 5 /tmp/t4_pdf 2>/dev/null)
log "  -> code=$RAW_CODE first-bytes='$HEADER'"
if [ "$RAW_CODE" = "403" ] || [ "$RAW_CODE" = "401" ]; then v=PASS; else v=FAIL; fi
record "C9e" "student->GET /papers/:id/export?answer_key" "403" "$RAW_CODE" "CRITICAL" "$v"

# 11g. DELETE /api/questions/:id (no role check)
log "TEST C6c — student A DELETE /api/questions/<fake-id>"
R=$(req DELETE "$BASE/api/questions/cmqqqqqq00000aaaabbbbcccc" "$TOKEN_A" "")
C="${R%%|*}"; B="${R#*|}"
log "  -> code=$C body=${B:0:200}"
if [ "$C" = "403" ] || [ "$C" = "401" ] || [ "$C" = "404" ]; then v=PASS; else v=FAIL; fi
record "C6c" "student->DELETE /questions/:id" "403/404" "$C" "HIGH" "$v"

# 12. GET /api/auth/me as student A
log "TEST C12 — student A GET /api/auth/me"
R=$(req GET "$BASE/api/auth/me" "$TOKEN_A" "")
C="${R%%|*}"; B="${R#*|}"
log "  -> code=$C body=${B:0:200}"
ROLE=$(printf '%s' "$B" | grep -o '"role":"[^"]*' | cut -d'"' -f4)
if [ "$C" = "200" ] && [ "$ROLE" = "student" ]; then v=PASS; else v=FAIL; fi
record "C12" "student->GET /auth/me role=student" "200/student" "${C}/${ROLE}" "INFO" "$v"

# ======================================================================
# D. JWT manipulation (HIGH/CRITICAL)
# ======================================================================
# 13. modify role in payload, keep signature
log "TEST D13 — JWT role tampering (signature mismatch)"
HEADER_B64="${TOKEN_A%%.*}"
REST="${TOKEN_A#*.}"
PAYLOAD_B64="${REST%%.*}"
SIG_B64="${REST#*.}"

# decode payload (base64url -> base64)
b64url_to_std() { local s="$1"; s="${s//-/+}"; s="${s//_/\/}"; case $((${#s} % 4)) in 2) s="${s}==" ;; 3) s="${s}=" ;; esac; printf '%s' "$s"; }
std_to_b64url() { local s; s=$(printf '%s' "$1" | tr '+/' '-_' | tr -d '='); printf '%s' "$s"; }

PAYLOAD_JSON=$(printf '%s' "$(b64url_to_std "$PAYLOAD_B64")" | base64 -d 2>/dev/null || true)
log "  original payload: $PAYLOAD_JSON"

# replace role -> admin
TAMPERED_JSON=$(printf '%s' "$PAYLOAD_JSON" | sed 's/"role":"student"/"role":"admin"/')
log "  tampered  payload: $TAMPERED_JSON"
TAMPERED_B64URL=$(std_to_b64url "$(printf '%s' "$TAMPERED_JSON" | base64 -w0 2>/dev/null || printf '%s' "$TAMPERED_JSON" | base64 | tr -d '\n')")
TAMPERED_TOKEN="${HEADER_B64}.${TAMPERED_B64URL}.${SIG_B64}"
log "  tampered token len=${#TAMPERED_TOKEN}"

R=$(req GET "$BASE/api/sources" "$TAMPERED_TOKEN" "")
C="${R%%|*}"; B="${R#*|}"
log "  -> code=$C body=${B:0:200}"
if [ "$C" = "401" ]; then v=PASS; else v=FAIL; fi
record "D13" "Tampered JWT (admin role) rejected" "401" "$C" "CRITICAL" "$v"

# 14. malformed token
log "TEST D14 — malformed token foo.bar.baz"
R=$(req GET "$BASE/api/sources" "foo.bar.baz" "")
C="${R%%|*}"; B="${R#*|}"
log "  -> code=$C body=${B:0:200}"
if [ "$C" = "401" ]; then v=PASS; else v=FAIL; fi
record "D14" "Malformed JWT rejected" "401" "$C" "HIGH" "$v"

# ======================================================================
# E. No-auth probes (MEDIUM)
# ======================================================================
log "TEST E15 — GET /api/classes without Authorization"
R=$(req GET "$BASE/api/classes" "" "")
C="${R%%|*}"; B="${R#*|}"
log "  -> code=$C body=${B:0:200}"
if [ "$C" = "401" ]; then v=PASS; else v=FAIL; fi
record "E15" "GET /classes no auth" "401" "$C" "MEDIUM" "$v"

log "TEST E16 — login wrong password"
R=$(req POST "$BASE/api/auth/login" "" "{\"email\":\"admin@school.local\",\"password\":\"WRONG\"}")
C="${R%%|*}"; B="${R#*|}"
log "  -> code=$C body=${B:0:200}"
if [ "$C" = "401" ]; then v=PASS; else v=FAIL; fi
record "E16" "Login wrong password" "401" "$C" "MEDIUM" "$v"

log "TEST E17 — login malformed body"
R=$(raw_req POST "$BASE/api/auth/login" "Content-Type: application/json" "{")
C="${R%%|*}"; B="${R#*|}"
log "  -> code=$C body=${B:0:200}"
if [ "$C" = "400" ]; then v=PASS; else v=FAIL; fi
record "E17" "Login malformed JSON" "400" "$C" "MEDIUM" "$v"

# ======================================================================
# F. User enumeration probe (LOW)
# ======================================================================
log "TEST F18 — login random unknown email"
R=$(req POST "$BASE/api/auth/login" "" "{\"email\":\"nope-${TS}@example.com\",\"password\":\"whatever123\"}")
C18A="${R%%|*}"; B18A="${R#*|}"
log "  unknown user -> code=$C18A msg='$(printf '%s' "$B18A" | grep -o '"message":"[^"]*' | head -n1)'"

R=$(req POST "$BASE/api/auth/login" "" "{\"email\":\"admin@school.local\",\"password\":\"definitely-not-it\"}")
C18B="${R%%|*}"; B18B="${R#*|}"
log "  known user wrong pwd -> code=$C18B msg='$(printf '%s' "$B18B" | grep -o '"message":"[^"]*' | head -n1)'"

if [ "$C18A" = "$C18B" ] && [ "$B18A" = "$B18B" ]; then v=PASS; ENUM="indistinguishable"; else v=FAIL; ENUM="distinguishable"; fi
record "F18" "User enumeration via login response" "indistinguishable" "$ENUM" "LOW" "$v"

# ======================================================================
# Summary
# ======================================================================
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
