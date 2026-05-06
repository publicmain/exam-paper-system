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


class TextBlock(BaseModel):
    # Pixel-space coordinates (matching the rendered PNG at RENDER_DPI),
    # so the splitter and frontend can crop without an inverse transform.
    bbox: list[float]   # [x0, y0, x1, y1]
    text: str


class PageOut(BaseModel):
    page_no: int
    text: str
    char_count: int
    used_ocr: bool
    image_b64: str
    image_mime: str = "image/png"
    width: int = 0
    height: int = 0
    blocks: list[TextBlock] = []


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
    # Open from bytes rather than a NamedTemporaryFile — Windows holds an
    # exclusive lock on tempfiles for the lifetime of the context manager,
    # so PyMuPDF cannot reopen the same path. Streaming bytes avoids the
    # double-handle issue and works the same on POSIX.
    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        for page_no, page in enumerate(doc, start=1):
            text = page.get_text("text") or ""
            char_count = len(text.strip())

            pix = page.get_pixmap(dpi=RENDER_DPI)
            png_bytes = pix.tobytes("png")
            b64 = base64.b64encode(png_bytes).decode("ascii")

            used_ocr = False
            if char_count < 40:
                log.info("page %d looks scanned (%d chars) — OCR pending", page_no, char_count)

            # Text blocks with pixel-space bboxes so the splitter can find
            # question-number columns and the frontend can crop the PNG to
            # exactly the question region. PyMuPDF reports bboxes in PDF
            # points; convert to pixels using the same DPI as the render.
            scale = RENDER_DPI / 72.0
            blocks: list[TextBlock] = []
            try:
                raw_dict = page.get_text("dict")
                for blk in raw_dict.get("blocks", []):
                    if blk.get("type", 0) != 0:
                        continue  # type 1 = image block, skip
                    btext_parts: list[str] = []
                    for line in blk.get("lines", []):
                        for span in line.get("spans", []):
                            t = span.get("text", "")
                            if t:
                                btext_parts.append(t)
                    btext = " ".join(btext_parts).strip()
                    if not btext:
                        continue
                    bb = blk.get("bbox", [0, 0, 0, 0])
                    blocks.append(TextBlock(
                        bbox=[bb[0] * scale, bb[1] * scale, bb[2] * scale, bb[3] * scale],
                        text=btext,
                    ))
            except Exception as e:
                log.warning("layout extraction failed on page %d: %s", page_no, e)

            pages.append(
                PageOut(
                    page_no=page_no,
                    text=text,
                    char_count=char_count,
                    used_ocr=used_ocr,
                    image_b64=b64,
                    width=pix.width,
                    height=pix.height,
                    blocks=blocks,
                )
            )

    return ProcessPdfResponse(
        source_file_id=req.source_file_id,
        page_count=len(pages),
        pages=pages,
        sha256=sha,
    )


# -----------------------------------------------------------------------
# Circuit diagram rendering via schemdraw (Phase 8)
# -----------------------------------------------------------------------
#
# The Nest API hands us a structured JSON spec describing electrical
# components and their connections; we drive schemdraw imperatively and
# return the rendered SVG. Used to replace gpt-image-2 for type=circuit
# in the AI question generator.

import io
import re

# schemdraw / rdkit are only used by the optional /render_circuit and
# /render_molecule endpoints. Make them optional so the worker boots in
# environments where their build deps (matplotlib, rdkit C++) are missing
# — past-paper ingest only needs PyMuPDF.
try:
    import schemdraw
    import schemdraw.elements as elm
    _SCHEMDRAW_OK = True
except ImportError as _schemdraw_err:
    schemdraw = None  # type: ignore[assignment]
    elm = None  # type: ignore[assignment]
    _SCHEMDRAW_OK = False
    log.warning("schemdraw not available; /render_circuit disabled (%s)", _schemdraw_err)

# Whitelist of schemdraw element classes we'll instantiate. AI gives us
# an element type as a string; this avoids arbitrary-attribute access.
_ALLOWED_ELEMENTS = {} if not _SCHEMDRAW_OK else {
    'Resistor': elm.Resistor,
    'ResistorIEC': elm.ResistorIEC,
    'Capacitor': elm.Capacitor,
    'CapacitorVar': elm.CapacitorVar,
    'Inductor': elm.Inductor,
    'Inductor2': elm.Inductor2,
    'Battery': elm.Battery,
    'Cell': elm.Cell,
    'Diode': elm.Diode,
    'LED': elm.LED,
    'Photodiode': elm.Photodiode,
    'Switch': elm.Switch,
    'SwitchSpdt': elm.SwitchSpdt,
    'Lamp': elm.Lamp,
    'Speaker': elm.Speaker,
    'Ground': elm.Ground,
    'Vss': elm.Vss,
    'Vdd': elm.Vdd,
    'Line': elm.Line,
    'Dot': elm.Dot,
    'Arrow': elm.Arrow,
    'SourceV': elm.SourceV,
    'SourceI': elm.SourceI,
    'Meter': elm.Meter,
    'MeterV': elm.MeterV,
    'MeterA': elm.MeterA,
    'MeterOhm': elm.MeterOhm,
    'Transformer': elm.Transformer,
    'Fuse': elm.Fuse,
    'Potentiometer': elm.Potentiometer,
    'Crystal': elm.Crystal,
    'Memristor': elm.Memristor,
}

