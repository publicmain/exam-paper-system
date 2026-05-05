#!/usr/bin/env bash
# T2 blackbox: student submission lifecycle (open → autosave → resume → submit → lock)
# Target: deployed Railway API
# Isolation prefix: t2-
set -u

API="${API:-https://exam-paper-system-production.up.railway.app}"
TS="$(date +%s)"
PREFIX="t2-"
ADMIN_EMAIL="admin@school.local"
ADMIN_PASS="admin123"

CURL=(curl -sS -w '\n%{http_code}\n' --max-time 30)

# JSON value extractor — uses Node (no jq on this box).
jget() {
  # $1 = json string, $2 = path expression as JS (e.g. ".token" or ".user.id" or ".questions[0].id")
  node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{const j=JSON.parse(s);const v=eval('j$2');console.log(v===undefined||v===null?'':typeof v==='object'?JSON.stringify(v):v)}catch(e){process.stderr.write('jget err: '+e.message+'\n');process.exit(2)}})" <<< "$1"
}

# Run curl, capture body + status. -w '\n%{http_code}\n' prints \n<code>\n
# at the end. Last non-empty line is the code; everything else is body.
# Sets $BODY and $CODE.
hit() {
  local out
  out="$("${CURL[@]}" "$@")" || true
  # Pull last non-empty line as the code.
  CODE="$(printf '%s' "$out" | awk 'NF{last=$0} END{print last}')"
  # Body is everything except that last non-empty line + trailing blank line.
  BODY="$(printf '%s' "$out" | awk -v code="$CODE" '
    {lines[NR]=$0}
    END{
      # Find the last line equal to code; print lines[1..that-1]
      for(i=NR;i>=1;i--){ if(lines[i]==code){cut=i; break} }
      if(!cut)cut=NR+1
      for(i=1;i<cut;i++){ if(i>1)printf "\n"; printf "%s", lines[i] }
    }')"
  # Strip trailing newline noise.
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
echo " T2 blackbox — student submission slice"
echo " API: $API"
echo " TS:  $TS"
echo "=========================================="

# -------------------------------------------------------------------
# Setup 1: admin login
# -------------------------------------------------------------------
echo
echo "--- [setup] admin login"
hit -X POST "$API/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}"
echo "code=$CODE body=$BODY"
[ "$CODE" = "200" ] || [ "$CODE" = "201" ] || { echo "FATAL: admin login failed"; exit 1; }
ADMIN_TOKEN="$(jget "$BODY" ".token")"
[ -n "$ADMIN_TOKEN" ] || { echo "FATAL: admin token empty"; exit 1; }
echo "adminToken=${ADMIN_TOKEN:0:24}..."

AUTH_ADMIN=(-H "Authorization: Bearer $ADMIN_TOKEN")

# -------------------------------------------------------------------
# Setup 2: create class
# -------------------------------------------------------------------
echo
echo "--- [setup] create class"
CLASS_NAME="${PREFIX}class-${TS}"
CLASS_CODE="T2C${TS}"
hit -X POST "$API/api/classes" -H 'Content-Type: application/json' \
  "${AUTH_ADMIN[@]}" \
  -d "{\"name\":\"$CLASS_NAME\",\"classCode\":\"$CLASS_CODE\",\"level\":\"Y10\"}"
echo "code=$CODE body=$BODY"
[ "$CODE" = "201" ] || [ "$CODE" = "200" ] || { echo "FATAL: class create failed"; exit 1; }
CLASS_ID="$(jget "$BODY" ".id")"
echo "classId=$CLASS_ID"

# -------------------------------------------------------------------
# Setup 3: roster a student
# -------------------------------------------------------------------
echo
echo "--- [setup] roster student"
STU_EMAIL="${PREFIX}stu-${TS}@example.com"
STU_PASS="test1234"
hit -X POST "$API/api/classes/$CLASS_ID/roster" -H 'Content-Type: application/json' \
  "${AUTH_ADMIN[@]}" \
  -d "{\"students\":[{\"email\":\"$STU_EMAIL\",\"name\":\"T2 Student $TS\",\"password\":\"$STU_PASS\"}]}"
echo "code=$CODE body=$BODY"
[ "$CODE" = "201" ] || [ "$CODE" = "200" ] || { echo "FATAL: roster failed"; exit 1; }

# -------------------------------------------------------------------
# Setup 4: pick a paper with >=2 questions including >=1 MCQ
# -------------------------------------------------------------------
echo
echo "--- [setup] list papers"
hit -X GET "$API/api/papers" "${AUTH_ADMIN[@]}"
echo "code=$CODE bodyLen=${#BODY}"
[ "$CODE" = "200" ] || { echo "FATAL: papers list failed"; exit 1; }

# Get list of paper IDs (sorted by updatedAt desc).
PAPER_IDS=$(node -e "
let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{
  const arr=JSON.parse(s);
  for (const p of arr) console.log(p.id);
});" <<< "$BODY")

PAPER_ID=""
declare -a Q_LIST=()
for pid in $PAPER_IDS; do
  hit -X GET "$API/api/papers/$pid" "${AUTH_ADMIN[@]}"
  [ "$CODE" = "200" ] || continue
  CHECK=$(node -e "
let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{
  const p=JSON.parse(s);
  const qs=p.questions||[];
  if (qs.length<2){console.log('NO');return;}
  const types=qs.map(x=>x.question&&x.question.questionType);
  const mcqIdx=types.findIndex(t=>t==='mcq');
  if (mcqIdx<0){console.log('NO');return;}
  const otherIdx=qs.findIndex((x,i)=>i!==mcqIdx);
  console.log('YES');
  console.log(p.id);
  console.log(qs[mcqIdx].id);
  console.log(qs[otherIdx].id);
  console.log(types[mcqIdx]);
  console.log(types[otherIdx]);
  // Provide any MCQ option key, prefer not-correct first to ensure overwrite path
  const opts=qs[mcqIdx].snapshotOptions||(qs[mcqIdx].question&&qs[mcqIdx].question.options)||[];
  console.log(JSON.stringify(opts));
});" <<< "$BODY")
  HEAD=$(printf '%s\n' "$CHECK" | head -n1)
  if [ "$HEAD" = "YES" ]; then
    PAPER_ID=$(printf '%s\n' "$CHECK" | sed -n '2p')
    MCQ_PQ_ID=$(printf '%s\n' "$CHECK" | sed -n '3p')
    OTHER_PQ_ID=$(printf '%s\n' "$CHECK" | sed -n '4p')
    MCQ_TYPE=$(printf '%s\n' "$CHECK" | sed -n '5p')
    OTHER_TYPE=$(printf '%s\n' "$CHECK" | sed -n '6p')
    OPTS_JSON=$(printf '%s\n' "$CHECK" | sed -n '7p')
    echo "Selected paperId=$PAPER_ID"
    echo "  MCQ paperQuestionId=$MCQ_PQ_ID type=$MCQ_TYPE"
    echo "  Other paperQuestionId=$OTHER_PQ_ID type=$OTHER_TYPE"
    echo "  MCQ options=$OPTS_JSON"
    break
  fi
done

if [ -z "$PAPER_ID" ]; then
  echo "FATAL: could not find a paper with >=2 questions and >=1 MCQ"
  exit 1
fi

# -------------------------------------------------------------------
# Setup 5: assign the paper to the class
# -------------------------------------------------------------------
echo
echo "--- [setup] assign paper to class"
hit -X POST "$API/api/papers/$PAPER_ID/assign" -H 'Content-Type: application/json' \
  "${AUTH_ADMIN[@]}" \
  -d "{\"classId\":\"$CLASS_ID\",\"startAt\":\"2024-01-01T00:00:00Z\",\"dueAt\":\"2099-01-01T00:00:00Z\",\"durationMin\":60}"
echo "code=$CODE body=$BODY"
[ "$CODE" = "201" ] || [ "$CODE" = "200" ] || { echo "FATAL: assign failed"; exit 1; }
ASSIGN_ID="$(jget "$BODY" ".id")"
echo "assignmentId=$ASSIGN_ID"

# -------------------------------------------------------------------
# Setup 6: student login
# -------------------------------------------------------------------
echo
echo "--- [setup] student login"
hit -X POST "$API/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$STU_EMAIL\",\"password\":\"$STU_PASS\"}"
echo "code=$CODE body=$BODY"
[ "$CODE" = "200" ] || [ "$CODE" = "201" ] || { echo "FATAL: student login failed"; exit 1; }
STU_TOKEN="$(jget "$BODY" ".token")"
[ -n "$STU_TOKEN" ] || { echo "FATAL: student token empty"; exit 1; }
AUTH_STU=(-H "Authorization: Bearer $STU_TOKEN")
echo "studentToken=${STU_TOKEN:0:24}..."

# ===================================================================
# COVERAGE TESTS
# ===================================================================

# T1: GET /api/student/assignments shows the new assignment
echo
echo "--- [T1] GET /api/student/assignments"
hit -X GET "$API/api/student/assignments" "${AUTH_STU[@]}"
echo "code=$CODE"
if [ "$CODE" = "200" ]; then
  HAS=$(node -e "
let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{
  const arr=JSON.parse(s);
  const f=arr.find(a=>a.id==='$ASSIGN_ID');
  console.log(f?'YES':'NO');
});" <<< "$BODY")
  if [ "$HAS" = "YES" ]; then record "T1: list assignments includes new" PASS "code=200, found assignmentId"
  else record "T1: list assignments includes new" FAIL "code=200 but assignment missing; body=$BODY"
  fi
else
  record "T1: list assignments includes new" FAIL "code=$CODE body=$BODY"
fi

# T2: open submission → 200/201, status=in_progress
echo
echo "--- [T2] POST /api/student/submissions {assignmentId}"
hit -X POST "$API/api/student/submissions" -H 'Content-Type: application/json' \
  "${AUTH_STU[@]}" -d "{\"assignmentId\":\"$ASSIGN_ID\"}"
echo "code=$CODE body=$BODY"
SUB_ID=""
if [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then
  SUB_ID="$(jget "$BODY" ".id")"
  STATUS="$(jget "$BODY" ".status")"
  if [ -n "$SUB_ID" ] && [ "$STATUS" = "in_progress" ]; then
    record "T2: open submission" PASS "code=$CODE id=$SUB_ID status=$STATUS"
  else
    record "T2: open submission" FAIL "code=$CODE id=$SUB_ID status=$STATUS body=$BODY"
  fi
else
  record "T2: open submission" FAIL "code=$CODE body=$BODY"
fi

# T3: open again → same submission.id (idempotent)
echo
echo "--- [T3] POST /api/student/submissions {same assignmentId} again"
hit -X POST "$API/api/student/submissions" -H 'Content-Type: application/json' \
  "${AUTH_STU[@]}" -d "{\"assignmentId\":\"$ASSIGN_ID\"}"
echo "code=$CODE body=$BODY"
if [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then
  SUB_ID2="$(jget "$BODY" ".id")"
  if [ -n "$SUB_ID2" ] && [ "$SUB_ID2" = "$SUB_ID" ]; then
    record "T3: open is idempotent" PASS "same id=$SUB_ID2"
  else
    record "T3: open is idempotent" FAIL "id changed: first=$SUB_ID, second=$SUB_ID2 (HIGH: duplicate submissions)"
  fi
else
  record "T3: open is idempotent" FAIL "code=$CODE body=$BODY"
fi

# T4: PATCH MCQ with selectedOption='A'
echo
echo "--- [T4] PATCH .../scripts {MCQ paperQuestionId, selectedOption:'A'}"
hit -X PATCH "$API/api/student/submissions/$SUB_ID/scripts" -H 'Content-Type: application/json' \
  "${AUTH_STU[@]}" -d "{\"paperQuestionId\":\"$MCQ_PQ_ID\",\"selectedOption\":\"A\"}"
echo "code=$CODE body=$BODY"
if [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then
  SO="$(jget "$BODY" ".selectedOption")"
  if [ "$SO" = "A" ]; then
    record "T4: PATCH MCQ A" PASS "selectedOption=A persisted"
  else
    record "T4: PATCH MCQ A" FAIL "selectedOption=$SO body=$BODY"
  fi
else
  record "T4: PATCH MCQ A" FAIL "code=$CODE body=$BODY"
fi

# T5: PATCH same MCQ with 'B' → overwrites
echo
echo "--- [T5] PATCH .../scripts {MCQ paperQuestionId, selectedOption:'B'} (overwrite)"
hit -X PATCH "$API/api/student/submissions/$SUB_ID/scripts" -H 'Content-Type: application/json' \
  "${AUTH_STU[@]}" -d "{\"paperQuestionId\":\"$MCQ_PQ_ID\",\"selectedOption\":\"B\"}"
echo "code=$CODE body=$BODY"
if [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then
  SO="$(jget "$BODY" ".selectedOption")"
  if [ "$SO" = "B" ]; then
    record "T5: PATCH MCQ overwrite to B" PASS "selectedOption=B (last wins)"
  else
    record "T5: PATCH MCQ overwrite to B" FAIL "selectedOption=$SO body=$BODY"
  fi
else
  record "T5: PATCH MCQ overwrite to B" FAIL "code=$CODE body=$BODY"
fi

# T6: PATCH for structured Q with textAnswer
echo
echo "--- [T6] PATCH .../scripts {other paperQuestionId, textAnswer}"
hit -X PATCH "$API/api/student/submissions/$SUB_ID/scripts" -H 'Content-Type: application/json' \
  "${AUTH_STU[@]}" -d "{\"paperQuestionId\":\"$OTHER_PQ_ID\",\"textAnswer\":\"my answer 12345\"}"
echo "code=$CODE body=$BODY"
if [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then
  TA="$(jget "$BODY" ".textAnswer")"
  if [ "$TA" = "my answer 12345" ]; then
    record "T6: PATCH structured textAnswer" PASS "textAnswer persisted"
  else
    record "T6: PATCH structured textAnswer" FAIL "textAnswer=$TA body=$BODY"
  fi
else
  record "T6: PATCH structured textAnswer" FAIL "code=$CODE body=$BODY"
fi

# T7: GET submission shows last values
echo
echo "--- [T7] GET /api/student/submissions/:subId"
hit -X GET "$API/api/student/submissions/$SUB_ID" "${AUTH_STU[@]}"
echo "code=$CODE bodyLen=${#BODY}"
if [ "$CODE" = "200" ]; then
  CHK=$(node -e "
let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{
  const sub=JSON.parse(s);
  const scripts=sub.scripts||[];
  const mcq=scripts.find(x=>x.paperQuestionId==='$MCQ_PQ_ID');
  const other=scripts.find(x=>x.paperQuestionId==='$OTHER_PQ_ID');
  console.log('MCQ_OPT='+(mcq&&mcq.selectedOption));
  console.log('OTHER_TXT='+(other&&other.textAnswer));
});" <<< "$BODY")
  echo "$CHK"
  M_OK=$(echo "$CHK" | grep -c '^MCQ_OPT=B$')
  O_OK=$(echo "$CHK" | grep -c '^OTHER_TXT=my answer 12345$')
  if [ "$M_OK" = "1" ] && [ "$O_OK" = "1" ]; then
    record "T7: scripts persist last values" PASS "MCQ=B; structured='my answer 12345'"
  else
    record "T7: scripts persist last values" FAIL "MCQ_OPT/OTHER_TXT mismatch ($CHK)"
  fi
else
  record "T7: scripts persist last values" FAIL "code=$CODE"
fi

# Edge T13: PATCH bogus paperQuestionId BEFORE submit (still in_progress)
echo
echo "--- [T13] PATCH .../scripts with bogus paperQuestionId"
hit -X PATCH "$API/api/student/submissions/$SUB_ID/scripts" -H 'Content-Type: application/json' \
  "${AUTH_STU[@]}" -d "{\"paperQuestionId\":\"pq-does-not-exist-$TS\",\"selectedOption\":\"A\"}"
echo "code=$CODE body=$BODY"
if [[ "$CODE" =~ ^4[0-9][0-9]$ ]]; then
  record "T13: PATCH bogus paperQuestionId rejected" PASS "code=$CODE (4xx)"
elif [ "$CODE" = "500" ]; then
  record "T13: PATCH bogus paperQuestionId rejected" FAIL "code=500 (MEDIUM: 500 on bad input) body=$BODY"
elif [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then
  record "T13: PATCH bogus paperQuestionId rejected" FAIL "code=$CODE accepted bogus FK (HIGH: orphan script possible) body=$BODY"
else
  record "T13: PATCH bogus paperQuestionId rejected" FAIL "code=$CODE body=$BODY"
fi

# Edge T12: open with non-existent assignmentId → 404, not 500
echo
echo "--- [T12] POST /api/student/submissions {fake-id}"
hit -X POST "$API/api/student/submissions" -H 'Content-Type: application/json' \
  "${AUTH_STU[@]}" -d "{\"assignmentId\":\"fake-id-$TS\"}"
echo "code=$CODE body=$BODY"
if [ "$CODE" = "404" ]; then
  record "T12: open with bogus assignment 404" PASS "code=404"
elif [ "$CODE" = "500" ]; then
  record "T12: open with bogus assignment 404" FAIL "code=500 (MEDIUM) body=$BODY"
elif [[ "$CODE" =~ ^4[0-9][0-9]$ ]]; then
  record "T12: open with bogus assignment 404" FAIL "code=$CODE (expected 404) body=$BODY"
else
  record "T12: open with bogus assignment 404" FAIL "code=$CODE body=$BODY"
fi

# T8: final submit
echo
echo "--- [T8] POST .../submit"
hit -X POST "$API/api/student/submissions/$SUB_ID/submit" -H 'Content-Type: application/json' \
  "${AUTH_STU[@]}"
echo "code=$CODE body=$BODY"
if [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then
  ST="$(jget "$BODY" ".status")"
  AS="$(jget "$BODY" ".autoScore")"
  SAT="$(jget "$BODY" ".submittedAt")"
  if [ "$ST" = "submitted" ] && [ -n "$SAT" ] && [ -n "$AS" ]; then
    record "T8: final submit locks" PASS "status=submitted autoScore=$AS submittedAt=$SAT"
  elif [ "$ST" = "submitted" ] && [ -n "$SAT" ]; then
    # autoScore could be 0 which is also valid
    record "T8: final submit locks" PASS "status=submitted autoScore=$AS submittedAt=$SAT"
  else
    record "T8: final submit locks" FAIL "status=$ST autoScore=$AS submittedAt=$SAT body=$BODY"
  fi
else
  record "T8: final submit locks" FAIL "code=$CODE body=$BODY"
fi

# T9: submit twice → second 4xx, NOT 500
echo
echo "--- [T9] POST .../submit second time"
hit -X POST "$API/api/student/submissions/$SUB_ID/submit" -H 'Content-Type: application/json' \
  "${AUTH_STU[@]}"
echo "code=$CODE body=$BODY"
if [[ "$CODE" =~ ^4[0-9][0-9]$ ]]; then
  record "T9: double submit rejected" PASS "code=$CODE"
elif [ "$CODE" = "500" ]; then
  record "T9: double submit rejected" FAIL "code=500 (MEDIUM) body=$BODY"
else
  record "T9: double submit rejected" FAIL "code=$CODE accepted second submit body=$BODY"
fi

# T10: PATCH after submit → 4xx (locked)
echo
echo "--- [T10] PATCH .../scripts after submit (should be locked)"
hit -X PATCH "$API/api/student/submissions/$SUB_ID/scripts" -H 'Content-Type: application/json' \
  "${AUTH_STU[@]}" -d "{\"paperQuestionId\":\"$MCQ_PQ_ID\",\"selectedOption\":\"C\"}"
echo "code=$CODE body=$BODY"
if [[ "$CODE" =~ ^4[0-9][0-9]$ ]]; then
  record "T10: post-submit PATCH locked" PASS "code=$CODE rejected"
elif [ "$CODE" = "500" ]; then
  record "T10: post-submit PATCH locked" FAIL "code=500 (MEDIUM) body=$BODY"
elif [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then
  record "T10: post-submit PATCH locked" FAIL "code=$CODE MUTATED locked submission (HIGH) body=$BODY"
else
  record "T10: post-submit PATCH locked" FAIL "code=$CODE body=$BODY"
fi

# T11: open after submit returns SAME submitted submission
echo
echo "--- [T11] POST /api/student/submissions {assignmentId} after submit"
hit -X POST "$API/api/student/submissions" -H 'Content-Type: application/json' \
  "${AUTH_STU[@]}" -d "{\"assignmentId\":\"$ASSIGN_ID\"}"
echo "code=$CODE body=$BODY"
if [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then
  RID="$(jget "$BODY" ".id")"
  RST="$(jget "$BODY" ".status")"
  if [ "$RID" = "$SUB_ID" ] && [ "$RST" = "submitted" ]; then
    record "T11: open after submit returns same submitted row" PASS "id=$RID status=submitted"
  elif [ "$RID" != "$SUB_ID" ]; then
    record "T11: open after submit returns same submitted row" FAIL "NEW submission id=$RID (HIGH: duplicate after submit)"
  else
    record "T11: open after submit returns same submitted row" FAIL "id=$RID status=$RST body=$BODY"
  fi
else
  record "T11: open after submit returns same submitted row" FAIL "code=$CODE body=$BODY"
fi

# T14: submit with zero scripts — need a fresh assignment + fresh student to get a clean submission
echo
echo "--- [T14] submit with zero scripts (fresh class/student/assignment)"
TS2="${TS}b"
CLASS2_NAME="${PREFIX}class-${TS2}"
CLASS2_CODE="T2C${TS2}"
hit -X POST "$API/api/classes" -H 'Content-Type: application/json' "${AUTH_ADMIN[@]}" \
  -d "{\"name\":\"$CLASS2_NAME\",\"classCode\":\"$CLASS2_CODE\",\"level\":\"Y10\"}"
CLASS2_ID="$(jget "$BODY" ".id")"
echo "class2Id=$CLASS2_ID code=$CODE"
STU2_EMAIL="${PREFIX}stu-${TS2}@example.com"
hit -X POST "$API/api/classes/$CLASS2_ID/roster" -H 'Content-Type: application/json' "${AUTH_ADMIN[@]}" \
  -d "{\"students\":[{\"email\":\"$STU2_EMAIL\",\"name\":\"T2 Student2\",\"password\":\"$STU_PASS\"}]}"
echo "roster code=$CODE"
hit -X POST "$API/api/papers/$PAPER_ID/assign" -H 'Content-Type: application/json' "${AUTH_ADMIN[@]}" \
  -d "{\"classId\":\"$CLASS2_ID\",\"startAt\":\"2024-01-01T00:00:00Z\",\"dueAt\":\"2099-01-01T00:00:00Z\",\"durationMin\":60}"
ASSIGN2_ID="$(jget "$BODY" ".id")"
echo "assign2Id=$ASSIGN2_ID code=$CODE"
hit -X POST "$API/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$STU2_EMAIL\",\"password\":\"$STU_PASS\"}"
STU2_TOKEN="$(jget "$BODY" ".token")"
AUTH_STU2=(-H "Authorization: Bearer $STU2_TOKEN")
hit -X POST "$API/api/student/submissions" -H 'Content-Type: application/json' \
  "${AUTH_STU2[@]}" -d "{\"assignmentId\":\"$ASSIGN2_ID\"}"
SUB2_ID="$(jget "$BODY" ".id")"
echo "sub2Id=$SUB2_ID code=$CODE"
hit -X POST "$API/api/student/submissions/$SUB2_ID/submit" -H 'Content-Type: application/json' \
  "${AUTH_STU2[@]}"
echo "submit code=$CODE body=$BODY"
if [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then
  ST="$(jget "$BODY" ".status")"
  AS="$(jget "$BODY" ".autoScore")"
  if [ "$ST" = "submitted" ] && [ "$AS" = "0" ]; then
    record "T14: zero-script submit" PASS "status=submitted autoScore=0"
  elif [ "$ST" = "submitted" ]; then
    record "T14: zero-script submit" PASS "status=submitted autoScore=$AS"
  else
    record "T14: zero-script submit" FAIL "status=$ST autoScore=$AS body=$BODY"
  fi
elif [[ "$CODE" =~ ^4[0-9][0-9]$ ]]; then
  record "T14: zero-script submit" PASS "explicit 4xx with clear msg: code=$CODE body=$BODY"
elif [ "$CODE" = "500" ]; then
  record "T14: zero-script submit" FAIL "code=500 on empty submit (MEDIUM) body=$BODY"
else
  record "T14: zero-script submit" FAIL "code=$CODE body=$BODY"
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

# exit non-zero if any FAIL
[ "$FAIL" = "0" ] || exit 2
exit 0
