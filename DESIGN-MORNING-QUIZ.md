# Morning Attendance + Quiz System — Design Document

**Status**: Brainstorming complete (2026-05-07), entering implementation
**Owner**: yaokexiang1bc@gmail.com
**Branch**: `feature/morning-attendance-quiz`

---

## 1. Understanding Summary

A new module **inside the existing exam-paper-system** that combines morning attendance with a daily English quiz. Students arrive at a single central venue (auditorium / large classroom), connect to school WiFi, scan a rotating QR code on the front screen between **8:30–8:32**, are marked present, and immediately receive a level-appropriate English quiz that auto-locks at **9:00**.

- **Goal**: replace the manual "teacher takes attendance + prints quiz + grades by hand" routine with a unified, audit-logged digital flow
- **Users**: 30 students (mixed O-Level + A-Level), English teachers, class teachers, admins
- **Three difficulty levels** assigned per class via `ClassEnglishLevel`:
  - `ielts_authentic` (Cambridge IELTS originals — admin-approved repo)
  - `ielts_hard` (AI-generated IELTS-style, hard difficulty)
  - `olevel` (Cambridge O-Level English 1123 originals — existing license)
- **Question types** (MVP): `mcq` + `short_answer` (covers fill-in-blank). Listening, writing, matching deferred.

## 2. Non-functional requirements

| Aspect | Target | Notes |
|---|---|---|
| Scale | 30 students / day | Single Railway instance trivially handles peak ~15 QPS |
| Latency | scan → quiz URL < 500 ms | Critical (8:30:01 to 8:31:59 is the whole window) |
| Reliability | tolerate 1 minute outage with manual fallback | Teachers carry pre-printed paper PDFs as backup |
| Security | server-side IP allowlist + JWT + HMAC QR + audit log | No client-side auth checks for cheating |
| Data privacy | all PII (attendance, IP, scan time) inside Railway Postgres only | Never logged to client or third party |
| Maintenance | one English teacher does Sunday-night batch generation; admin handles compliance | Same admin as existing exam-paper-system |

## 3. Decision Log

| # | Decision | Alternatives | Why |
|---|---|---|---|
| 1 | Extend exam-paper-system as new modules | Standalone repo / hybrid microservice | Massive reuse of question bank, PDF pipeline, student auth, MCQ auto-grading, AnswerScript, Quick Paper |
| 2 | Single-point centralized scan + WiFi/IP gate | Multi-classroom distributed; SSID detection (impossible from web) | Simplicity for 30 students; IP allowlist is 5 lines of code |
| 3 | Class-bound level mapping via `ClassEnglishLevel` | Per-student field; adaptive; self-select; teacher-day-of | Aligns perfectly with existing `Class` + `ClassEnrollment`; configured once per semester |
| 4 | Triple source: AI + IELTS originals (authorized GitHub) + teacher-authored | AI-only / GitHub-only / school-purchased / hard-pass | School has authorization (admin compliance memo); existing compliance gates apply |
| 5 | Hard windows: attendance 8:30–8:32, quiz 8:30–9:00 | Per-student 30-min timer | Aligns with school-wide morning routine; tight window naturally limits screenshot-forward attacks |
| 6 | Late policy = mark `late` + still take quiz (8:32–8:50); admin manual override anytime | Hard cutoff / late but no quiz / pure manual | Balances rigor with operational reality; teachers can always correct via audit-logged path |
| 7 | Objective questions only (MCQ + short_answer) | Include listening / writing / matching | 100% auto-grade keeps "scan-and-finish" promise; advanced types Phase 2 |
| 8 | Public IP allowlist via `SCHOOL_PUBLIC_IPS` env var | WebRTC internal-IP probe / captive portal token | Static school IPs are 99% case in China; trivial to implement and maintain |
| 9 | Mon–Fri only; manual /admin toggle for holidays | Auto holiday calendar / 6-day / fully flexible | YAGNI; admin can disable a date as needed |
| 10 | Sunday-night teacher batch via Quick Paper | Random per day / templates / morning-of | Reuses Phase 3 Quick Paper completely; teacher does 15-30 min once a week |
| 11 | Per-student question + option shuffle (MVP) | No shuffle / wait for spawned task #7 / multi-version paper | ~50 lines of deterministic Fisher-Yates kills 90% of side-glance copying |
| 12 | Architecture = Hybrid Composition (MorningQuizSession wraps PaperAssignment) | Tight Reuse (mode field on PaperAssignment) / Separate Domain (rewrite submission flow) | Best balance: clean separation + 0 logic duplication + spawned-tasks compatibility |

