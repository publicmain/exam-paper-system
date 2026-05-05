#!/usr/bin/env bash
# B6 Blackbox tests — AI cost dashboard + RBAC admin management.
#
# Verifies:
#   - admin-cost endpoints return well-shaped JSON (admin only)
#   - admin-rbac /users list pagination
#   - admin-rbac PATCH role + isActive
#   - reset-password never echoes plaintext, never echoes a hash
#   - LOCKOUT PROTECTION: admin demoting *self* to non-admin -> 400
#   - LOCKOUT PROTECTION: admin deactivating *self*           -> 400
#   - role gating: teacher cannot reach any /admin-cost or /admin-rbac route
#
# Isolation: creates two test users with the t6- prefix and tears them
# down at the end (best-effort). Reads existing admin creds from env.
set -u

BASE="${BASE:-https://exam-paper-system-production.up.railway.app}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@school.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"
TS="$(date +%s)"
PFX="b6-${TS}"
TEACHER_EMAIL="b6-teacher-${TS}@example.com"
VICTIM_EMAIL="b6-victim-${TS}@example.com"
PASS_PWD="initial1234"
NEW_PWD="rotated56789"

PASS=0
FAIL=0
declare -a RESULTS

# helpers ------------------------------------------------------------
hr() { printf '\n%s\n' "----------------------------------------------------------"; }
log() { printf '[b6] %s\n' "$*"; }

# req METHOD URL TOKEN BODY -> "<status>|<body>"
req() {
  local m="$1" u="$2" t="${3:-}" b="${4:-}"
  local args=(-s -o /tmp/b6_body -w '%{http_code}' -X "$m" "$u" -H 'Content-Type: application/json')
  [ -n "$t" ] && args+=(-H "Authorization: Bearer $t")
  [ -n "$b" ] && args+=(--data "$b")
  local code body
  code=$(curl "${args[@]}")
  body=$(cat /tmp/b6_body 2>/dev/null || echo '')
  printf '%s|%s' "$code" "$body"
}

record() {
  local id="$1" name="$2" expected="$3" got="$4" sev="$5" verdict="$6"
  RESULTS+=("${id}|${name}|${expected}|${got}|${sev}|${verdict}")
  if [ "$verdict" = "PASS" ]; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi
  log "[$verdict][$sev] $id $name -- expected=$expected got=$got"
}

extract_field() { printf '%s' "$2" | grep -o "\"$1\":\"[^\"]*" | head -n1 | cut -d'"' -f4; }

# ====================================================================
log "BASE=$BASE  prefix=$PFX"
hr

