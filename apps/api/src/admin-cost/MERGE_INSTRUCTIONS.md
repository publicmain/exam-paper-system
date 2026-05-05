# B6 — AI Cost Dashboard + RBAC Management — Merge Instructions

These instructions cover **both** modules delivered by B6:

- `apps/api/src/admin-cost/` — read-only AI spend dashboard
- `apps/api/src/admin-rbac/` — admin user / role management

Both modules are admin-only. Neither touches files outside its own directory
(plus the new web pages `apps/web/src/pages/CostDashboard.tsx` and
`apps/web/src/pages/UserAdmin.tsx`, and the test script
`tests/blackbox/b6-admin.sh`).

---

## 1. Backend module registration

### 1a. Register the modules in `apps/api/src/app.module.ts`

Add the two imports near the other module imports and append the modules
to the `imports:` array:

```ts
import { AdminCostModule } from './admin-cost/admin-cost.module';
import { AdminRbacModule } from './admin-rbac/admin-rbac.module';

@Module({
  imports: [
    // …existing modules…
    AdminCostModule,
    AdminRbacModule,
  ],
  // …
})
```

That is the **only** change required to `app.module.ts`. The modules carry
their own controllers and providers. They reuse the global `AuditService`
(already exported by `AuditModule` which is `@Global()`), and the existing
`AuthGuard` + `@Roles('admin')` mechanism.

### 1b. Schema fragment to merge into `schema.prisma`

`apps/api/prisma/path-b-fragments/b6.prisma` documents the schema change.
Concretely, the integrator must add **one** field to the existing `User`
model:

```prisma
model User {
  // …existing fields…
  isActive Boolean @default(true)
}
```

Then run `prisma migrate dev --name add_user_is_active` (or
`prisma db push` for the dev DB).

### 1c. Auth follow-up (NOT a B6 file change — flagged for the auth owner)

After the column lands, `apps/api/src/auth/auth.service.ts` should reject
logins where `user.isActive === false`. The recommended diff:

```ts
// inside AuthService.login, after the bcrypt.compare check passes
if (user.isActive === false) {
  // Same generic 401 to avoid user-enumeration leaks.
  throw new UnauthorizedException('Invalid credentials');
}
```

**Until that auth change lands**, the B6 RBAC service falls back to a
sentinel-prefix on `passwordHash` so that login still fails for a
deactivated user (bcrypt.compare can never match a hash that begins with
`!DEACTIVATED!:`). Once `isActive` is wired into auth, the prefix path
remains as a no-op safety net but the real gate is `User.isActive`.

The B6 service auto-detects whether the column exists by trying the
sentinel approach, so **no code change is required in admin-rbac/ when
the column lands**. The fallback simply becomes redundant.

---

## 2. New HTTP routes (admin-only)

All routes are gated by `@Roles('admin')` at the controller class level.

### 2a. `/admin-cost`

| Method | Path                                     | Purpose                                |
|--------|------------------------------------------|----------------------------------------|
| GET    | `/api/admin-cost/summary?from=&to=`     | Total + per-channel USD aggregates     |
| GET    | `/api/admin-cost/by-user?from=&to=`     | Top spenders, joined to User           |
| GET    | `/api/admin-cost/by-day?days=30`        | Daily timeseries (UTC)                 |

`from` / `to` accept `YYYY-MM-DD`. Unspecified `from` defaults to 30 days
ago at UTC midnight; `to` defaults to "now".

### 2b. `/admin-rbac`

| Method | Path                                                | Purpose                                    |
|--------|-----------------------------------------------------|--------------------------------------------|
| GET    | `/api/admin-rbac/users?q=&role=&page=&pageSize=`   | Paginated user list with last-login        |
| PATCH  | `/api/admin-rbac/users/:id`                         | `{ role?, isActive? }` — change role / deactivate |
| POST   | `/api/admin-rbac/users/:id/reset-password`          | `{ newPassword }` — bcrypt-hashed, never echoed |

The PATCH endpoint enforces **self-lockout protection**: an admin attempting
to change their own role to a non-admin role, or to set `isActive=false` on
themselves, receives a 400 with an explanatory message. See section 4.

---

## 3. Frontend wiring

### 3a. `apps/web/src/lib/api.ts` — add API methods

Append the following inside the `api = {…}` literal (next to `listSources`,
which is the closest analogue):

