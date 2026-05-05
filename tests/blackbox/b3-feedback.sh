#!/usr/bin/env bash
# B3 — AI question quality feedback round-trip
#   1. Log signals via POST /quality/question/:id/signal
#   2. Verify aggregate score via GET /quality/question/:id/score
#   3. Verify topic leaderboard via GET /quality/topic/:topicId/leaderboard
#   4. Verify ai-prompt-suggestions output shape via
#      GET /quality/ai-prompt-suggestions?topicId=...
# Target: deployed exam-paper-system on Railway (override BASE for local).
set -u

BASE="${BASE:-https://exam-paper-system-production.up.railway.app}"
TS="$(date +%s)"
PFX="b3-${TS}"

PASS=0
FAIL=0
declare -a RESULTS

# helpers ------------------------------------------------------------
hr() { printf '\n%s\n' "----------------------------------------------------------"; }
log() { printf '[b3] %s\n' "$*"; }

# req METHOD URL TOKEN BODY
# echoes "<status>|<body>"
req() {
  local m="$1" u="$2" t="${3:-}" b="${4:-}"
  local args=(-s -o /tmp/b3_body -w '%{http_code}' -X "$m" "$u" -H 'Content-Type: application/json')
  [ -n "$t" ] && args+=(-H "Authorization: Bearer $t")
  if [ -n "$b" ]; then args+=(--data "$b"); fi
  local code
  code=$(curl "${args[@]}")
  local body
  body=$(cat /tmp/b3_body 2>/dev/null || echo '')
  printf '%s|%s' "$code" "$body"
}

record() {
  local id="$1" name="$2" expected="$3" got="$4" sev="$5" verdict="$6"
  RESULTS+=("${id}|${name}|${expected}|${got}|${sev}|${verdict}")
  if [ "$verdict" = "PASS" ]; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi
  log "[$verdict][$sev] $id $name -- expected=$expected got=$got"
}

extract() { # extract simple JSON field: extract '"id"' "$body"
  local key="$1" body="$2"
  printf '%s' "$body" | grep -o "${key}:\"[^\"]*\"" | head -n1 | sed 's/.*:"\([^"]*\)".*/\1/'
}

extract_num() { # extract numeric JSON field: extract_num '"score"' body
  local key="$1" body="$2"
  printf '%s' "$body" | grep -oE "${key}:-?[0-9]+(\.[0-9]+)?" | head -n1 | sed "s/${key}://"
}

# ======================================================================
log "BASE=$BASE"
log "Prefix=$PFX"
hr

# 1. Admin login -------------------------------------------------------
log "Admin login..."
R=$(req POST "$BASE/api/auth/login" "" "{\"email\":\"admin@school.local\",\"password\":\"admin123\"}")
ADMIN_CODE="${R%%|*}"; ADMIN_BODY="${R#*|}"
if [ "$ADMIN_CODE" != "201" ] && [ "$ADMIN_CODE" != "200" ]; then
  log "FATAL: admin login failed code=$ADMIN_CODE body=$ADMIN_BODY"; exit 1
