#!/usr/bin/env bash
# T1 Blackbox tests — classes / roster / authorization
# Target: deployed Railway exam-paper-system
# Isolation prefix: t1-
set -u

API="${API:-https://exam-paper-system-production.up.railway.app}"
TS="$(date +%s)"
PREFIX="t1"
PASS=0
FAIL=0

# Portable curl helper. Writes body to $1, status code goes to stdout.
# Usage: STATUS=$(req METHOD URL BODYFILE [DATA] [TOKEN])
req() {
  local method="$1" url="$2" bodyfile="$3" data="${4:-}" token="${5:-}"
  local args=(-sS -o "$bodyfile" -w '%{http_code}' --max-time 30 -X "$method" "$url" -H 'Content-Type: application/json')
  if [ -n "$token" ]; then
    args+=(-H "Authorization: Bearer $token")
  fi
  if [ -n "$data" ]; then
    args+=(--data "$data")
  fi
  curl "${args[@]}"
}

# Like req() but no Authorization header at all (for testing 401)
req_noauth() {
  local method="$1" url="$2" bodyfile="$3" data="${4:-}"
  local args=(-sS -o "$bodyfile" -w '%{http_code}' --max-time 30 -X "$method" "$url" -H 'Content-Type: application/json')
  if [ -n "$data" ]; then
    args+=(--data "$data")
  fi
  curl "${args[@]}"
}

pass() { PASS=$((PASS+1)); echo "[PASS] $1"; [ -n "${2:-}" ] && echo "       $2"; }
fail() { FAIL=$((FAIL+1)); echo "[FAIL] $1"; [ -n "${2:-}" ] && echo "       $2"; }

# Crude JSON value extractor for "key":"value" or "key":value (numbers/bools).
# Good enough for our deterministic NestJS responses.
jget() {
  local file="$1" key="$2"
  # quoted string
  local v
  v=$(grep -o "\"$key\":\"[^\"]*\"" "$file" | head -n1 | sed -E "s/\"$key\":\"([^\"]*)\"/\1/")
  if [ -n "$v" ]; then echo "$v"; return; fi
  # bare value
  v=$(grep -oE "\"$key\":[^,}]+" "$file" | head -n1 | sed -E "s/\"$key\"://; s/^[ ]+//; s/[ ]+$//")
  echo "$v"
}

TMP="$(mktemp -d 2>/dev/null || mktemp -d -t t1)"
echo "tmp=$TMP api=$API ts=$TS"
echo "============================================="

# --- Login admin ---
ADMIN_BODY="$TMP/admin_login.json"
ADMIN_STATUS=$(req POST "$API/api/auth/login" "$ADMIN_BODY" '{"email":"admin@school.local","password":"admin123"}')
echo "admin_login: status=$ADMIN_STATUS body=$(cat "$ADMIN_BODY")"
if [ "$ADMIN_STATUS" != "200" ] && [ "$ADMIN_STATUS" != "201" ]; then
  fail "admin login" "got status $ADMIN_STATUS"
  echo "Cannot continue without admin token. Aborting." >&2
  exit 1
fi
ADMIN_TOKEN=$(jget "$ADMIN_BODY" token)
if [ -z "$ADMIN_TOKEN" ]; then
  fail "admin login token extraction" "$(cat "$ADMIN_BODY")"
  exit 1
fi
echo "admin_token_len=${#ADMIN_TOKEN}"
echo "============================================="

# --- Test 1: POST /api/classes (admin) ---
CLASS_NAME="${PREFIX}-class-${TS}"
CLASS_CODE="${PREFIX}-CC-${TS}"
T1_BODY="$TMP/t1.json"
T1_DATA="$(printf '{"name":"%s","classCode":"%s","level":"AS"}' "$CLASS_NAME" "$CLASS_CODE")"
T1_STATUS=$(req POST "$API/api/classes" "$T1_BODY" "$T1_DATA" "$ADMIN_TOKEN")
CLASS_ID=$(jget "$T1_BODY" id)
echo "[T1] POST /api/classes status=$T1_STATUS body=$(cat "$T1_BODY")"
if { [ "$T1_STATUS" = "200" ] || [ "$T1_STATUS" = "201" ]; } && [ -n "$CLASS_ID" ]; then
  pass "T1 POST /api/classes (admin)" "id=$CLASS_ID status=$T1_STATUS"
else
  fail "T1 POST /api/classes (admin)" "status=$T1_STATUS body=$(cat "$T1_BODY")"
  echo "no class id — aborting"
  exit 1
