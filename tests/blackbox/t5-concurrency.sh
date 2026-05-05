#!/usr/bin/env bash
# T5 Blackbox tests — concurrency & idempotency
# Target: deployed Railway exam-paper-system
# Isolation prefix: t5-
set -u

API="${API:-https://exam-paper-system-production.up.railway.app}"
TS="$(date +%s)"
PREFIX="t5"
PASS=0
FAIL=0

# Portable curl helper. Writes body to $3, status code goes to stdout.
# Usage: STATUS=$(req METHOD URL BODYFILE [DATA] [TOKEN])
req() {
  local method="$1" url="$2" bodyfile="$3" data="${4:-}" token="${5:-}"
  local args=(-sS -o "$bodyfile" -w '%{http_code}' --max-time 60 -X "$method" "$url" -H 'Content-Type: application/json')
  if [ -n "$token" ]; then
    args+=(-H "Authorization: Bearer $token")
  fi
  if [ -n "$data" ]; then
    args+=(--data "$data")
  fi
  curl "${args[@]}"
}

# Same as req() but takes data via @file (avoids huge cmdline). status -> stdout
req_file() {
  local method="$1" url="$2" bodyfile="$3" datafile="$4" token="${5:-}"
  local args=(-sS -o "$bodyfile" -w '%{http_code}' --max-time 60 -X "$method" "$url" -H 'Content-Type: application/json')
  if [ -n "$token" ]; then
    args+=(-H "Authorization: Bearer $token")
  fi
  args+=(--data "@$datafile")
  curl "${args[@]}"
}

# Background variant: writes status to a separate file so we can collect later.
req_bg() {
  local method="$1" url="$2" bodyfile="$3" statusfile="$4" data="${5:-}" token="${6:-}"
  local args=(-sS -o "$bodyfile" -w '%{http_code}' --max-time 60 -X "$method" "$url" -H 'Content-Type: application/json')
  if [ -n "$token" ]; then
    args+=(-H "Authorization: Bearer $token")
  fi
  if [ -n "$data" ]; then
    args+=(--data "$data")
  fi
  curl "${args[@]}" > "$statusfile" 2>/dev/null
}

req_bg_file() {
  local method="$1" url="$2" bodyfile="$3" statusfile="$4" datafile="$5" token="${6:-}"
  local args=(-sS -o "$bodyfile" -w '%{http_code}' --max-time 60 -X "$method" "$url" -H 'Content-Type: application/json')
  if [ -n "$token" ]; then
    args+=(-H "Authorization: Bearer $token")
  fi
  args+=(--data "@$datafile")
  curl "${args[@]}" > "$statusfile" 2>/dev/null
}

pass() { PASS=$((PASS+1)); echo "[PASS] $1"; [ -n "${2:-}" ] && echo "       $2"; }
fail() { FAIL=$((FAIL+1)); echo "[FAIL] $1"; [ -n "${2:-}" ] && echo "       $2"; }

# Crude JSON value extractor for "key":"value" or "key":value (numbers/bools/null).
jget() {
  local file="$1" key="$2"
  local v
  v=$(grep -o "\"$key\":\"[^\"]*\"" "$file" | head -n1 | sed -E "s/\"$key\":\"([^\"]*)\"/\1/")
  if [ -n "$v" ]; then echo "$v"; return; fi
  v=$(grep -oE "\"$key\":[^,}]+" "$file" | head -n1 | sed -E "s/\"$key\"://; s/^[ ]+//; s/[ ]+$//")
  echo "$v"
}

# Count occurrences of a literal substring in a file (used to count user IDs in /classes/:id).
ccount() { grep -o "$2" "$1" 2>/dev/null | wc -l | tr -d ' '; }

# Convert a Unix-ish path to whatever Python expects on this OS. On Git-Bash for Windows,
# python3 resolves paths in Windows-land, so /tmp/... won't be found. cygpath -w fixes that.
to_py_path() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -w "$1"
  else
    echo "$1"
  fi
}