fi
ADMIN_TOKEN=$(printf '%s' "$ADMIN_BODY" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
log "Admin token obtained (len=${#ADMIN_TOKEN})"

# 2. Pick a Question (and its primary topic) from /questions -----------
log "Fetch a Question id + topic id"
R=$(req GET "$BASE/api/questions?pageSize=5" "$ADMIN_TOKEN" "")
Q_CODE="${R%%|*}"; Q_BODY="${R#*|}"
if [ "$Q_CODE" != "200" ]; then
  log "FATAL: list questions failed code=$Q_CODE"; exit 1
fi
QID=$(printf '%s' "$Q_BODY" | grep -oE '"id":"[a-z0-9]+"' | head -n1 | cut -d'"' -f4)
TOPIC_ID=$(printf '%s' "$Q_BODY" | grep -oE '"primaryTopicId":"[a-z0-9]+"' | head -n1 | cut -d'"' -f4)
log "QID=$QID  TOPIC_ID=$TOPIC_ID"
if [ -z "$QID" ] || [ -z "$TOPIC_ID" ]; then
  log "FATAL: no Question with primaryTopicId available; seed the DB first."
  exit 1
fi

# ======================================================================
# A. Signal logging round-trip
# ======================================================================
hr
log "====== A. Signal logging ======"

# A1. Valid signal types each return 2xx
for sig in approved rejected edited answered_correct answered_wrong skipped; do
  log "TEST A1.$sig — POST /quality/question/$QID/signal {$sig}"
  R=$(req POST "$BASE/api/quality/question/$QID/signal" "$ADMIN_TOKEN" "{\"signalType\":\"$sig\",\"meta\":{\"src\":\"$PFX\"}}")
  C="${R%%|*}"; B="${R#*|}"
  log "  -> code=$C body=${B:0:160}"
  if [ "$C" = "200" ] || [ "$C" = "201" ]; then v=PASS; else v=FAIL; fi
  record "A1.$sig" "POST signal $sig" "200/201" "$C" "HIGH" "$v"
done

# A2. Bad signal type -> 400
log "TEST A2 — bad signalType rejected"
R=$(req POST "$BASE/api/quality/question/$QID/signal" "$ADMIN_TOKEN" "{\"signalType\":\"NONSENSE\"}")
C="${R%%|*}"; B="${R#*|}"
log "  -> code=$C body=${B:0:160}"
if [ "$C" = "400" ]; then v=PASS; else v=FAIL; fi
record "A2" "Bad signalType rejected" "400" "$C" "HIGH" "$v"

# A3. Unknown question -> 404
log "TEST A3 — unknown questionId rejected"
R=$(req POST "$BASE/api/quality/question/zzzzzzzznotrealcid/signal" "$ADMIN_TOKEN" "{\"signalType\":\"approved\"}")
C="${R%%|*}"; B="${R#*|}"
log "  -> code=$C body=${B:0:160}"
if [ "$C" = "404" ]; then v=PASS; else v=FAIL; fi
record "A3" "Unknown questionId" "404" "$C" "MEDIUM" "$v"

# ======================================================================
# B. Score aggregation
# ======================================================================
hr
log "====== B. Aggregate score ======"

log "TEST B1 — GET /quality/question/$QID/score"
R=$(req GET "$BASE/api/quality/question/$QID/score" "$ADMIN_TOKEN" "")
C="${R%%|*}"; B="${R#*|}"
log "  -> code=$C body=${B:0:300}"
if [ "$C" = "200" ]; then
  HAS_SCORE=$(printf '%s' "$B" | grep -c '"score"')
  HAS_COUNTS=$(printf '%s' "$B" | grep -c '"counts"')
  HAS_TOTAL=$(printf '%s' "$B" | grep -c '"totalSignals"')
  if [ "$HAS_SCORE" -gt 0 ] && [ "$HAS_COUNTS" -gt 0 ] && [ "$HAS_TOTAL" -gt 0 ]; then v=PASS; else v=FAIL; fi
else v=FAIL; fi
record "B1" "Score response shape" "200 + score/counts/totalSignals" "$C" "HIGH" "$v"

# B2. After 6 signals (1 of each), expected default-weight sum:
#   +1.0 -2.0 -0.5 +0.2 -0.2 -0.1 = -1.6
# We just check the score is finite and counts add to >=6.
SCORE=$(extract_num '"score"' "$B")
COUNT_TOTAL=$(extract_num '"totalSignals"' "$B")
log "  parsed score=$SCORE totalSignals=$COUNT_TOTAL"
if [ -n "$SCORE" ] && [ -n "$COUNT_TOTAL" ] && [ "$COUNT_TOTAL" -ge 6 ]; then v=PASS; else v=FAIL; fi
record "B2" "Score reflects logged signals" ">=6 signals, numeric score" "score=$SCORE n=$COUNT_TOTAL" "HIGH" "$v"

# ======================================================================
# C. Leaderboard
# ======================================================================
hr
log "====== C. Topic leaderboard ======"

log "TEST C1 — GET /quality/topic/$TOPIC_ID/leaderboard"
R=$(req GET "$BASE/api/quality/topic/$TOPIC_ID/leaderboard?limit=5" "$ADMIN_TOKEN" "")
C="${R%%|*}"; B="${R#*|}"
log "  -> code=$C body=${B:0:400}"
if [ "$C" = "200" ]; then
  HAS_TOP=$(printf '%s' "$B" | grep -c '"top"')
  HAS_BOT=$(printf '%s' "$B" | grep -c '"bottom"')
  HAS_TOPIC=$(printf '%s' "$B" | grep -c '"topic"')
  CONTAINS_QID=$(printf '%s' "$B" | grep -c "\"$QID\"")
  if [ "$HAS_TOP" -gt 0 ] && [ "$HAS_BOT" -gt 0 ] && [ "$HAS_TOPIC" -gt 0 ] && [ "$CONTAINS_QID" -gt 0 ]; then v=PASS; else v=FAIL; fi
else v=FAIL; fi
record "C1" "Leaderboard response shape & contains test qid" "200 + top/bottom/topic + qid" "$C top=$HAS_TOP bot=$HAS_BOT inc=$CONTAINS_QID" "HIGH" "$v"

# ======================================================================
# D. AI prompt suggestions
# ======================================================================
hr
log "====== D. AI prompt suggestions ======"

log "TEST D1 — GET /quality/ai-prompt-suggestions?topicId=$TOPIC_ID"
R=$(req GET "$BASE/api/quality/ai-prompt-suggestions?topicId=$TOPIC_ID" "$ADMIN_TOKEN" "")
C="${R%%|*}"; B="${R#*|}"
log "  -> code=$C body=${B:0:400}"
if [ "$C" = "200" ]; then
  HAS_SUGG=$(printf '%s' "$B" | grep -c '"suggestions"')
  HAS_TOPIC=$(printf '%s' "$B" | grep -c '"topic"')
  HAS_STATS=$(printf '%s' "$B" | grep -c '"stats"')
  if [ "$HAS_SUGG" -gt 0 ] && [ "$HAS_TOPIC" -gt 0 ] && [ "$HAS_STATS" -gt 0 ]; then v=PASS; else v=FAIL; fi
else v=FAIL; fi
record "D1" "Suggestions response shape" "200 + topic/suggestions/stats" "$C suggKey=$HAS_SUGG topicKey=$HAS_TOPIC statsKey=$HAS_STATS" "HIGH" "$v"

log "TEST D2 — missing topicId rejected"
R=$(req GET "$BASE/api/quality/ai-prompt-suggestions" "$ADMIN_TOKEN" "")
C="${R%%|*}"; B="${R#*|}"
log "  -> code=$C body=${B:0:160}"
if [ "$C" = "400" ]; then v=PASS; else v=FAIL; fi
record "D2" "Missing topicId rejected" "400" "$C" "MEDIUM" "$v"

# ======================================================================
# E. Authz — student must NOT reach /quality (HIGH)
# ======================================================================
hr
log "====== E. Authz ======"

# Try to find or create a student. We just probe with no token / invalid token
# to confirm the route requires auth at minimum. Full role-block coverage is
# in t4-authz.sh; here we add a single belt-and-braces check.
log "TEST E1 — no-auth GET /quality/question/.../score"
R=$(req GET "$BASE/api/quality/question/$QID/score" "" "")
C="${R%%|*}"; B="${R#*|}"
log "  -> code=$C body=${B:0:160}"
if [ "$C" = "401" ]; then v=PASS; else v=FAIL; fi
record "E1" "Score requires auth" "401" "$C" "HIGH" "$v"

log "TEST E2 — no-auth POST /quality/question/.../signal"
R=$(req POST "$BASE/api/quality/question/$QID/signal" "" "{\"signalType\":\"approved\"}")
C="${R%%|*}"; B="${R#*|}"
log "  -> code=$C body=${B:0:160}"
if [ "$C" = "401" ]; then v=PASS; else v=FAIL; fi
record "E2" "Signal log requires auth" "401" "$C" "HIGH" "$v"

# ======================================================================
# Summary
# ======================================================================
hr
log "====== SUMMARY ======"
log "PASS=$PASS FAIL=$FAIL TOTAL=$((PASS+FAIL))"
printf '\n| ID | Test | Severity | Expected | Got | Verdict |\n'
printf '|---|---|---|---|---|---|\n'
for line in "${RESULTS[@]}"; do
  IFS='|' read -r id name expected got sev verdict <<< "$line"
  printf '| %s | %s | %s | %s | %s | %s |\n' "$id" "$name" "$sev" "$expected" "$got" "$verdict"
done
hr
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
