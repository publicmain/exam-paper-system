#!/usr/bin/env bash
# B4 Blackbox tests — perf-routing (class topic mastery → AI generator)
# Target: deployed Railway exam-paper-system (or local API via API= env).
# Isolation prefix: b4-
#
# Coverage:
#   1. Authz: GET weak-topics with no token → 401
#   2. Authz: as student → 403
#   3. Happy path: GET weak-topics returns array shape
#   4. Happy path: POST preview-prompt augments base prompt when class
#      has data, returns weakTopics array
#   5. 404 on unknown classId
#   6. Invalid limit → 400
#
# This script does NOT seed answer-script data. It uses an existing class
# (created via t1-classes.sh first, or any class accessible to admin).
# When a class has zero auto-graded scripts the endpoint returns [], which
# we accept as a valid response shape.
set -u

API="${API:-https://exam-paper-system-production.up.railway.app}"
TS="$(date +%s)"
PREFIX="b4"
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
  local file="$1" key="$2"
  local v
  v=$(grep -o "\"$key\":\"[^\"]*\"" "$file" | head -n1 | sed -E "s/\"$key\":\"([^\"]*)\"/\1/")
  if [ -n "$v" ]; then echo "$v"; return; fi
  v=$(grep -oE "\"$key\":[^,}]+" "$file" | head -n1 | sed -E "s/\"$key\"://; s/^[ ]+//; s/[ ]+$//")
  echo "$v"
}

TMP="$(mktemp -d 2>/dev/null || mktemp -d -t b4)"
echo "tmp=$TMP api=$API ts=$TS"
echo "============================================="

# --- Login admin ---
ADMIN_BODY="$TMP/admin_login.json"
ADMIN_STATUS=$(req POST "$API/api/auth/login" "$ADMIN_BODY" '{"email":"admin@school.local","password":"admin123"}')
echo "admin_login: status=$ADMIN_STATUS"
if [ "$ADMIN_STATUS" != "200" ] && [ "$ADMIN_STATUS" != "201" ]; then
  fail "admin login" "got status $ADMIN_STATUS body=$(cat "$ADMIN_BODY")"
  exit 1
fi
ADMIN_TOKEN=$(jget "$ADMIN_BODY" token)
[ -z "$ADMIN_TOKEN" ] && { fail "admin token extract"; exit 1; }
echo "admin_token_len=${#ADMIN_TOKEN}"

# --- Create a class to test against (so the script is self-contained) ---
CLASS_NAME="${PREFIX}-class-${TS}"
CLASS_CODE="${PREFIX}CC${TS}"
CLS_BODY="$TMP/cls.json"
CLS_DATA="$(printf '{"name":"%s","classCode":"%s","level":"AS"}' "$CLASS_NAME" "$CLASS_CODE")"
CLS_STATUS=$(req POST "$API/api/classes" "$CLS_BODY" "$CLS_DATA" "$ADMIN_TOKEN")
CLASS_ID=$(jget "$CLS_BODY" id)
echo "create class status=$CLS_STATUS id=$CLASS_ID"
if { [ "$CLS_STATUS" != "200" ] && [ "$CLS_STATUS" != "201" ]; } || [ -z "$CLASS_ID" ]; then
  fail "create class for B4" "status=$CLS_STATUS body=$(cat "$CLS_BODY")"
  exit 1
fi

# --- Roster a single student (we need them to be enrolled with role=student
#     so the perf-routing service has someone to look at; even with zero
#     submissions this exercises the SQL path correctly).
STU="${PREFIX}-stu-${TS}@example.com"
ROSTER_DATA="$(printf '{"students":[{"email":"%s","name":"B4 Stu","password":"test1234"}]}' "$STU")"
ROSTER_BODY="$TMP/roster.json"
req POST "$API/api/classes/$CLASS_ID/roster" "$ROSTER_BODY" "$ROSTER_DATA" "$ADMIN_TOKEN" >/dev/null

# Student token for authz tests
STU_BODY="$TMP/stu_login.json"
req POST "$API/api/auth/login" "$STU_BODY" "$(printf '{"email":"%s","password":"test1234"}' "$STU")" >/dev/null
STU_TOKEN=$(jget "$STU_BODY" token)
echo "student_token_len=${#STU_TOKEN}"
echo "============================================="

# --- B4-T1: GET weak-topics with no auth → 401 ---
T1_BODY="$TMP/t1.json"
T1_STATUS=$(req_noauth GET "$API/api/perf-routing/class/$CLASS_ID/weak-topics" "$T1_BODY" "")
echo "[B4-T1] no auth status=$T1_STATUS"
if [ "$T1_STATUS" = "401" ]; then
  pass "B4-T1 GET weak-topics without auth → 401"
else
  fail "B4-T1 GET weak-topics without auth NOT 401" "status=$T1_STATUS body=$(cat "$T1_BODY")"
fi
echo "---------------------------------------------"