# Count student-role enrollments in a /classes/:id response, robustly (avoids
# matching the embedded user.role:"student"). Uses python because grepping
# ambiguous JSON gives double-counts.
count_student_enrollments() {
  local f="$1"
  local pf
  pf=$(to_py_path "$f")
  python3 -c "
import json,sys
try:
    d=json.load(open(r'$pf'))
except Exception as e:
    print(0); sys.exit(0)
e=d.get('enrollments',[])
print(sum(1 for x in e if x.get('role')=='student'))
" 2>/dev/null
}

TMP="$(mktemp -d 2>/dev/null || mktemp -d -t t5)"
echo "tmp=$TMP api=$API ts=$TS prefix=$PREFIX"
echo "============================================="

# --- Login admin ---
ADMIN_BODY="$TMP/admin_login.json"
ADMIN_STATUS=$(req POST "$API/api/auth/login" "$ADMIN_BODY" '{"email":"admin@school.local","password":"admin123"}')
echo "admin_login: status=$ADMIN_STATUS"
if [ "$ADMIN_STATUS" != "200" ] && [ "$ADMIN_STATUS" != "201" ]; then
  fail "admin login" "got status $ADMIN_STATUS body=$(cat "$ADMIN_BODY")"
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

# --- Setup: create class ---
CLASS_NAME="${PREFIX}-class-${TS}"
CLASS_CODE="${PREFIX}CC${TS}"
CLS_BODY="$TMP/class.json"
CLS_STATUS=$(req POST "$API/api/classes" "$CLS_BODY" \
  "$(printf '{"name":"%s","classCode":"%s","level":"AS"}' "$CLASS_NAME" "$CLASS_CODE")" "$ADMIN_TOKEN")
CLASS_ID=$(jget "$CLS_BODY" id)
echo "create_class: status=$CLS_STATUS id=$CLASS_ID"
if [ -z "$CLASS_ID" ]; then
  fail "setup: create class" "$(cat "$CLS_BODY")"
  exit 1
fi

# --- Setup: enroll one primary student via roster ---
STU_EMAIL="${PREFIX}-stu-${TS}@example.com"
STU_BODY="$TMP/stu.json"
STU_DATA="$(printf '{"students":[{"email":"%s","name":"T5 Student","password":"test1234"}]}' "$STU_EMAIL")"
STU_STATUS=$(req POST "$API/api/classes/$CLASS_ID/roster" "$STU_BODY" "$STU_DATA" "$ADMIN_TOKEN")
echo "enroll_student: status=$STU_STATUS body=$(cat "$STU_BODY")"
if [ "$STU_STATUS" != "200" ] && [ "$STU_STATUS" != "201" ]; then
  fail "setup: enroll primary student" "$STU_STATUS $(cat "$STU_BODY")"
  exit 1
fi

# --- Setup: find a paper with >=2 questions ---
PAPERS_BODY="$TMP/papers.json"
PAPERS_STATUS=$(req GET "$API/api/papers" "$PAPERS_BODY" "" "$ADMIN_TOKEN")
echo "list_papers: status=$PAPERS_STATUS bytes=$(wc -c < "$PAPERS_BODY")"
# Take first paper id we can find. Then GET /papers/:id and check question count.
PAPER_ID=""
for pid in $(grep -oE '"id":"[^"]+"' "$PAPERS_BODY" | sed -E 's/"id":"([^"]+)"/\1/'); do
  PD_BODY="$TMP/paper_${pid}.json"
  pd_status=$(req GET "$API/api/papers/$pid" "$PD_BODY" "" "$ADMIN_TOKEN")
  if [ "$pd_status" != "200" ]; then continue; fi
  qcount=$(grep -oE '"paperQuestion[^"]*"' "$PD_BODY" | wc -l | tr -d ' ')
  pqcount=$(grep -oE '"paperId":"[^"]*"' "$PD_BODY" | wc -l | tr -d ' ')
  # Count by paperQuestion ids: each PaperQuestion has its own id; better: count snapshotContent occurrences
  scount=$(grep -oE '"snapshotContent"' "$PD_BODY" | wc -l | tr -d ' ')
  echo "paper $pid pqCount(approx by snapshotContent)=$scount"
  if [ "$scount" -ge 2 ]; then
    PAPER_ID="$pid"
    PAPER_DETAIL="$PD_BODY"
    break
  fi
done
if [ -z "$PAPER_ID" ]; then
  fail "setup: find paper with >=2 questions" "no eligible paper in $PAPERS_BODY"
  exit 1
