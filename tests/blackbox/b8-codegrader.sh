#!/usr/bin/env bash
# B8: Code grader blackbox test against deployed API.
# Isolation prefix: b8-
#
# Verifies:
#   - Teacher can add / list / delete test cases
#   - Student can list (with hidden filtered, expectedStdout redacted)
#   - Student can submit code, get a CodeSubmissionResult with the
#     stub-mode shape (passed=1, totalCases >= 1, meta.stub=true)
#   - GET /codegrader/result/:scriptId returns the same result for
#     the owning student and for a teacher
#   - Teacher cannot hit /codegrader/submit (student-only)
#   - Student cannot create test cases (teacher-only)
#
# Stub mode is mandatory here — we never hit a real judge0. The API is
# expected to run with JUDGE0_URL unset.
set -uo pipefail

API="${API:-https://exam-paper-system-production.up.railway.app}"
TS="$(date +%s)"
PREFIX="b8-${TS}"

PASS=0
FAIL=0
RESULTS=()

note() { echo "[b8] $*"; }
ok()   { echo "[PASS] $1"; PASS=$((PASS+1)); RESULTS+=("PASS|$1"); }
bad()  { echo "[FAIL] $1 -- $2"; FAIL=$((FAIL+1)); RESULTS+=("FAIL|$1|$2"); }

PY() { python -c "$1"; }

curl_json() {
  local method="$1" path="$2" bearer="${3:-}" body="${4:-}"
  if [[ -n "$body" ]]; then
    curl -sS -X "$method" "$API$path" \
      ${bearer:+-H "Authorization: Bearer $bearer"} \
      -H "Content-Type: application/json" \
      -d "$body"
  else
    curl -sS -X "$method" "$API$path" \
      ${bearer:+-H "Authorization: Bearer $bearer"}
  fi
}

http_status() {
  local method="$1" path="$2" bearer="${3:-}" body="${4:-}"
  local out=/tmp/b8_body.$$
  if [[ -n "$body" ]]; then
    curl -sS -o "$out" -w "%{http_code}" -X "$method" "$API$path" \
      ${bearer:+-H "Authorization: Bearer $bearer"} \
      -H "Content-Type: application/json" \
      -d "$body"
  else
    curl -sS -o "$out" -w "%{http_code}" -X "$method" "$API$path" \
      ${bearer:+-H "Authorization: Bearer $bearer"}
  fi
  rm -f "$out"
}

# ============================================================
# 1. Admin login + create a code-bearing question
# ============================================================
note "Admin login"
ADMIN_LOGIN=$(curl_json POST /api/auth/login "" '{"email":"admin@school.local","password":"admin123"}')
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | PY "import sys,json;print(json.load(sys.stdin)['token'])" | tr -d '\r')
[[ -n "$ADMIN_TOKEN" ]] || { echo "FATAL: admin login failed: $ADMIN_LOGIN"; exit 1; }

# Use Computer Science 9608 ids if seeded, else fall back to first
# subject available. We don't depend on specific seed values — the
# test creates a fresh structured question and binds test cases to it.
SUBJECTS=$(curl_json GET /api/subjects "$ADMIN_TOKEN")
SUBJECT_ID=$(echo "$SUBJECTS" | PY "import sys,json;arr=json.load(sys.stdin);print(arr[0]['id'] if arr else '')" | tr -d '\r')
[[ -n "$SUBJECT_ID" ]] || { echo "FATAL: no subjects"; exit 1; }
note "Using subjectId=$SUBJECT_ID"