_ALLOWED_DIRECTIONS = {'right', 'left', 'up', 'down'}


class CircuitElement(BaseModel):
    type: str
    label: str | None = None
    direction: str | None = None  # 'right' | 'left' | 'up' | 'down'
    length: float | None = None   # multiplier of default unit
    flip: bool = False
    reverse: bool = False


class CircuitRequest(BaseModel):
    elements: list[CircuitElement]


class CircuitResponse(BaseModel):
    svg: str


@app.post("/render_circuit", response_model=CircuitResponse)
def render_circuit(req: CircuitRequest) -> CircuitResponse:
    if not _SCHEMDRAW_OK:
        raise HTTPException(503, "schemdraw not installed in this worker")
    if not req.elements:
        raise HTTPException(400, "elements list is empty")
    if len(req.elements) > 30:
        raise HTTPException(400, "circuit has too many elements (max 30)")

    d = schemdraw.Drawing(show=False)
    try:
        for spec in req.elements:
            cls = _ALLOWED_ELEMENTS.get(spec.type)
            if not cls:
                raise HTTPException(400, f"unknown element type: {spec.type}")
            el = cls()
            if spec.direction and spec.direction in _ALLOWED_DIRECTIONS:
                el = getattr(el, spec.direction)()
            if spec.length is not None and 0.5 <= spec.length <= 5:
                el = el.length(spec.length)
            if spec.flip:
                el = el.flip()
            if spec.reverse:
                el = el.reverse()
            if spec.label:
                el = el.label(spec.label[:40])
            d += el
        svg_bytes = d.get_imagedata('svg')
    except HTTPException:
        raise
    except Exception as e:
        log.warning("schemdraw failed: %s", e)
        raise HTTPException(500, f"schemdraw render failed: {e}") from e

    svg = svg_bytes.decode('utf-8') if isinstance(svg_bytes, bytes) else str(svg_bytes)
    # Sanitise: strip script/foreignObject + the XML declaration so the SVG
    # works inline as a data URI.
    svg = re.sub(r'<\?xml[^?]*\?>\s*', '', svg)
    svg = re.sub(r'<!DOCTYPE[^>]*>\s*', '', svg)
    svg = re.sub(r'<script[\s\S]*?</script>', '', svg, flags=re.IGNORECASE)
    svg = re.sub(r'<foreignObject[\s\S]*?</foreignObject>', '', svg, flags=re.IGNORECASE)
    return CircuitResponse(svg=svg)


# -----------------------------------------------------------------------
# Chemistry rendering via RDKit (Phase 10)
# -----------------------------------------------------------------------
#
# AI emits a SMILES string (e.g. "CCO" for ethanol, "c1ccccc1" for benzene,
# "CC(=O)O" for acetic acid). RDKit parses it, computes 2D coordinates,
# and renders SVG via rdMolDraw2D. Used to replace gpt-image-2 for
# type=molecular and type=organic_skeletal.

try:
    from rdkit import Chem
    from rdkit.Chem import AllChem
    from rdkit.Chem.Draw import rdMolDraw2D
    _RDKIT_OK = True
except ImportError as _rdkit_err:
    Chem = None  # type: ignore[assignment]
    AllChem = None  # type: ignore[assignment]
    rdMolDraw2D = None  # type: ignore[assignment]
    _RDKIT_OK = False
    log.warning("rdkit not available; /render_molecule disabled (%s)", _rdkit_err)


class MoleculeRequest(BaseModel):
    smiles: str
    kekulize: bool = True
    width: int = 400
    height: int = 280


class MoleculeResponse(BaseModel):
    svg: str


@app.post("/render_molecule", response_model=MoleculeResponse)
def render_molecule(req: MoleculeRequest) -> MoleculeResponse:
    if not _RDKIT_OK:
        raise HTTPException(503, "rdkit not installed in this worker")
    smiles = (req.smiles or "").strip()
    if not smiles or len(smiles) > 500:
        raise HTTPException(400, "smiles must be 1..500 chars")

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise HTTPException(400, f"invalid SMILES: {smiles[:80]}")

    # Compute 2D coords if missing
    AllChem.Compute2DCoords(mol)

    # Clamp draw canvas to safe range
    w = max(120, min(req.width, 800))
    h = max(120, min(req.height, 600))

    drawer = rdMolDraw2D.MolDraw2DSVG(w, h)
    opts = drawer.drawOptions()
    opts.addStereoAnnotation = True
    opts.bondLineWidth = 2
    drawer.DrawMolecule(mol, kekulize=req.kekulize)
    drawer.FinishDrawing()
    svg = drawer.GetDrawingText()

    # Sanitise (RDKit's SVG is already clean but defence in depth)
    svg = re.sub(r'<\?xml[^?]*\?>\s*', '', svg)
    svg = re.sub(r'<!DOCTYPE[^>]*>\s*', '', svg)
    svg = re.sub(r'<script[\s\S]*?</script>', '', svg, flags=re.IGNORECASE)
    svg = re.sub(r'<foreignObject[\s\S]*?</foreignObject>', '', svg, flags=re.IGNORECASE)
    return MoleculeResponse(svg=svg)
