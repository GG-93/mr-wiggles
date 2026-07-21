#!/usr/bin/env node
/**
 * generate-icons.js
 *
 * Generates frontend/icons/icon-192.png and frontend/icons/icon-512.png
 * using only Node.js built-in modules (no external dependencies).
 *
 * Usage:
 *   node scripts/generate-icons.js
 */
'use strict';

const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '..', 'frontend', 'icons');

// ── CRC32 ──────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ── PNG builder ────────────────────────────────────────────────────────────
function pngChunk(type, data) {
  const len  = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeB = Buffer.from(type, 'ascii');
  const crcB  = Buffer.alloc(4);
  crcB.writeUInt32BE(crc32(Buffer.concat([typeB, data])));
  return Buffer.concat([len, typeB, data, crcB]);
}

/**
 * Build a PNG from a flat RGBA Uint8Array (size×size×4).
 * @param {number} size
 * @param {Uint8Array} rgba – row-major RGBA bytes
 */
function buildPNG(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8]  = 8; // bit depth
  ihdrData[9]  = 6; // RGBA
  ihdrData[10] = 0; // deflate
  ihdrData[11] = 0; // adaptive filter
  ihdrData[12] = 0; // no interlace

  // Prepend filter byte (0 = None) to each row
  const rowLen = 1 + size * 4;
  const raw    = Buffer.alloc(size * rowLen);
  for (let y = 0; y < size; y++) {
    raw[y * rowLen] = 0; // filter = None
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4;
      const dst = y * rowLen + 1 + x * 4;
      raw[dst]     = rgba[src];
      raw[dst + 1] = rgba[src + 1];
      raw[dst + 2] = rgba[src + 2];
      raw[dst + 3] = rgba[src + 3];
    }
  }

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdrData),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Pixel helpers ──────────────────────────────────────────────────────────
function blendPixel(pixels, size, x, y, r, g, b, a) {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || xi >= size || yi < 0 || yi >= size) return;
  const i   = (yi * size + xi) * 4;
  const sA  = a / 255;
  const dA  = pixels[i + 3] / 255;
  const oA  = sA + dA * (1 - sA);
  if (oA === 0) return;
  pixels[i]     = Math.round((r * sA + pixels[i]     * dA * (1 - sA)) / oA);
  pixels[i + 1] = Math.round((g * sA + pixels[i + 1] * dA * (1 - sA)) / oA);
  pixels[i + 2] = Math.round((b * sA + pixels[i + 2] * dA * (1 - sA)) / oA);
  pixels[i + 3] = Math.round(oA * 255);
}

/**
 * Draw a thick arc (anti-aliased via oversampling).
 */
function drawArc(pixels, size, cx, cy, radius, startAngle, endAngle, r, g, b, lineWidth, alpha) {
  const steps = Math.max(200, Math.round(radius * Math.abs(endAngle - startAngle) * 4));
  const hw    = lineWidth / 2;
  for (let i = 0; i <= steps; i++) {
    const angle = startAngle + (i / steps) * (endAngle - startAngle);
    const px    = cx + Math.cos(angle) * radius;
    const py    = cy + Math.sin(angle) * radius;
    const hwI   = Math.ceil(hw);
    for (let dy = -hwI; dy <= hwI; dy++) {
      for (let dx = -hwI; dx <= hwI; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= hw) {
          const edgeAlpha = Math.min(1, (hw - dist + 0.5));
          blendPixel(pixels, size,
            Math.round(px) + dx, Math.round(py) + dy,
            r, g, b, Math.round(alpha * edgeAlpha * 255));
        }
      }
    }
  }
}

/** Draw a filled circle with radial fade (glow). */
function drawGlow(pixels, size, cx, cy, radius, r, g, b, alpha) {
  const ri = Math.ceil(radius);
  for (let dy = -ri; dy <= ri; dy++) {
    for (let dx = -ri; dx <= ri; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= radius) {
        const a = alpha * Math.max(0, 1 - dist / radius);
        blendPixel(pixels, size, Math.round(cx) + dx, Math.round(cy) + dy,
          r, g, b, Math.round(a * 255));
      }
    }
  }
}

/** Draw a solid filled circle. */
function drawDot(pixels, size, cx, cy, radius, r, g, b) {
  const ri = Math.ceil(radius);
  for (let dy = -ri; dy <= ri; dy++) {
    for (let dx = -ri; dx <= ri; dx++) {
      if (dx * dx + dy * dy <= radius * radius) {
        blendPixel(pixels, size, Math.round(cx) + dx, Math.round(cy) + dy, r, g, b, 255);
      }
    }
  }
}

// ── Icon drawing ──────────────────────────────────────────────────────────
function drawIcon(pixels, size) {
  const cx    = size / 2;
  const cy    = size / 2;
  const cr    = size * 0.14; // corner radius

  // ── Rounded-rect background (#0a0a0a) ──
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Distance to nearest corner arc centre
      const nx = Math.max(cr, Math.min(size - cr, x));
      const ny = Math.max(cr, Math.min(size - cr, y));
      const d  = Math.sqrt((x - nx) ** 2 + (y - ny) ** 2);
      if (d <= cr) {
        blendPixel(pixels, size, x, y, 10, 10, 10, 255);
      }
    }
  }

  // ── Grid rings ──
  const gridRadii = [size * 0.19, size * 0.27, size * 0.35, size * 0.43];
  const gridLW    = Math.max(1, size / 160);
  for (const r of gridRadii) {
    drawArc(pixels, size, cx, cy, r, 0, Math.PI * 2, 0, 229, 255, gridLW, 0.12);
  }

  // ── Crescent ripples (3 arcs, NE direction ≈ -45°) ──
  const doaAngle  = -Math.PI * 0.25; // NE
  const halfSpan  = Math.PI * 0.42;
  const crescentR = [size * 0.21, size * 0.28, size * 0.36];
  const crescentA = [0.85, 0.60, 0.35];
  const crescentW = [size / 28, size / 36, size / 48];

  for (let i = 0; i < crescentR.length; i++) {
    drawArc(pixels, size, cx, cy, crescentR[i],
      doaAngle - halfSpan, doaAngle + halfSpan,
      0, 229, 255, crescentW[i], crescentA[i]);
  }

  // ── Center glow ──
  drawGlow(pixels, size, cx, cy, size * 0.12, 0, 229, 255, 0.30);

  // ── Center ring ──
  drawArc(pixels, size, cx, cy, size * 0.05, 0, Math.PI * 2,
    0, 229, 255, Math.max(1, size / 80), 0.70);

  // ── Center solid dot ──
  drawDot(pixels, size, cx, cy, size * 0.025, 0, 229, 255);
}

// ── Generate ───────────────────────────────────────────────────────────────
fs.mkdirSync(ICONS_DIR, { recursive: true });

for (const size of [192, 512]) {
  const rgba = new Uint8Array(size * size * 4); // all zeros = transparent
  drawIcon(rgba, size);
  const png  = buildPNG(size, rgba);
  const dest = path.join(ICONS_DIR, `icon-${size}.png`);
  fs.writeFileSync(dest, png);
  console.log(`✓  ${dest}  (${(png.length / 1024).toFixed(1)} KB)`);
}

console.log('Icons generated.');
