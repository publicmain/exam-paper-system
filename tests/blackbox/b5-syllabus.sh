#!/usr/bin/env bash
# B5 Blackbox tests — admin-syllabus CRUD + bulk import + authz
# Target: deployed Railway exam-paper-system
# Isolation prefix: b5-
set -u

API="${API:-https://exam-paper-system-production.up.railway.app}"
TS="$(date +%s)"
PREFIX="b5"
PASS=0
FAIL=0

# --- Portable curl helpers (copied from t1-classes.sh — proven shape) ---
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

TMP="$(mktemp -d 2>/dev/null || mktemp -d -t b5)"
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
[ -z "$ADMIN_TOKEN" ] && { fail "admin token" ""; exit 1; }
echo "admin_token_len=${#ADMIN_TOKEN}"

# --- Login head_teacher (for authz checks). If account doesn't exist, skip those tests. ---
HEAD_BODY="$TMP/head_login.json"
HEAD_STATUS=$(req POST "$API/api/auth/login" "$HEAD_BODY" '{"email":"head@school.local","password":"head1234"}')
HEAD_TOKEN=""
if [ "$HEAD_STATUS" = "200" ] || [ "$HEAD_STATUS" = "201" ]; then
  HEAD_TOKEN=$(jget "$HEAD_BODY" token)
  echo "head_token_len=${#HEAD_TOKEN}"
else
  echo "head_teacher login failed (status=$HEAD_STATUS) — head_teacher authz tests will be skipped"
fi

# --- Login teacher (for authz checks). If account doesn't exist, skip those tests. ---
TEACHER_BODY="$TMP/teacher_login.json"
TEACHER_STATUS=$(req POST "$API/api/auth/login" "$TEACHER_BODY" '{"email":"teacher@school.local","password":"teacher123"}')
TEACHER_TOKEN=""
if [ "$TEACHER_STATUS" = "200" ] || [ "$TEACHER_STATUS" = "201" ]; then
  TEACHER_TOKEN=$(jget "$TEACHER_BODY" token)
  echo "teacher_token_len=${#TEACHER_TOKEN}"
else
  echo "teacher login failed (status=$TEACHER_STATUS) — teacher authz tests will be skipped"
fi
echo "============================================="

# --- T1: Create exam board (admin) ---
BOARD_CODE="${PREFIX^^}-${TS}"
T1_BODY="$TMP/t1.json"
T1_DATA="$(printf '{"code":"%s","name":"B5 Test Board %s"}' "$BOARD_CODE" "$TS")"
T1_STATUS=$(req POST "$API/api/admin-syllabus/exam-boards" "$T1_BODY" "$T1_DATA" "$ADMIN_TOKEN")
BOARD_ID=$(jget "$T1_BODY" id)
echo "[T1] POST exam-boards status=$T1_STATUS body=$(cat "$T1_BODY")"
if { [ "$T1_STATUS" = "200" ] || [ "$T1_STATUS" = "201" ]; } && [ -n "$BOARD_ID" ]; then
  pass "T1 POST /admin-syllabus/exam-boards (admin)" "id=$BOARD_ID"
else
  fail "T1 POST /admin-syllabus/exam-boards" "status=$T1_STATUS body=$(cat "$T1_BODY")"
  exit 1
fi
echo "---------------------------------------------"

# --- T2: Create exam board with same code → 409 ---
T2_BODY="$TMP/t2.json"
T2_STATUS=$(req POST "$API/api/admin-syllabus/exam-boards" "$T2_BODY" "$T1_DATA" "$ADMIN_TOKEN")
echo "[T2] duplicate exam-board status=$T2_STATUS body=$(cat "$T2_BODY")"
if [ "$T2_STATUS" = "409" ]; then
  pass "T2 duplicate exam-board returns 409" "status=409"
else
  fail "T2 duplicate exam-board" "expected 409 got $T2_STATUS"
fi
echo "---------------------------------------------"

