// Generates the Synapse PWA icons with node stdlib only (zlib + manual PNG encoding).
// Mark: rounded-square tile with the signature gradient (#6E6BFF -> #A78BFA -> #2DD4BF)
// and a white node-graph glyph (three dots connected by lines).
//
// Usage: node scripts/gen-icons.mjs

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// ---------------------------------------------------------------- PNG encode

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePNG(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  // compression / filter / interlace = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- rasterizer

const hex = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const G1 = hex("#6E6BFF");
const G2 = hex("#A78BFA");
const G3 = hex("#2DD4BF");

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function gradient(t) {
  if (t <= 0.55) {
    const k = t / 0.55;
    return [lerp(G1[0], G2[0], k), lerp(G1[1], G2[1], k), lerp(G1[2], G2[2], k)];
  }
  const k = (t - 0.55) / 0.45;
  return [lerp(G2[0], G3[0], k), lerp(G2[1], G3[1], k), lerp(G2[2], G3[2], k)];
}

// Signed distance to a rounded rect centered on the canvas.
function roundedRectSD(px, py, half, radius) {
  const qx = Math.abs(px - half) - (half - radius);
  const qy = Math.abs(py - half) - (half - radius);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - radius;
}

function segmentDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp01(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

// Node-graph glyph in canvas-normalized coordinates, scaled by `shrink`
// around the center (maskable icons keep content inside the safe zone).
function glyphSD(px, py, size, shrink) {
  const s = (v) => size * (0.5 + (v - 0.5) * shrink);
  const nodes = [
    [s(0.32), s(0.66)],
    [s(0.5), s(0.32)],
    [s(0.68), s(0.66)],
  ];
  const dotR = size * 0.088 * shrink;
  const lineW = size * 0.042 * shrink;
  let d = Infinity;
  for (const [nx, ny] of nodes) d = Math.min(d, Math.hypot(px - nx, py - ny) - dotR);
  const edges = [
    [0, 1],
    [1, 2],
  ];
  for (const [a, b] of edges) {
    d = Math.min(
      d,
      segmentDist(px, py, nodes[a][0], nodes[a][1], nodes[b][0], nodes[b][1]) - lineW / 2
    );
  }
  return d;
}

function renderIcon(size, { maskable = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const half = size / 2;
  const cornerR = maskable ? 0 : size * 0.225;
  const shrink = maskable ? 0.72 : 1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const tileA = clamp01(0.5 - roundedRectSD(px, py, half, cornerR));
      if (tileA <= 0) continue;
      const t = clamp01((px + py) / (2 * size));
      const [gr, gg, gb] = gradient(t);
      const glyphA = clamp01(0.5 - glyphSD(px, py, size, shrink));
      const r = lerp(gr, 255, glyphA);
      const g = lerp(gg, 255, glyphA);
      const b = lerp(gb, 255, glyphA);
      const i = (y * size + x) * 4;
      rgba[i] = Math.round(r);
      rgba[i + 1] = Math.round(g);
      rgba[i + 2] = Math.round(b);
      rgba[i + 3] = Math.round(tileA * 255);
    }
  }
  return rgba;
}

// ---------------------------------------------------------------- generate

const targets = [
  { file: "public/icons/icon-192.png", size: 192 },
  { file: "public/icons/icon-512.png", size: 512 },
  { file: "public/icons/icon-maskable-512.png", size: 512, maskable: true },
  { file: "app/icon.png", size: 32 },
];

for (const { file, size, maskable } of targets) {
  const out = join(ROOT, file);
  mkdirSync(dirname(out), { recursive: true });
  const png = encodePNG(size, size, renderIcon(size, { maskable }));
  writeFileSync(out, png);
  console.log(`wrote ${file} (${size}x${size}${maskable ? ", maskable" : ""}, ${png.length} bytes)`);
}