# --- B4-T2: GET weak-topics as student → 401 (insufficient role) ---
# AuthGuard returns UnauthorizedException for failed role check, which
# Nest serialises as 401. Either 401 or 403 is acceptable; 2xx is not.
T2_BODY="$TMP/t2.json"
T2_STATUS=$(req GET "$API/api/perf-routing/class/$CLASS_ID/weak-topics" "$T2_BODY" "" "$STU_TOKEN")
echo "[B4-T2] student status=$T2_STATUS"
if [ "$T2_STATUS" = "401" ] || [ "$T2_STATUS" = "403" ]; then
  pass "B4-T2 GET weak-topics as student → ${T2_STATUS} (denied)"
else
  fail "B4-T2 student access NOT denied" "status=$T2_STATUS body=$(cat "$T2_BODY")"
fi
echo "---------------------------------------------"

# --- B4-T3: GET weak-topics happy path — empty array OK if no submissions ---
T3_BODY="$TMP/t3.json"
T3_STATUS=$(req GET "$API/api/perf-routing/class/$CLASS_ID/weak-topics?limit=10" "$T3_BODY" "" "$ADMIN_TOKEN")
echo "[B4-T3] admin status=$T3_STATUS body=$(head -c 200 "$T3_BODY")"
if [ "$T3_STATUS" = "200" ]; then
  # Body must be a JSON array.
  if head -c 1 "$T3_BODY" | grep -q '\['; then
    pass "B4-T3 GET weak-topics returns 200 + JSON array"
  else
    fail "B4-T3 weak-topics body is not an array" "body=$(cat "$T3_BODY")"
  fi
else
  fail "B4-T3 weak-topics not 200" "status=$T3_STATUS body=$(cat "$T3_BODY")"
fi
echo "---------------------------------------------"

# --- B4-T4: POST preview-prompt — base prompt should round-trip even
#     when class has zero data. augmentedPrompt key must exist. ---
T4_BODY="$TMP/t4.json"
T4_DATA="$(printf '{"classId":"%s","basePrompt":"Generate 3 questions on %s."}' \
  "$CLASS_ID" "trigonometry")"
T4_STATUS=$(req POST "$API/api/perf-routing/preview-prompt" "$T4_BODY" "$T4_DATA" "$ADMIN_TOKEN")
echo "[B4-T4] preview status=$T4_STATUS body=$(head -c 300 "$T4_BODY")"
if [ "$T4_STATUS" = "200" ] || [ "$T4_STATUS" = "201" ]; then
  if grep -q '"augmentedPrompt"' "$T4_BODY" && grep -q '"weakTopics"' "$T4_BODY"; then
    pass "B4-T4 POST preview-prompt has augmentedPrompt + weakTopics keys"
  else
    fail "B4-T4 preview-prompt missing keys" "body=$(cat "$T4_BODY")"
  fi
else
  fail "B4-T4 preview-prompt not 2xx" "status=$T4_STATUS body=$(cat "$T4_BODY")"
fi
echo "---------------------------------------------"

# --- B4-T5: Unknown classId → 404 ---
T5_BODY="$TMP/t5.json"
T5_STATUS=$(req GET "$API/api/perf-routing/class/no-such-class-xxx/weak-topics" "$T5_BODY" "" "$ADMIN_TOKEN")
echo "[B4-T5] unknown class status=$T5_STATUS"
if [ "$T5_STATUS" = "404" ]; then
  pass "B4-T5 unknown classId → 404"
else
  fail "B4-T5 unknown classId NOT 404" "status=$T5_STATUS body=$(cat "$T5_BODY")"
fi
echo "---------------------------------------------"

# --- B4-T6: Invalid limit query → 400 ---
T6_BODY="$TMP/t6.json"
T6_STATUS=$(req GET "$API/api/perf-routing/class/$CLASS_ID/weak-topics?limit=-1" "$T6_BODY" "" "$ADMIN_TOKEN")
echo "[B4-T6] negative limit status=$T6_STATUS"
if [ "$T6_STATUS" = "400" ]; then
  pass "B4-T6 invalid limit → 400"
else
  fail "B4-T6 invalid limit NOT 400" "status=$T6_STATUS body=$(cat "$T6_BODY")"
fi
echo "---------------------------------------------"

# --- B4-T7: preview-prompt with empty body → 400 (zod validation) ---
T7_BODY="$TMP/t7.json"
T7_STATUS=$(req POST "$API/api/perf-routing/preview-prompt" "$T7_BODY" '{}' "$ADMIN_TOKEN")
echo "[B4-T7] empty body status=$T7_STATUS"
if [ "$T7_STATUS" = "400" ]; then
  pass "B4-T7 preview-prompt empty body → 400"
elif [ "$T7_STATUS" -ge 500 ] 2>/dev/null; then
  fail "B4-T7 empty body returns 5xx (HIGH severity)" "status=$T7_STATUS"
else
  fail "B4-T7 empty body NOT 400" "status=$T7_STATUS body=$(cat "$T7_BODY")"
fi
echo "============================================="
echo "SUMMARY: PASS=$PASS  FAIL=$FAIL"
echo "Class id under test: $CLASS_ID  ($CLASS_CODE)"
echo "============================================="
[ "$FAIL" -gt 0 ] && exit 1
exit 0