# --- T3: Create subject under board (admin) ---
SUBJECT_CODE="${PREFIX}${TS}"
T3_BODY="$TMP/t3.json"
T3_DATA="$(printf '{"examBoardId":"%s","code":"%s","name":"B5 Subject","level":"A_LEVEL"}' "$BOARD_ID" "$SUBJECT_CODE")"
T3_STATUS=$(req POST "$API/api/admin-syllabus/subjects" "$T3_BODY" "$T3_DATA" "$ADMIN_TOKEN")
SUBJECT_ID=$(jget "$T3_BODY" id)
echo "[T3] POST subjects status=$T3_STATUS body=$(cat "$T3_BODY")"
if { [ "$T3_STATUS" = "200" ] || [ "$T3_STATUS" = "201" ]; } && [ -n "$SUBJECT_ID" ]; then
  pass "T3 POST /admin-syllabus/subjects (admin)" "id=$SUBJECT_ID"
else
  fail "T3 POST /admin-syllabus/subjects" "status=$T3_STATUS body=$(cat "$T3_BODY")"
  exit 1
fi
echo "---------------------------------------------"

# --- T4: Create component under subject (admin) ---
T4_BODY="$TMP/t4.json"
T4_DATA="$(printf '{"subjectId":"%s","code":"P1","name":"Paper 1"}' "$SUBJECT_ID")"
T4_STATUS=$(req POST "$API/api/admin-syllabus/components" "$T4_BODY" "$T4_DATA" "$ADMIN_TOKEN")
COMPONENT_ID=$(jget "$T4_BODY" id)
echo "[T4] POST components status=$T4_STATUS body=$(cat "$T4_BODY")"
if { [ "$T4_STATUS" = "200" ] || [ "$T4_STATUS" = "201" ]; } && [ -n "$COMPONENT_ID" ]; then
  pass "T4 POST /admin-syllabus/components (admin)" "id=$COMPONENT_ID"
else
  fail "T4 POST /admin-syllabus/components" "status=$T4_STATUS body=$(cat "$T4_BODY")"
  exit 1
fi
echo "---------------------------------------------"

# --- T5: Create 3 topics (one root, one root-with-no-children, one child) ---
T5A_BODY="$TMP/t5a.json"
T5A_DATA="$(printf '{"componentId":"%s","code":"T1","name":"Topic 1"}' "$COMPONENT_ID")"
T5A_STATUS=$(req POST "$API/api/admin-syllabus/topics" "$T5A_BODY" "$T5A_DATA" "$ADMIN_TOKEN")
TOPIC1_ID=$(jget "$T5A_BODY" id)

T5B_BODY="$TMP/t5b.json"
T5B_DATA="$(printf '{"componentId":"%s","code":"T2","name":"Topic 2"}' "$COMPONENT_ID")"
T5B_STATUS=$(req POST "$API/api/admin-syllabus/topics" "$T5B_BODY" "$T5B_DATA" "$ADMIN_TOKEN")
TOPIC2_ID=$(jget "$T5B_BODY" id)

T5C_BODY="$TMP/t5c.json"
T5C_DATA="$(printf '{"componentId":"%s","parentTopicId":"%s","code":"T1.1","name":"Topic 1.1"}' "$COMPONENT_ID" "$TOPIC1_ID")"
T5C_STATUS=$(req POST "$API/api/admin-syllabus/topics" "$T5C_BODY" "$T5C_DATA" "$ADMIN_TOKEN")
TOPIC11_ID=$(jget "$T5C_BODY" id)

echo "[T5] topic_ids: T1=$TOPIC1_ID T2=$TOPIC2_ID T1.1=$TOPIC11_ID"
if [ -n "$TOPIC1_ID" ] && [ -n "$TOPIC2_ID" ] && [ -n "$TOPIC11_ID" ]; then
  pass "T5 Created 3 topics (2 roots + 1 child)" "T1=$TOPIC1_ID T2=$TOPIC2_ID child=$TOPIC11_ID"
else
  fail "T5 Create 3 topics" "T5A=$T5A_STATUS T5B=$T5B_STATUS T5C=$T5C_STATUS"
fi
echo "---------------------------------------------"

