# Exam Paper System

This repository holds **two product surfaces** that share one API and one database.

1. **Teacher / admin platform** — exam paper generation and content operations for
   international curriculum schools (CIE / Edexcel / O-Level / IGCSE / A-Level).
   Teachers configure subject, chapter, duration, total marks, and question type mix;
   the system pulls from a tagged question bank, presents an editable paper, and
   exports PDF + answer key. It also covers the question bank, marking queue,
   class management, scheduling, dashboards, and the parent portal.

2. **Student daily-English app** — an account-based, all-day English learning flow
   (reading → vocabulary → formal vocabulary quiz → summary), plus scores,
   vocabulary practice, mistakes practice, and account settings.

> ⚠️ The second surface is **implemented on the local branch and under isolated
> staging / manual-device validation** — it is **not** established as released to
> production. Its frontend is also **mid-reconstruction**. Read the next section
> before changing anything on the student side.

**Still out of scope:** multi-tenant SaaS, bulk past-paper digitization.

---

## Product surfaces: three distinct states

Keep these apart. Conflating them is how this repo drifted in the first place.

### PRODUCTION — what the repo can actually prove

- `origin/main` is at **`b72212e`** (`docs: P1 完成登记`).
- The local `main` branch is **42 commits ahead of it**. Everything from P7 through
  P8, P8.5, P9, P9.5, RC1 and RC1.1 sits in those unpushed commits.
- RC1.1 has only ever been pushed to the **`staging-manual-test`** branch.
- Therefore: **do not claim RC1.1 is deployed, released, or in daily student use.**
  Which commit production actually runs requires deployment-side evidence that this
  repository does not contain; this file makes no claim about it.
- **Historical note:** earlier morning-quiz capabilities did exist and did serve real
  classes, and the 3.0 / 4.0 business rules were implemented incrementally over
  time. That history is real — but it does **not** prove that the complete RC1.1
  student flow is in production.

### LOCAL / STAGING (as of RC1.1)

- The **teacher / admin platform** is stable and is the original product of this repo.
- **Student capabilities through P1–P9.5 / RC1.1 are implemented on the local
  branch** and have passed local verification: account login, today's lesson,
  reading with server-side draft saving, lesson vocabulary, a graded vocabulary
  quiz, and the summary.
- They are deployed to an **isolated staging environment** (a separate Railway
  project with its own database and eight fictional test accounts) and are
  **undergoing manual real-device validation** — see
  [`docs/manual-device-test-plan.md`](docs/manual-device-test-plan.md).
- **The student frontend is mixed.** It lives inside `apps/web` alongside the
  teacher UI and still contains conflicting routes and two different application
  shells: the account-based pages (`/me`, `/my-lesson`, `/my-lesson/summary`) and
  legacy scan / name-query / `/my-history` flows from earlier product eras. Some
  canonical steps still land on legacy pages.
- **This is not the final student product.**

### TARGET (planned — not built)

- A **physically separate `apps/student-web`**: an account-based, all-day English
  learning app.
- **Canonical student flow (seven steps):**
  `login / registration → today → reading → reading result → lesson vocabulary →
  formal vocabulary quiz → summary`
- **Independent account-based pages:** scores, vocabulary practice, mistakes
  practice, account.
- **No scan, no attendance dependency, no name-query identity, and no legacy
  `/my-history` navigation** anywhere in canonical flows. Identity comes only from
  a server-verified student token; canonical URLs never carry a name or student id.
- **Preserved as-is:** teacher / admin capabilities, API business rules, the
  database, all migrations, and historical data.

> **`apps/student-web` does not exist yet.** Nothing in the reconstruction has been
> implemented beyond documentation and a frozen baseline. Reconstruction Stage 3
> (a blocking deployment spike) has not started.

### Where the student product is specified

Authority order — **higher overrides lower**:

1. [`docs/reconstruction/product-contract.md`](docs/reconstruction/product-contract.md) — the target product definition
2. [`docs/reconstruction/product-decisions.md`](docs/reconstruction/product-decisions.md) — settled product decisions (D1–D6)
3. [`docs/reconstruction/migration-plan.md`](docs/reconstruction/migration-plan.md) — 16 staged migration plan

Supporting documents: [`student-route-inventory.md`](docs/reconstruction/student-route-inventory.md)
(every student entry point, classified), [`legacy-retirement-map.md`](docs/reconstruction/legacy-retirement-map.md)
(reference matrix), [`student-web-architecture.md`](docs/reconstruction/student-web-architecture.md)
(route contract + CI guards), [`freeze-manifest.md`](docs/reconstruction/freeze-manifest.md)
(what is frozen and what may still change).