fi
echo "---------------------------------------------"

# --- Test 2: GET /api/classes (admin) — created class appears ---
T2_BODY="$TMP/t2.json"
T2_STATUS=$(req GET "$API/api/classes" "$T2_BODY" "" "$ADMIN_TOKEN")
echo "[T2] GET /api/classes status=$T2_STATUS bytes=$(wc -c < "$T2_BODY")"
if [ "$T2_STATUS" = "200" ] && grep -q "\"id\":\"$CLASS_ID\"" "$T2_BODY"; then
  pass "T2 GET /api/classes (admin) lists created class" "id=$CLASS_ID found"
else
  fail "T2 GET /api/classes (admin) lists created class" "status=$T2_STATUS contains_id=$(grep -c "\"id\":\"$CLASS_ID\"" "$T2_BODY")"
fi
echo "---------------------------------------------"

# --- Test 3: POST /api/classes/:id/roster (3 students) ---
ST1="${PREFIX}-stu-1-${TS}@example.com"
ST2="${PREFIX}-stu-2-${TS}@example.com"
ST3="${PREFIX}-stu-3-${TS}@example.com"
ST4="${PREFIX}-stu-4-${TS}@example.com"
ROSTER_DATA=$(cat <<JSON
{"students":[
  {"email":"$ST1","name":"T1 Stu 1","password":"test1234"},
  {"email":"$ST2","name":"T1 Stu 2","password":"test1234"},
  {"email":"$ST3","name":"T1 Stu 3","password":"test1234"}
]}
JSON
)
T3_BODY="$TMP/t3.json"
T3_STATUS=$(req POST "$API/api/classes/$CLASS_ID/roster" "$T3_BODY" "$ROSTER_DATA" "$ADMIN_TOKEN")
echo "[T3] POST roster status=$T3_STATUS body=$(cat "$T3_BODY")"
T3_CREATED=$(jget "$T3_BODY" createdUsers)
T3_ENROLLED=$(jget "$T3_BODY" enrolled)
if { [ "$T3_STATUS" = "200" ] || [ "$T3_STATUS" = "201" ]; } && [ "$T3_CREATED" = "3" ] && [ "$T3_ENROLLED" = "3" ]; then
  pass "T3 POST /api/classes/:id/roster (3 students)" "createdUsers=$T3_CREATED enrolled=$T3_ENROLLED"
else
  fail "T3 POST /api/classes/:id/roster (3 students)" "status=$T3_STATUS createdUsers=$T3_CREATED enrolled=$T3_ENROLLED body=$(cat "$T3_BODY")"
fi
echo "---------------------------------------------"

# --- Test 4: Login as t1-stu-1 ---
T4_BODY="$TMP/t4.json"
T4_STATUS=$(req POST "$API/api/auth/login" "$T4_BODY" "$(printf '{"email":"%s","password":"test1234"}' "$ST1")")
echo "[T4] student login status=$T4_STATUS body=$(cat "$T4_BODY")"
STU_TOKEN=$(jget "$T4_BODY" token)
STU_ROLE=$(jget "$T4_BODY" role)
if [ "$T4_STATUS" = "200" ] || [ "$T4_STATUS" = "201" ]; then
  if [ "$STU_ROLE" = "student" ] && [ -n "$STU_TOKEN" ]; then
    pass "T4 Student login (t1-stu-1)" "role=$STU_ROLE token_len=${#STU_TOKEN}"
  else
    fail "T4 Student login role/token" "role=$STU_ROLE token_len=${#STU_TOKEN} body=$(cat "$T4_BODY")"
  fi
else
  fail "T4 Student login" "status=$T4_STATUS body=$(cat "$T4_BODY")"
fi
# Verify token works by hitting an authed endpoint (GET /api/classes)
if [ -n "$STU_TOKEN" ]; then
  T4B_BODY="$TMP/t4b.json"
  T4B_STATUS=$(req GET "$API/api/classes" "$T4B_BODY" "" "$STU_TOKEN")
  if [ "$T4B_STATUS" = "200" ]; then
    pass "T4b Student token works on GET /api/classes" "status=200"
  else
    fail "T4b Student token works on GET /api/classes" "status=$T4B_STATUS body=$(cat "$T4B_BODY")"
  fi
fi
echo "---------------------------------------------"

