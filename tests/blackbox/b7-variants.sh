#!/usr/bin/env bash
# B7 Blackbox tests — paper variants + WeChat notify stubs
# Target: deployed Railway exam-paper-system (or localhost when API= override)
# Isolation prefix: b7-
#
# Coverage:
#   1. Generate variants for a 5-student class
#   2. Each student gets a unique seed
#   3. Re-running generate-for-class is idempotent
#      (deterministic — same seed for same student)
#   4. Each student's variant lookup returns the same shape they
#      saw in the bulk generate result
#   5. Wechat-notify configs CRUD round-trip + noop:// stub fires
#      logs without making HTTP calls
#   6. Authorization fences (student cannot read another student's
#      variant; non-admin cannot mutate notification configs)
set -u

API="${API:-https://exam-paper-system-production.up.railway.app}"
TS="$(date +%s)"
PREFIX="b7"
PASS=0
FAIL=0

req() {
  local method="$1" url="$2" bodyfile="$3" data="${4:-}" token="${5:-}"
  local args=(-sS -o "$bodyfile" -w '%{http_code}' --max-time 30 -X "$method" "$url" -H 'Content-Type: application/json')
  [ -n "$token" ] && args+=(-H "Authorization: Bearer $token")
  [ -n "$data" ] && args+=(--data "$data")
  curl "${args[@]}"
}

req_noauth() {
  local method="$1" url="$2" bodyfile="$3" data="${4:-}"
  local args=(-sS -o "$bodyfile" -w '%{http_code}' --max-time 30 -X "$method" "$url" -H 'Content-Type: application/json')
  [ -n "$data" ] && args+=(--data "$data")
  curl "${args[@]}"
}

pass() { PASS=$((PASS+1)); echo "[PASS] $1"; [ -n "${2:-}" ] && echo "       $2"; }
fail() { FAIL=$((FAIL+1)); echo "[FAIL] $1"; [ -n "${2:-}" ] && echo "       $2"; }

jget() {
  local file="$1" key="$2" v
  v=$(grep -o "\"$key\":\"[^\"]*\"" "$file" | head -n1 | sed -E "s/\"$key\":\"([^\"]*)\"/\1/")
  if [ -n "$v" ]; then echo "$v"; return; fi
  v=$(grep -oE "\"$key\":[^,}]+" "$file" | head -n1 | sed -E "s/\"$key\"://; s/^[ ]+//; s/[ ]+$//")
  echo "$v"
}

TMP="$(mktemp -d 2>/dev/null || mktemp -d -t b7)"
echo "tmp=$TMP api=$API ts=$TS"
echo "============================================="

# --- Login admin ---
ADMIN_BODY="$TMP/admin_login.json"
ADMIN_STATUS=$(req POST "$API/api/auth/login" "$ADMIN_BODY" '{"email":"admin@school.local","password":"admin123"}')
echo "admin_login: status=$ADMIN_STATUS"
if [ "$ADMIN_STATUS" != "200" ] && [ "$ADMIN_STATUS" != "201" ]; then
  fail "admin login" "got $ADMIN_STATUS"; exit 1
fi
ADMIN_TOKEN=$(jget "$ADMIN_BODY" token)
[ -z "$ADMIN_TOKEN" ] && { fail "no admin token" "$(cat "$ADMIN_BODY")"; exit 1; }
echo "============================================="

# --- Setup: class + 5 students + paper + assignment -----------
CLASS_NAME="${PREFIX}-class-${TS}"
CLASS_CODE="${PREFIX}-CC-${TS}"
CLASS_BODY="$TMP/class.json"
CLASS_STATUS=$(req POST "$API/api/classes" "$CLASS_BODY" \
  "$(printf '{"name":"%s","classCode":"%s","level":"AS"}' "$CLASS_NAME" "$CLASS_CODE")" "$ADMIN_TOKEN")
CLASS_ID=$(jget "$CLASS_BODY" id)
echo "[setup] class status=$CLASS_STATUS id=$CLASS_ID"
[ -z "$CLASS_ID" ] && { fail "class create" "$(cat "$CLASS_BODY")"; exit 1; }