**Legacy student code is frozen** under the freeze manifest: it accepts only
blockers, security fixes, and one-way compatibility adapters. New student behaviour
belongs in the future `apps/student-web`, not in `apps/web`.

The `docs/PRD/*` files for the student side are **historical evidence** — they record
why decisions were made, and they do **not** override the three documents above.

---

## Quick Start (local)

### Prerequisites
- Node.js 20+
- Docker (for Postgres) — or any local Postgres 15
- npm 10+

### 1. Install
```bash
cd C:\Users\yaoke\Projects\exam-paper-system
npm install
```

### 2. Start Postgres
```bash
docker compose up -d
```

### 3. Configure environment
```bash
cp .env.example .env
# Edit .env if needed; defaults work with docker-compose
```

The `.env` file contains your Anthropic API key (already filled in) — **never commit this file**.

### 4. Run migrations + seed
```bash
npm run db:migrate    # first time: it will prompt to name the migration; default "init" is fine
npm run db:seed
```

Seed creates:
- Two demo users:
  - `teacher@school.local` / `teacher123`
  - `admin@school.local` / `admin123`
- Two subjects: CIE A-Level Mathematics 9709 + Physics 9702 with topic trees
- ~25 demo questions (school-original, no past-paper content)
- One default paper template

### 5. Run dev servers
```bash
npm run dev
```
- API: http://localhost:4000  (health: http://localhost:4000/api/health)
- Web: http://localhost:5173

Open http://localhost:5173 and log in.

---

## Demo Workflow

1. **Login** as teacher@school.local
2. **Dashboard** → "+ Create New Paper"
3. **Step 1**: pick a preset (e.g. "Weekly Test 60 min")
4. **Step 2**: choose subject (CIE 9709 Mathematics) → component (P1) → tick a few topic chapters (e.g. Quadratics, Functions)
5. **Step 3**: review duration / total marks / question mix → "Generate Paper"
6. **Paper editor**: reorder, replace, edit, delete. The validation card shows total marks vs target, time vs duration, topic coverage, difficulty spread.
7. **Export PDF** → cover sheet + LaTeX-rendered questions + answer space
8. **Export Answer Key PDF** → same paper but with marked correct options and answer text

---

## Project Layout

```
exam-paper-system/
├── apps/
│   ├── api/                 # NestJS + Prisma + Postgres + Puppeteer (PDF)
│   │   ├── src/
│   │   │   ├── auth/        # JWT login, roles
│   │   │   ├── reference/   # boards / subjects / components / topics
│   │   │   ├── questions/   # CRUD, version history
│   │   │   ├── templates/   # paper templates
│   │   │   ├── papers/      # generation engine, validation, export
│   │   │   │   ├── generation.service.ts   # seeded RNG + constraint sat
│   │   │   │   ├── validation.service.ts
│   │   │   │   └── papers.service.ts       # reorder / edit / replace
│   │   │   ├── ai/          # Claude API for topic & difficulty labeling
│   │   │   ├── pdf/         # KaTeX SSR + Puppeteer
│   │   │   └── users/       # admin only
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── seed.ts
│   │   │   └── seed-data/
│   │   ├── test/            # Vitest unit tests
│   │   └── Dockerfile
│   └── web/                 # React 18 + Vite + Tailwind + KaTeX
│       ├── src/
│       │   ├── pages/       # Login, Dashboard, Questions, PaperWizard, PaperEdit, …
│       │   ├── components/  # MathHtml (KaTeX renderer)
│       │   └── lib/         # api client, auth store, latex utils
│       ├── Dockerfile
│       └── nginx.conf
├── docker-compose.yml       # local Postgres
├── railway.json             # Railway deploy (api root)
├── .env.example
└── README.md
```

---

## API endpoints