# Create a structured question that will host the code test cases.
QBODY=$(PY "
import json
print(json.dumps({
  'subjectId': '$SUBJECT_ID',
  'questionType': 'structured',
  'marks': 6,
  'difficulty': 2,
  'sourceType': 'original_school',
  'estimatedTimeMin': 5,
  'content': {'stem': 'B8 code question ${TS}: write a program that prints HELLO'},
  'answerContent': {'text': 'print(\"HELLO\")'},
  'status': 'active'
}))
")
QRESP=$(curl_json POST /api/questions "$ADMIN_TOKEN" "$QBODY")
QID=$(echo "$QRESP" | PY "import sys,json;d=json.load(sys.stdin);print(d.get('id') or '')" | tr -d '\r')
[[ -n "$QID" ]] || { echo "FATAL: question create failed: $QRESP"; exit 1; }
note "Question id: $QID (6 marks)"

# ============================================================
# 2. Teacher: add test cases
# ============================================================
add_case() {
  local stdin="$1" expected="$2" marks="$3" hidden="$4" label="$5"
  local body
  body=$(PY "
import json
print(json.dumps({
  'stdin': '$stdin',
  'expectedStdout': '$expected',
  'marksPerCase': $marks,
  'hidden': $hidden,
  'label': '$label'
}))
")
  curl_json POST "/api/codegrader/questions/$QID/test-cases" "$ADMIN_TOKEN" "$body"
}

C1=$(add_case "" "HELLO" 2 "false" "sample: prints HELLO")
C1_ID=$(echo "$C1" | PY "import sys,json;d=json.load(sys.stdin);print(d.get('id') or '')" | tr -d '\r')
C2=$(add_case "" "HELLO" 2 "true" "hidden: same output, hidden")
C2_ID=$(echo "$C2" | PY "import sys,json;d=json.load(sys.stdin);print(d.get('id') or '')" | tr -d '\r')
note "Created test cases: visible=$C1_ID hidden=$C2_ID"

if [[ -n "$C1_ID" && -n "$C2_ID" ]]; then
  ok "teacher: POST test-cases -> 2 created"
else
  bad "teacher: POST test-cases" "create returned no id ($C1 / $C2)"
fi

# Try to over-allocate marks (current 4, marksPerCase 5 -> 9 > 6).
HTTP_OVER=$(http_status POST "/api/codegrader/questions/$QID/test-cases" "$ADMIN_TOKEN" \
  '{"stdin":"","expectedStdout":"X","marksPerCase":5,"hidden":false}')
if [[ "$HTTP_OVER" == "400" ]]; then
  ok "teacher: over-allocate marks -> 400"
else
  bad "teacher: over-allocate marks" "expected 400, got $HTTP_OVER"
fi

# ============================================================
# 3. Teacher: list test cases (sees expectedStdout, hidden+visible)
# ============================================================
LIST_T=$(curl_json GET "/api/codegrader/questions/$QID/test-cases" "$ADMIN_TOKEN")
TEACHER_COUNT=$(echo "$LIST_T" | PY "import sys,json;print(len(json.load(sys.stdin)))" | tr -d '\r')
TEACHER_HAS_EXP=$(echo "$LIST_T" | PY "
import sys,json
arr=json.load(sys.stdin)
print('Y' if arr and 'expectedStdout' in arr[0] else 'N')
" | tr -d '\r')
if [[ "$TEACHER_COUNT" == "2" && "$TEACHER_HAS_EXP" == "Y" ]]; then
  ok "teacher: GET test-cases -> 2 cases incl. expectedStdout"
else
  bad "teacher: GET test-cases" "count=$TEACHER_COUNT hasExpected=$TEACHER_HAS_EXP"
fi

# ============================================================
# 4. Build a paper containing this question + assign to a class
# ============================================================
GEN_BODY=$(PY "
import json
print(json.dumps({
  'name': '${PREFIX}-paper',
  'config': {
    'subjectId': '$SUBJECT_ID',
    'durationMin': 60,
    'totalMarks': 30,
    'questionMix': [{'type':'structured','count': 5}],
    'includeAiQuickPaper': True
  }
}))
")
GEN=$(curl_json POST /api/papers/generate "$ADMIN_TOKEN" "$GEN_BODY")
PAPER_ID=$(echo "$GEN" | PY "import sys,json;d=json.load(sys.stdin);print((d.get('paper') or {}).get('id',''))" | tr -d '\r')
[[ -n "$PAPER_ID" ]] || { echo "FATAL: paper gen failed: $GEN"; exit 1; }
note "Paper: $PAPER_ID"

# Replace first question with our code question
PAPER_FULL=$(curl_json GET "/api/papers/$PAPER_ID" "$ADMIN_TOKEN")
FIRST_PQ=$(echo "$PAPER_FULL" | PY "
import sys,json
p=json.load(sys.stdin)
qs=p.get('questions') or []
print(qs[0]['id'] if qs else '')
" | tr -d '\r')
[[ -n "$FIRST_PQ" ]] || { echo "FATAL: paper has no questions"; exit 1; }

curl_json PATCH "/api/papers/$PAPER_ID/questions/$FIRST_PQ" "$ADMIN_TOKEN" \
  "{\"action\":\"replace\",\"replacementQuestionId\":\"$QID\"}" >/dev/null

PAPER_FULL=$(curl_json GET "/api/papers/$PAPER_ID" "$ADMIN_TOKEN")
PQ_ID=$(echo "$PAPER_FULL" | PY "
import sys,json
p=json.load(sys.stdin)
for q in p.get('questions') or []:
  if (q.get('question') or {}).get('id')=='$QID':
    print(q['id']); break
" | tr -d '\r')
[[ -n "$PQ_ID" ]] || { echo "FATAL: replace lost"; exit 1; }
note "PaperQuestion: $PQ_ID"

CLASS=$(curl_json POST /api/classes "$ADMIN_TOKEN" \
  "{\"name\":\"${PREFIX}-class\",\"classCode\":\"B8${TS}\",\"level\":\"A_LEVEL\"}")
CLASS_ID=$(echo "$CLASS" | PY "import sys,json;print(json.load(sys.stdin).get('id',''))" | tr -d '\r')

ROSTER_BODY=$(PY "
import json
print(json.dumps({'students':[
  {'email':'b8-stu-1-${TS}@example.com','name':'B8 Stu 1','password':'test1234'},
  {'email':'b8-stu-2-${TS}@example.com','name':'B8 Stu 2','password':'test1234'}
]}))
")
curl_json POST "/api/classes/$CLASS_ID/roster" "$ADMIN_TOKEN" "$ROSTER_BODY" >/dev/null

ASSIGN=$(curl_json POST "/api/papers/$PAPER_ID/assign" "$ADMIN_TOKEN" \
  "{\"classId\":\"$CLASS_ID\"}")
ASSIGN_ID=$(echo "$ASSIGN" | PY "import sys,json;print(json.load(sys.stdin).get('id',''))" | tr -d '\r')
[[ -n "$ASSIGN_ID" ]] || { echo "FATAL: assign failed"; exit 1; }

# ============================================================
# 5. Student flow
# ============================================================
STU_LOGIN=$(curl_json POST /api/auth/login "" \
  "{\"email\":\"b8-stu-1-${TS}@example.com\",\"password\":\"test1234\"}")
STU_TOKEN=$(echo "$STU_LOGIN" | PY "import sys,json;print(json.load(sys.stdin)['token'])" | tr -d '\r')
[[ -n "$STU_TOKEN" ]] || { echo "FATAL: student login"; exit 1; }

# Open submission (creates AnswerScripts)
SUB=$(curl_json POST /api/student/submissions "$STU_TOKEN" "{\"assignmentId\":\"$ASSIGN_ID\"}")
SUB_ID=$(echo "$SUB" | PY "import sys,json;print(json.load(sys.stdin).get('id',''))" | tr -d '\r')

# Save initial code via the regular saveScript (textAnswer = code)
curl_json PATCH "/api/student/submissions/$SUB_ID/scripts" "$STU_TOKEN" \
  "{\"paperQuestionId\":\"$PQ_ID\",\"textAnswer\":\"print('HELLO')\"}" >/dev/null

# Student lists test cases for the question — should NOT see expectedStdout
LIST_S=$(curl_json GET "/api/codegrader/questions/$QID/test-cases" "$STU_TOKEN")
STU_COUNT=$(echo "$LIST_S" | PY "import sys,json;print(len(json.load(sys.stdin)))" | tr -d '\r')
STU_HAS_EXP=$(echo "$LIST_S" | PY "
import sys,json
arr=json.load(sys.stdin)
print('Y' if arr and 'expectedStdout' in arr[0] else 'N')
" | tr -d '\r')
if [[ "$STU_COUNT" == "1" && "$STU_HAS_EXP" == "N" ]]; then
  ok "student: GET test-cases -> 1 visible case, expectedStdout redacted"
else
  bad "student: GET test-cases" "count=$STU_COUNT hasExpected=$STU_HAS_EXP (expected 1/N)"
fi

# Student submits code -> CodeSubmissionResult
SUBMIT_BODY=$(PY "
import json
print(json.dumps({
  'paperQuestionId': '$PQ_ID',
  'language': 'python',
  'sourceCode': 'print(\"HELLO\")\\n'
}))
")
SUB_RESULT=$(curl_json POST /api/codegrader/submit "$STU_TOKEN" "$SUBMIT_BODY")
note "Submit response: $SUB_RESULT"

PASSED=$(echo "$SUB_RESULT" | PY "import sys,json;print(json.load(sys.stdin).get('passedCases'))" | tr -d '\r')
TOTAL=$(echo "$SUB_RESULT" | PY "import sys,json;print(json.load(sys.stdin).get('totalCases'))" | tr -d '\r')
AWARDED=$(echo "$SUB_RESULT" | PY "import sys,json;print(json.load(sys.stdin).get('awardedMarks'))" | tr -d '\r')
IS_STUB=$(echo "$SUB_RESULT" | PY "
import sys,json
d=json.load(sys.stdin)
m=d.get('meta') or {}
print('Y' if m.get('stub') else 'N')
" | tr -d '\r')
SCRIPT_ID=$(echo "$SUB_RESULT" | PY "import sys,json;print(json.load(sys.stdin).get('answerScriptId',''))" | tr -d '\r')

# Stub mode: passes the FIRST case only -> passed=1, total=2, awarded=2
if [[ "$TOTAL" == "2" ]]; then
  ok "submit: totalCases == 2"
else
  bad "submit: totalCases" "expected 2 got $TOTAL"
fi
if [[ "$IS_STUB" == "Y" ]]; then
  ok "submit: meta.stub == true"
else
  bad "submit: meta.stub" "expected Y got $IS_STUB"
fi
if [[ "$PASSED" == "1" && "$AWARDED" == "2" ]]; then
  ok "submit: stub passes case 0 -> passedCases=1 awardedMarks=2"
else
  bad "submit: stub aggregate" "passed=$PASSED awarded=$AWARDED expected 1/2"
fi

# Student fetches own result
GET_RES=$(curl_json GET "/api/codegrader/result/$SCRIPT_ID" "$STU_TOKEN")
GET_TOTAL=$(echo "$GET_RES" | PY "import sys,json;print(json.load(sys.stdin).get('totalCases'))" | tr -d '\r')
if [[ "$GET_TOTAL" == "$TOTAL" ]]; then
  ok "student: GET own /result/:id -> matches submit"
else
  bad "student: GET own /result/:id" "totalCases mismatch"
fi

# Teacher can fetch any student's result
GET_RES_T=$(curl_json GET "/api/codegrader/result/$SCRIPT_ID" "$ADMIN_TOKEN")
GET_TOTAL_T=$(echo "$GET_RES_T" | PY "import sys,json;print(json.load(sys.stdin).get('totalCases'))" | tr -d '\r')
if [[ "$GET_TOTAL_T" == "$TOTAL" ]]; then
  ok "teacher: GET /result/:id of any student"
else
  bad "teacher: GET /result/:id" "totalCases mismatch ($GET_TOTAL_T)"
fi

# AnswerScript.awardedMarks should be mirrored
SUB_FULL=$(curl_json GET "/api/student/submissions/$SUB_ID" "$STU_TOKEN")
SCRIPT_AWARDED=$(echo "$SUB_FULL" | PY "
import sys,json
d=json.load(sys.stdin)
for s in d.get('scripts') or []:
  if s.get('paperQuestionId')=='$PQ_ID':
    print(s.get('awardedMarks'))
    break
" | tr -d '\r')
if [[ "$SCRIPT_AWARDED" == "2" ]]; then
  ok "answerScript.awardedMarks mirrored == 2"
else
  bad "answerScript.awardedMarks" "expected 2 got $SCRIPT_AWARDED"
fi

# ============================================================
# 6. Authz negative checks
# ============================================================
# Teacher cannot submit code (student-only)
HTTP_T_SUBMIT=$(http_status POST /api/codegrader/submit "$ADMIN_TOKEN" \
  "{\"paperQuestionId\":\"$PQ_ID\",\"language\":\"python\",\"sourceCode\":\"print('x')\"}")
if [[ "$HTTP_T_SUBMIT" == "401" || "$HTTP_T_SUBMIT" == "403" ]]; then
  ok "authz: teacher submit -> 401/403"
else
  bad "authz: teacher submit" "expected 401/403 got $HTTP_T_SUBMIT"
fi

# Student cannot create test cases
HTTP_S_CREATE=$(http_status POST "/api/codegrader/questions/$QID/test-cases" "$STU_TOKEN" \
  '{"stdin":"","expectedStdout":"X","marksPerCase":1,"hidden":false}')
if [[ "$HTTP_S_CREATE" == "401" || "$HTTP_S_CREATE" == "403" ]]; then
  ok "authz: student create test case -> 401/403"
else
  bad "authz: student create test case" "expected 401/403 got $HTTP_S_CREATE"
fi

# Student cannot delete test cases
HTTP_S_DEL=$(http_status DELETE "/api/codegrader/test-cases/$C1_ID" "$STU_TOKEN")
if [[ "$HTTP_S_DEL" == "401" || "$HTTP_S_DEL" == "403" ]]; then
  ok "authz: student delete test case -> 401/403"
else
  bad "authz: student delete test case" "expected 401/403 got $HTTP_S_DEL"
fi

# Different student cannot read first student's result
STU2_LOGIN=$(curl_json POST /api/auth/login "" \
  "{\"email\":\"b8-stu-2-${TS}@example.com\",\"password\":\"test1234\"}")
STU2_TOKEN=$(echo "$STU2_LOGIN" | PY "import sys,json;print(json.load(sys.stdin)['token'])" | tr -d '\r')
HTTP_S2_GET=$(http_status GET "/api/codegrader/result/$SCRIPT_ID" "$STU2_TOKEN")
if [[ "$HTTP_S2_GET" == "401" || "$HTTP_S2_GET" == "403" ]]; then
  ok "authz: other student GET /result/:id -> 401/403"
else
  bad "authz: other student GET /result/:id" "expected 401/403 got $HTTP_S2_GET"
fi

# ============================================================
# 7. Empty source code -> stub fails all cases (passed=0)
# ============================================================
EMPTY_BODY=$(PY "
import json
print(json.dumps({
  'paperQuestionId': '$PQ_ID',
  'language': 'python',
  'sourceCode': '   '
}))
")
EMPTY_RES=$(curl_json POST /api/codegrader/submit "$STU_TOKEN" "$EMPTY_BODY")
EMPTY_PASSED=$(echo "$EMPTY_RES" | PY "import sys,json;print(json.load(sys.stdin).get('passedCases'))" | tr -d '\r')
if [[ "$EMPTY_PASSED" == "0" ]]; then
  ok "empty source -> passedCases=0"
else
  bad "empty source" "expected passed=0 got $EMPTY_PASSED"
fi

# ============================================================
# Summary
# ============================================================
echo ""
echo "============================================================"
echo "B8 RESULTS: $PASS PASS, $FAIL FAIL"
echo "------------------------------------------------------------"
for r in "${RESULTS[@]}"; do echo "  $r"; done
echo "============================================================"

[[ "$FAIL" == "0" ]] && exit 0 || exit 1