## 4. Constraints / Assumptions

1. School public IP is static (or small allowlist) — verify at deploy via `https://api.ipify.org`
2. IELTS GitHub repo is real, accessible, and admin compliance memo is filed before sync
3. Single Railway api instance (no horizontal scaling needed for 30 students)
4. Existing schemas (`User`, `Class`, `ClassEnrollment`, `Paper`, `PaperAssignment`, `StudentSubmission`, `AnswerScript`, `AuditLog`) are reused as-is — **zero modifications**
5. Existing `QuestionType.short_answer` covers fill-in-blank; no new enum value for MVP
6. Holidays handled manually via admin toggle; no automatic calendar
7. Railway downtime fallback = teacher uses pre-printed paper PDF (out of scope for code, in scope for ops doc)
8. Result dashboard depth = MVP shows class avg + top-wrong + per-student score; full analytics deferred to spawned task #2
9. AuditLog is the single source of truth for all writes (scan, correct, batch-create, cancel)
10. Deterministic shuffle uses `seedrandom` with `sha256(studentId + paperId).slice(0,16)` as seed

## 5. Schema Additions

Four new tables, three new enums. **No changes to existing models.**

```prisma
enum MorningQuizStatus { scheduled active locked cancelled }
enum AttendanceStatus  { on_time late absent }
enum AttendanceSource  { qr_scan manual_correction }
enum EnglishLevel      { ielts_authentic ielts_hard olevel }

model MorningQuizSession {
  id                  String   @id @default(cuid())
  date                DateTime @db.Date
  classId             String
  paperAssignmentId   String   @unique
  attendanceStart     DateTime
  attendanceEnd       DateTime
  lateCutoff          DateTime
  quizStart           DateTime
  quizEnd             DateTime
  qrSecret            String
  qrRotationSeconds   Int      @default(15)
  status              MorningQuizStatus @default(scheduled)
  scheduledById       String
  createdAt           DateTime @default(now())

  class             Class           @relation(fields: [classId], references: [id], onDelete: Cascade)
  paperAssignment   PaperAssignment @relation(fields: [paperAssignmentId], references: [id], onDelete: Cascade)
  scheduledBy       User            @relation("MorningQuizScheduledBy", fields: [scheduledById], references: [id])
  attendances       Attendance[]

  @@unique([date, classId])
  @@index([date, status])
}

model Attendance {
  id              String   @id @default(cuid())
  sessionId       String
  studentId       String
  status          AttendanceStatus
  scanTime        DateTime?
  sourceIp        String?
  source          AttendanceSource
  correctedById   String?
  correctedNote   String?
  submissionId    String?  @unique
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  session       MorningQuizSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  student       User               @relation("AttendanceStudent", fields: [studentId], references: [id])
  submission    StudentSubmission? @relation(fields: [submissionId], references: [id])
  correctedBy   User?              @relation("AttendanceCorrectedBy", fields: [correctedById], references: [id])

  @@unique([sessionId, studentId])
  @@index([studentId, status])
}

model ClassEnglishLevel {
  id            String        @id @default(cuid())
  classId       String        @unique
  level         EnglishLevel
  effectiveFrom DateTime
  createdAt     DateTime      @default(now())

  class         Class         @relation(fields: [classId], references: [id], onDelete: Cascade)
}

model QuestionShuffleMap {
  id              String   @id @default(cuid())
  studentId       String
  paperId         String
  seed            String
  questionOrder   Int[]
  optionOrders    Json
  createdAt       DateTime @default(now())

  student         User    @relation("ShuffleMapStudent", fields: [studentId], references: [id])
  paper           Paper   @relation(fields: [paperId], references: [id], onDelete: Cascade)

  @@unique([studentId, paperId])
  @@index([paperId])
}
```

## 6. Modules

```
apps/api/src/
├── attendance/      — POST /scan, /correct, GET /history
├── morning-quiz/    — POST /batch, GET /scheduled, sessions CRUD, cron
├── wifi-gate/       — IpAllowlistGuard (CIDR-aware)
├── qr/              — HMAC rolling-token service + GET /qr/current
└── shuffle/         — Deterministic Fisher-Yates with seedrandom

apps/web/src/pages/
├── MorningQuizScan.tsx       /scan/:token
├── MorningQuizTake.tsx       /morning-quiz/:sessionId
├── MorningQuizDisplay.tsx    /display/:sessionId  (大屏)
├── MorningQuizSchedule.tsx   /morning-quiz/schedule
└── AttendanceAdmin.tsx       /admin/attendance
```

