"""PDF processing micro-service.

Phase 2 worker for the exam-paper-system. The Nest API kicks this service
with a POST /process_pdf carrying a SourceFile id and an HTTP URL the
worker can fetch the raw PDF from. The worker:

1. Downloads the PDF from the API (using a shared internal token)
2. Renders each page to PNG and extracts text
3. Falls back to OCR if text density is too low (TODO — Tesseract)
4. Returns pages with embedded base64 PNGs so the API can persist them
   on its own volume without needing a shared filesystem

Image-as-base64 over HTTP keeps the deployment trivial on Railway, where
volumes are scoped to a single service. For very large papers this is
~MBs per page; that's acceptable for an internal call.
"""

from __future__ import annotations

import base64
import hashlib
import logging
import os
import tempfile
from pathlib import Path
from typing import Any

import fitz  # PyMuPDF
import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s :: %(message)s")
log = logging.getLogger("pdf-worker")

RENDER_DPI = int(os.environ.get("RENDER_DPI", "180"))
FETCH_TIMEOUT_SEC = float(os.environ.get("FETCH_TIMEOUT_SEC", "60"))
INTERNAL_TOKEN = os.environ.get("INTERNAL_API_TOKEN", "")

app = FastAPI(title="exam-paper-system pdf-worker", version="0.2.0")


class ProcessPdfRequest(BaseModel):
    source_file_id: str
    fetch_url: str
    expected_sha256: str | None = None


class PageOut(BaseModel):
    page_no: int
    text: str
    char_count: int
    used_ocr: bool
    image_b64: str
    image_mime: str = "image/png"


class ProcessPdfResponse(BaseModel):
    source_file_id: str
    page_count: int
    pages: list[PageOut]
    sha256: str


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "version": "0.2.0"}


@app.post("/process_pdf", response_model=ProcessPdfResponse)
def process_pdf(req: ProcessPdfRequest) -> ProcessPdfResponse:
    if not INTERNAL_TOKEN:
        raise HTTPException(500, "INTERNAL_API_TOKEN not configured on worker")

    # Fetch the raw PDF from the API. We authenticate as an internal caller
    # via the shared token; the API enforces this on the matching route.
    log.info("fetching %s for source_file=%s", req.fetch_url, req.source_file_id)
    headers = {"X-Internal-Token": INTERNAL_TOKEN}
    try:
        with httpx.Client(timeout=FETCH_TIMEOUT_SEC, follow_redirects=True) as client:
            r = client.get(req.fetch_url, headers=headers)
        r.raise_for_status()
    except httpx.HTTPError as e:
        raise HTTPException(502, f"failed to fetch PDF: {e}") from e

    pdf_bytes = r.content
    sha = hashlib.sha256(pdf_bytes).hexdigest()
    if req.expected_sha256 and req.expected_sha256 != sha:
        raise HTTPException(400, f"sha256 mismatch: got {sha}, expected {req.expected_sha256}")

    log.info("processing %s (%s bytes, sha=%s)", req.source_file_id, len(pdf_bytes), sha[:12])

    pages: list[PageOut] = []
    with tempfile.NamedTemporaryFile(suffix=".pdf") as tmp:
        tmp.write(pdf_bytes)
        tmp.flush()
        with fitz.open(tmp.name) as doc:
            for page_no, page in enumerate(doc, start=1):
                text = page.get_text("text") or ""
                char_count = len(text.strip())

                pix = page.get_pixmap(dpi=RENDER_DPI)
                png_bytes = pix.tobytes("png")
                b64 = base64.b64encode(png_bytes).decode("ascii")

                used_ocr = False
                if char_count < 40:
                    log.info("page %d looks scanned (%d chars) — OCR pending", page_no, char_count)

                pages.append(
                    PageOut(
                        page_no=page_no,
                        text=text,
                        char_count=char_count,
                        used_ocr=used_ocr,
                        image_b64=b64,
                    )
                )

    return ProcessPdfResponse(
        source_file_id=req.source_file_id,
        page_count=len(pages),
        pages=pages,
        sha256=sha,
    )