# --- T6: Verify GET /api/topics?componentId=... returns the tree ---
T6_BODY="$TMP/t6.json"
T6_STATUS=$(req GET "$API/api/topics?componentId=$COMPONENT_ID" "$T6_BODY" "" "$ADMIN_TOKEN")
echo "[T6] GET topics tree status=$T6_STATUS bytes=$(wc -c < "$T6_BODY")"
if [ "$T6_STATUS" = "200" ] && grep -q "\"id\":\"$TOPIC1_ID\"" "$T6_BODY" && grep -q "\"id\":\"$TOPIC11_ID\"" "$T6_BODY"; then
  pass "T6 GET /api/topics returns created topics" "all 3 ids found"
else
  fail "T6 GET /api/topics" "status=$T6_STATUS body=$(cat "$T6_BODY")"
fi
echo "---------------------------------------------"

# --- T7: PATCH topic — rename ---
T7_BODY="$TMP/t7.json"
T7_DATA='{"name":"Topic 1 — Renamed"}'
T7_STATUS=$(req PATCH "$API/api/admin-syllabus/topics/$TOPIC1_ID" "$T7_BODY" "$T7_DATA" "$ADMIN_TOKEN")
echo "[T7] PATCH topic rename status=$T7_STATUS body=$(cat "$T7_BODY")"
if [ "$T7_STATUS" = "200" ] && grep -q "Renamed" "$T7_BODY"; then
  pass "T7 PATCH topic rename" "status=200"
else
  fail "T7 PATCH topic rename" "status=$T7_STATUS body=$(cat "$T7_BODY")"
fi
echo "---------------------------------------------"

# --- T8: PATCH topic — reparent T1.1 under T2 ---
T8_BODY="$TMP/t8.json"
T8_DATA="$(printf '{"parentTopicId":"%s"}' "$TOPIC2_ID")"
T8_STATUS=$(req PATCH "$API/api/admin-syllabus/topics/$TOPIC11_ID" "$T8_BODY" "$T8_DATA" "$ADMIN_TOKEN")
echo "[T8] PATCH reparent status=$T8_STATUS body=$(cat "$T8_BODY")"
if [ "$T8_STATUS" = "200" ] && grep -q "\"parentTopicId\":\"$TOPIC2_ID\"" "$T8_BODY"; then
  pass "T8 PATCH reparent T1.1 → T2" "status=200"
else
  fail "T8 PATCH reparent" "status=$T8_STATUS body=$(cat "$T8_BODY")"
fi
echo "---------------------------------------------"

# --- T9: PATCH topic — reject self-parent (cycle) ---
T9_BODY="$TMP/t9.json"
T9_DATA="$(printf '{"parentTopicId":"%s"}' "$TOPIC1_ID")"
T9_STATUS=$(req PATCH "$API/api/admin-syllabus/topics/$TOPIC1_ID" "$T9_BODY" "$T9_DATA" "$ADMIN_TOKEN")
echo "[T9] PATCH self-parent status=$T9_STATUS body=$(cat "$T9_BODY")"
if [ "$T9_STATUS" = "400" ]; then
  pass "T9 self-parent rejected with 400" "status=400"
else
  fail "T9 self-parent should be 400" "status=$T9_STATUS body=$(cat "$T9_BODY")"
fi
echo "---------------------------------------------"

# --- T10: DELETE topic with no references → 200 ---
# Delete the leaf (T1.1, now child of T2). Has no questions, no children.
T10_BODY="$TMP/t10.json"
T10_STATUS=$(req DELETE "$API/api/admin-syllabus/topics/$TOPIC11_ID" "$T10_BODY" "" "$ADMIN_TOKEN")
echo "[T10] DELETE leaf topic status=$T10_STATUS body=$(cat "$T10_BODY")"
if [ "$T10_STATUS" = "200" ] || [ "$T10_STATUS" = "204" ]; then
  pass "T10 DELETE unreferenced topic" "status=$T10_STATUS"
else
  fail "T10 DELETE unreferenced topic" "status=$T10_STATUS body=$(cat "$T10_BODY")"
fi
echo "---------------------------------------------"