All non-public routes require `Authorization: Bearer <jwt>` (or set `MOCK_AUTH=true` for dev).

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | public |
| POST | `/api/auth/login` | public |
| GET | `/api/auth/me` | |
| GET | `/api/exam-boards` | |
| GET | `/api/subjects?boardId&level` | |
| GET | `/api/components?subjectId` | |
| GET | `/api/topics?componentId` | returns nested tree |
| GET | `/api/questions` | filters: subjectId, componentId, topicId, questionType, difficulty, marksMin/Max, search, includeDraft |
| POST | `/api/questions` | |
| PATCH | `/api/questions/:id` | creates new version automatically |
| GET | `/api/templates` | |
| POST | `/api/templates` | |
| GET | `/api/papers` | |
| POST | `/api/papers/generate` | core endpoint |
| GET | `/api/papers/:id` | full paper with questions |
| PATCH | `/api/papers/:id/questions/:pqId` | actions: `reorder`, `delete`, `edit`, `replace` |
| GET | `/api/papers/:id/questions/:pqId/replacements` | candidate alternates |
| GET | `/api/papers/:id/validate` | total marks / time / coverage / spread / warnings |
| GET | `/api/papers/:id/export?type=paper\|answer_key` | streams PDF |
| POST | `/api/papers/:id/versions` | save version snapshot |
| POST | `/api/ai/suggest-labels` | Claude-powered topic & difficulty suggestion |
| GET | `/api/admin/users` | admin only |

---

## Generation Algorithm (in plain English)

Given `{subject, component, topicFilter, durationMin, totalMarks, questionMix, difficultyDist, excludeRecentDays}`:

1. **Preflight checks** detect obviously bad configs (warnings, not errors).
2. **Expand topic filter**: if a parent topic is selected, include all descendants.
3. **Build candidate pool**: subject + component + topic + status=active, minus questions used by any class in the last N days.
4. **For each slot in `questionMix`**:
   - Filter pool by question type
   - Bucket by difficulty (1-2 easy, 3 medium, 4-5 hard)
   - Either pick `count` items distributed by `difficultyDist` (MCQ-style slot) **or** greedily pick until `targetMarks` is hit (structured-style slot)
5. **Postflight**: warn if total marks deviates >10% or estimated time deviates >20%.
6. **Persist** with a snapshot of the question content into `paper_questions.snapshotContent` so future master edits never alter historical papers.
7. **Seeded RNG** (mulberry32) — same `seed` reproduces the exact same paper.

Replacement uses the same algorithm but constrained to `(topic, marks, difficulty, type)` matches.

---

## Editing model — two layers

- **Paper-level edits**: stored in `paper_questions.overrideContent` / `overrideAnswer`. Only affects this paper. Does NOT modify the master question.
- **Master-level edits**: via `PATCH /api/questions/:id`. Creates a new row in `question_versions`. Does NOT retroactively change papers that already snapshotted the old version.

This is the central correctness guarantee — see `apps/api/src/papers/papers.service.ts:updateQuestion`.

---

## LaTeX rendering

- **Browser preview**: KaTeX renders `$...$` inline and `$$...$$` display math live (see `apps/web/src/lib/latex.ts`).
- **PDF**: KaTeX server-side renders to HTML+CSS, then Puppeteer prints to A4 PDF (see `apps/api/src/pdf/templates.ts` and `pdf.service.ts`). KaTeX CSS is loaded from CDN; Puppeteer waits for `networkidle0` to ensure fonts are ready.
- **Chemistry**: KaTeX's `mhchem` extension is included via the `katex` package — use `\ce{H2SO4}` syntax.
- **Diagrams**: store as images via `question_assets` (S3 or local filesystem URL). Auto-generation is out of scope.

---

## Copyright and Compliance Notes

This system is designed to be **safe for school internal use only**.

- All seed questions are flagged `source_type=original_school` (school-authored).
- Past paper questions, when added by teachers, must be flagged `source_type=past_paper_reference` and **only the metadata** (e.g., `9702/22/M/J/19/Q3`) is stored — not the original question text or images. Teachers are expected to obtain the original PDFs from official channels (CAIE School Support Hub / Edexcel Online).
- The PDF footer includes `© School internal use only` to make scope explicit.
- **Do not** upload Cambridge / Pearson original questions in bulk. **Do not** distribute generated PDFs commercially or to non-students.
- Before any external distribution or commercial use, obtain explicit written license from the relevant exam board.

See the design doc for full risk analysis (Cambridge CIE vs Pearson Edexcel separately).

---

## AI labeling

The endpoint `POST /api/ai/suggest-labels` calls Claude (`claude-sonnet-4-6` by default) with the question stem, the syllabus topic list, and asks for top 3 topic candidates + suggested difficulty + suggested question type.

- The teacher always reviews and confirms — AI never auto-applies labels.
- If `ANTHROPIC_API_KEY` is unset or set to the placeholder, the endpoint returns a stub response so the UI still works for development.

