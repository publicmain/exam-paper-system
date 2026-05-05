#!/usr/bin/env bash
# B2 Blackbox — analytics (class stats + wrong-answer dashboard).
# Strategy: bring up data via existing T1 + T2 + T3 fixtures (we just hit
# the same admin/student creds and a fresh class, paper, assignment chain).
# This script is intentionally self-contained — it creates everything it
# needs from scratch, then probes the four analytics endpoints.
#
# Usage:
#   API=https://exam-paper-system-production.up.railway.app ./b2-analytics.sh
#
# Exit code: 0 if all PASS, 1 if any FAIL.
set -u

API="${API:-https://exam-paper-system-production.up.railway.app}"
TS="$(date +%s)"
PREFIX="b2"
PASS=0
FAIL=0

req() {
  local method="$1" url="$2" bodyfile="$3" data="${4:-}" token="${5:-}"
  local args=(-sS -o "$bodyfile" -w '%{http_code}' --max-time 30 -X "$method" "$url" -H 'Content-Type: application/json')
  if [ -n "$token" ]; then args+=(-H "Authorization: Bearer $token"); fi
  if [ -n "$data" ]; then args+=(--data "$data"); fi
  curl "${args[@]}"
}

req_noauth() {
  local method="$1" url="$2" bodyfile="$3" data="${4:-}"
  local args=(-sS -o "$bodyfile" -w '%{http_code}' --max-time 30 -X "$method" "$url" -H 'Content-Type: application/json')
  if [ -n "$data" ]; then args+=(--data "$data"); fi
  curl "${args[@]}"
}

pass() { PASS=$((PASS+1)); echo "[PASS] $1"; [ -n "${2:-}" ] && echo "       $2"; }
fail() { FAIL=$((FAIL+1)); echo "[FAIL] $1"; [ -n "${2:-}" ] && echo "       $2"; }

jget() {
  local file="$1" key="$2"
  local v
  v=$(grep -o "\"$key\":\"[^\"]*\"" "$file" | head -n1 | sed -E "s/\"$key\":\"([^\"]*)\"/\1/")
  if [ -n "$v" ]; then echo "$v"; return; fi
  v=$(grep -oE "\"$key\":[^,}]+" "$file" | head -n1 | sed -E "s/\"$key\"://; s/^[ ]+//; s/[ ]+$//")
  echo "$v"
}

TMP="$(mktemp -d 2>/dev/null || mktemp -d -t b2)"
echo "tmp=$TMP api=$API ts=$TS"
echo "============================================="

# --- Login admin ---
ADMIN_BODY="$TMP/admin_login.json"
ADMIN_STATUS=$(req POST "$API/api/auth/login" "$ADMIN_BODY" '{"email":"admin@school.local","password":"admin123"}')
echo "admin_login: status=$ADMIN_STATUS"
if [ "$ADMIN_STATUS" != "200" ] && [ "$ADMIN_STATUS" != "201" ]; then
  fail "admin login" "got status $ADMIN_STATUS"
  exit 1
fi
ADMIN_TOKEN=$(jget "$ADMIN_BODY" token)
[ -z "$ADMIN_TOKEN" ] && { fail "admin token extraction"; exit 1; }
echo "admin_token_len=${#ADMIN_TOKEN}"

# --- Create class + roster ---
CLASS_NAME="${PREFIX}-class-${TS}"
CLASS_CODE="${PREFIX}-CC-${TS}"
CC_BODY="$TMP/cc.json"
CC_STATUS=$(req POST "$API/api/classes" "$CC_BODY" "$(printf '{"name":"%s","classCode":"%s","level":"AS"}' "$CLASS_NAME" "$CLASS_CODE")" "$ADMIN_TOKEN")
CLASS_ID=$(jget "$CC_BODY" id)
[ -z "$CLASS_ID" ] && { fail "create class" "$(cat "$CC_BODY")"; exit 1; }
echo "class_id=$CLASS_ID"

ST1="${PREFIX}-stu-1-${TS}@example.com"
ST2="${PREFIX}-stu-2-${TS}@example.com"
ROSTER_DATA=$(cat <<JSON
{"students":[
  {"email":"$ST1","name":"B2 Stu 1","password":"test1234"},
  {"email":"$ST2","name":"B2 Stu 2","password":"test1234"}
]}
JSON
)
ROST_BODY="$TMP/rost.json"
req POST "$API/api/classes/$CLASS_ID/roster" "$ROST_BODY" "$ROSTER_DATA" "$ADMIN_TOKEN" >/dev/null
echo "roster body=$(cat "$ROST_BODY")"

# --- Need a paper to assign. Pull the first published paper from listings. ---
PAPERS_BODY="$TMP/papers.json"
PAPERS_STATUS=$(req GET "$API/api/papers" "$PAPERS_BODY" "" "$ADMIN_TOKEN")
PAPER_ID=$(grep -oE '"id":"[^"]+"' "$PAPERS_BODY" | head -n1 | sed -E 's/"id":"([^"]+)"/\1/')
echo "paper_id=$PAPER_ID papers_status=$PAPERS_STATUS"
if [ -z "$PAPER_ID" ]; then
  echo "[SKIP] No paper available — analytics endpoints will still be probed for shape but no data."