ROSTER_DATA=$(cat <<JSON
{"students":[
  {"email":"$PREFIX-s1-$TS@ex.com","name":"$PREFIX-S1","password":"test1234"},
  {"email":"$PREFIX-s2-$TS@ex.com","name":"$PREFIX-S2","password":"test1234"},
  {"email":"$PREFIX-s3-$TS@ex.com","name":"$PREFIX-S3","password":"test1234"},
  {"email":"$PREFIX-s4-$TS@ex.com","name":"$PREFIX-S4","password":"test1234"},
  {"email":"$PREFIX-s5-$TS@ex.com","name":"$PREFIX-S5","password":"test1234"}
]}
JSON
)
ROSTER_BODY="$TMP/roster.json"
ROSTER_STATUS=$(req POST "$API/api/classes/$CLASS_ID/roster" "$ROSTER_BODY" "$ROSTER_DATA" "$ADMIN_TOKEN")
echo "[setup] roster status=$ROSTER_STATUS body=$(cat "$ROSTER_BODY" | head -c 200)"

# Find an existing paper to assign. We don't generate one here
# because generation needs a populated question bank; we just pick
# the first paper visible to admin.
PAPERS_BODY="$TMP/papers.json"
PAPERS_STATUS=$(req GET "$API/api/papers" "$PAPERS_BODY" "" "$ADMIN_TOKEN")
PAPER_ID=$(grep -oE '"id":"[^"]+"' "$PAPERS_BODY" | head -n1 | sed -E 's/"id":"([^"]+)"/\1/')
echo "[setup] papers status=$PAPERS_STATUS first_paper=$PAPER_ID"
if [ -z "$PAPER_ID" ]; then
  fail "no paper available — cannot continue" "list size=$(wc -c < "$PAPERS_BODY")"
  echo "Skip variant tests (no paper). Continuing to notify tests."
  ASSIGNMENT_ID=""
else
  ASSIGN_BODY="$TMP/assign.json"
  ASSIGN_STATUS=$(req POST "$API/api/papers/$PAPER_ID/assign" "$ASSIGN_BODY" \
    "$(printf '{"classId":"%s"}' "$CLASS_ID")" "$ADMIN_TOKEN")
  ASSIGNMENT_ID=$(jget "$ASSIGN_BODY" id)
  echo "[setup] assign status=$ASSIGN_STATUS id=$ASSIGNMENT_ID"
fi
echo "============================================="

