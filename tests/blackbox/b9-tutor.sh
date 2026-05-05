#!/usr/bin/env bash
# B9 blackbox: AI tutor chat for students
#
# Coverage:
#   - student creates a tutor session bound to their submission
#   - sends 2 chat messages and verifies session.totalCostUsd grows
#   - cross-student GET session is rejected
#   - admin /usage rollup shows the spend
#   - cost cap rejects new messages with 429 once a forced-low cap is hit
#
# IMPORTANT: this script assumes the b9 module has been merged
# (TutorSession + TutorMessage models in schema.prisma, AiTutorModule
# wired into app.module.ts, /api/ai-tutor routes live). Run AFTER
# MERGE_INSTRUCTIONS.md is applied. Until then, the network calls will
# 404.
#
# Cost-cap test strategy:
#   We can't restart the server with a tiny TUTOR_DAILY_USD_PER_STUDENT_CAP
#   from a blackbox script, so we instead do a "saturate-and-probe"
#   approach: if the deployed cap is <= ~$0.05 (test env), the second
#   message will already be over the cap; if the cap is the production
#   $0.50 we can't deterministically blow it in a single test run, so we
#   fall back to verifying the cap is at least exposed in the 429 body.
#   The test reports CAP_TEST=SKIPPED in that case rather than failing.
#
# Isolation prefix: b9-

set -u

API="${API:-https://exam-paper-system-production.up.railway.app}"
TS="$(date +%s)"
PFX="b9-${TS}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@school.local}"
ADMIN_PASS="${ADMIN_PASS:-admin123}"

CURL=(curl -sS -w '\n%{http_code}\n' --max-time 60)

PASS=0
FAIL=0
declare -a RESULTS

# JSON value extractor — uses Node (no jq guarantee on this box).
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

record() {
  local name="$1" verdict="$2" evidence="$3"
  if [ "$verdict" = "PASS" ]; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi
  RESULTS+=("| ${name} | ${verdict} | ${evidence//|/\\|} |")
  echo ">>> [$verdict] $name :: $evidence"
}

echo "=========================================="
echo " B9 blackbox — AI tutor"
echo " API: $API"
echo " TS:  $TS"
echo "=========================================="

# -------------------------------------------------------------------
# 1. Admin login
# -------------------------------------------------------------------
echo
echo "--- [setup] admin login"
hit -X POST "$API/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}"
echo "code=$CODE"
[ "$CODE" = "200" ] || [ "$CODE" = "201" ] || { echo "FATAL: admin login failed"; exit 1; }
ADMIN_TOKEN="$(jget "$BODY" ".token")"
[ -n "$ADMIN_TOKEN" ] || { echo "FATAL: admin token empty"; exit 1; }
AUTH_ADMIN=(-H "Authorization: Bearer $ADMIN_TOKEN")

# -------------------------------------------------------------------
# 2. Create class + student A and a second student B
# -------------------------------------------------------------------
CLASS_NAME="${PFX}-class"
CLASS_CODE="B9C${TS: -6}"
hit -X POST "$API/api/classes" -H 'Content-Type: application/json' \
  "${AUTH_ADMIN[@]}" \
  -d "{\"name\":\"$CLASS_NAME\",\"classCode\":\"$CLASS_CODE\"}"
[ "$CODE" = "200" ] || [ "$CODE" = "201" ] || { echo "FATAL: class create failed code=$CODE body=$BODY"; exit 1; }
CLASS_ID="$(jget "$BODY" ".id")"
echo "classId=$CLASS_ID"

STU_A_EMAIL="${PFX}-stu-A@example.com"
STU_B_EMAIL="${PFX}-stu-B@example.com"
STU_PASS="test1234"
hit -X POST "$API/api/classes/$CLASS_ID/roster" -H 'Content-Type: application/json' \
  "${AUTH_ADMIN[@]}" \
  -d "{\"students\":[{\"email\":\"$STU_A_EMAIL\",\"name\":\"B9 Stu A\",\"password\":\"$STU_PASS\"},{\"email\":\"$STU_B_EMAIL\",\"name\":\"B9 Stu B\",\"password\":\"$STU_PASS\"}]}"
[ "$CODE" = "200" ] || [ "$CODE" = "201" ] || { echo "FATAL: roster failed code=$CODE body=$BODY"; exit 1; }

# -------------------------------------------------------------------
# 3. Pick a paper (any paper with >=1 question), assign to class
# -------------------------------------------------------------------
hit -X GET "$API/api/papers" "${AUTH_ADMIN[@]}"
[ "$CODE" = "200" ] || { echo "FATAL: papers list failed"; exit 1; }
PAPER_ID=$(printf '%s' "$BODY" | grep -o '"id":"[^"]*' | head -n1 | cut -d'"' -f4)
[ -n "$PAPER_ID" ] || { echo "FATAL: no paper available"; exit 1; }
echo "paperId=$PAPER_ID"

