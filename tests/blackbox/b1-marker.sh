#!/usr/bin/env bash
# B1 blackbox: marker workflow (queue → claim → score → finalize)
# Target: deployed Railway API (after main schema integration)
# Isolation prefix: b1-
set -u

API="${API:-https://exam-paper-system-production.up.railway.app}"
TS="$(date +%s)"
PREFIX="b1-"
ADMIN_EMAIL="admin@school.local"
ADMIN_PASS="admin123"

CURL=(curl -sS -w '\n%{http_code}\n' --max-time 30)

# JSON value extractor — uses Node (no jq on the test box).
jget() {
  node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{const j=JSON.parse(s);const v=eval('j$2');console.log(v===undefined||v===null?'':typeof v==='object'?JSON.stringify(v):v)}catch(e){process.stderr.write('jget err: '+e.message+'\n');process.exit(2)}})" <<< "$1"
}

hit() {
  local out
  out="$("${CURL[@]}" "$@")" || true
  CODE="$(printf '%s' "$out" | awk 'NF{last=$0} END{print last}')"
  BODY="$(printf '%s' "$out" | awk -v code="$CODE" '
    {lines[NR]=$0}
    END{
      for(i=NR;i>=1;i--){ if(lines[i]==code){cut=i; break} }
      if(!cut)cut=NR+1
      for(i=1;i<cut;i++){ if(i>1)printf "\n"; printf "%s", lines[i] }
    }')"
  BODY="${BODY%$'\n'}"
}

PASS=0
FAIL=0
declare -a RESULTS

record() {
  local name="$1" verdict="$2" evidence="$3"
  if [ "$verdict" = "PASS" ]; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi
  RESULTS+=("| ${name} | ${verdict} | ${evidence//|/\\|} |")
  echo ">>> [$verdict] $name :: $evidence"
}

echo "=========================================="
echo " B1 blackbox — marker workflow"
echo " API: $API"
echo " TS:  $TS"
echo "=========================================="

# -------------------------------------------------------------------
# Setup 1: admin login (acts as marker #1)
# -------------------------------------------------------------------
echo
echo "--- [setup] admin login (marker #1)"
hit -X POST "$API/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}"
echo "code=$CODE"
[ "$CODE" = "200" ] || [ "$CODE" = "201" ] || { echo "FATAL: admin login failed"; exit 1; }
ADMIN_TOKEN="$(jget "$BODY" ".token")"
ADMIN_ID="$(jget "$BODY" ".user.id")"
[ -n "$ADMIN_TOKEN" ] || { echo "FATAL: admin token empty"; exit 1; }
AUTH_ADMIN=(-H "Authorization: Bearer $ADMIN_TOKEN")
echo "adminToken=${ADMIN_TOKEN:0:24}... adminId=$ADMIN_ID"

# -------------------------------------------------------------------
# Setup 2: create class
# -------------------------------------------------------------------
echo
echo "--- [setup] create class"
CLASS_NAME="${PREFIX}class-${TS}"
CLASS_CODE="B1C${TS}"
hit -X POST "$API/api/classes" -H 'Content-Type: application/json' "${AUTH_ADMIN[@]}" \
  -d "{\"name\":\"$CLASS_NAME\",\"classCode\":\"$CLASS_CODE\",\"level\":\"Y10\"}"
echo "code=$CODE body=$BODY"
[ "$CODE" = "201" ] || [ "$CODE" = "200" ] || { echo "FATAL: class create failed"; exit 1; }
CLASS_ID="$(jget "$BODY" ".id")"

# -------------------------------------------------------------------
# Setup 3: roster a student
# -------------------------------------------------------------------
echo
echo "--- [setup] roster student"
STU_EMAIL="${PREFIX}stu-${TS}@example.com"
STU_PASS="test1234"
hit -X POST "$API/api/classes/$CLASS_ID/roster" -H 'Content-Type: application/json' \
  "${AUTH_ADMIN[@]}" \
  -d "{\"students\":[{\"email\":\"$STU_EMAIL\",\"name\":\"B1 Student $TS\",\"password\":\"$STU_PASS\"}]}"
echo "code=$CODE"
[ "$CODE" = "201" ] || [ "$CODE" = "200" ] || { echo "FATAL: roster failed"; exit 1; }