fi
echo "found paper_id=$PAPER_ID"

# Extract two paperQuestion ids from PAPER_DETAIL.
# Use python if available for robustness, else fall back to grep.
PQ_LIST=""
PD_PY=$(to_py_path "$PAPER_DETAIL")
if command -v python3 >/dev/null 2>&1; then
  PQ_LIST=$(python3 -c "
import json,sys
d=json.load(open(r'$PD_PY'))
qs=d.get('questions',[])
print(' '.join(q['id'] for q in qs[:5]))
" 2>/dev/null || true)
fi
if [ -z "$PQ_LIST" ]; then
  # Fallback: skip the first id (which is the paper itself) and take the next two.
  PQ_LIST=$(grep -oE '"id":"c[a-z0-9]{10,}"' "$PAPER_DETAIL" | sed -E 's/"id":"([^"]+)"/\1/' | sed -n '2,4p' | tr '\n' ' ')
fi
PQ1=$(echo "$PQ_LIST" | awk '{print $1}')
PQ2=$(echo "$PQ_LIST" | awk '{print $2}')
echo "pq1=$PQ1 pq2=$PQ2"
if [ -z "$PQ1" ] || [ -z "$PQ2" ]; then
  fail "setup: extract pq ids" "PQ_LIST=$PQ_LIST"
  exit 1
fi

# --- Setup: assign paper to class ---
ASSIGN_BODY="$TMP/assign.json"
ASSIGN_DATA="$(printf '{"classId":"%s"}' "$CLASS_ID")"
ASSIGN_STATUS=$(req POST "$API/api/papers/$PAPER_ID/assign" "$ASSIGN_BODY" "$ASSIGN_DATA" "$ADMIN_TOKEN")
echo "assign: status=$ASSIGN_STATUS body=$(cat "$ASSIGN_BODY")"
ASSIGNMENT_ID=$(jget "$ASSIGN_BODY" id)
if [ -z "$ASSIGNMENT_ID" ]; then
  # Maybe already assigned from prior run — list student assignments to find it
  echo "assignment id not found, will try lookup via student"
fi

# --- Setup: student login ---
STU_LOGIN="$TMP/stu_login.json"
STU_LOGIN_STATUS=$(req POST "$API/api/auth/login" "$STU_LOGIN" "$(printf '{"email":"%s","password":"test1234"}' "$STU_EMAIL")")
STUDENT_TOKEN=$(jget "$STU_LOGIN" token)
echo "student_login: status=$STU_LOGIN_STATUS token_len=${#STUDENT_TOKEN}"
if [ -z "$STUDENT_TOKEN" ]; then
  fail "setup: student login" "$(cat "$STU_LOGIN")"
  exit 1
fi

# If assignment id was empty, get it via student listing
if [ -z "$ASSIGNMENT_ID" ]; then
  SA_BODY="$TMP/student_assignments.json"
  req GET "$API/api/student/assignments" "$SA_BODY" "" "$STUDENT_TOKEN" >/dev/null
  ASSIGNMENT_ID=$(grep -oE '"id":"c[a-z0-9]{10,}"' "$SA_BODY" | head -1 | sed -E 's/"id":"([^"]+)"/\1/')
  echo "assignment_id (recovered)=$ASSIGNMENT_ID"
fi
if [ -z "$ASSIGNMENT_ID" ]; then
  fail "setup: assignment id" "$(cat "$ASSIGN_BODY")"
  exit 1
fi

echo "============================================="
echo "Setup done. class=$CLASS_ID paper=$PAPER_ID assignment=$ASSIGNMENT_ID"
echo "============================================="

###############################################################
# TEST 1: bulk-roster idempotency under concurrency
###############################################################
echo
echo "=== TEST 1: bulk-roster idempotency under concurrency ==="
ROSTER_DATA="$TMP/roster_data.json"
{
  printf '{"students":['
  for i in 1 2 3 4 5; do
    [ $i -gt 1 ] && printf ','
    printf '{"email":"%s-bulk-%d-%s@example.com","name":"T5 Bulk %d","password":"test1234"}' "$PREFIX" "$i" "$TS" "$i"
  done
  printf ']}'
} > "$ROSTER_DATA"

# Sequential first
SEQ_BODY="$TMP/roster_seq.json"
SEQ_STATUS=$(req_file POST "$API/api/classes/$CLASS_ID/roster" "$SEQ_BODY" "$ROSTER_DATA" "$ADMIN_TOKEN")
echo "roster seq: status=$SEQ_STATUS body=$(cat "$SEQ_BODY")"

# 3 parallel calls with the SAME body
for i in 1 2 3; do
  req_bg_file POST "$API/api/classes/$CLASS_ID/roster" \
    "$TMP/roster_par_$i.json" "$TMP/roster_par_$i.status" \
    "$ROSTER_DATA" "$ADMIN_TOKEN" &
done
wait

T1_HAS_500=0
for i in 1 2 3; do
  s=$(cat "$TMP/roster_par_$i.status")
  echo "roster par[$i]: status=$s body=$(head -c 200 "$TMP/roster_par_$i.json")"
  if [ "$s" = "500" ]; then T1_HAS_500=1; fi
done

# Verify enrollment count
GETCLS_BODY="$TMP/class_after.json"
req GET "$API/api/classes/$CLASS_ID" "$GETCLS_BODY" "" "$ADMIN_TOKEN" >/dev/null
ENROLL_STU=$(count_student_enrollments "$GETCLS_BODY")
echo "enrollment student-role count after parallel = $ENROLL_STU (expected: 6 = 1 primary + 5 bulk)"

if [ "$T1_HAS_500" = "1" ]; then
  fail "T1 bulk-roster idempotency" "got 500 from at least one parallel call"
elif [ "$ENROLL_STU" -ne 6 ]; then
  fail "T1 bulk-roster idempotency" "expected 6 student enrollments, got $ENROLL_STU"
else
  pass "T1 bulk-roster idempotency under concurrency" "exactly 6 enrollments, no 500s across 3 parallel POSTs"
fi

###############################################################
# TEST 2: openSubmission idempotency under concurrency
###############################################################
echo
echo "=== TEST 2: openSubmission idempotency under concurrency ==="
OPEN_DATA="$(printf '{"assignmentId":"%s"}' "$ASSIGNMENT_ID")"

for i in 1 2 3 4 5; do
  req_bg POST "$API/api/student/submissions" \
    "$TMP/open_$i.json" "$TMP/open_$i.status" \
    "$OPEN_DATA" "$STUDENT_TOKEN" &
done
wait

T2_HAS_500=0
T2_IDS=""
for i in 1 2 3 4 5; do
  s=$(cat "$TMP/open_$i.status")
  bid=$(jget "$TMP/open_$i.json" id)
  echo "open[$i]: status=$s id=$bid"
  if [ "$s" = "500" ]; then T2_HAS_500=1; fi
  if [ -n "$bid" ]; then T2_IDS="$T2_IDS $bid"; fi
done

UNIQUE_IDS=$(echo "$T2_IDS" | tr ' ' '\n' | sort -u | grep -v '^$' | wc -l | tr -d ' ')
echo "open unique submission ids = $UNIQUE_IDS (expected 1)"

if [ "$T2_HAS_500" = "1" ]; then
  fail "T2 openSubmission idempotency" "got 500 from at least one parallel call (likely Prisma duplicate-key leaking)"
elif [ "$UNIQUE_IDS" -ne 1 ]; then
  fail "T2 openSubmission idempotency" "expected 1 unique submission id across 5 parallel calls, got $UNIQUE_IDS ids: $T2_IDS"
else
  pass "T2 openSubmission idempotency under concurrency" "all 5 parallel POSTs returned the same submission id"
fi

# Capture submission id for later tests (any of the open responses)
SUB_ID=$(jget "$TMP/open_1.json" id)
if [ -z "$SUB_ID" ]; then
  for i in 2 3 4 5; do
    SUB_ID=$(jget "$TMP/open_$i.json" id)
    [ -n "$SUB_ID" ] && break
  done
fi
echo "submission_id=$SUB_ID"
if [ -z "$SUB_ID" ]; then
  fail "setup: capture submission id" "$(cat "$TMP/open_1.json")"
  exit 1
fi

###############################################################
# TEST 3: autosave race
###############################################################
echo
echo "=== TEST 3: autosave race (5 parallel PATCH on same pq) ==="
LETTERS=("A" "B" "C" "D" "A")
for i in 0 1 2 3 4; do
  L="${LETTERS[$i]}"
  D="$(printf '{"paperQuestionId":"%s","selectedOption":"%s"}' "$PQ1" "$L")"
  req_bg PATCH "$API/api/student/submissions/$SUB_ID/scripts" \
    "$TMP/save_$i.json" "$TMP/save_$i.status" \
    "$D" "$STUDENT_TOKEN" &
done
wait

T3_HAS_500=0
T3_NON_2XX=0
for i in 0 1 2 3 4; do
  s=$(cat "$TMP/save_$i.status")
  echo "save[$i]: status=$s body=$(head -c 200 "$TMP/save_$i.json")"
  if [ "$s" = "500" ]; then T3_HAS_500=1; fi
  case "$s" in 2*) ;; *) T3_NON_2XX=$((T3_NON_2XX+1));; esac
