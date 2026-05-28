// Generate PWA icons with zero image-library deps — hand-rolled PNG
// encoder on top of Node's built-in zlib. Draws a blue tile with three
// ascending white bars (a "scores / progress" motif) inside the maskable
// safe zone. Run: node apps/web/scripts/gen-pwa-icons.mjs
import zlib from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

// ── CRC32 ───────────────────────────────────────────────────────────
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const tb = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0);
  return Buffer.concat([len, tb, data, crc]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Draw ────────────────────────────────────────────────────────────
const BG = [29, 78, 216, 255]; // #1d4ed8
const WHITE = [255, 255, 255, 255];

function draw(size) {
  const buf = Buffer.alloc(size * size * 4);
  const set = (x, y, c) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = c[3];
  };
  // Full-bleed blue background (works as a maskable icon).
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) set(x, y, BG);

  // Three ascending bars within the central safe zone (~26%..74%).
  const baseY = Math.round(size * 0.72);
  const bottom = baseY;
  const barW = Math.round(size * 0.12);
  const gap = Math.round(size * 0.05);
  const heights = [0.18, 0.30, 0.42].map((f) => Math.round(size * f));
  const totalW = barW * 3 + gap * 2;
  let x0 = Math.round((size - totalW) / 2);
  for (let b = 0; b < 3; b++) {
    const top = bottom - heights[b];
    for (let y = top; y < bottom; y++)
      for (let x = x0; x < x0 + barW; x++) set(x, y, WHITE);
    x0 += barW + gap;
  }
  // A thin white baseline under the bars.
  const lineY0 = bottom + Math.round(size * 0.015);
  const lineY1 = lineY0 + Math.max(2, Math.round(size * 0.022));
  const lx0 = Math.round(size * 0.24);
  const lx1 = Math.round(size * 0.76);
  for (let y = lineY0; y < lineY1; y++) for (let x = lx0; x < lx1; x++) set(x, y, WHITE);

  return encodePNG(size, size, buf);
}

for (const size of [180, 192, 512]) {
  const png = draw(size);
  writeFileSync(join(OUT, `icon-${size}.png`), png);
  console.log(`wrote icon-${size}.png (${png.length} bytes)`);
}
console.log('done →', OUT);