# --- Test 5: Re-roster same 3 → idempotent ---
T5_BODY="$TMP/t5.json"
T5_STATUS=$(req POST "$API/api/classes/$CLASS_ID/roster" "$T5_BODY" "$ROSTER_DATA" "$ADMIN_TOKEN")
echo "[T5] re-roster status=$T5_STATUS body=$(cat "$T5_BODY")"
T5_CREATED=$(jget "$T5_BODY" createdUsers)
T5_ENROLLED=$(jget "$T5_BODY" enrolled)
T5_ALREADY=$(jget "$T5_BODY" alreadyIn)
if { [ "$T5_STATUS" = "200" ] || [ "$T5_STATUS" = "201" ]; } && [ "$T5_CREATED" = "0" ] && [ "$T5_ENROLLED" = "0" ] && [ "$T5_ALREADY" = "3" ]; then
  pass "T5 Re-roster is idempotent" "createdUsers=0 enrolled=0 alreadyIn=3"
else
  fail "T5 Re-roster is idempotent" "status=$T5_STATUS createdUsers=$T5_CREATED enrolled=$T5_ENROLLED alreadyIn=$T5_ALREADY"
fi

# Sanity check: GET class detail and count enrollments — should still be 3.
# We count distinct enrollment objects via the unique enrollment "joinedAt" field
# (each enrollment row has exactly one joinedAt; the nested user object does not).
T5C_BODY="$TMP/t5c.json"
T5C_STATUS=$(req GET "$API/api/classes/$CLASS_ID" "$T5C_BODY" "" "$ADMIN_TOKEN")
ENR_COUNT=$(grep -o '"joinedAt":' "$T5C_BODY" | wc -l | tr -d ' ')
echo "[T5c] class detail status=$T5C_STATUS student_enrollment_count=$ENR_COUNT"
if [ "$T5C_STATUS" = "200" ] && [ "$ENR_COUNT" = "3" ]; then
  pass "T5c Enrollment count after re-roster" "count=$ENR_COUNT"
else
  fail "T5c Enrollment count after re-roster" "status=$T5C_STATUS count=$ENR_COUNT (expected 3)"
fi
echo "---------------------------------------------"

# --- Test 6: POST /api/classes/:id/enrollments add 4th student ---
# We'll need a 4th existing user to enroll. Create one via a single-roster call to a tmp class? Simpler:
# Re-use t1-stu-3 — wait, they're already enrolled. We need a different existing student id.
# Approach: pull stu-1's id by decoding his JWT? Or create a new student via roster on a throwaway then enroll into our class.
# Simplest: bulk-roster a NEW student into our class then re-add via /enrollments would 409. Instead:
# Roster t1-stu-4 via roster endpoint into another approach: roster expects classId. Let's create them via roster on our class with just stu-4, then DELETE then re-add via /enrollments.
# That tests 6 + 7 cleanly.

# Create stu-4 by rostering (this auto-enrolls them in our class).
STU4_DATA=$(printf '{"students":[{"email":"%s","name":"T1 Stu 4","password":"test1234"}]}' "$ST4")
T6PREP_BODY="$TMP/t6prep.json"
T6PREP_STATUS=$(req POST "$API/api/classes/$CLASS_ID/roster" "$T6PREP_BODY" "$STU4_DATA" "$ADMIN_TOKEN")
echo "[T6-prep] roster stu4 status=$T6PREP_STATUS body=$(cat "$T6PREP_BODY")"
# Get stu-4's id by logging in as them
T6LOGIN_BODY="$TMP/t6login.json"
T6LOGIN_STATUS=$(req POST "$API/api/auth/login" "$T6LOGIN_BODY" "$(printf '{"email":"%s","password":"test1234"}' "$ST4")")
STU4_ID=$(jget "$T6LOGIN_BODY" id)
# The id may live inside a "user":{...} object; try alternative extraction.
if [ -z "$STU4_ID" ]; then
  STU4_ID=$(grep -o '"user":{[^}]*"id":"[^"]*"' "$T6LOGIN_BODY" | sed -E 's/.*"id":"([^"]*)".*/\1/')
fi
echo "[T6-prep] stu4 id=$STU4_ID"

# Now: stu-4 is already enrolled via roster. To test the /enrollments POST, we DELETE first then POST /enrollments.
T6DEL_BODY="$TMP/t6del.json"
T6DEL_STATUS=$(req DELETE "$API/api/classes/$CLASS_ID/enrollments/$STU4_ID" "$T6DEL_BODY" "" "$ADMIN_TOKEN")
echo "[T6-prep-del] DELETE status=$T6DEL_STATUS body=$(cat "$T6DEL_BODY")"