done

# GET submission and count scripts for PQ1
GETSUB_BODY="$TMP/sub_after_race.json"
req GET "$API/api/student/submissions/$SUB_ID" "$GETSUB_BODY" "" "$STUDENT_TOKEN" >/dev/null
PQ1_SCRIPT_COUNT=$(grep -oE "\"paperQuestionId\":\"$PQ1\"" "$GETSUB_BODY" | wc -l | tr -d ' ')
PQ1_VALUE=""
GS_PY=$(to_py_path "$GETSUB_BODY")
if command -v python3 >/dev/null 2>&1; then
  PQ1_VALUE=$(python3 -c "
import json
d=json.load(open(r'$GS_PY'))
for s in d.get('scripts',[]):
    if s.get('paperQuestionId')=='$PQ1':
        print(s.get('selectedOption') or '')
        break
" 2>/dev/null || true)
fi
echo "PQ1 script count after race = $PQ1_SCRIPT_COUNT (expected 1) value=$PQ1_VALUE"

if [ "$T3_HAS_500" = "1" ]; then
  fail "T3 autosave race" "got 500 from at least one parallel PATCH"
elif [ "$T3_NON_2XX" -gt 0 ]; then
  fail "T3 autosave race" "$T3_NON_2XX of 5 PATCHes returned non-2xx"
elif [ "$PQ1_SCRIPT_COUNT" -ne 1 ]; then
  fail "T3 autosave race" "expected 1 AnswerScript row for pq, got $PQ1_SCRIPT_COUNT — duplicate rows leaked through @@unique"
else
  case "$PQ1_VALUE" in
    A|B|C|D)
      pass "T3 autosave race" "single row, value=$PQ1_VALUE, no 500s, all 2xx (last-write-wins acceptable)"
      ;;
    *)
      fail "T3 autosave race" "single row but value is unexpected '$PQ1_VALUE'"
      ;;
  esac