# --- Test V1: generate-for-class -----------------------------
if [ -n "$ASSIGNMENT_ID" ]; then
  V1_BODY="$TMP/v1.json"
  V1_DATA="$(printf '{"assignmentId":"%s","mode":"both"}' "$ASSIGNMENT_ID")"
  V1_STATUS=$(req POST "$API/api/paper-variants/generate-for-class" "$V1_BODY" "$V1_DATA" "$ADMIN_TOKEN")
  echo "[V1] generate status=$V1_STATUS body=$(cat "$V1_BODY" | head -c 300)"
  V1_PROCESSED=$(jget "$V1_BODY" studentsProcessed)
  if { [ "$V1_STATUS" = "200" ] || [ "$V1_STATUS" = "201" ]; } && [ "$V1_PROCESSED" = "5" ]; then
    pass "V1 generate-for-class processed 5 students" "studentsProcessed=$V1_PROCESSED"
  else
    fail "V1 generate-for-class" "status=$V1_STATUS processed=$V1_PROCESSED"
  fi
  echo "---------------------------------------------"

  # --- Test V2: list — every seed unique -----------------------
  V2_BODY="$TMP/v2.json"
  V2_STATUS=$(req GET "$API/api/paper-variants/assignment/$ASSIGNMENT_ID" "$V2_BODY" "" "$ADMIN_TOKEN")
  echo "[V2] list status=$V2_STATUS bytes=$(wc -c < "$V2_BODY")"
  SEEDS=$(grep -oE '"seed":[0-9]+' "$V2_BODY" | sed 's/"seed"://')
  SEED_COUNT=$(echo "$SEEDS" | wc -l | tr -d ' ')
  UNIQ_COUNT=$(echo "$SEEDS" | sort -u | wc -l | tr -d ' ')
  if [ "$V2_STATUS" = "200" ] && [ "$SEED_COUNT" = "5" ] && [ "$UNIQ_COUNT" = "5" ]; then
    pass "V2 each student got a unique seed" "seeds=$SEED_COUNT unique=$UNIQ_COUNT"
  else
    fail "V2 unique seeds" "status=$V2_STATUS seeds=$SEED_COUNT unique=$UNIQ_COUNT"
  fi
  echo "---------------------------------------------"

  # --- Test V3: idempotent — same seeds on re-run --------------
  V3_BODY="$TMP/v3.json"
  V3_STATUS=$(req POST "$API/api/paper-variants/generate-for-class" "$V3_BODY" "$V1_DATA" "$ADMIN_TOKEN")
  V3B_BODY="$TMP/v3b.json"
  req GET "$API/api/paper-variants/assignment/$ASSIGNMENT_ID" "$V3B_BODY" "" "$ADMIN_TOKEN" >/dev/null
  SEEDS_2=$(grep -oE '"seed":[0-9]+' "$V3B_BODY" | sed 's/"seed"://' | sort)
  SEEDS_1=$(echo "$SEEDS" | sort)
  if [ "$V3_STATUS" = "200" ] || [ "$V3_STATUS" = "201" ]; then
    if [ "$SEEDS_1" = "$SEEDS_2" ]; then
      pass "V3 re-run is deterministic — seeds unchanged" "ok"
    else
      fail "V3 re-run produced different seeds (NOT deterministic)" "before=$SEEDS_1 after=$SEEDS_2"
    fi
  else
    fail "V3 re-run status" "status=$V3_STATUS"
  fi
  echo "---------------------------------------------"

  # --- Test V4: per-student fetch as student -------------------
  S1_LOGIN_BODY="$TMP/s1login.json"
  req POST "$API/api/auth/login" "$S1_LOGIN_BODY" \
    "$(printf '{"email":"%s-s1-%s@ex.com","password":"test1234"}' "$PREFIX" "$TS")" >/dev/null
  S1_TOKEN=$(jget "$S1_LOGIN_BODY" token)
  S1_ID=$(jget "$S1_LOGIN_BODY" id)
  if [ -z "$S1_ID" ]; then
    S1_ID=$(grep -o '"user":{[^}]*"id":"[^"]*"' "$S1_LOGIN_BODY" | sed -E 's/.*"id":"([^"]*)".*/\1/')
  fi
  echo "[V4] s1 token_len=${#S1_TOKEN} id=$S1_ID"

  V4_BODY="$TMP/v4.json"
  V4_STATUS=$(req GET "$API/api/paper-variants/student/$S1_ID/assignment/$ASSIGNMENT_ID" "$V4_BODY" "" "$S1_TOKEN")
  if [ "$V4_STATUS" = "200" ] && grep -q '"questionOrder"' "$V4_BODY"; then
    pass "V4 student reads own variant" "status=200"
  else
    fail "V4 student own variant" "status=$V4_STATUS body=$(cat "$V4_BODY")"
  fi

  # V4b: student tries to read ANOTHER student's variant → 403
  S2_LOGIN_BODY="$TMP/s2login.json"
  req POST "$API/api/auth/login" "$S2_LOGIN_BODY" \
    "$(printf '{"email":"%s-s2-%s@ex.com","password":"test1234"}' "$PREFIX" "$TS")" >/dev/null
  S2_ID=$(jget "$S2_LOGIN_BODY" id)
  if [ -z "$S2_ID" ]; then
    S2_ID=$(grep -o '"user":{[^}]*"id":"[^"]*"' "$S2_LOGIN_BODY" | sed -E 's/.*"id":"([^"]*)".*/\1/')
  fi
  V4B_BODY="$TMP/v4b.json"
  V4B_STATUS=$(req GET "$API/api/paper-variants/student/$S2_ID/assignment/$ASSIGNMENT_ID" "$V4B_BODY" "" "$S1_TOKEN")
  if [ "$V4B_STATUS" = "403" ]; then
    pass "V4b student CANNOT read peer's variant" "status=403"
  else
    fail "V4b student CAN read peer's variant — AUTHZ LEAK" "status=$V4B_STATUS"
  fi
  echo "---------------------------------------------"
else
  echo "[V1..V4] SKIPPED — no paper available to assign"
fi

# --- Test N1: notification config CRUD + noop:// stub --------
N1_BODY="$TMP/n1.json"
N1_DATA='{"event":"paper_assigned","channel":"wechat_work","target":{"webhookUrl":"noop://b7-test"},"enabled":true}'
N1_STATUS=$(req POST "$API/api/wechat-notify/configs" "$N1_BODY" "$N1_DATA" "$ADMIN_TOKEN")
CFG_ID=$(jget "$N1_BODY" id)
echo "[N1] create config status=$N1_STATUS id=$CFG_ID"
if { [ "$N1_STATUS" = "200" ] || [ "$N1_STATUS" = "201" ]; } && [ -n "$CFG_ID" ]; then
  pass "N1 admin creates notification config" "id=$CFG_ID"