```ts
// admin cost dashboard (admin only)
costSummary: (from?: string, to?: string) =>
  request('GET', `/admin-cost/summary${qs({ from, to })}`),
costByUser: (from?: string, to?: string) =>
  request('GET', `/admin-cost/by-user${qs({ from, to })}`),
costByDay: (days?: number) =>
  request('GET', `/admin-cost/by-day${qs({ days })}`),

// admin rbac (admin only)
listAdminUsers: (params: any = {}) =>
  request('GET', `/admin-rbac/users${qs(params)}`),
updateAdminUser: (id: string, data: any) =>
  request('PATCH', `/admin-rbac/users/${id}`, data),
resetUserPassword: (id: string, newPassword: string) =>
  request('POST', `/admin-rbac/users/${id}/reset-password`, { newPassword }),
```

(Optional — the B6 pages call `fetch` directly, mirroring the `lib/api.ts`
conventions, so this is purely a convenience for future callers.)

### 3b. `apps/web/src/App.tsx` — register the pages and admin nav

Add the imports:

```tsx
import CostDashboardPage from './pages/CostDashboard';
import UserAdminPage from './pages/UserAdmin';
```

Add admin-only nav links (next to the existing `/sources` admin link):

```tsx
{user.role === 'admin' && <NavLink to="/admin/cost" label="AI Cost" />}
{user.role === 'admin' && <NavLink to="/admin/users" label="Users" />}
```

Add the routes inside the teacher/admin `<Routes>` block (mirroring the
`/sources` pattern, which redirects non-admins to `/`):

```tsx
<Route path="/admin/cost" element={user.role === 'admin' ? <CostDashboardPage /> : <Navigate to="/" replace />} />
<Route path="/admin/users" element={user.role === 'admin' ? <UserAdminPage /> : <Navigate to="/" replace />} />
```

The pages themselves are self-contained — they don't import from any
shared component, only from `react` / `react-router-dom`.

---

## 4. Authorization checklist

| Concern                                              | Where it's enforced                                  |
|------------------------------------------------------|------------------------------------------------------|
| `/admin-cost/*` admin-only                          | `@Roles('admin')` at controller class                |
| `/admin-rbac/*` admin-only                          | `@Roles('admin')` at controller class                |
| No-auth requests rejected                            | Global `AuthGuard` (existing, app.module.ts)         |
| Cost data hides per-user PII from non-admin viewers | Same — non-admin can't reach the route               |
| `passwordHash` never returned in `/admin-rbac/users`| Service shape strips it; `isActive` derived only     |
| Plaintext password never echoed                      | Reset endpoint returns `{ ok, userId }` only         |
| Plaintext password never logged                      | Audit metadata: `{ passwordRotated: true, ... }`     |
| **Self-lockout protection** — can't demote self     | Service rejects `targetId === actor.id && role !== admin` with 400 |
| **Self-lockout protection** — can't deactivate self | Service rejects `targetId === actor.id && isActive === false` with 400 |
| Role values constrained to enum                     | Zod `UserRoleEnum` + `ASSIGNABLE_ROLES` allowlist    |
| New password length floor (≥8)                       | Zod `min(8)` + service guard                         |
| Audit row written for every mutation                | `admin.rbac.user.update` + `…reset_password` actions |

The frontend mirrors these protections (disables non-admin role options
and the deactivate checkbox when the row is the current user) but the
**server is the source of truth**; the FE check is for UX only.

---

## 5. Test script

`tests/blackbox/b6-admin.sh` — black-box hits the deployed API with admin
credentials (and a freshly-created teacher token) and verifies:

- Shape of all three `/admin-cost` endpoints
- `/admin-rbac/users` list pagination + filtering, no `passwordHash` leak
- PATCH happy paths for role + isActive
- **All four lockout scenarios** (demote-to-teacher, demote-to-head_teacher,
  deactivate-self, no-op self-role)
- Password reset returns no plaintext, no bcrypt hash; new password works;
  old password fails
- Teacher / no-auth probes get 401 / 403 on every B6 route

Run with `BASE=http://localhost:3000 ADMIN_EMAIL=admin@school.local
ADMIN_PASSWORD=admin123 bash tests/blackbox/b6-admin.sh`.

---

## 6. What's NOT included

- **No new Prisma tables.** Cost dashboard reads from `AuditLog` rows
  written by existing AI services. If query cost becomes a concern, a
  daily-rollup table is the next step — the API surface is the same so
  the FE wouldn't change.
- **No email notification on password reset.** The admin must communicate
  the new password out-of-band. This is intentional — sending email
  would require an SMTP integration B6 doesn't own, and would risk
  echoing the plaintext through logs.
- **No bulk operations.** "Deactivate all teachers in subject X" or
  "rotate everyone's password" are not exposed; do them one row at a
  time in the UI, audited per-row.