# -------------------------------------------------------------------
# Setup 4: create a 2nd marker (head_teacher) for the race test
# -------------------------------------------------------------------
echo
echo "--- [setup] create 2nd marker (head_teacher)"
M2_EMAIL="${PREFIX}m2-${TS}@example.com"
M2_PASS="test1234"
# Use admin/users endpoint if exposed; else fall back to seeding via teachers.
# We'll try the users endpoint. If it 404s we skip the race test gracefully.
hit -X POST "$API/api/users" -H 'Content-Type: application/json' "${AUTH_ADMIN[@]}" \
  -d "{\"email\":\"$M2_EMAIL\",\"name\":\"B1 Marker2 $TS\",\"password\":\"$M2_PASS\",\"role\":\"head_teacher\"}"
echo "code=$CODE body=$BODY"
HAVE_M2=0
if [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then
  HAVE_M2=1
fi

# -------------------------------------------------------------------
# Setup 5: pick a paper with at least one structured question
# -------------------------------------------------------------------
echo
echo "--- [setup] pick paper with structured Q"
hit -X GET "$API/api/papers" "${AUTH_ADMIN[@]}"
[ "$CODE" = "200" ] || { echo "FATAL: papers list failed"; exit 1; }
PAPER_IDS=$(node -e "
let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{
  const arr=JSON.parse(s);
  for (const p of arr) console.log(p.id);
});" <<< "$BODY")

PAPER_ID=""
declare -a STRUCTURED_PQ_IDS=()
for pid in $PAPER_IDS; do
  hit -X GET "$API/api/papers/$pid" "${AUTH_ADMIN[@]}"
  [ "$CODE" = "200" ] || continue
  CHECK=$(node -e "
let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{
  const p=JSON.parse(s);
  const qs=p.questions||[];
  const struct = qs.filter(x=>['structured','short_answer','essay'].includes(x.question&&x.question.questionType));
  if (struct.length<1){console.log('NO');return;}
  console.log('YES');
  console.log(p.id);
  console.log(struct.map(x=>x.id).join(','));
  console.log(struct.map(x=>x.marks).join(','));
});" <<< "$BODY")
  HEAD=$(printf '%s\n' "$CHECK" | head -n1)
  if [ "$HEAD" = "YES" ]; then
    PAPER_ID=$(printf '%s\n' "$CHECK" | sed -n '2p')
    PQS_CSV=$(printf '%s\n' "$CHECK" | sed -n '3p')
    MARKS_CSV=$(printf '%s\n' "$CHECK" | sed -n '4p')
    IFS=',' read -ra STRUCTURED_PQ_IDS <<< "$PQS_CSV"
    IFS=',' read -ra STRUCTURED_MARKS <<< "$MARKS_CSV"
    echo "Selected paperId=$PAPER_ID structuredCount=${#STRUCTURED_PQ_IDS[@]}"
    break
  fi
done
[ -n "$PAPER_ID" ] || { echo "FATAL: no paper with structured questions found"; exit 1; }

# -------------------------------------------------------------------
# Setup 6: assign paper to class
# -------------------------------------------------------------------
echo
echo "--- [setup] assign paper to class"
hit -X POST "$API/api/papers/$PAPER_ID/assign" -H 'Content-Type: application/json' \
  "${AUTH_ADMIN[@]}" \
  -d "{\"classId\":\"$CLASS_ID\",\"startAt\":\"2024-01-01T00:00:00Z\",\"dueAt\":\"2099-01-01T00:00:00Z\",\"durationMin\":60}"
echo "code=$CODE"
[ "$CODE" = "201" ] || [ "$CODE" = "200" ] || { echo "FATAL: assign failed"; exit 1; }
ASSIGN_ID="$(jget "$BODY" ".id")"

# -------------------------------------------------------------------
# Setup 7: student opens, fills a structured answer, submits
# -------------------------------------------------------------------
echo
echo "--- [setup] student login + open + answer + submit"
hit -X POST "$API/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$STU_EMAIL\",\"password\":\"$STU_PASS\"}"
[ "$CODE" = "200" ] || [ "$CODE" = "201" ] || { echo "FATAL: student login failed"; exit 1; }
STU_TOKEN="$(jget "$BODY" ".token")"
AUTH_STU=(-H "Authorization: Bearer $STU_TOKEN")

hit -X POST "$API/api/student/submissions" -H 'Content-Type: application/json' \
  "${AUTH_STU[@]}" -d "{\"assignmentId\":\"$ASSIGN_ID\"}"
SUB_ID="$(jget "$BODY" ".id")"
echo "submissionId=$SUB_ID"

# Fill each structured Q with a textAnswer.
for pq in "${STRUCTURED_PQ_IDS[@]}"; do
  hit -X PATCH "$API/api/student/submissions/$SUB_ID/scripts" -H 'Content-Type: application/json' \
    "${AUTH_STU[@]}" -d "{\"paperQuestionId\":\"$pq\",\"textAnswer\":\"answer for $pq @${TS}\"}"
done

hit -X POST "$API/api/student/submissions/$SUB_ID/submit" "${AUTH_STU[@]}"
echo "submit code=$CODE"
SUB_STATUS="$(jget "$BODY" ".status")"
SUB_AUTO="$(jget "$BODY" ".autoScore")"
[ "$SUB_STATUS" = "submitted" ] || { echo "FATAL: submit didn't move to submitted"; exit 1; }
echo "autoScore=$SUB_AUTO"

# ===================================================================
# COVERAGE TESTS
# ===================================================================

# B1: queue includes our submission
echo
echo "--- [B1] GET /api/marker/queue"
hit -X GET "$API/api/marker/queue" "${AUTH_ADMIN[@]}"
echo "code=$CODE bodyLen=${#BODY}"
if [ "$CODE" = "200" ]; then
  HAS=$(node -e "
let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{
  const r=JSON.parse(s);
  const items=r.items||[];
  const f=items.find(x=>x.id==='$SUB_ID');
  console.log(f?'YES':'NO');
});" <<< "$BODY")
  if [ "$HAS" = "YES" ]; then record "B1: queue includes ungraded submission" PASS "code=200"
  else record "B1: queue includes ungraded submission" FAIL "submission not in queue body=$BODY"
  fi
else
  record "B1: queue includes ungraded submission" FAIL "code=$CODE body=$BODY"
fi

# B2: claim the submission
echo
echo "--- [B2] POST /api/marker/claim"
hit -X POST "$API/api/marker/claim" -H 'Content-Type: application/json' "${AUTH_ADMIN[@]}" \
  -d "{\"submissionId\":\"$SUB_ID\"}"
echo "code=$CODE body=$BODY"
if [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then
  CL_STATUS="$(jget "$BODY" ".status")"
  CL_MARKER="$(jget "$BODY" ".markerId")"
  if [ "$CL_STATUS" = "active" ] && [ "$CL_MARKER" = "$ADMIN_ID" ]; then
    record "B2: claim succeeded" PASS "claim active by admin"
  else
    record "B2: claim succeeded" FAIL "status=$CL_STATUS markerId=$CL_MARKER body=$BODY"
  fi
else
  record "B2: claim succeeded" FAIL "code=$CODE body=$BODY"
fi

# B2b: idempotent re-claim by same marker
echo
echo "--- [B2b] re-claim by same marker (idempotent)"
hit -X POST "$API/api/marker/claim" -H 'Content-Type: application/json' "${AUTH_ADMIN[@]}" \
  -d "{\"submissionId\":\"$SUB_ID\"}"
echo "code=$CODE"
if [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then
  record "B2b: re-claim by owner is idempotent" PASS "code=$CODE"
else
  record "B2b: re-claim by owner is idempotent" FAIL "code=$CODE body=$BODY"
fi

# B3: race claim — second marker tries to claim, expect 409
if [ "$HAVE_M2" = "1" ]; then
  echo
  echo "--- [B3] race claim — head_teacher tries to claim already-held submission"
  hit -X POST "$API/api/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$M2_EMAIL\",\"password\":\"$M2_PASS\"}"
  M2_TOKEN="$(jget "$BODY" ".token")"
  AUTH_M2=(-H "Authorization: Bearer $M2_TOKEN")

  hit -X POST "$API/api/marker/claim" -H 'Content-Type: application/json' "${AUTH_M2[@]}" \
    -d "{\"submissionId\":\"$SUB_ID\"}"
  echo "code=$CODE body=$BODY"
  if [ "$CODE" = "409" ]; then
    record "B3: 2nd marker race → 409" PASS "expected 409"
  elif [[ "$CODE" =~ ^4[0-9][0-9]$ ]]; then
    record "B3: 2nd marker race → 409" FAIL "got $CODE (expected 409); body=$BODY"
  else
    record "B3: 2nd marker race → 409" FAIL "code=$CODE body=$BODY (HIGH: claim race not enforced)"
  fi
else
  record "B3: 2nd marker race → 409" SKIP "no 2nd marker user available (POST /users may not be supported)"
fi

# B4: score every structured script
echo
echo "--- [B4] PATCH /api/marker/scripts/:id for each structured script"
# First we need the script ids; pull the marker submission detail.
hit -X GET "$API/api/marker/submissions/$SUB_ID" "${AUTH_ADMIN[@]}"
[ "$CODE" = "200" ] || { record "B4: load detail" FAIL "code=$CODE body=$BODY"; }
SCRIPT_INFO=$(node -e "
let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{
  const sub=JSON.parse(s);
  const scripts=sub.scripts||[];
  const struct=scripts.filter(x=>['structured','short_answer','essay'].includes(x.paperQuestion&&x.paperQuestion.question&&x.paperQuestion.question.questionType));
  for (const sc of struct){
    console.log(sc.id+'|'+(sc.paperQuestion.marks||0));
  }
});" <<< "$BODY")
echo "structured scripts:"
echo "$SCRIPT_INFO"

EXPECTED_MANUAL=0
SCORE_OK=1
while IFS='|' read -r SCR_ID SCR_MAX; do
  [ -n "$SCR_ID" ] || continue
  # Award full marks for the test (deterministic).
  AWARD="$SCR_MAX"
  hit -X PATCH "$API/api/marker/scripts/$SCR_ID" -H 'Content-Type: application/json' "${AUTH_ADMIN[@]}" \
    -d "{\"awardedMarks\":$AWARD,\"markerComment\":\"good answer\"}"
  if [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then
    GOT=$(jget "$BODY" ".awardedMarks")
    if [ "$GOT" != "$AWARD" ]; then SCORE_OK=0; echo "MISMATCH on $SCR_ID: got=$GOT expected=$AWARD"; fi
    EXPECTED_MANUAL=$(node -e "console.log(${EXPECTED_MANUAL}+${AWARD})")
  else
    SCORE_OK=0
    echo "scoreScript code=$CODE body=$BODY"
  fi
done <<< "$SCRIPT_INFO"

if [ "$SCORE_OK" = "1" ]; then
  record "B4: score all structured scripts" PASS "expectedManualScore=$EXPECTED_MANUAL"
else
  record "B4: score all structured scripts" FAIL "one or more PATCH failed"
fi

# B4b: marker-claim ownership — non-owner cannot score
if [ "$HAVE_M2" = "1" ]; then
  echo
  echo "--- [B4b] non-owner attempting to PATCH script → 403"
  # Pick first script id.
  FIRST_SCR_ID=$(echo "$SCRIPT_INFO" | head -n1 | cut -d'|' -f1)
  hit -X PATCH "$API/api/marker/scripts/$FIRST_SCR_ID" -H 'Content-Type: application/json' "${AUTH_M2[@]}" \
    -d "{\"awardedMarks\":0,\"markerComment\":\"nope\"}"
  echo "code=$CODE body=$BODY"
  if [ "$CODE" = "403" ]; then
    record "B4b: non-owner score denied" PASS "code=403"
  elif [[ "$CODE" =~ ^4[0-9][0-9]$ ]]; then
    record "B4b: non-owner score denied" PASS "code=$CODE (4xx; ideally 403)"
  else
    record "B4b: non-owner score denied" FAIL "code=$CODE accepted by non-owner (HIGH) body=$BODY"
  fi
fi

# B5: cannot finalize with ungraded scripts? — already graded all, so positive path
echo
echo "--- [B5] POST /api/marker/finalize/:submissionId"
hit -X POST "$API/api/marker/finalize/$SUB_ID" "${AUTH_ADMIN[@]}"
echo "code=$CODE body=$BODY"
if [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then
  FIN_STATUS="$(jget "$BODY" ".status")"
  FIN_AUTO="$(jget "$BODY" ".autoScore")"
  FIN_MAN="$(jget "$BODY" ".manualScore")"
  FIN_TOTAL="$(jget "$BODY" ".totalScore")"
  EXPECTED_TOTAL=$(node -e "console.log((${FIN_AUTO:-0})+(${FIN_MAN:-0}))")
  if [ "$FIN_STATUS" = "marked" ] && [ "$FIN_TOTAL" = "$EXPECTED_TOTAL" ]; then
    record "B5: finalize sets totalScore=auto+manual" PASS "auto=$FIN_AUTO manual=$FIN_MAN total=$FIN_TOTAL"
  else
    record "B5: finalize sets totalScore=auto+manual" FAIL "status=$FIN_STATUS total=$FIN_TOTAL expected=$EXPECTED_TOTAL"
  fi
else
  record "B5: finalize sets totalScore=auto+manual" FAIL "code=$CODE body=$BODY"
fi

# B6: double-finalize → 4xx
echo
echo "--- [B6] double finalize → 4xx"
hit -X POST "$API/api/marker/finalize/$SUB_ID" "${AUTH_ADMIN[@]}"
echo "code=$CODE body=$BODY"
if [[ "$CODE" =~ ^4[0-9][0-9]$ ]]; then
  record "B6: double finalize rejected" PASS "code=$CODE"
elif [ "$CODE" = "500" ]; then
  record "B6: double finalize rejected" FAIL "code=500 (MEDIUM)"
else
  record "B6: double finalize rejected" FAIL "code=$CODE accepted (HIGH)"
fi

# B7: student can read their own submission post-marking and see manual scores
echo
echo "--- [B7] student GET /api/student/submissions/:id post-mark"
hit -X GET "$API/api/student/submissions/$SUB_ID" "${AUTH_STU[@]}"
echo "code=$CODE bodyLen=${#BODY}"
if [ "$CODE" = "200" ]; then
  CHK=$(node -e "
let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{
  const sub=JSON.parse(s);
  const scripts=sub.scripts||[];
  const graded=scripts.filter(sc=>sc.awardedMarks!=null);
  console.log('STATUS='+sub.status);
  console.log('TOTAL='+sub.totalScore);
  console.log('MANUAL='+sub.manualScore);
  console.log('GRADED_COUNT='+graded.length);
  console.log('AUTO='+sub.autoScore);
});" <<< "$BODY")
  echo "$CHK"
  ST=$(echo "$CHK" | grep '^STATUS=' | head -n1 | cut -d'=' -f2)
  TT=$(echo "$CHK" | grep '^TOTAL=' | head -n1 | cut -d'=' -f2)
  MN=$(echo "$CHK" | grep '^MANUAL=' | head -n1 | cut -d'=' -f2)
  if [ "$ST" = "marked" ] && [ -n "$TT" ] && [ -n "$MN" ]; then
    record "B7: student sees marked submission with manual scores" PASS "status=marked total=$TT manual=$MN"
  else
    record "B7: student sees marked submission with manual scores" FAIL "status=$ST total=$TT manual=$MN"
  fi
else
  record "B7: student sees marked submission with manual scores" FAIL "code=$CODE body=$BODY"
fi

# B8: student must NOT be able to call /api/marker/* (authz check)
echo
echo "--- [B8] student GET /api/marker/queue → 401/403"
hit -X GET "$API/api/marker/queue" "${AUTH_STU[@]}"
echo "code=$CODE body=$BODY"
if [ "$CODE" = "401" ] || [ "$CODE" = "403" ]; then
  record "B8: student blocked from /marker/queue" PASS "code=$CODE"
else
  record "B8: student blocked from /marker/queue" FAIL "code=$CODE LEAK (HIGH) body=$BODY"
fi

echo
echo "--- [B8b] student POST /api/marker/claim → 401/403"
hit -X POST "$API/api/marker/claim" -H 'Content-Type: application/json' "${AUTH_STU[@]}" \
  -d "{\"submissionId\":\"$SUB_ID\"}"
echo "code=$CODE body=$BODY"
if [ "$CODE" = "401" ] || [ "$CODE" = "403" ]; then
  record "B8b: student blocked from /marker/claim" PASS "code=$CODE"
else
  record "B8b: student blocked from /marker/claim" FAIL "code=$CODE LEAK (CRITICAL) body=$BODY"
fi

# ===================================================================
# Summary
# ===================================================================
echo
echo "=========================================="
echo " RESULTS SUMMARY"
echo "=========================================="
echo "PASS=$PASS FAIL=$FAIL"
echo
echo "| Test | Verdict | Evidence |"
echo "|------|---------|----------|"
for r in "${RESULTS[@]}"; do echo "$r"; done

[ "$FAIL" = "0" ] || exit 2
exit 0
