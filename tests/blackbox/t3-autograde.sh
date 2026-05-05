#!/usr/bin/env bash
# T3: MCQ auto-grading correctness blackbox test against deployed API.
# Isolation prefix: t3-
# Verifies: per-script awardedMarks/autoCorrect, autoScore aggregation, maxScore,
# and edge cases (no answer, lowercase key, invalid key).
set -uo pipefail

API="${API:-https://exam-paper-system-production.up.railway.app}"
TS="$(date +%s)"
PREFIX="t3-${TS}"

PASS=0
FAIL=0
RESULTS=()

note() { echo "[t3] $*"; }
ok()   { echo "[PASS] $1"; PASS=$((PASS+1)); RESULTS+=("PASS|$1"); }
bad()  { echo "[FAIL] $1 -- $2"; FAIL=$((FAIL+1)); RESULTS+=("FAIL|$1|$2"); }

PY() { python -c "$1"; }

curl_json() {
  # curl_json METHOD PATH [BEARER] [BODY_JSON]
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
  if [[ -n "$body" ]]; then
    curl -sS -o /tmp/t3_body.$$ -w "%{http_code}" -X "$method" "$API$path" \
      ${bearer:+-H "Authorization: Bearer $bearer"} \
      -H "Content-Type: application/json" \
      -d "$body"
  else
    curl -sS -o /tmp/t3_body.$$ -w "%{http_code}" -X "$method" "$API$path" \
      ${bearer:+-H "Authorization: Bearer $bearer"}
  fi
  rm -f /tmp/t3_body.$$
}

# ============================================================
# 1. Admin login
# ============================================================
note "Admin login"
ADMIN_LOGIN=$(curl_json POST /api/auth/login "" '{"email":"admin@school.local","password":"admin123"}')
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | PY "import sys,json;print(json.load(sys.stdin)['token'])" | tr -d '\r')
[[ -n "$ADMIN_TOKEN" ]] || { echo "FATAL: admin login failed: $ADMIN_LOGIN"; exit 1; }
note "Admin token len=${#ADMIN_TOKEN}"

# ============================================================
# 2. Seed: create 3 MCQ questions with options + 1 structured.
#    These guarantee the grader has data to work with.
# ============================================================
SUBJECT_ID="cmogmhf6a003hy7by4t9zegd7"   # 9702 Physics
COMPONENT_ID="cmogmhfbo003jy7by23vdag61" # AS Physics
TOPIC_ID="cmogmhh030043y7byr37204a1"     # PH.4 Forces

note "Creating 3 MCQ + 1 structured questions in bank"