fi

###############################################################
# TEST 4: double-submit
###############################################################
echo
echo "=== TEST 4: double-submit ==="
# Save an answer for PQ2 first so submission has content
SAVE2_BODY="$TMP/save_pq2.json"
SAVE2_DATA="$(printf '{"paperQuestionId":"%s","selectedOption":"A"}' "$PQ2")"
SAVE2_STATUS=$(req PATCH "$API/api/student/submissions/$SUB_ID/scripts" "$SAVE2_BODY" "$SAVE2_DATA" "$STUDENT_TOKEN")
echo "save pq2 prefatory: status=$SAVE2_STATUS"

# Two parallel submits
for i in 1 2; do
  req_bg POST "$API/api/student/submissions/$SUB_ID/submit" \
    "$TMP/sub_$i.json" "$TMP/sub_$i.status" \
    "" "$STUDENT_TOKEN" &
done
wait

S1=$(cat "$TMP/sub_1.status")
S2=$(cat "$TMP/sub_2.status")
echo "submit[1]: status=$S1 body=$(head -c 300 "$TMP/sub_1.json")"
echo "submit[2]: status=$S2 body=$(head -c 300 "$TMP/sub_2.json")"

T4_2XX=0
T4_4XX=0
T4_5XX=0
for s in "$S1" "$S2"; do
  case "$s" in
    2*) T4_2XX=$((T4_2XX+1));;
    4*) T4_4XX=$((T4_4XX+1));;
    5*) T4_5XX=$((T4_5XX+1));;
  esac