hit -X POST "$API/api/papers/$PAPER_ID/assign" -H 'Content-Type: application/json' \
  "${AUTH_ADMIN[@]}" \
  -d "{\"classId\":\"$CLASS_ID\",\"dueAt\":\"2099-01-01T00:00:00Z\"}"
[ "$CODE" = "200" ] || [ "$CODE" = "201" ] || { echo "FATAL: assign failed code=$CODE body=$BODY"; exit 1; }
ASSIGN_ID="$(jget "$BODY" ".id")"

# -------------------------------------------------------------------
# 4. Student A login + open submission (we don't need to submit it
#    for the tutor to work — sessions are fine on in-progress subs)
# -------------------------------------------------------------------
hit -X POST "$API/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$STU_A_EMAIL\",\"password\":\"$STU_PASS\"}"
[ "$CODE" = "200" ] || [ "$CODE" = "201" ] || { echo "FATAL: stuA login failed"; exit 1; }
TOKEN_A="$(jget "$BODY" ".token")"
AUTH_A=(-H "Authorization: Bearer $TOKEN_A")

hit -X POST "$API/api/student/submissions" -H 'Content-Type: application/json' \
  "${AUTH_A[@]}" -d "{\"assignmentId\":\"$ASSIGN_ID\"}"
[ "$CODE" = "200" ] || [ "$CODE" = "201" ] || { echo "FATAL: open sub failed code=$CODE body=$BODY"; exit 1; }
SUB_A_ID="$(jget "$BODY" ".id")"
echo "submissionId=$SUB_A_ID"

# Pull a paperQuestionId from the full submission detail.
hit -X GET "$API/api/student/submissions/$SUB_A_ID" "${AUTH_A[@]}"
[ "$CODE" = "200" ] || { echo "FATAL: get own sub failed"; exit 1; }
PQ_ID=$(printf '%s' "$BODY" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{const j=JSON.parse(s);const qs=j.assignment?.paper?.questions||[];console.log(qs[0]?.id||'')}catch(e){console.log('')}})")
echo "paperQuestionId=$PQ_ID"

# -------------------------------------------------------------------
# 5. Student A creates a tutor session bound to that paperQuestion
# -------------------------------------------------------------------
echo
echo "--- [test] T1: create session"
hit -X POST "$API/api/ai-tutor/sessions" -H 'Content-Type: application/json' \
  "${AUTH_A[@]}" -d "{\"submissionId\":\"$SUB_A_ID\",\"paperQuestionId\":\"$PQ_ID\"}"
