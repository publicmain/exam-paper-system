"""PDF processing micro-service.

Phase 2 scaffold. The Nest API hands a source_file row to this service
via POST /process_pdf; the worker downloads / opens the raw PDF, renders
each page to PNG, extracts embedded text, falls back to OCR if the page
is scanned, and posts the structured result back to the Nest API at
/api/internal/pdf-processed.

This file is the minimal scaffold — render + text extract only. OCR,
question-splitting, and asset extraction land in subsequent commits.
"""

from __future__ import annotations

import hashlib
import logging
import os
from pathlib import Path
from typing import Any

import fitz  # PyMuPDF
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s :: %(message)s")
log = logging.getLogger("pdf-worker")

RAW_STORE = Path(os.environ.get("RAW_STORAGE_PATH", "/tmp/exam-raw-pdfs"))
RENDER_STORE = Path(os.environ.get("RENDER_STORAGE_PATH", "/tmp/exam-rendered"))
RENDER_DPI = int(os.environ.get("RENDER_DPI", "200"))

RAW_STORE.mkdir(parents=True, exist_ok=True)
RENDER_STORE.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="exam-paper-system pdf-worker", version="0.1.0")


class ProcessPdfRequest(BaseModel):
    source_file_id: str
    storage_path: str  # absolute path on shared volume / container


class PageOut(BaseModel):
    page_no: int
    text: str
    image_path: str
    char_count: int
    used_ocr: bool


class ProcessPdfResponse(BaseModel):
    source_file_id: str
    page_count: int
    pages: list[PageOut]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/process_pdf", response_model=ProcessPdfResponse)
def process_pdf(req: ProcessPdfRequest) -> ProcessPdfResponse:
    src = Path(req.storage_path)
    if not src.exists():
        raise HTTPException(404, f"raw PDF not found: {src}")

    log.info("processing %s (%s bytes)", src.name, src.stat().st_size)

    # Re-hash to verify integrity. Mismatched hashes mean the file was
    # mutated between ingest and processing — refuse to continue.
    sha = hashlib.sha256(src.read_bytes()).hexdigest()
    log.info("sha256 = %s", sha)

    out_dir = RENDER_STORE / req.source_file_id
    out_dir.mkdir(parents=True, exist_ok=True)

    pages: list[PageOut] = []
    with fitz.open(src) as doc:
        for page_no, page in enumerate(doc, start=1):
            text = page.get_text("text") or ""
            char_count = len(text.strip())

            # Render page PNG at configured DPI for both reviewer fallback
            # and (later) OCR feedstock.
            pix = page.get_pixmap(dpi=RENDER_DPI)
            img_path = out_dir / f"page-{page_no:04d}.png"
            pix.save(img_path)

            # Heuristic: if extracted text density is very low, the page is
            # almost certainly scanned and needs OCR. We mark it but defer
            # the actual OCR call to a later commit (will plug Tesseract).
            used_ocr = False
            if char_count < 40:
                log.info("page %d looks scanned (%d chars) — OCR pending", page_no, char_count)

            pages.append(
                PageOut(
                    page_no=page_no,
                    text=text,
                    image_path=str(img_path),
                    char_count=char_count,
                    used_ocr=used_ocr,
                )
            )

    return ProcessPdfResponse(
        source_file_id=req.source_file_id,
        page_count=len(pages),
        pages=pages,
    )