T6_BODY="$TMP/t6.json"
T6_DATA=$(printf '{"userId":"%s"}' "$STU4_ID")
T6_STATUS=$(req POST "$API/api/classes/$CLASS_ID/enrollments" "$T6_BODY" "$T6_DATA" "$ADMIN_TOKEN")
echo "[T6] POST enrollments status=$T6_STATUS body=$(cat "$T6_BODY")"
if { [ "$T6_STATUS" = "200" ] || [ "$T6_STATUS" = "201" ]; } && [ -n "$(jget "$T6_BODY" id)" ]; then
  pass "T6 POST /api/classes/:id/enrollments adds 4th student" "status=$T6_STATUS"
else
  fail "T6 POST /api/classes/:id/enrollments adds 4th student" "status=$T6_STATUS body=$(cat "$T6_BODY")"
fi

# Verify count is now 4
T6V_BODY="$TMP/t6v.json"
T6V_STATUS=$(req GET "$API/api/classes/$CLASS_ID" "$T6V_BODY" "" "$ADMIN_TOKEN")
T6V_COUNT=$(grep -o '"joinedAt":' "$T6V_BODY" | wc -l | tr -d ' ')
echo "[T6v] count after add=$T6V_COUNT"
if [ "$T6V_COUNT" = "4" ]; then
  pass "T6v Count after add = 4" "count=$T6V_COUNT"
else
  fail "T6v Count after add = 4" "count=$T6V_COUNT"
fi
echo "---------------------------------------------"

# --- Test 7: DELETE /api/classes/:id/enrollments/:userId — back to 3 ---
T7_BODY="$TMP/t7.json"
T7_STATUS=$(req DELETE "$API/api/classes/$CLASS_ID/enrollments/$STU4_ID" "$T7_BODY" "" "$ADMIN_TOKEN")
echo "[T7] DELETE status=$T7_STATUS body=$(cat "$T7_BODY")"

T7V_BODY="$TMP/t7v.json"
T7V_STATUS=$(req GET "$API/api/classes/$CLASS_ID" "$T7V_BODY" "" "$ADMIN_TOKEN")
T7V_COUNT=$(grep -o '"joinedAt":' "$T7V_BODY" | wc -l | tr -d ' ')
echo "[T7v] count after delete=$T7V_COUNT"
if { [ "$T7_STATUS" = "200" ] || [ "$T7_STATUS" = "204" ]; } && [ "$T7V_COUNT" = "3" ]; then
  pass "T7 DELETE enrollment removes student; count back to 3" "delete_status=$T7_STATUS count=$T7V_COUNT"
else
  fail "T7 DELETE enrollment removes student; count back to 3" "delete_status=$T7_STATUS count=$T7V_COUNT"
fi
echo "---------------------------------------------"

# --- Test 8a: GET /api/classes as student — should be ONLY their own class or empty (not full list) ---
T8A_BODY="$TMP/t8a.json"
T8A_STATUS=$(req GET "$API/api/classes" "$T8A_BODY" "" "$STU_TOKEN")
echo "[T8a] student GET /api/classes status=$T8A_STATUS body=$(cat "$T8A_BODY")"
# Count number of class objects with "id":"..."
STU_CLASS_COUNT=$(grep -oE '"id":"[^"]*"' "$T8A_BODY" | sort -u | wc -l | tr -d ' ')
# Heuristic: response should at most contain entries the student is in. Since we made one class for them,
# expect 1 (maybe multiple t1-* runs accumulate, but always belonging to them).
# Critical: must NOT contain classes student does not belong to. Our classCode CLASS_CODE is theirs.
if [ "$T8A_STATUS" != "200" ]; then
  fail "T8a Student GET /api/classes" "status=$T8A_STATUS"
elif ! grep -q "\"id\":\"$CLASS_ID\"" "$T8A_BODY"; then
  fail "T8a Student GET /api/classes — should see own class but didn't" "body=$(cat "$T8A_BODY")"