---

## Deploying to Railway

This repo is structured to deploy as **two Railway services + one managed Postgres**.

### Service 1 — API
1. Push this repo to GitHub.
2. On Railway, create a new project → "Deploy from GitHub repo".
3. Select **root directory `/`** (the API Dockerfile path is in `railway.json`).
4. Add a **Postgres** plugin. Railway auto-injects `DATABASE_URL`.
5. Set environment variables:
   - `JWT_SECRET` (generate a random 64-char string)
   - `ANTHROPIC_API_KEY`
   - `MOCK_AUTH=false`
   - `PORT` is auto-set by Railway (the API reads `PORT` as fallback).
6. The Dockerfile runs `prisma migrate deploy && node dist/main.js` on each boot, so migrations are applied automatically.
7. After first deploy, exec into the service and run seed once:
   ```
   railway run --service api npm run db:seed -w @app/api
   ```
   (or run via Railway CLI / job)

### Service 2 — Web
1. Create a second service on the same Railway project, also pointing at the GitHub repo.
2. Set **root directory `apps/web`** and use the Dockerfile in that directory.
3. Set build arg `VITE_API_URL` to your API service's public URL (e.g., `https://exam-api.up.railway.app`).
4. Deploy.

### Service 3 — Postgres
Use Railway's managed Postgres plugin; copy `DATABASE_URL` into the API service.

### Persistent storage
This MVP stores PDF output transiently (returned in HTTP response) and question images via URL references. If you add image uploads, mount a Railway Volume to `STORAGE_DIR`.

---

## Tests

```bash
npm run test
```

Currently runs `vitest` against `apps/api/test/generation.spec.ts` (preflight checks). The full integration test set against a live database is planned but not in this MVP.

### Manual test plan

1. ✅ Login with seeded teacher account
2. ✅ List question bank — should show ~25 questions across 9709 + 9702
3. ✅ Open one question — LaTeX in stem renders correctly in preview pane
4. ✅ Create new question, click "Suggest topic & difficulty" → AI returns suggestion (or stub)
5. ✅ Save question as draft, then publish (status becomes `active`)
6. ✅ Run paper wizard → preset → 9709 P1 → tick 2-3 topics → generate
7. ✅ Paper editor: reorder Q1↔Q2, replace Q3, edit Q4 stem, delete Q5
8. ✅ Validation card updates total marks live
9. ✅ Export paper PDF → opens, LaTeX renders, header has school/subject/duration/marks
10. ✅ Export answer key PDF → MCQ correct options marked, structured answers shown

---

## Roadmap (Phase 2+)

- Image upload pipeline + S3 / Railway volume
- DOCX export (Phase 2)
- AI-generated original questions (with mandatory review queue)
- Past-paper PDF semi-automatic ingestion (cropping tool, metadata-only)
- Approval workflow (head teacher reviews question bank changes)
- Multi-school tenancy (only after copyright due diligence)

> The student-side roadmap is **not** tracked here any more. Auto-marking and
> weak-topic practice are **implemented** in the student app (marking queue,
> mistakes practice, FSRS vocabulary scheduling) — implemented on the branch, not
> a claim about what is released. What remains for the student side is the
> reconstruction — see
> [`docs/reconstruction/migration-plan.md`](docs/reconstruction/migration-plan.md).

---

## Backup & Recovery

Database backup automation and the full disaster-recovery runbook live in [`docs/disaster-recovery.md`](docs/disaster-recovery.md). It covers RTO/RPO targets, daily cron setup, three off-site copy strategies (rsync, USB, `rclone`), and the step-by-step restore procedure with post-recovery validation queries.

Quick commands:

```bash
# Take a backup (writes to ./backups/, rotates to keep 7 most recent)
./scripts/backup.sh

# Restore from a specific dump (interactive — requires typing "RESTORE")
./scripts/restore.sh ./backups/exam-paper-system-YYYYMMDD-HHMMSS.dump
```

On Linux/macOS, make the scripts executable once: `chmod +x scripts/*.sh`. On Windows, run them inside WSL2 or Git Bash.

**Warning:** the dev DB has **no automatic backup** out of the box — `backup.sh` only runs when an operator (or cron) invokes it. Production / Railway operators must install the cron entry documented in the runbook before relying on recovery.

---

## License & Contributions

Internal school project. Not for external distribution. Do not commit `.env` or any past-paper original content.