fi

# Assign the paper to the class (creates a PaperAssignment so the class has
# at least one paper to roll up).
if [ -n "$PAPER_ID" ]; then
  ASSIGN_BODY="$TMP/assign.json"
  req POST "$API/api/papers/$PAPER_ID/assign" "$ASSIGN_BODY" \
    "$(printf '{"classId":"%s"}' "$CLASS_ID")" "$ADMIN_TOKEN" >/dev/null
  echo "assign body=$(cat "$ASSIGN_BODY")"
fi
echo "============================================="

# === Test 1: GET /api/analytics/class/:classId/overview (admin) ===
T1_BODY="$TMP/t1.json"
T1_STATUS=$(req GET "$API/api/analytics/class/$CLASS_ID/overview" "$T1_BODY" "" "$ADMIN_TOKEN")
echo "[T1] overview status=$T1_STATUS body=$(cat "$T1_BODY")"
if [ "$T1_STATUS" = "200" ] && grep -q '"studentCount"' "$T1_BODY" && grep -q '"perPaper"' "$T1_BODY" && grep -q '"totals"' "$T1_BODY"; then
  STUD_COUNT=$(jget "$T1_BODY" studentCount)
  PAPER_COUNT=$(jget "$T1_BODY" paperCount)
  pass "T1 GET /analytics/class/:classId/overview shape OK" "studentCount=$STUD_COUNT paperCount=$PAPER_COUNT"
else
  fail "T1 GET /analytics/class/:classId/overview" "status=$T1_STATUS body=$(cat "$T1_BODY")"
fi
echo "---------------------------------------------"

# === Test 2: 404 for bogus class id ===
T2_BODY="$TMP/t2.json"
T2_STATUS=$(req GET "$API/api/analytics/class/no-such-class/overview" "$T2_BODY" "" "$ADMIN_TOKEN")
echo "[T2] bogus class status=$T2_STATUS body=$(cat "$T2_BODY")"
if [ "$T2_STATUS" = "404" ]; then
  pass "T2 Bogus classId returns 404" ""
else
  fail "T2 Bogus classId NOT 404" "status=$T2_STATUS"
fi
echo "---------------------------------------------"

# === Test 3: GET /api/analytics/paper/:paperId/wrong-answers (admin) ===
if [ -n "$PAPER_ID" ]; then
  T3_BODY="$TMP/t3.json"
  T3_STATUS=$(req GET "$API/api/analytics/paper/$PAPER_ID/wrong-answers" "$T3_BODY" "" "$ADMIN_TOKEN")
  echo "[T3] wrong-answers status=$T3_STATUS body_bytes=$(wc -c < "$T3_BODY")"
  if [ "$T3_STATUS" = "200" ] && grep -q '"rows"' "$T3_BODY" && grep -q '"totalSubmissions"' "$T3_BODY"; then
    pass "T3 GET /analytics/paper/:paperId/wrong-answers shape OK" "$(grep -oE '"rows":\[[^]]*' "$T3_BODY" | head -c 80)"
  else
    fail "T3 GET /analytics/paper/:paperId/wrong-answers" "status=$T3_STATUS body=$(cat "$T3_BODY")"
  fi
else
  echo "[T3] SKIP — no paper id"
fi
echo "---------------------------------------------"

# === Test 4: GET /api/analytics/class/:classId/topic-mastery (admin) ===
T4_BODY="$TMP/t4.json"
T4_STATUS=$(req GET "$API/api/analytics/class/$CLASS_ID/topic-mastery" "$T4_BODY" "" "$ADMIN_TOKEN")
echo "[T4] topic-mastery status=$T4_STATUS body=$(cat "$T4_BODY")"
if [ "$T4_STATUS" = "200" ] && grep -q '"topics"' "$T4_BODY"; then
  pass "T4 GET /analytics/class/:classId/topic-mastery shape OK" ""
else
  fail "T4 GET /analytics/class/:classId/topic-mastery" "status=$T4_STATUS"
fi

# Same endpoint with paperId filter
if [ -n "$PAPER_ID" ]; then
  T4B_BODY="$TMP/t4b.json"
  T4B_STATUS=$(req GET "$API/api/analytics/class/$CLASS_ID/topic-mastery?paperId=$PAPER_ID" "$T4B_BODY" "" "$ADMIN_TOKEN")
  echo "[T4b] topic-mastery filtered status=$T4B_STATUS"
  if [ "$T4B_STATUS" = "200" ] && grep -q "\"paperId\":\"$PAPER_ID\"" "$T4B_BODY"; then
    pass "T4b topic-mastery?paperId=… echoes filter" ""
  else
    fail "T4b topic-mastery?paperId=… filter" "status=$T4B_STATUS body=$(cat "$T4B_BODY")"
  fi