# 1. Admin login -----------------------------------------------------
log "Admin login..."
R=$(req POST "$BASE/api/auth/login" "" "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ADMIN_CODE="${R%%|*}"; ADMIN_BODY="${R#*|}"
ADMIN_TOKEN=$(extract_field "token" "$ADMIN_BODY")
ADMIN_ID=$(printf '%s' "$ADMIN_BODY" | grep -o '"id":"[^"]*' | head -n1 | cut -d'"' -f4)
if [ -z "$ADMIN_TOKEN" ]; then log "FATAL: admin login failed code=$ADMIN_CODE"; exit 1; fi
log "  admin token obtained (len=${#ADMIN_TOKEN}) admin id=$ADMIN_ID"

# 2. Create teacher + victim accounts via existing /admin/users -----
log "Create teacher (for negative authz tests)"
R=$(req POST "$BASE/api/admin/users" "$ADMIN_TOKEN" \
   "{\"email\":\"$TEACHER_EMAIL\",\"name\":\"B6 Teacher\",\"password\":\"$PASS_PWD\",\"role\":\"teacher\"}")
TC="${R%%|*}"; TB="${R#*|}"
log "  -> code=$TC body=${TB:0:200}"
TEACHER_ID=$(extract_field "id" "$TB")

log "Login as teacher"
R=$(req POST "$BASE/api/auth/login" "" "{\"email\":\"$TEACHER_EMAIL\",\"password\":\"$PASS_PWD\"}")
TLB="${R#*|}"
TEACHER_TOKEN=$(extract_field "token" "$TLB")
log "  teacher token len=${#TEACHER_TOKEN}"

log "Create victim user"
R=$(req POST "$BASE/api/admin/users" "$ADMIN_TOKEN" \
   "{\"email\":\"$VICTIM_EMAIL\",\"name\":\"B6 Victim\",\"password\":\"$PASS_PWD\",\"role\":\"teacher\"}")
VC="${R%%|*}"; VB="${R#*|}"
log "  -> code=$VC body=${VB:0:200}"
VICTIM_ID=$(extract_field "id" "$VB")
log "  VICTIM_ID=$VICTIM_ID"

if [ -z "$VICTIM_ID" ]; then log "FATAL: victim creation failed"; exit 1; fi

hr
log "====== Setup done. Beginning tests. ======"
hr

# ====================================================================
# A. admin-cost shape tests
# ====================================================================
log "TEST A1 — GET /admin-cost/summary (admin)"
R=$(req GET "$BASE/api/admin-cost/summary?from=2025-01-01&to=$(date -u +%Y-%m-%d)" "$ADMIN_TOKEN" "")
C="${R%%|*}"; B="${R#*|}"
log "  -> code=$C body=${B:0:200}"
HAS_TOTAL=$(printf '%s' "$B" | grep -c '"totalUsd"')
HAS_BYMODEL=$(printf '%s' "$B" | grep -c '"byModel"')
if [ "$C" = "200" ] && [ "$HAS_TOTAL" -gt 0 ] && [ "$HAS_BYMODEL" -gt 0 ]; then v=PASS; else v=FAIL; fi
record "A1" "GET /admin-cost/summary shape" "200+totalUsd+byModel" "$C/totalUsd=$HAS_TOTAL/byModel=$HAS_BYMODEL" "HIGH" "$v"

log "TEST A2 — GET /admin-cost/summary bad date -> 400"
R=$(req GET "$BASE/api/admin-cost/summary?from=not-a-date" "$ADMIN_TOKEN" "")
C="${R%%|*}"
if [ "$C" = "400" ]; then v=PASS; else v=FAIL; fi
record "A2" "/admin-cost/summary bad date -> 400" "400" "$C" "MEDIUM" "$v"

log "TEST A3 — GET /admin-cost/by-user (admin)"
R=$(req GET "$BASE/api/admin-cost/by-user" "$ADMIN_TOKEN" "")
C="${R%%|*}"; B="${R#*|}"
HAS_USERS=$(printf '%s' "$B" | grep -c '"users"')
if [ "$C" = "200" ] && [ "$HAS_USERS" -gt 0 ]; then v=PASS; else v=FAIL; fi
record "A3" "GET /admin-cost/by-user shape" "200+users[]" "$C/users=$HAS_USERS" "HIGH" "$v"

log "TEST A4 — GET /admin-cost/by-day?days=7"
R=$(req GET "$BASE/api/admin-cost/by-day?days=7" "$ADMIN_TOKEN" "")
C="${R%%|*}"; B="${R#*|}"
HAS_SERIES=$(printf '%s' "$B" | grep -c '"series"')
if [ "$C" = "200" ] && [ "$HAS_SERIES" -gt 0 ]; then v=PASS; else v=FAIL; fi
record "A4" "GET /admin-cost/by-day shape" "200+series[]" "$C/series=$HAS_SERIES" "HIGH" "$v"

# ====================================================================
# B. admin-rbac shape + paging
# ====================================================================
log "TEST B1 — GET /admin-rbac/users (admin)"
R=$(req GET "$BASE/api/admin-rbac/users?pageSize=5" "$ADMIN_TOKEN" "")
C="${R%%|*}"; B="${R#*|}"
HAS_TOTAL_PAGES=$(printf '%s' "$B" | grep -c '"totalPages"')
HAS_PASSWORD_HASH=$(printf '%s' "$B" | grep -c 'passwordHash')
if [ "$C" = "200" ] && [ "$HAS_TOTAL_PAGES" -gt 0 ] && [ "$HAS_PASSWORD_HASH" = "0" ]; then v=PASS; else v=FAIL; fi
record "B1" "GET /admin-rbac/users shape (no passwordHash leak)" "200+totalPages+no-hash" "$C/pages=$HAS_TOTAL_PAGES/hash=$HAS_PASSWORD_HASH" "CRITICAL" "$v"

log "TEST B2 — GET /admin-rbac/users?q=$VICTIM_EMAIL"
R=$(req GET "$BASE/api/admin-rbac/users?q=$VICTIM_EMAIL" "$ADMIN_TOKEN" "")
C="${R%%|*}"; B="${R#*|}"
HAS_VICTIM=$(printf '%s' "$B" | grep -c "$VICTIM_EMAIL")
if [ "$C" = "200" ] && [ "$HAS_VICTIM" -gt 0 ]; then v=PASS; else v=FAIL; fi
record "B2" "/admin-rbac/users?q= filter works" "200+victim-found" "$C/found=$HAS_VICTIM" "MEDIUM" "$v"

# ====================================================================
# C. admin-rbac PATCH happy path
# ====================================================================
log "TEST C1 — PATCH victim role teacher -> head_teacher"
R=$(req PATCH "$BASE/api/admin-rbac/users/$VICTIM_ID" "$ADMIN_TOKEN" '{"role":"head_teacher"}')
C="${R%%|*}"; B="${R#*|}"
NEW_ROLE=$(printf '%s' "$B" | grep -o '"role":"[^"]*' | head -n1 | cut -d'"' -f4)
if [ "$C" = "200" ] && [ "$NEW_ROLE" = "head_teacher" ]; then v=PASS; else v=FAIL; fi
record "C1" "PATCH role promotion" "200/head_teacher" "$C/$NEW_ROLE" "HIGH" "$v"

log "TEST C2 — PATCH victim isActive=false (deactivate)"
R=$(req PATCH "$BASE/api/admin-rbac/users/$VICTIM_ID" "$ADMIN_TOKEN" '{"isActive":false}')
C="${R%%|*}"; B="${R#*|}"
NEW_ACTIVE=$(printf '%s' "$B" | grep -o '"isActive":[a-z]*' | head -n1 | cut -d':' -f2)
if [ "$C" = "200" ] && [ "$NEW_ACTIVE" = "false" ]; then v=PASS; else v=FAIL; fi
record "C2" "PATCH isActive=false" "200/false" "$C/$NEW_ACTIVE" "HIGH" "$v"

log "TEST C3 — PATCH victim isActive=true (re-activate)"
R=$(req PATCH "$BASE/api/admin-rbac/users/$VICTIM_ID" "$ADMIN_TOKEN" '{"isActive":true}')
C="${R%%|*}"; B="${R#*|}"
NEW_ACTIVE=$(printf '%s' "$B" | grep -o '"isActive":[a-z]*' | head -n1 | cut -d':' -f2)
if [ "$C" = "200" ] && [ "$NEW_ACTIVE" = "true" ]; then v=PASS; else v=FAIL; fi
record "C3" "PATCH isActive=true (reactivate)" "200/true" "$C/$NEW_ACTIVE" "HIGH" "$v"

# ====================================================================
# D. LOCKOUT PROTECTION — the critical security invariant
# ====================================================================
log "TEST D1 — admin demoting SELF to teacher must be rejected"
R=$(req PATCH "$BASE/api/admin-rbac/users/$ADMIN_ID" "$ADMIN_TOKEN" '{"role":"teacher"}')
C="${R%%|*}"; B="${R#*|}"
log "  -> code=$C body=${B:0:200}"
if [ "$C" = "400" ]; then v=PASS; else v=FAIL; fi
record "D1" "Self-demotion to teacher" "400" "$C" "CRITICAL" "$v"

# Verify the admin row is still admin (no partial mutation)
log "TEST D1b — admin role still admin after rejected self-demote"
R=$(req GET "$BASE/api/auth/me" "$ADMIN_TOKEN" "")
C="${R%%|*}"; B="${R#*|}"
ROLE_NOW=$(printf '%s' "$B" | grep -o '"role":"[^"]*' | head -n1 | cut -d'"' -f4)
if [ "$ROLE_NOW" = "admin" ]; then v=PASS; else v=FAIL; fi
record "D1b" "admin role unchanged after self-demote attempt" "admin" "$ROLE_NOW" "CRITICAL" "$v"

log "TEST D2 — admin demoting SELF to head_teacher must be rejected"
R=$(req PATCH "$BASE/api/admin-rbac/users/$ADMIN_ID" "$ADMIN_TOKEN" '{"role":"head_teacher"}')
C="${R%%|*}"; B="${R#*|}"
if [ "$C" = "400" ]; then v=PASS; else v=FAIL; fi
record "D2" "Self-demotion to head_teacher" "400" "$C" "CRITICAL" "$v"

log "TEST D3 — admin deactivating SELF must be rejected"
R=$(req PATCH "$BASE/api/admin-rbac/users/$ADMIN_ID" "$ADMIN_TOKEN" '{"isActive":false}')
C="${R%%|*}"; B="${R#*|}"
if [ "$C" = "400" ]; then v=PASS; else v=FAIL; fi
record "D3" "Self-deactivation" "400" "$C" "CRITICAL" "$v"

log "TEST D4 — admin keeping SELF role=admin is allowed (no-op)"
R=$(req PATCH "$BASE/api/admin-rbac/users/$ADMIN_ID" "$ADMIN_TOKEN" '{"role":"admin"}')
C="${R%%|*}"; B="${R#*|}"
if [ "$C" = "200" ]; then v=PASS; else v=FAIL; fi
record "D4" "Self-role=admin no-op" "200" "$C" "MEDIUM" "$v"

# ====================================================================
# E. Password reset — must NOT leak plaintext or hash
# ====================================================================
log "TEST E1 — POST /admin-rbac/users/:id/reset-password"
R=$(req POST "$BASE/api/admin-rbac/users/$VICTIM_ID/reset-password" "$ADMIN_TOKEN" "{\"newPassword\":\"$NEW_PWD\"}")
C="${R%%|*}"; B="${R#*|}"
log "  -> code=$C body=${B:0:300}"
HAS_PLAIN=$(printf '%s' "$B" | grep -c "$NEW_PWD")
HAS_HASH=$(printf '%s' "$B" | grep -c -E '\$2[aby]\$')
if [ "$C" = "200" ] && [ "$HAS_PLAIN" = "0" ] && [ "$HAS_HASH" = "0" ]; then v=PASS; else v=FAIL; fi
record "E1" "Password reset response: no plaintext, no hash" "200/no-leak" "$C/plain=$HAS_PLAIN/hash=$HAS_HASH" "CRITICAL" "$v"

log "TEST E2 — too-short password rejected"
R=$(req POST "$BASE/api/admin-rbac/users/$VICTIM_ID/reset-password" "$ADMIN_TOKEN" '{"newPassword":"tiny"}')
C="${R%%|*}"
if [ "$C" = "400" ]; then v=PASS; else v=FAIL; fi
record "E2" "<8 char password rejected" "400" "$C" "MEDIUM" "$v"

log "TEST E3 — login with NEW password works"
R=$(req POST "$BASE/api/auth/login" "" "{\"email\":\"$VICTIM_EMAIL\",\"password\":\"$NEW_PWD\"}")
C="${R%%|*}"; B="${R#*|}"
if [ "$C" = "200" ] || [ "$C" = "201" ]; then v=PASS; else v=FAIL; fi
record "E3" "Login with rotated password" "200/201" "$C" "HIGH" "$v"

log "TEST E4 — login with OLD password is rejected"
R=$(req POST "$BASE/api/auth/login" "" "{\"email\":\"$VICTIM_EMAIL\",\"password\":\"$PASS_PWD\"}")
C="${R%%|*}"
if [ "$C" = "401" ]; then v=PASS; else v=FAIL; fi
record "E4" "Old password no longer works" "401" "$C" "CRITICAL" "$v"

# ====================================================================
# F. Role gating — non-admin must NOT reach these routes
# ====================================================================
declare -a TEACHER_HITS=(
  "F1|GET|/api/admin-cost/summary"
  "F2|GET|/api/admin-cost/by-user"
  "F3|GET|/api/admin-cost/by-day"
  "F4|GET|/api/admin-rbac/users"
)
for spec in "${TEACHER_HITS[@]}"; do
  IFS='|' read -r tid mth path <<< "$spec"
  log "TEST $tid — teacher $mth $path"
  R=$(req "$mth" "$BASE$path" "$TEACHER_TOKEN" "")
  C="${R%%|*}"
  if [ "$C" = "401" ] || [ "$C" = "403" ]; then v=PASS; else v=FAIL; fi
  record "$tid" "teacher->$path blocked" "401/403" "$C" "CRITICAL" "$v"
done

log "TEST F5 — teacher PATCH /admin-rbac/users/:self"
if [ -n "$TEACHER_ID" ]; then
  R=$(req PATCH "$BASE/api/admin-rbac/users/$TEACHER_ID" "$TEACHER_TOKEN" '{"role":"admin"}')
  C="${R%%|*}"
  if [ "$C" = "401" ] || [ "$C" = "403" ]; then v=PASS; else v=FAIL; fi
  record "F5" "teacher self-promote attempt blocked" "401/403" "$C" "CRITICAL" "$v"
fi

log "TEST F6 — teacher reset-password"
R=$(req POST "$BASE/api/admin-rbac/users/$VICTIM_ID/reset-password" "$TEACHER_TOKEN" '{"newPassword":"hijack9999"}')
C="${R%%|*}"
if [ "$C" = "401" ] || [ "$C" = "403" ]; then v=PASS; else v=FAIL; fi
record "F6" "teacher reset-password blocked" "401/403" "$C" "CRITICAL" "$v"

# ====================================================================
# G. No-auth probes
# ====================================================================
log "TEST G1 — GET /admin-cost/summary without token"
R=$(req GET "$BASE/api/admin-cost/summary" "" "")
C="${R%%|*}"
if [ "$C" = "401" ]; then v=PASS; else v=FAIL; fi
record "G1" "no-auth /admin-cost/summary -> 401" "401" "$C" "HIGH" "$v"

log "TEST G2 — GET /admin-rbac/users without token"
R=$(req GET "$BASE/api/admin-rbac/users" "" "")
C="${R%%|*}"
if [ "$C" = "401" ]; then v=PASS; else v=FAIL; fi
record "G2" "no-auth /admin-rbac/users -> 401" "401" "$C" "HIGH" "$v"

# ====================================================================
# Summary
# ====================================================================
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
exit 0