mk_mcq() {
  local stem="$1" correct="$2" marks="$3"
  local body
  body=$(PY "
import json
print(json.dumps({
  'subjectId': '$SUBJECT_ID',
  'componentId': '$COMPONENT_ID',
  'primaryTopicId': '$TOPIC_ID',
  'questionType': 'mcq',
  'marks': $marks,
  'difficulty': 1,
  'sourceType': 'original_school',
  'estimatedTimeMin': 1,
  'content': {'stem': '$stem'},
  'answerContent': {'text': 'key=$correct'},
  'options': [
    {'key':'A','text':'option A','correct': '$correct'=='A'},
    {'key':'B','text':'option B','correct': '$correct'=='B'},
    {'key':'C','text':'option C','correct': '$correct'=='C'},
    {'key':'D','text':'option D','correct': '$correct'=='D'},
  ],
  'status': 'active',
}))
")
  curl_json POST /api/questions "$ADMIN_TOKEN" "$body"
}

MCQ1=$(mk_mcq "T3 MCQ #1 stem ${TS}" "A" 2)
MCQ1_ID=$(echo "$MCQ1" | PY "import sys,json;d=json.load(sys.stdin);print(d.get('id') or d)" | tr -d '\r')
MCQ2=$(mk_mcq "T3 MCQ #2 stem ${TS}" "C" 3)
MCQ2_ID=$(echo "$MCQ2" | PY "import sys,json;d=json.load(sys.stdin);print(d.get('id') or d)" | tr -d '\r')
MCQ3=$(mk_mcq "T3 MCQ #3 stem ${TS}" "B" 5)
MCQ3_ID=$(echo "$MCQ3" | PY "import sys,json;d=json.load(sys.stdin);print(d.get('id') or d)" | tr -d '\r')

note "MCQ ids: $MCQ1_ID / $MCQ2_ID / $MCQ3_ID"
note "Expected correct keys: MCQ1=A(2m) MCQ2=C(3m) MCQ3=B(5m)"

# Create structured question to keep maxScore != autoScore
STRUCT_BODY=$(PY "
import json
print(json.dumps({
  'subjectId': '$SUBJECT_ID',
  'componentId': '$COMPONENT_ID',
  'primaryTopicId': '$TOPIC_ID',
  'questionType': 'structured',
  'marks': 7,
  'difficulty': 2,
  'sourceType': 'original_school',
  'estimatedTimeMin': 5,
  'content': {'stem': 'T3 structured stem ${TS}'},
  'answerContent': {'text': 'sample working'},
  'markScheme': {'points': ['method', 'answer']},
  'status': 'active',
}))
")
STRUCT=$(curl_json POST /api/questions "$ADMIN_TOKEN" "$STRUCT_BODY")
STRUCT_ID=$(echo "$STRUCT" | PY "import sys,json;d=json.load(sys.stdin);print(d.get('id') or d)" | tr -d '\r')
note "Structured id: $STRUCT_ID (7 marks)"

# ============================================================
# 3. Build the test paper. Take an existing 5-question paper and
#    replace 4 of its questions with our 3 MCQ + 1 structured.
#    Existing paper: cmojlm5ao0054nxxoc3i0xlzj (5 questions: 1 mcq + 4 struct)
# ============================================================
SOURCE_PAPER="cmojlm5ao0054nxxoc3i0xlzj"
note "Cloning paper structure from $SOURCE_PAPER via 'replace' action"

# We can't create papers directly without generation. Instead, generate a fresh
# paper first then mutate. Easier: just use the 'replace' action on the source
# paper itself - but other agents may also touch it. To stay isolated, generate
# a new paper by template-less generate with config.
GEN_BODY=$(PY "
import json
print(json.dumps({
  'name': '${PREFIX}-paper',
  'config': {
    'subjectId': '$SUBJECT_ID',
    'durationMin': 60,
    'totalMarks': 30,
    'questionMix': [
      {'type': 'structured', 'count': 5}
    ],
    'includeAiQuickPaper': True
  }
}))
")
GEN=$(curl_json POST /api/papers/generate "$ADMIN_TOKEN" "$GEN_BODY")
PAPER_ID=$(echo "$GEN" | PY "import sys,json;d=json.load(sys.stdin);print((d.get('paper') or {}).get('id',''))" | tr -d '\r')
if [[ -z "$PAPER_ID" ]]; then
  note "Generation failed, falling back. Response: $GEN"
  exit 1
fi
note "Generated paper id: $PAPER_ID"

# Replace first 3 questions of the new paper with our 3 MCQ, keep 2 structured.
PAPER_FULL=$(curl_json GET /api/papers/$PAPER_ID "$ADMIN_TOKEN")
PQ_IDS=$(echo "$PAPER_FULL" | PY "
import sys,json
p=json.load(sys.stdin)
for q in p.get('questions') or []:
  print(q['id'])
" | tr -d '\r')
PQ_ARR=($PQ_IDS)
note "PQ_ARR has ${#PQ_ARR[@]} elements: ${PQ_ARR[*]}"
note "Original paper has ${#PQ_ARR[@]} questions; replacing first 3 with MCQs"

replace_pq() {
  local pq="$1" newq="$2"
  curl_json PATCH "/api/papers/$PAPER_ID/questions/$pq" "$ADMIN_TOKEN" \
    "{\"action\":\"replace\",\"replacementQuestionId\":\"$newq\"}"
}

replace_pq "${PQ_ARR[0]}" "$MCQ1_ID" >/dev/null
replace_pq "${PQ_ARR[1]}" "$MCQ2_ID" >/dev/null
replace_pq "${PQ_ARR[2]}" "$MCQ3_ID" >/dev/null
# Replace 4th with our small structured for predictable maxScore
replace_pq "${PQ_ARR[3]}" "$STRUCT_ID" >/dev/null

# Re-read and verify correct options are present
PAPER_FULL=$(curl_json GET /api/papers/$PAPER_ID "$ADMIN_TOKEN")
SETUP_SNAPSHOT=$(echo "$PAPER_FULL" | PY "
import sys,json
p=json.load(sys.stdin)
mcqs=[]; non=[]; mcq_marks=0; total_marks=0
for pq in p.get('questions') or []:
  q=pq.get('question') or {}
  total_marks += pq.get('marks') or 0
  if q.get('questionType')=='mcq':
    opts = pq.get('snapshotOptions') or q.get('options') or []
    correct = next((o['key'] for o in opts if o.get('correct')), None)
    mcqs.append({'pqId': pq['id'], 'qId': q.get('id'), 'marks': pq.get('marks'), 'correctKey': correct, 'optionKeys':[o.get('key') for o in opts]})
    mcq_marks += pq.get('marks') or 0
  else:
    non.append({'pqId': pq['id'], 'type': q.get('questionType'), 'marks': pq.get('marks')})
import json
print(json.dumps({'paperId': p.get('id'), 'mcqCount': len(mcqs), 'mcqs': mcqs, 'nonMcq': non, 'mcqMarksSum': mcq_marks, 'totalMarks': total_marks, 'totalMarksActual': p.get('totalMarksActual')}, indent=2))
")
echo "==== SETUP SNAPSHOT ===="
echo "$SETUP_SNAPSHOT"
echo "========================"

# Extract values for assertions
read PAPER_ID_CHECK MCQ_COUNT MCQ_MARKS TOTAL_MARKS PQ1 KEY1 M1 PQ2 KEY2 M2 PQ3 KEY3 M3 PQ4 PQ5 < <(echo "$SETUP_SNAPSHOT" | tr -d '\r' | PY "
import sys,json
d=json.load(sys.stdin)
mcqs=d['mcqs']
non=d['nonMcq']
print(d['paperId'], d['mcqCount'], d['mcqMarksSum'], d['totalMarks'],
  mcqs[0]['pqId'], mcqs[0]['correctKey'], mcqs[0]['marks'],
  mcqs[1]['pqId'], mcqs[1]['correctKey'], mcqs[1]['marks'],
  mcqs[2]['pqId'], mcqs[2]['correctKey'], mcqs[2]['marks'],
  non[0]['pqId'] if len(non)>0 else 'NONE',
  non[1]['pqId'] if len(non)>1 else 'NONE')
")

note "MCQ count=$MCQ_COUNT, MCQ marks sum=$MCQ_MARKS, paper total=$TOTAL_MARKS"
note "MCQ1 pq=$PQ1 key=$KEY1 marks=$M1"
note "MCQ2 pq=$PQ2 key=$KEY2 marks=$M2"
note "MCQ3 pq=$PQ3 key=$KEY3 marks=$M3"

if [[ "$MCQ_COUNT" -lt 3 ]]; then
  echo "FATAL: paper has < 3 MCQs"; exit 1
fi

# ============================================================
# 4. Create class + 5 students (4 main + 1 spare for case-sensitivity)
# ============================================================
CLASS_NAME="${PREFIX}-class"
CLASS_CODE="T3${TS}"
note "Creating class $CLASS_NAME ($CLASS_CODE)"
CLASS=$(curl_json POST /api/classes "$ADMIN_TOKEN" \
  "{\"name\":\"$CLASS_NAME\",\"classCode\":\"$CLASS_CODE\",\"level\":\"A_LEVEL\"}")
CLASS_ID=$(echo "$CLASS" | PY "import sys,json;print(json.load(sys.stdin).get('id',''))" | tr -d '\r')
[[ -n "$CLASS_ID" ]] || { echo "FATAL: class create failed: $CLASS"; exit 1; }
note "Class id: $CLASS_ID"

ROSTER_BODY=$(PY "
import json
print(json.dumps({'students':[
  {'email':'t3-stu-1-${TS}@example.com','name':'T3 Student 1','password':'test1234'},
  {'email':'t3-stu-2-${TS}@example.com','name':'T3 Student 2','password':'test1234'},
  {'email':'t3-stu-3-${TS}@example.com','name':'T3 Student 3','password':'test1234'},
  {'email':'t3-stu-4-${TS}@example.com','name':'T3 Student 4','password':'test1234'},
  {'email':'t3-stu-5-${TS}@example.com','name':'T3 Student 5','password':'test1234'},
  {'email':'t3-stu-6-${TS}@example.com','name':'T3 Student 6','password':'test1234'}
]}))
")
ROSTER=$(curl_json POST "/api/classes/$CLASS_ID/roster" "$ADMIN_TOKEN" "$ROSTER_BODY")
note "Roster: $ROSTER"

# ============================================================
# 5. Assign paper to class
# ============================================================
ASSIGN=$(curl_json POST "/api/papers/$PAPER_ID/assign" "$ADMIN_TOKEN" \
  "{\"classId\":\"$CLASS_ID\"}")
ASSIGN_ID=$(echo "$ASSIGN" | PY "import sys,json;print(json.load(sys.stdin).get('id',''))" | tr -d '\r')
[[ -n "$ASSIGN_ID" ]] || { echo "FATAL: assign failed: $ASSIGN"; exit 1; }
note "Assignment id: $ASSIGN_ID"

# ============================================================
# 6. Helpers for student flow
# ============================================================
student_login() {
  local email="$1"
  curl_json POST /api/auth/login "" \
    "{\"email\":\"$email\",\"password\":\"test1234\"}" \
    | PY "import sys,json;print(json.load(sys.stdin)['token'])" | tr -d '\r'
}

open_sub() {
  local tok="$1"
  curl_json POST /api/student/submissions "$tok" \
    "{\"assignmentId\":\"$ASSIGN_ID\"}" \
    | PY "import sys,json;print(json.load(sys.stdin).get('id',''))" | tr -d '\r'
}

save_script() {
  local tok="$1" sub="$2" pq="$3" key="$4"
  curl_json PATCH "/api/student/submissions/$sub/scripts" "$tok" \
    "{\"paperQuestionId\":\"$pq\",\"selectedOption\":\"$key\"}"
}

final_submit() {
  local tok="$1" sub="$2"
  curl_json POST "/api/student/submissions/$sub/submit" "$tok" ''
}

submit_status() {
  local tok="$1" sub="$2"
  curl -sS -o /tmp/t3_sub_resp.$$ -w "%{http_code}" -X POST \
    "$API/api/student/submissions/$sub/submit" \
    -H "Authorization: Bearer $tok"
  cat /tmp/t3_sub_resp.$$
  rm -f /tmp/t3_sub_resp.$$
}

get_sub() {
  local tok="$1" sub="$2"
  curl_json GET "/api/student/submissions/$sub" "$tok"
}

# Compute "wrong key": pick first option key not equal to correct.
wrong_key() {
  local correct="$1"
  for k in A B C D; do
    [[ "$k" != "$correct" ]] && { echo "$k"; return; }
  done
}

WK1=$(wrong_key "$KEY1")
WK2=$(wrong_key "$KEY2")
WK3=$(wrong_key "$KEY3")

# ============================================================
# A. All-correct (t3-stu-1)
# ============================================================
echo ""
echo "==== A. All-correct ===="
T1=$(student_login "t3-stu-1-${TS}@example.com")
S1=$(open_sub "$T1")
save_script "$T1" "$S1" "$PQ1" "$KEY1" >/dev/null
save_script "$T1" "$S1" "$PQ2" "$KEY2" >/dev/null
save_script "$T1" "$S1" "$PQ3" "$KEY3" >/dev/null
RESP1=$(final_submit "$T1" "$S1")
EXPECTED_AUTO=$((M1+M2+M3))
ACTUAL_AUTO=$(echo "$RESP1" | PY "import sys,json;print(json.load(sys.stdin).get('autoScore'))" | tr -d '\r')
ACTUAL_MAX=$(echo "$RESP1" | PY "import sys,json;print(json.load(sys.stdin).get('maxScore'))" | tr -d '\r')
note "A response autoScore=$ACTUAL_AUTO maxScore=$ACTUAL_MAX expected_auto=$EXPECTED_AUTO expected_max=$TOTAL_MARKS"

if [[ "$ACTUAL_AUTO" == "$EXPECTED_AUTO" ]]; then
  ok "A: autoScore == sum(MCQ marks) ($EXPECTED_AUTO)"
else
  bad "A: autoScore" "expected=$EXPECTED_AUTO actual=$ACTUAL_AUTO"
fi

SUB1=$(get_sub "$T1" "$S1")
# Check each MCQ script: autoCorrect=true and awardedMarks=marks
PER_SCRIPT=$(echo "$SUB1" | PY "
import sys,json
d=json.load(sys.stdin)
errs=[]
for s in d.get('scripts') or []:
  q=s.get('paperQuestion',{}).get('question',{})
  if q.get('questionType')!='mcq': continue
  if not s.get('autoCorrect'): errs.append('pq=%s autoCorrect=%s'%(s.get('paperQuestionId'),s.get('autoCorrect')))
  if s.get('awardedMarks') != s.get('paperQuestion',{}).get('marks'):
    errs.append('pq=%s awarded=%s expected=%s'%(s.get('paperQuestionId'), s.get('awardedMarks'), s.get('paperQuestion',{}).get('marks')))
print('|'.join(errs) if errs else 'OK')
")
if [[ "$PER_SCRIPT" == "OK" ]]; then
  ok "A: every MCQ script autoCorrect=true and awardedMarks=marks"
else
  bad "A: per-script grading" "$PER_SCRIPT"
fi

# E. maxScore correctness (checked here once)
if [[ "$ACTUAL_MAX" == "$TOTAL_MARKS" ]]; then
  ok "E: maxScore == sum(all questions' marks) ($TOTAL_MARKS)"
else
  bad "E: maxScore" "expected=$TOTAL_MARKS actual=$ACTUAL_MAX"
fi

# ============================================================
# B. All-wrong (t3-stu-2)
# ============================================================
echo ""
echo "==== B. All-wrong ===="
T2=$(student_login "t3-stu-2-${TS}@example.com")
S2=$(open_sub "$T2")
save_script "$T2" "$S2" "$PQ1" "$WK1" >/dev/null
save_script "$T2" "$S2" "$PQ2" "$WK2" >/dev/null
save_script "$T2" "$S2" "$PQ3" "$WK3" >/dev/null
RESP2=$(final_submit "$T2" "$S2")
ACTUAL_AUTO2=$(echo "$RESP2" | PY "import sys,json;print(json.load(sys.stdin).get('autoScore'))" | tr -d '\r')
note "B autoScore=$ACTUAL_AUTO2 (expected 0)"
if [[ "$ACTUAL_AUTO2" == "0" ]]; then
  ok "B: autoScore == 0 (all wrong)"
else
  bad "B: autoScore" "expected=0 actual=$ACTUAL_AUTO2"
fi

SUB2=$(get_sub "$T2" "$S2")
PER2=$(echo "$SUB2" | PY "
import sys,json
d=json.load(sys.stdin); errs=[]
for s in d.get('scripts') or []:
  q=s.get('paperQuestion',{}).get('question',{})
  if q.get('questionType')!='mcq': continue
  if s.get('autoCorrect') is not False: errs.append('pq=%s autoCorrect=%s'%(s.get('paperQuestionId'),s.get('autoCorrect')))
  if s.get('awardedMarks') != 0: errs.append('pq=%s awarded=%s'%(s.get('paperQuestionId'), s.get('awardedMarks')))
print('|'.join(errs) if errs else 'OK')
")
if [[ "$PER2" == "OK" ]]; then
  ok "B: every MCQ script autoCorrect=false and awardedMarks=0"
else
  bad "B: per-script grading" "$PER2"
fi

# ============================================================
# C. Mixed: first correct, rest wrong (t3-stu-3)
# ============================================================
echo ""
echo "==== C. Mixed ===="
T3=$(student_login "t3-stu-3-${TS}@example.com")
S3=$(open_sub "$T3")
save_script "$T3" "$S3" "$PQ1" "$KEY1" >/dev/null   # correct
save_script "$T3" "$S3" "$PQ2" "$WK2" >/dev/null    # wrong
save_script "$T3" "$S3" "$PQ3" "$WK3" >/dev/null    # wrong
RESP3=$(final_submit "$T3" "$S3")
ACTUAL_AUTO3=$(echo "$RESP3" | PY "import sys,json;print(json.load(sys.stdin).get('autoScore'))" | tr -d '\r')
note "C autoScore=$ACTUAL_AUTO3 (expected $M1)"
if [[ "$ACTUAL_AUTO3" == "$M1" ]]; then
  ok "C: autoScore == marks of first MCQ ($M1)"
else
  bad "C: autoScore" "expected=$M1 actual=$ACTUAL_AUTO3"
fi

# ============================================================
# D. No answer (t3-stu-4)
# ============================================================
echo ""
echo "==== D. No answer ===="
T4=$(student_login "t3-stu-4-${TS}@example.com")
S4=$(open_sub "$T4")
# No PATCH at all
HTTP4=$(curl -sS -o /tmp/t3_d.$$ -w "%{http_code}" -X POST \
  "$API/api/student/submissions/$S4/submit" \
  -H "Authorization: Bearer $T4")
RESP4=$(cat /tmp/t3_d.$$)
rm -f /tmp/t3_d.$$
note "D http=$HTTP4 body=$RESP4"

if [[ "$HTTP4" == "5"* ]]; then
  bad "D: no 500" "got HTTP $HTTP4"
else
  ok "D: no 500 on empty submission"
fi
ACTUAL_AUTO4=$(echo "$RESP4" | PY "import sys,json;print(json.load(sys.stdin).get('autoScore'))" 2>/dev/null | tr -d '\r')
if [[ "$ACTUAL_AUTO4" == "0" ]]; then
  ok "D: autoScore == 0 with no answers"
else
  bad "D: autoScore" "expected=0 actual=$ACTUAL_AUTO4"
fi

# ============================================================
# F. Case sensitivity (t3-stu-5)
# ============================================================
echo ""
echo "==== F. Case sensitivity (lowercase key) ===="
T5=$(student_login "t3-stu-5-${TS}@example.com")
S5=$(open_sub "$T5")
LCK1=$(echo "$KEY1" | tr 'A-Z' 'a-z')
note "Saving lowercase '$LCK1' for MCQ1 (correct=$KEY1)"
save_script "$T5" "$S5" "$PQ1" "$LCK1" >/dev/null
HTTP5=$(curl -sS -o /tmp/t3_f.$$ -w "%{http_code}" -X POST \
  "$API/api/student/submissions/$S5/submit" \
  -H "Authorization: Bearer $T5")
RESP5=$(cat /tmp/t3_f.$$)
rm -f /tmp/t3_f.$$
note "F http=$HTTP5 body=$RESP5"
if [[ "$HTTP5" == "5"* ]]; then
  bad "F: no 500" "got HTTP $HTTP5"
else
  ok "F: no 500 on lowercase key"
fi
ACTUAL_AUTO5=$(echo "$RESP5" | PY "import sys,json;print(json.load(sys.stdin).get('autoScore'))" 2>/dev/null | tr -d '\r')
note "F autoScore=$ACTUAL_AUTO5 (lowercase '$LCK1' vs uppercase '$KEY1')"
if [[ "$ACTUAL_AUTO5" == "$M1" ]]; then
  note "F: case-INSENSITIVE match (lowercase counted as correct)"
  RESULTS+=("INFO|F|case-insensitive: lowercase '$LCK1' awarded $M1 marks")
elif [[ "$ACTUAL_AUTO5" == "0" ]]; then
  note "F: case-SENSITIVE (lowercase NOT counted, autoScore=0) -- expected by spec"
  RESULTS+=("INFO|F|case-sensitive: lowercase '$LCK1' awarded 0 marks")
else
  bad "F: unexpected autoScore" "got $ACTUAL_AUTO5"
fi

# ============================================================
# G. Invalid option key 'Z' (t3-stu-6)
# ============================================================
echo ""
echo "==== G. Invalid option key 'Z' ===="
T6=$(student_login "t3-stu-6-${TS}@example.com")
S6=$(open_sub "$T6")
note "Saving 'Z' (not in opts) for MCQ1"
SAVE6=$(save_script "$T6" "$S6" "$PQ1" "Z")
note "save resp: $SAVE6"
HTTP6=$(curl -sS -o /tmp/t3_g.$$ -w "%{http_code}" -X POST \
  "$API/api/student/submissions/$S6/submit" \
  -H "Authorization: Bearer $T6")
RESP6=$(cat /tmp/t3_g.$$)
rm -f /tmp/t3_g.$$
note "G http=$HTTP6 body=$RESP6"
if [[ "$HTTP6" == "5"* ]]; then
  bad "G: no 500 on invalid key" "got HTTP $HTTP6"
else
  ok "G: no 500 on invalid key 'Z'"
fi
ACTUAL_AUTO6=$(echo "$RESP6" | PY "import sys,json;print(json.load(sys.stdin).get('autoScore'))" 2>/dev/null | tr -d '\r')
SUB6=$(get_sub "$T6" "$S6")
SCRIPT6=$(echo "$SUB6" | PY "
import sys,json
d=json.load(sys.stdin)
for s in d.get('scripts') or []:
  if s.get('paperQuestionId')=='$PQ1':
    print(s.get('autoCorrect'),'|',s.get('awardedMarks'))
    break
")
note "G script for PQ1: $SCRIPT6"
if [[ "$ACTUAL_AUTO6" == "0" ]]; then
  ok "G: autoScore == 0 with invalid key"
else
  bad "G: autoScore" "expected=0 actual=$ACTUAL_AUTO6"
fi
G_AC=$(echo "$SCRIPT6" | awk -F'\\|' '{gsub(/ /,"",$1);print $1}')
G_AM=$(echo "$SCRIPT6" | awk -F'\\|' '{gsub(/ /,"",$2);print $2}')
if [[ "$G_AC" == "False" && "$G_AM" == "0" ]]; then
  ok "G: per-script autoCorrect=false, awardedMarks=0"
else
  bad "G: per-script" "autoCorrect=$G_AC awardedMarks=$G_AM"
fi

# ============================================================
# Summary
# ============================================================
echo ""
echo "============================================================"
echo "T3 RESULTS: $PASS PASS, $FAIL FAIL"
echo "------------------------------------------------------------"
for r in "${RESULTS[@]}"; do echo "  $r"; done
echo "============================================================"

# expose for parent to capture
echo "T3_PAPER_ID=$PAPER_ID"
echo "T3_MCQ_COUNT=$MCQ_COUNT"
echo "T3_MCQ_MARKS=$MCQ_MARKS"
echo "T3_TOTAL_MARKS=$TOTAL_MARKS"
echo "T3_KEYS=$KEY1,$KEY2,$KEY3"

[[ "$FAIL" == "0" ]] && exit 0 || exit 1