fi
echo "---------------------------------------------"

# === Test 5: GET /api/analytics/student/:studentId/history (admin) ===
# We need a student id. Login as ST1 and grab id from JWT response.
SLOG_BODY="$TMP/slog.json"
SLOG_STATUS=$(req POST "$API/api/auth/login" "$SLOG_BODY" "$(printf '{"email":"%s","password":"test1234"}' "$ST1")")
STU_TOKEN=$(jget "$SLOG_BODY" token)
STU_ID=$(jget "$SLOG_BODY" id)
if [ -z "$STU_ID" ]; then
  STU_ID=$(grep -o '"user":{[^}]*"id":"[^"]*"' "$SLOG_BODY" | sed -E 's/.*"id":"([^"]*)".*/\1/')
fi
echo "student id=$STU_ID token_len=${#STU_TOKEN}"

T5_BODY="$TMP/t5.json"
T5_STATUS=$(req GET "$API/api/analytics/student/$STU_ID/history" "$T5_BODY" "" "$ADMIN_TOKEN")
echo "[T5] history status=$T5_STATUS body=$(cat "$T5_BODY")"
if [ "$T5_STATUS" = "200" ] && grep -q '"submissions"' "$T5_BODY" && grep -q '"studentId"' "$T5_BODY"; then
  pass "T5 GET /analytics/student/:studentId/history shape OK" ""
else
  fail "T5 GET /analytics/student/:studentId/history" "status=$T5_STATUS"
fi
echo "============================================="

# === Authz tests — every endpoint must 401/403 for students ===
# AuthGuard returns 401 (UnauthorizedException) when role check fails.
echo "AUTHZ — student should NOT reach analytics endpoints"

if [ -n "$STU_TOKEN" ]; then
  for ROUTE in \
    "/api/analytics/class/$CLASS_ID/overview" \
    "/api/analytics/paper/$PAPER_ID/wrong-answers" \
    "/api/analytics/class/$CLASS_ID/topic-mastery" \
    "/api/analytics/student/$STU_ID/history" ; do
    if [ -z "$PAPER_ID" ] && echo "$ROUTE" | grep -q "/wrong-answers"; then
      echo "  skip $ROUTE (no paper)"
      continue
    fi
    AB="$TMP/authz_$(echo "$ROUTE" | tr '/?:&=' '_').json"
    AS=$(req GET "$API$ROUTE" "$AB" "" "$STU_TOKEN")
    if [ "$AS" = "401" ] || [ "$AS" = "403" ]; then
      pass "AUTHZ student GET $ROUTE -> $AS" ""
    else
      fail "AUTHZ LEAK student GET $ROUTE -> $AS" "body=$(cat "$AB")"
    fi
  done
fi

# No-auth at all -> 401
NA_BODY="$TMP/na.json"
NA_STATUS=$(req_noauth GET "$API/api/analytics/class/$CLASS_ID/overview" "$NA_BODY" "")
echo "[no-auth overview] status=$NA_STATUS"
if [ "$NA_STATUS" = "401" ]; then
  pass "no-auth GET /analytics/class/:classId/overview -> 401" ""
else
  fail "no-auth NOT 401" "status=$NA_STATUS"
fi
echo "---------------------------------------------"

# === Cross-class teacher access — documented "any teacher passes for now". ===
# This isn't a vulnerability in MVP scope: the current authz is role-based
# (teacher / head_teacher / admin). The MERGE_INSTRUCTIONS note explains
# why and what to tighten in Phase 2. We assert the documented behaviour:
# a teacher (NOT enrolled in the class) CAN read its analytics.
TEACH_BODY="$TMP/teach_login.json"
TEACH_STATUS=$(req POST "$API/api/auth/login" "$TEACH_BODY" '{"email":"teacher@school.local","password":"teacher123"}')
TEACH_TOKEN=$(jget "$TEACH_BODY" token)
echo "teacher_login status=$TEACH_STATUS token_len=${#TEACH_TOKEN}"
if [ -n "$TEACH_TOKEN" ]; then
  CT_BODY="$TMP/ct.json"
  CT_STATUS=$(req GET "$API/api/analytics/class/$CLASS_ID/overview" "$CT_BODY" "" "$TEACH_TOKEN")
  if [ "$CT_STATUS" = "200" ]; then
    pass "Cross-class teacher access (documented MVP behaviour)" "teacher reads class overview without enrollment"
  else
    # If a future hardening pass changes this to 403, that's fine — flip
    # the test then. For now, anything non-200 is a regression.
    fail "Cross-class teacher access changed (was 200 in MVP)" "status=$CT_STATUS"
  fi
else
  echo "[cross-class] SKIP — no teacher creds"
fi

echo "============================================="
echo "SUMMARY: PASS=$PASS  FAIL=$FAIL"
echo "Class id under test: $CLASS_ID  ($CLASS_CODE)"
echo "============================================="
[ "$FAIL" = "0" ] || exit 1
exit 0