else
  # Check that count <= number of classes student could possibly belong to.
  # Authoritative check: re-fetch admin list count and compare. If student sees same count as admin = LEAK.
  T8A_ADMIN_BODY="$TMP/t8a_admin.json"
  req GET "$API/api/classes" "$T8A_ADMIN_BODY" "" "$ADMIN_TOKEN" >/dev/null
  ADMIN_CLASS_COUNT=$(grep -oE '"id":"[^"]*","' "$T8A_ADMIN_BODY" | sort -u | wc -l | tr -d ' ')
  echo "[T8a] student_class_count=$STU_CLASS_COUNT admin_class_count=$ADMIN_CLASS_COUNT"
  if [ "$STU_CLASS_COUNT" -lt "$ADMIN_CLASS_COUNT" ] || [ "$ADMIN_CLASS_COUNT" -le 1 ]; then
    pass "T8a Student sees fewer classes than admin (no leak)" "student=$STU_CLASS_COUNT admin=$ADMIN_CLASS_COUNT"
  else
    fail "T8a AUTHORIZATION LEAK: student sees same/more classes than admin" "student=$STU_CLASS_COUNT admin=$ADMIN_CLASS_COUNT"
  fi
fi
echo "---------------------------------------------"

# --- Test 8b: POST /api/classes as student → 403 ---
T8B_BODY="$TMP/t8b.json"
T8B_DATA=$(printf '{"name":"%s-evil-%s","classCode":"%s-EVIL-%s","level":"AS"}' "$PREFIX" "$TS" "$PREFIX" "$TS")
T8B_STATUS=$(req POST "$API/api/classes" "$T8B_BODY" "$T8B_DATA" "$STU_TOKEN")
echo "[T8b] student POST /api/classes status=$T8B_STATUS body=$(cat "$T8B_BODY")"
if [ "$T8B_STATUS" = "403" ]; then
  pass "T8b Student POST /api/classes is 403" "status=403"
elif [ "$T8B_STATUS" = "401" ]; then
  fail "T8b Student POST /api/classes returns 401 instead of 403" "status=401 (acceptable but inconsistent)"
else
  fail "T8b Student POST /api/classes NOT 403 (CRITICAL if 2xx)" "status=$T8B_STATUS body=$(cat "$T8B_BODY")"
fi
echo "---------------------------------------------"

# --- Test 8c: POST /api/classes/:id/roster as student → 403 ---
T8C_BODY="$TMP/t8c.json"
T8C_DATA='{"students":[{"email":"t1-evil-roster@example.com","name":"Evil","password":"test1234"}]}'
T8C_STATUS=$(req POST "$API/api/classes/$CLASS_ID/roster" "$T8C_BODY" "$T8C_DATA" "$STU_TOKEN")
echo "[T8c] student POST roster status=$T8C_STATUS body=$(cat "$T8C_BODY")"
if [ "$T8C_STATUS" = "403" ]; then
  pass "T8c Student POST roster is 403" "status=403"
elif [ "$T8C_STATUS" = "401" ]; then
  fail "T8c Student POST roster returns 401 instead of 403" "status=401"
else
  fail "T8c Student POST roster NOT 403 (CRITICAL if 2xx)" "status=$T8C_STATUS body=$(cat "$T8C_BODY")"
fi
echo "---------------------------------------------"

# --- Test 9: POST /api/classes with empty body {} → 400 (NOT 500) ---
T9_BODY="$TMP/t9.json"
T9_STATUS=$(req POST "$API/api/classes" "$T9_BODY" '{}' "$ADMIN_TOKEN")
echo "[T9] empty body status=$T9_STATUS body=$(cat "$T9_BODY")"
if [ "$T9_STATUS" = "400" ]; then
  pass "T9 Empty body returns 400" "status=400"
elif [ "$T9_STATUS" -ge 500 ] 2>/dev/null; then
  fail "T9 Empty body returns 5xx (HIGH severity)" "status=$T9_STATUS"
else
  fail "T9 Empty body NOT 400" "status=$T9_STATUS body=$(cat "$T9_BODY")"
fi
echo "---------------------------------------------"

# --- Test 10: GET /api/classes with no Authorization header → 401 ---
T10_BODY="$TMP/t10.json"
T10_STATUS=$(req_noauth GET "$API/api/classes" "$T10_BODY" "")
echo "[T10] no auth status=$T10_STATUS body=$(cat "$T10_BODY")"
if [ "$T10_STATUS" = "401" ]; then
  pass "T10 No auth header returns 401" "status=401"
else
  fail "T10 No auth header NOT 401" "status=$T10_STATUS body=$(cat "$T10_BODY")"
fi
echo "============================================="
echo "SUMMARY: PASS=$PASS  FAIL=$FAIL"
echo "Class id under test: $CLASS_ID  ($CLASS_CODE)"
echo "============================================="
exit 0
