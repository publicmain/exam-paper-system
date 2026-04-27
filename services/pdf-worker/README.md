# pdf-worker

Phase 2 microservice that processes raw past-paper PDFs ingested by the
Nest API. Currently implements:

- `GET /health`
- `POST /process_pdf` — render pages to PNG + extract embedded text. OCR
  and question-splitting land in subsequent commits.

## Local dev

```bash
cd services/pdf-worker
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8080
```

## Railway

Deployed as a separate service in the same project. The Nest API talks
to it over Railway's private network. Required env vars:

- `RAW_STORAGE_PATH` — same path the api writes to (shared volume)
- `RENDER_STORAGE_PATH` — where to write rendered page PNGs
- `RENDER_DPI` — default 200