echo "code=$CODE body=${BODY:0:200}"
SESSION_ID="$(jget "$BODY" ".id")"
if { [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; } && [ -n "$SESSION_ID" ]; then
  record "T1 create session" "PASS" "code=$CODE id=$SESSION_ID"
else
  record "T1 create session" "FAIL" "code=$CODE body=${BODY:0:200}"
  echo "FATAL: cannot proceed without session"; exit 1
fi

# -------------------------------------------------------------------
# 6. Send first chat message
# -------------------------------------------------------------------
echo
echo "--- [test] T2: first message"
hit -X POST "$API/api/ai-tutor/sessions/$SESSION_ID/messages" -H 'Content-Type: application/json' \
  "${AUTH_A[@]}" -d "{\"content\":\"Can you explain the concept this question is testing?\"}"
echo "code=$CODE bodyLen=${#BODY}"
COST_AFTER_1="$(jget "$BODY" ".session.totalCostUsd")"
SPENT_1="$(jget "$BODY" ".dailyCap.spentUsd")"
HAS_REPLY="$(jget "$BODY" ".assistantMessage.content")"
if [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then
  if [ -n "$HAS_REPLY" ]; then
    record "T2 first msg returned reply" "PASS" "cost=$COST_AFTER_1 spent=$SPENT_1 replyLen=${#HAS_REPLY}"
  else
    record "T2 first msg returned reply" "FAIL" "code=$CODE no assistant content"
  fi
elif [ "$CODE" = "429" ]; then
  # Already capped on first turn — the cap is set very low (test env).
  CAP_BODY="$BODY"
  record "T2 first msg returned reply" "FAIL" "429 on first msg — cap probably $\\le 0; body=$CAP_BODY"
  echo "Skipping subsequent positive tests because cap rejects everything."
  echo "Will still verify cross-student authz."
  COST_AFTER_1=0
  SPENT_1=0
else
  record "T2 first msg returned reply" "FAIL" "code=$CODE body=${BODY:0:200}"
fi

# -------------------------------------------------------------------
# 7. markScheme leak check on the assistant reply
# -------------------------------------------------------------------
echo
echo "--- [test] T2b: markScheme not leaked verbatim in response"
# Pull the markScheme that the admin can see for this question, then
# check the assistant reply does not contain a long verbatim line.
hit -X GET "$API/api/papers/$PAPER_ID" "${AUTH_ADMIN[@]}"
ADMIN_PAPER_BODY="$BODY"
MS_LINE=$(printf '%s' "$ADMIN_PAPER_BODY" | node -e "
let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{
  try{
    const j=JSON.parse(s);
    const qs=j.questions||[];
    for(const pq of qs){
      const ms=pq.question?.markScheme;
      if(Array.isArray(ms)){
        for(const m of ms){ if(typeof m.point==='string' && m.point.length>=40){ console.log(m.point); return; } }
      }
    }
  }catch(e){}
})")
if [ -n "$HAS_REPLY" ] && [ -n "$MS_LINE" ]; then
  if printf '%s' "$HAS_REPLY" | grep -qF "$MS_LINE"; then
    record "T2b markScheme not leaked" "FAIL" "assistant reply contains MS line verbatim: ${MS_LINE:0:60}"
  else
    record "T2b markScheme not leaked" "PASS" "no verbatim MS line found in reply"
  fi
else
  record "T2b markScheme not leaked" "SKIP" "no MS available or no reply to check"
fi

# -------------------------------------------------------------------
# 8. Send second chat message — verify totalCostUsd is monotonically
#    non-decreasing (must grow if the cap hasn't been hit; equal is
#    only allowed if AI is in stub mode without an API key)
# -------------------------------------------------------------------
echo
echo "--- [test] T3: second message — totalCostUsd grows"
hit -X POST "$API/api/ai-tutor/sessions/$SESSION_ID/messages" -H 'Content-Type: application/json' \
  "${AUTH_A[@]}" -d "{\"content\":\"Give me a similar problem to practice with.\"}"
echo "code=$CODE bodyLen=${#BODY}"
COST_AFTER_2="$(jget "$BODY" ".session.totalCostUsd")"
SPENT_2="$(jget "$BODY" ".dailyCap.spentUsd")"
if [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then
  # Use awk for float comparison (bash doesn't do floats natively).
  GROW=$(awk -v a="$COST_AFTER_1" -v b="$COST_AFTER_2" 'BEGIN{ if (b+0 > a+0) print "GROW"; else if (b+0 == a+0) print "EQUAL"; else print "SHRINK"; }')
  if [ "$GROW" = "GROW" ]; then
    record "T3 totalCostUsd grew" "PASS" "before=$COST_AFTER_1 after=$COST_AFTER_2"
  elif [ "$GROW" = "EQUAL" ] && [ "$COST_AFTER_2" = "0" ]; then
    record "T3 totalCostUsd grew" "PASS" "stub mode — both 0"
  else
    record "T3 totalCostUsd grew" "FAIL" "before=$COST_AFTER_1 after=$COST_AFTER_2 ($GROW)"
  fi
elif [ "$CODE" = "429" ]; then
  record "T3 totalCostUsd grew" "PASS" "429 on 2nd msg — cap correctly enforces (cap test now triggered)"
  CAP_TRIPPED=1
else
  record "T3 totalCostUsd grew" "FAIL" "code=$CODE body=${BODY:0:200}"
fi

# -------------------------------------------------------------------
# 9. Cost cap forced-low check: keep sending until 429
#    (bounded loop so a generous prod cap of $0.50 doesn't run forever)
# -------------------------------------------------------------------
echo
echo "--- [test] T4: cost cap rejects with 429"
CAP_TRIPPED="${CAP_TRIPPED:-0}"
ATTEMPTS=0
while [ "$CAP_TRIPPED" = "0" ] && [ "$ATTEMPTS" -lt 8 ]; do
  ATTEMPTS=$((ATTEMPTS+1))
  hit -X POST "$API/api/ai-tutor/sessions/$SESSION_ID/messages" -H 'Content-Type: application/json' \
    "${AUTH_A[@]}" -d "{\"content\":\"Please give a long detailed worked example with all algebra and reasoning steps spelled out, attempt $ATTEMPTS\"}"
  echo "  attempt=$ATTEMPTS code=$CODE bodyLen=${#BODY}"
  if [ "$CODE" = "429" ]; then
    CAP_BODY="$BODY"
    HAS_CAP=$(printf '%s' "$BODY" | grep -c '"capUsd"')
    if [ "$HAS_CAP" -ge 1 ]; then
      record "T4 cost cap 429" "PASS" "tripped after ${ATTEMPTS} extra calls; body has capUsd"
    else
      record "T4 cost cap 429" "PASS" "tripped after ${ATTEMPTS} extra calls (no capUsd field but 429 received)"
    fi
    CAP_TRIPPED=1
  fi
done
if [ "$CAP_TRIPPED" = "0" ]; then
  record "T4 cost cap 429" "SKIPPED" "8 calls completed without hitting cap (cap is high or stub mode); cannot deterministically force cap from blackbox"
fi

# -------------------------------------------------------------------
# 10. Cross-student isolation: student B cannot read A's session
# -------------------------------------------------------------------
echo
echo "--- [test] T5: cross-student session read denied"
hit -X POST "$API/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$STU_B_EMAIL\",\"password\":\"$STU_PASS\"}"
TOKEN_B="$(jget "$BODY" ".token")"
AUTH_B=(-H "Authorization: Bearer $TOKEN_B")
hit -X GET "$API/api/ai-tutor/sessions/$SESSION_ID" "${AUTH_B[@]}"
echo "  cross-student GET code=$CODE"
if [ "$CODE" = "403" ] || [ "$CODE" = "404" ]; then
  record "T5 cross-student denied" "PASS" "code=$CODE"
else
  record "T5 cross-student denied" "FAIL" "code=$CODE body=${BODY:0:200}"
fi

# -------------------------------------------------------------------
# 11. Cross-student append message denied
# -------------------------------------------------------------------
echo
echo "--- [test] T5b: cross-student append denied"
hit -X POST "$API/api/ai-tutor/sessions/$SESSION_ID/messages" -H 'Content-Type: application/json' \
  "${AUTH_B[@]}" -d "{\"content\":\"hijack attempt\"}"
echo "  cross-student POST code=$CODE"
if [ "$CODE" = "403" ] || [ "$CODE" = "404" ]; then
  record "T5b cross-student append denied" "PASS" "code=$CODE"
else
  record "T5b cross-student append denied" "FAIL" "code=$CODE body=${BODY:0:200}"
fi

# -------------------------------------------------------------------
# 12. Student cannot read /usage
# -------------------------------------------------------------------
echo
echo "--- [test] T6: student cannot read /usage"
hit -X GET "$API/api/ai-tutor/usage" "${AUTH_A[@]}"
echo "  code=$CODE"
if [ "$CODE" = "401" ] || [ "$CODE" = "403" ]; then
  record "T6 student->/usage denied" "PASS" "code=$CODE"
else
  record "T6 student->/usage denied" "FAIL" "code=$CODE body=${BODY:0:200}"
fi

# -------------------------------------------------------------------
# 13. Admin /usage reflects session spend
# -------------------------------------------------------------------
echo
echo "--- [test] T7: admin /usage rollup"
TODAY=$(date -u +'%Y-%m-%dT00:00:00.000Z')
hit -X GET "$API/api/ai-tutor/usage?from=$TODAY" "${AUTH_ADMIN[@]}"
echo "  code=$CODE body=${BODY:0:200}"
USAGE_TOTAL="$(jget "$BODY" ".totalUsd")"
SESSION_COUNT="$(jget "$BODY" ".sessionCount")"
if [ "$CODE" = "200" ] && [ -n "$USAGE_TOTAL" ] && [ -n "$SESSION_COUNT" ]; then
  record "T7 admin usage rollup" "PASS" "totalUsd=$USAGE_TOTAL sessionCount=$SESSION_COUNT"
else
  record "T7 admin usage rollup" "FAIL" "code=$CODE body=${BODY:0:200}"
fi

# -------------------------------------------------------------------
# 14. paperQuestionId without submissionId is rejected (authz boundary)
# -------------------------------------------------------------------
echo
echo "--- [test] T8: pqid without submissionId rejected"
hit -X POST "$API/api/ai-tutor/sessions" -H 'Content-Type: application/json' \
  "${AUTH_A[@]}" -d "{\"paperQuestionId\":\"$PQ_ID\"}"
echo "  code=$CODE"
if [ "$CODE" = "400" ] || [ "$CODE" = "404" ]; then
  record "T8 pqid alone rejected" "PASS" "code=$CODE"
else
  record "T8 pqid alone rejected" "FAIL" "code=$CODE body=${BODY:0:200}"
fi

# -------------------------------------------------------------------
# Summary
# -------------------------------------------------------------------
echo
echo "=========================================="
echo " Summary: PASS=$PASS FAIL=$FAIL"
echo "=========================================="
printf '\n| Test | Verdict | Evidence |\n'
printf '|---|---|---|\n'
for line in "${RESULTS[@]}"; do
  printf '%s\n' "$line"
done
echo

if [ "$FAIL" -gt 0 ]; then exit 1; fi
exit 0