# --- T11: Bulk import another subject ---
IMPORT_BOARD="${PREFIX^^}-IMP-${TS}"
IMPORT_SUBJECT="${PREFIX}imp${TS}"
T11_BODY="$TMP/t11.json"
T11_DATA=$(cat <<JSON
{
  "boardCode": "$IMPORT_BOARD",
  "boardName": "B5 Import Board",
  "subjectCode": "$IMPORT_SUBJECT",
  "subjectName": "B5 Imported Subject",
  "level": "A_LEVEL",
  "components": [
    {
      "code": "P1",
      "name": "Multiple Choice",
      "topics": [
        { "code": "1", "name": "Atomic structure", "children": [
          { "code": "1.1", "name": "Particles" },
          { "code": "1.2", "name": "Isotopes" }
        ]},
        { "code": "2", "name": "Stoichiometry" }
      ]
    },
    {
      "code": "P2",
      "name": "Theory",
      "topics": [
        { "code": "P2.1", "name": "Bonding" }
      ]
    }
  ]
}
JSON
)
T11_STATUS=$(req POST "$API/api/admin-syllabus/import" "$T11_BODY" "$T11_DATA" "$ADMIN_TOKEN")
IMP_BOARD_ID=$(jget "$T11_BODY" boardId)
IMP_SUBJECT_ID=$(jget "$T11_BODY" subjectId)
IMP_COMPONENTS=$(jget "$T11_BODY" components)
IMP_TOPICS=$(jget "$T11_BODY" topics)
echo "[T11] bulk import status=$T11_STATUS body=$(cat "$T11_BODY")"
if { [ "$T11_STATUS" = "200" ] || [ "$T11_STATUS" = "201" ]; } && [ -n "$IMP_BOARD_ID" ] && [ "$IMP_COMPONENTS" = "2" ] && [ "$IMP_TOPICS" = "5" ]; then
  pass "T11 bulk import (2 components, 5 topics)" "components=$IMP_COMPONENTS topics=$IMP_TOPICS"
else
  fail "T11 bulk import" "status=$T11_STATUS components=$IMP_COMPONENTS topics=$IMP_TOPICS"
fi
echo "---------------------------------------------"

# --- T12: Bulk import idempotent (re-run same payload) ---
T12_BODY="$TMP/t12.json"
T12_STATUS=$(req POST "$API/api/admin-syllabus/import" "$T12_BODY" "$T11_DATA" "$ADMIN_TOKEN")
T12_BOARD=$(jget "$T12_BODY" boardId)
echo "[T12] re-import status=$T12_STATUS boardId=$T12_BOARD"
if { [ "$T12_STATUS" = "200" ] || [ "$T12_STATUS" = "201" ]; } && [ "$T12_BOARD" = "$IMP_BOARD_ID" ]; then
  pass "T12 bulk import idempotent (upsert)" "boardId stable=$T12_BOARD"
else
  fail "T12 bulk import idempotent" "status=$T12_STATUS imp1=$IMP_BOARD_ID imp2=$T12_BOARD"
fi
echo "---------------------------------------------"

# --- T13: AUTHZ — head_teacher CANNOT create exam board (must 401/403) ---
if [ -n "$HEAD_TOKEN" ]; then
  T13_BODY="$TMP/t13.json"
  T13_DATA="$(printf '{"code":"%s-HD","name":"head_teacher attempt"}' "$BOARD_CODE")"
  T13_STATUS=$(req POST "$API/api/admin-syllabus/exam-boards" "$T13_BODY" "$T13_DATA" "$HEAD_TOKEN")
  echo "[T13] head_teacher POST exam-boards status=$T13_STATUS body=$(cat "$T13_BODY")"
  if [ "$T13_STATUS" = "401" ] || [ "$T13_STATUS" = "403" ]; then
    pass "T13 head_teacher blocked from POST exam-boards" "status=$T13_STATUS"
  else
    fail "T13 AUTHZ LEAK: head_teacher should be blocked" "status=$T13_STATUS body=$(cat "$T13_BODY")"
  fi
else
  echo "[T13] skipped (no head_teacher token)"