done

# Check autoScore present once and not double
GETSUB_AFTER="$TMP/sub_after_submit.json"
req GET "$API/api/student/submissions/$SUB_ID" "$GETSUB_AFTER" "" "$STUDENT_TOKEN" >/dev/null
AS_AFTER=$(jget "$GETSUB_AFTER" autoScore)
STATUS_AFTER=$(jget "$GETSUB_AFTER" status)
echo "after submit: status=$STATUS_AFTER autoScore=$AS_AFTER"

if [ "$T4_5XX" -gt 0 ]; then
  fail "T4 double-submit" "got 5xx (T4_5XX=$T4_5XX) — should have been 4xx race-loser"
elif [ "$T4_2XX" -ne 1 ] || [ "$T4_4XX" -ne 1 ]; then
  fail "T4 double-submit" "expected exactly one 2xx + one 4xx, got 2xx=$T4_2XX 4xx=$T4_4XX"
elif [ "$STATUS_AFTER" != "submitted" ]; then
  fail "T4 double-submit" "post-submit status not 'submitted', got '$STATUS_AFTER'"
else
  pass "T4 double-submit" "exactly 1 success + 1 4xx; status=submitted; autoScore=$AS_AFTER"
fi

###############################################################
# TEST 5: autosave-after-submit race
###############################################################
echo
echo "=== TEST 5: autosave-after-submit race ==="
# Submission is already submitted from T4. Capture autoScore snapshot.
PRE_AS="$AS_AFTER"

for i in 1 2 3; do
  D="$(printf '{"paperQuestionId":"%s","selectedOption":"D"}' "$PQ1")"
  req_bg PATCH "$API/api/student/submissions/$SUB_ID/scripts" \
    "$TMP/locked_$i.json" "$TMP/locked_$i.status" \
    "$D" "$STUDENT_TOKEN" &
done
wait

T5_OK_4XX=0
T5_OTHER=0
for i in 1 2 3; do
  s=$(cat "$TMP/locked_$i.status")
  echo "locked-patch[$i]: status=$s body=$(head -c 200 "$TMP/locked_$i.json")"
  case "$s" in
    4*) T5_OK_4XX=$((T5_OK_4XX+1));;
    *) T5_OTHER=$((T5_OTHER+1));;
  esac
done

# Verify state unchanged
req GET "$API/api/student/submissions/$SUB_ID" "$TMP/sub_after_locked.json" "" "$STUDENT_TOKEN" >/dev/null
POST_STATUS=$(jget "$TMP/sub_after_locked.json" status)
POST_AS=$(jget "$TMP/sub_after_locked.json" autoScore)
echo "after locked patches: status=$POST_STATUS autoScore=$POST_AS (was=$PRE_AS)"

if [ "$T5_OK_4XX" -ne 3 ]; then
  fail "T5 autosave-after-submit race" "expected all 3 PATCHes 4xx, got 4xx=$T5_OK_4XX other=$T5_OTHER"
elif [ "$POST_STATUS" != "submitted" ] || [ "$POST_AS" != "$PRE_AS" ]; then
  fail "T5 autosave-after-submit race" "state mutated: status=$POST_STATUS autoScore=$POST_AS (pre=$PRE_AS)"
else
  pass "T5 autosave-after-submit race" "all 3 PATCHes 4xx and submission unchanged"
fi

###############################################################
# TEST 6: body-size edge (200KB textAnswer)
###############################################################
echo
echo "=== TEST 6: body-size edge ==="
# Need a fresh in-progress submission. Make a new student so we can open a new one.
STU2_EMAIL="${PREFIX}-stu2-${TS}@example.com"
STU2_DATA="$(printf '{"students":[{"email":"%s","name":"T5 Stu2","password":"test1234"}]}' "$STU2_EMAIL")"
req POST "$API/api/classes/$CLASS_ID/roster" "$TMP/stu2_roster.json" "$STU2_DATA" "$ADMIN_TOKEN" >/dev/null
req POST "$API/api/auth/login" "$TMP/stu2_login.json" "$(printf '{"email":"%s","password":"test1234"}' "$STU2_EMAIL")" >/dev/null
STU2_TOKEN=$(jget "$TMP/stu2_login.json" token)
req POST "$API/api/student/submissions" "$TMP/sub2_open.json" "$OPEN_DATA" "$STU2_TOKEN" >/dev/null
SUB2_ID=$(jget "$TMP/sub2_open.json" id)
echo "stu2 sub_id=$SUB2_ID"