## 7. API Surface

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/api/attendance/scan` | student | 5-gate validation → upsert Attendance + Submission |
| POST | `/api/attendance/correct` | admin/head_teacher | Manual override, audit-logged |
| GET  | `/api/attendance/history` | admin/head_teacher | Stats by class / date range |
| GET  | `/api/morning-quiz/:id` | student | Get questions (shuffle applied) |
| PATCH| `/api/morning-quiz/:id/answer` | student | Autosave answer |
| POST | `/api/morning-quiz/:id/submit` | student | Submit + auto-grade |
| GET  | `/api/morning-quiz/:id/result` | student | Score + wrong answers (after lock) |
| POST | `/api/morning-quiz/batch` | teacher | Sunday-night generate next week |
| GET  | `/api/morning-quiz/scheduled` | teacher | Week view |
| PATCH| `/api/morning-quiz/:id` | teacher | Edit/cancel session |
| GET  | `/api/morning-quiz/:id/dashboard` | teacher | Class results |
| PUT  | `/api/classes/:id/english-level` | admin | Set level mapping |
| GET  | `/api/qr/current` | (none) | Rolling token for big screen |

## 8. Anti-Cheat Layers

1. **WiFi/IP gate** (`IpAllowlistGuard` on `/scan`): `req.ip` must match `SCHOOL_PUBLIC_IPS` (CIDR-aware)
2. **Rolling QR token**: HMAC-SHA256 with 15s window, 30s tolerance for clock drift; screenshot becomes invalid in ≤30s
3. **Per-student deterministic shuffle**: `seedrandom(sha256(studentId+paperId))` drives both question order and option order; map persisted on first scan, reapplied identically on re-fetch

Known unblocked vectors (accepted): ChatGPT-assisted answers, side-channel verbal cheating, second-device search. Mitigated by 30-min hard cap + invigilation.

## 9. End-to-end timing

```
T-2 days  Sunday 21:00  Teacher: POST /morning-quiz/batch → 25 sessions created
T 08:29:50              Cron: status=scheduled → status=active for today
T 08:30:00              Big-screen QR appears, rotates every 15s
T 08:30:08              Student scans → 5 gates → Attendance(on_time) + Submission
T 08:30:08–08:59:59     Student answers, autosave each blur
T 08:32:01              Late channel: status=late, quiz still allowed
T 08:50:01              Late cutoff: scan returns 410 absent
T 09:00:00              Cron: locks sessions, force-submits in-progress, marks no-shows absent
T 09:00:01              Teacher dashboard available
```

## 10. Failure modes & fallbacks

See Section 6 of brainstorm transcript. Key:
- **Cron failure** → server-side time check (`now() < session.quizEnd`) is hard wall regardless
- **IP change** → daily 8:25 health-probe cron pings `/api/health/ip`, alerts admin on drift
- **Big screen dies** → `/admin/morning-quiz/today` shows token URL; admin reads aloud
- **Student no phone** → manual_correction by class teacher with `correctedNote`
- **Railway down** → pre-printed paper PDF is the ops backup (not in code scope)

## 11. Testing

- **Unit**: ShuffleService (determinism, uniformity), QrService (verify, expire, tamper), IpAllowlistGuard (CIDR, fail-closed)
- **Integration**: 5-gate scan flow (each gate fails individually), batch generator (no Anthropic flood), 9:00 cron lock (force submit + mark absent)
- **E2E**: Playwright — display rotation, scan → take, schedule generation
- **Load**: k6 with 30 simultaneous scans within 2s
- **Manual**: physical 30-phone WiFi test, screenshot-replay attack

## 12. Out of scope (Phase 2+)

- Listening (audio sync), writing (manual marking flow lives in spawned task #1)
- Multi-classroom distribution
- Self-select difficulty
- ChatGPT/focus-loss detection
- Auto holiday calendar
- Parent dashboard
- WeChat / DingTalk push (lives in spawned task #7)
- Per-student paper variant beyond shuffle (lives in spawned task #7)

## 13. Open implementation questions

| # | Q | Owner |
|---|---|---|
| 1 | School public IP value | yaokexiang at deploy time → Railway env var |
| 2 | IELTS GitHub repo URL + filename format | yaokexiang at first sync |
| 3 | Compliance memo text (auth source, signatory, date) | admin at first SourceRepository approval |