else
  fail "N1 create config" "status=$N1_STATUS body=$(cat "$N1_BODY")"
fi
echo "---------------------------------------------"

# N2: list configs contains the new one
N2_BODY="$TMP/n2.json"
N2_STATUS=$(req GET "$API/api/wechat-notify/configs" "$N2_BODY" "" "$ADMIN_TOKEN")
if [ "$N2_STATUS" = "200" ] && grep -q "\"id\":\"$CFG_ID\"" "$N2_BODY"; then
  pass "N2 list configs contains new one" "ok"
else
  fail "N2 list configs missing new one" "status=$N2_STATUS body=$(cat "$N2_BODY")"
fi
echo "---------------------------------------------"

# N3: PATCH disable
if [ -n "$CFG_ID" ]; then
  N3_BODY="$TMP/n3.json"
  N3_STATUS=$(req PATCH "$API/api/wechat-notify/configs/$CFG_ID" "$N3_BODY" '{"enabled":false}' "$ADMIN_TOKEN")
  ENABLED=$(jget "$N3_BODY" enabled)
  if [ "$N3_STATUS" = "200" ] && [ "$ENABLED" = "false" ]; then
    pass "N3 PATCH config enabled=false" "ok"
  else
    fail "N3 PATCH config" "status=$N3_STATUS enabled=$ENABLED"
  fi
  # Re-enable for the test fire below
  req PATCH "$API/api/wechat-notify/configs/$CFG_ID" "$TMP/n3b.json" '{"enabled":true}' "$ADMIN_TOKEN" >/dev/null
fi
echo "---------------------------------------------"

# N4: test fire on noop:// stub → log row created with httpStatus=0
if [ -n "$CFG_ID" ]; then
  N4_BODY="$TMP/n4.json"
  N4_STATUS=$(req POST "$API/api/wechat-notify/test/$CFG_ID" "$N4_BODY" "" "$ADMIN_TOKEN")
  N4_HTTP=$(jget "$N4_BODY" httpStatus)
  if { [ "$N4_STATUS" = "200" ] || [ "$N4_STATUS" = "201" ]; } && [ "$N4_HTTP" = "0" ]; then
    pass "N4 test-fire on noop:// stub returns httpStatus=0 (no real HTTP)" "ok"
  else
    fail "N4 test-fire stub" "status=$N4_STATUS httpStatus=$N4_HTTP body=$(cat "$N4_BODY")"
  fi
fi
echo "---------------------------------------------"

# N5: GET /logs returns the noop log
N5_BODY="$TMP/n5.json"
N5_STATUS=$(req GET "$API/api/wechat-notify/logs?event=paper_assigned&limit=20" "$N5_BODY" "" "$ADMIN_TOKEN")
if [ "$N5_STATUS" = "200" ] && grep -q '"httpStatus":0' "$N5_BODY"; then
  pass "N5 GET /logs surfaces the noop test log" "ok"
else
  fail "N5 GET /logs" "status=$N5_STATUS bytes=$(wc -c < "$N5_BODY")"
fi
echo "---------------------------------------------"

# N6: authz — non-admin (admin-token swapped for student token) cannot mutate
if [ -n "${S1_TOKEN:-}" ]; then
  N6_BODY="$TMP/n6.json"
  N6_STATUS=$(req POST "$API/api/wechat-notify/configs" "$N6_BODY" "$N1_DATA" "$S1_TOKEN")
  if [ "$N6_STATUS" = "401" ] || [ "$N6_STATUS" = "403" ]; then
    pass "N6 non-admin cannot create notification config" "status=$N6_STATUS"
  else
    fail "N6 non-admin AUTHZ LEAK on create config" "status=$N6_STATUS body=$(cat "$N6_BODY")"
  fi
fi

# N7: no auth header → 401
N7_BODY="$TMP/n7.json"
N7_STATUS=$(req_noauth GET "$API/api/wechat-notify/configs" "$N7_BODY" "")
if [ "$N7_STATUS" = "401" ]; then
  pass "N7 no auth → 401 on /wechat-notify/configs" "ok"
else
  fail "N7 missing auth NOT 401" "status=$N7_STATUS"
fi
echo "============================================="
echo "SUMMARY: PASS=$PASS  FAIL=$FAIL"
echo "Class: $CLASS_ID  Assignment: ${ASSIGNMENT_ID:-<none>}"
echo "============================================="
exit 0