fi
echo "---------------------------------------------"

# --- T14: AUTHZ — teacher CANNOT create topics (must 401/403) ---
if [ -n "$TEACHER_TOKEN" ]; then
  T14_BODY="$TMP/t14.json"
  T14_DATA="$(printf '{"componentId":"%s","code":"EVIL","name":"evil"}' "$COMPONENT_ID")"
  T14_STATUS=$(req POST "$API/api/admin-syllabus/topics" "$T14_BODY" "$T14_DATA" "$TEACHER_TOKEN")
  echo "[T14] teacher POST topics status=$T14_STATUS body=$(cat "$T14_BODY")"
  if [ "$T14_STATUS" = "401" ] || [ "$T14_STATUS" = "403" ]; then
    pass "T14 teacher blocked from POST topics" "status=$T14_STATUS"
  else
    fail "T14 AUTHZ LEAK: teacher should be blocked" "status=$T14_STATUS body=$(cat "$T14_BODY")"
  fi
else
  echo "[T14] skipped (no teacher token)"
fi
echo "---------------------------------------------"

# --- T15: AUTHZ — no token at all (must 401) ---
T15_BODY="$TMP/t15.json"
T15_DATA='{"code":"NOAUTH","name":"no auth"}'
T15_STATUS=$(req_noauth POST "$API/api/admin-syllabus/exam-boards" "$T15_BODY" "$T15_DATA")
echo "[T15] no-auth POST status=$T15_STATUS body=$(cat "$T15_BODY")"
if [ "$T15_STATUS" = "401" ]; then
  pass "T15 no-auth POST exam-boards is 401" "status=401"
else
  fail "T15 no-auth POST exam-boards" "expected 401 got $T15_STATUS"
fi
echo "---------------------------------------------"

# --- T16: empty body → 400 (NOT 500) ---
T16_BODY="$TMP/t16.json"
T16_STATUS=$(req POST "$API/api/admin-syllabus/exam-boards" "$T16_BODY" '{}' "$ADMIN_TOKEN")
echo "[T16] empty body status=$T16_STATUS body=$(cat "$T16_BODY")"
if [ "$T16_STATUS" = "400" ]; then
  pass "T16 empty body returns 400" "status=400"
elif [ "$T16_STATUS" -ge 500 ] 2>/dev/null; then
  fail "T16 empty body returns 5xx" "status=$T16_STATUS"
else
  fail "T16 empty body NOT 400" "status=$T16_STATUS"
fi
echo "---------------------------------------------"

# ============================================================
# Cleanup — best-effort. We delete in dependency order:
#   topics → components → subjects → exam boards
# Some rows (boards / subjects / components) have no admin DELETE
# endpoint yet (out-of-scope for B5 — questions might reference them).
# We delete topics only; the rest are left for manual / DB cleanup.
# ============================================================
echo "============= CLEANUP ============="
# Delete remaining topics on our test component (T1, T2 — T1.1 already deleted)
for TID in "$TOPIC2_ID" "$TOPIC1_ID"; do
  if [ -n "$TID" ]; then
    DEL_BODY="$TMP/del_${TID}.json"
    DEL_STATUS=$(req DELETE "$API/api/admin-syllabus/topics/$TID" "$DEL_BODY" "" "$ADMIN_TOKEN")
    echo "cleanup: DELETE topic $TID → $DEL_STATUS"
  fi
done
echo "(Test exam-board $BOARD_CODE / subject $SUBJECT_CODE / component P1"
echo " and import-board $IMPORT_BOARD / subject $IMPORT_SUBJECT remain in DB —"
echo " no admin DELETE endpoint exposed for those tables in B5.)"

echo "============================================="
echo "SUMMARY: PASS=$PASS  FAIL=$FAIL"
echo "Test board: $BOARD_CODE id=$BOARD_ID"
echo "Test subject: $SUBJECT_CODE id=$SUBJECT_ID"
echo "Test component: P1 id=$COMPONENT_ID"
echo "Bulk-imported board: $IMPORT_BOARD id=$IMP_BOARD_ID"
echo "============================================="
exit 0
