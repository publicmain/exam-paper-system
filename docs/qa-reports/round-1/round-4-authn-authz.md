# Round 4 — AuthN / AuthZ

## Critical
- `attendance.controller.ts:92,99` correct/history endpoints had **no role
  check** — any logged-in student could mutate any class's attendance or
  enumerate attendance history school-wide. **FIXED** — both gated by
  `isTeacherOrAbove(user.role)`.
- `attendance.service.scanQr` user lookup didn't filter `isActive=true` →
  admin-deactivated accounts could still be impersonated by typing the name.
  **FIXED**.
- `attendance.service.fetchRoster` returned roster regardless of
  `session.status` — replaying yesterday's QR exposed today's class names.
  **FIXED** — gate on `MorningQuizStatus.active`.

## High (partly deferred)
- `analytics.controller.ts` cross-class isolation (English teacher can read
  Maths class metrics) — not fixed; needs `isTeacherOfClass` helper +
  ClassEnrollment lookup at service layer.
- `morning-quiz.controller.ts:135` dashboard same shape — same fix needed.
- `auth.controller.ts` login no rate-limit — needs `@nestjs/throttler` add.

## Medium
- Role-string drift: 7 controllers used inline `['admin','head_teacher',
  'teacher'].includes(...)` arrays. **FIXED** — added
  `apps/api/src/common/roles.ts` with `ROLES_TEACHER_OR_ABOVE` constant +
  `isTeacherOrAbove`/`isAdminOrHead` helpers.

## Files changed
- `apps/api/src/common/roles.ts` (new)
- `apps/api/src/attendance/attendance.controller.ts`
- `apps/api/src/attendance/attendance.service.ts`

## Deferred (Round 2 candidate)
- analytics + morning-quiz cross-class enforcement
- login rate-limiting
- IDOR audit on `/paper-variants`, `/codegrader`
