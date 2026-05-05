# Local-folder past-paper ingest

One-shot CLI for pulling a folder (or single PDF) of past papers into the
exam-paper-system, bypassing the git-clone path. Designed for the teacher
flow where PDFs already live on disk.

## What the pipeline does end-to-end

1. **`ingest:local`** (this script)
   - Creates / reuses a `school_upload` SourceRepository for the path.
   - Walks for `.pdf`, parses CIE filenames (`9618_s24_qp_11.pdf`), dedupes
     by sha256, copies into the API's RAW_STORE, creates `SourceFile` rows.
2. **PDF worker** (`services/pdf-worker`, Python/FastAPI)
   - Renders each page to PNG, extracts text, OCR fallback. Writes
     `PdfPage` rows + page images.
3. **`question-splitter.service.ts`**
   - Splits each QP into `QuestionItem`s (with sub-parts) by detecting
     question numbers + bounding boxes.
4. **`mark-scheme-linker.service.ts`**
   - Pairs every QP with its MS variant and attaches `MarkSchemeItem`s
     to the matching `QuestionItem`.
5. **`POST /sources/:id/tag`** (manual next step) — runs Claude over each
   item to suggest topic + difficulty + question type.

## Prerequisites (local run)

```bash
# 1. Postgres
docker compose up -d postgres

# 2. Migrate + seed (this now seeds 9618 syllabus too)
npm run db:migrate -w @app/api
npm run db:seed    -w @app/api

# 3. Set env so the dispatcher can reach the PDF worker
#    Copy .env.example to .env (project root) and add:
PDF_WORKER_URL=http://localhost:8001
INTERNAL_API_TOKEN=any-shared-secret
RAW_STORAGE_PATH=./uploads/raw
RENDER_STORAGE_PATH=./uploads/rendered

# 4. Start the PDF worker
cd services/pdf-worker
python -m venv .venv && source .venv/Scripts/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
INTERNAL_API_TOKEN=any-shared-secret \
  uvicorn main:app --host 0.0.0.0 --port 8001

# 5. Start the API (separate terminal)
npm run dev:api
```

If you already deploy to Railway and want to skip the worker setup, point
your local `DATABASE_URL` and `PDF_WORKER_URL` at the deployed services.
The script doesn't care where Postgres or the worker live.

## Phase 1 — single-paper smoke test

```bash
cd C:/Users/yaoke/Projects/exam-paper-system

# Make a test pair so the splitter has both a QP and its MS to link.
mkdir -p /tmp/9618-smoke
cp "C:/Users/yaoke/Projects/alevel-cs-papers/2024-s/9618_s24_qp_11.pdf" /tmp/9618-smoke/
cp "C:/Users/yaoke/Projects/alevel-cs-papers/2024-s/9618_s24_ms_11.pdf" /tmp/9618-smoke/

npm run ingest:local -w @app/api -- \
  --path /tmp/9618-smoke \
  --label "9618 Paper 1 — smoke test" \
  --show 3
```

You should see something like:

```
=== Ingest result (12.4s) ===
  scanned:           2
  newFiles:          2
  duplicates:        0
  dispatch:          processed=2
  split:             files=1 items=8     ← 8 QuestionItems from QP
  msLink:            pairs=1 matched=8   ← all 8 paired with MS

=== Sample QuestionItems (3) ===
id:            ck...
source:        9618_s24_qp_11.pdf
q.number:      1
pages:         2-2
marks (sugg):  4
crop image:    /api/source-files/.../pages/2.png
text (head):   1 (a) Describe the difference between primary and secondary memory ...
parts:
  (a) [2m] Describe ...
  (b) [2m] State ...
mark scheme:
  (a) [1m] Primary is volatile / RAM ...
  (a) [1m] Secondary is non-volatile / disk ...
```

What to check:
- `split.items > 0` — splitter found the questions
- `msLink.matched > 0` — mark scheme attached to questions
- `text (head)` looks like a real exam question (not garbage OCR)
- `parts[]` has the right (a)/(b)/(i)/(ii) labels

If any of those are off, the splitter heuristics need tuning before we
scale to all 30 papers. If they look right → say "go" and we move to
Phase 2 (full Paper 1 ingest + AI topic tagging + frontend).

## Phase 2 — full Paper 1 ingest (after smoke test passes)

```bash
# Stage just Paper 1 variants from all sessions (variants 11/12/13).
mkdir -p /tmp/9618-paper1
for d in 2021-s 2021-w 2022-s 2022-w 2023-s 2023-w 2024-s 2024-w 2025-s 2025-w; do
  cp "C:/Users/yaoke/Projects/alevel-cs-papers/$d/9618_${d:2:1}${d:0:2:}_qp_1"?.pdf  /tmp/9618-paper1/ 2>/dev/null
  cp "C:/Users/yaoke/Projects/alevel-cs-papers/$d/9618_${d:2:1}${d:0:2:}_ms_1"?.pdf  /tmp/9618-paper1/ 2>/dev/null
done

npm run ingest:local -w @app/api -- \
  --path /tmp/9618-paper1 \
  --label "9618 Paper 1 — full archive 2021-2025"

# Then tag with AI:
curl -X POST -H "Authorization: Bearer <admin-jwt>" \
  "http://localhost:4000/sources/<repoId>/tag?syllabusCode=9618"
```

## Common gotchas

- **`PDF_WORKER_URL not set — skipping dispatch`** — the worker URL isn't
  in the API's env. SourceFiles will be created but stay `pending`. Add
  the env var and re-run `POST /sources/:id/process` to retry.
- **`source.local_ingest.fail` with `localPath not found`** — the script
  resolves the path verbatim; pass an absolute one.
- **Duplicates on rerun** — by design; the script dedupes on sha256, so
  re-running the same folder is idempotent (`duplicates` in the report).