# Build a 200KB string
BIG_STR=$(printf 'x%.0s' $(seq 1 200000))
BIG_DATA="$TMP/big.json"
{
  printf '{"paperQuestionId":"%s","textAnswer":"' "$PQ1"
  printf '%s' "$BIG_STR"
  printf '"}'
} > "$BIG_DATA"
echo "big payload size = $(wc -c < "$BIG_DATA")"

BIG_BODY="$TMP/big_resp.json"
BIG_STATUS=$(req_file PATCH "$API/api/student/submissions/$SUB2_ID/scripts" "$BIG_BODY" "$BIG_DATA" "$STU2_TOKEN")
echo "big-payload: status=$BIG_STATUS body_excerpt=$(head -c 200 "$BIG_BODY")"

case "$BIG_STATUS" in
  200|201|413|400|414)
    pass "T6 body-size edge" "status=$BIG_STATUS — graceful (no 500)"
    ;;
  500|502|503|504)
    fail "T6 body-size edge" "got $BIG_STATUS — server errored on large payload"
    ;;
  *)
    # Note schema caps textAnswer at 20000 in zod. So 400 expected. Anything that's not 5xx is OK per spec.
    pass "T6 body-size edge" "status=$BIG_STATUS — non-5xx accepted"
    ;;
esac

###############################################################
# TEST 7: roster-bulk volume (50 students)
###############################################################
echo
echo "=== TEST 7: roster-bulk volume (50 students) ==="
VOL_DATA="$TMP/vol_data.json"
{
  printf '{"students":['
  for i in $(seq 1 50); do
    [ $i -gt 1 ] && printf ','
    printf '{"email":"%s-vol-%d-%s@example.com","name":"T5 Vol %d","password":"test1234"}' "$PREFIX" "$i" "$TS" "$i"
  done
  printf ']}'
} > "$VOL_DATA"
echo "vol payload size = $(wc -c < "$VOL_DATA")"

T7_BODY="$TMP/vol_resp.json"
T7_START=$(date +%s)
T7_STATUS=$(req_file POST "$API/api/classes/$CLASS_ID/roster" "$T7_BODY" "$VOL_DATA" "$ADMIN_TOKEN")
T7_END=$(date +%s)
T7_ELAPSED=$((T7_END - T7_START))
echo "vol roster: status=$T7_STATUS elapsed=${T7_ELAPSED}s body=$(cat "$T7_BODY")"

# Re-fetch class enrollments
req GET "$API/api/classes/$CLASS_ID" "$TMP/class_vol.json" "" "$ADMIN_TOKEN" >/dev/null
ENROLL_VOL=$(count_student_enrollments "$TMP/class_vol.json")
# Expected = 1 primary + 1 stu2 + 5 bulk + 50 vol = 57
echo "enrollment student count after vol = $ENROLL_VOL (expected 57)"

if [ "$T7_STATUS" != "200" ] && [ "$T7_STATUS" != "201" ]; then
  fail "T7 roster-bulk volume" "status=$T7_STATUS body=$(cat "$T7_BODY")"
elif [ "$T7_ELAPSED" -gt 60 ]; then
  fail "T7 roster-bulk volume" "took ${T7_ELAPSED}s (>60s threshold)"
elif [ "$ENROLL_VOL" -lt 57 ]; then
  fail "T7 roster-bulk volume" "expected >=57 enrollments, got $ENROLL_VOL"
else
  pass "T7 roster-bulk volume" "50 students enrolled in ${T7_ELAPSED}s (total student enrollments=$ENROLL_VOL)"
fi

echo
echo "============================================="
echo "T5 SUMMARY: PASS=$PASS FAIL=$FAIL"
echo "tmp=$TMP"
echo "============================================="
exit $FAIL
