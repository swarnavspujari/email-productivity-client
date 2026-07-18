// Generates the Snail Mail app icon (512x512 PNG) by rasterizing
// design/assets/snail-mail-app-tile.svg — the traced snail mark on its
// cerulean rounded tile. Zero image dependencies: the tile's paths are pure
// M/L/Z polygons, so a scanline even-odd fill + 3x supersampling is enough,
// and the PNG is hand-encoded like before. Feed the output to `tauri icon`.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";

const svg = readFileSync("design/assets/snail-mail-app-tile.svg", "utf8");

// ---- parse the tile: outer rounded rect + positioned inner svg + polygons
const rect = svg.match(/<rect width="512" height="512" rx="([\d.]+)" fill="(#[0-9a-fA-F]{6})"/);
if (!rect) throw new Error("tile rect not found");
const CORNER = Number(rect[1]);
const TILE_BG = hex(rect[2]);

const inner = svg.match(/<svg x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" viewBox="([\d. ]+)"/);
if (!inner) throw new Error("inner svg not found");
const [ix, iy, iw, ih] = [1, 2, 3, 4].map((i) => Number(inner[i]));
const [, , vbW, vbH] = inner[5].split(/\s+/).map(Number);
// preserveAspectRatio="xMidYMid meet"
const scale = Math.min(iw / vbW, ih / vbH);
const tx = ix + (iw - vbW * scale) / 2;
const ty = iy + (ih - vbH * scale) / 2;

const layers = []; // in document order; later layers paint over earlier ones
for (const m of svg.matchAll(/<path fill="(#[0-9a-fA-F]{6})" d="([^"]+)"/g)) {
  const color = hex(m[1]);
  const subpaths = [];
  let cur = null;
  const tokens = m[2].match(/[MLZ]|-?[\d.]+/g) ?? [];
  for (let i = 0; i < tokens.length; ) {
    const t = tokens[i];
    if (t === "M") {
      cur = [[Number(tokens[i + 1]), Number(tokens[i + 2])]];
      subpaths.push(cur);
      i += 3;
    } else if (t === "L") {
      cur.push([Number(tokens[i + 1]), Number(tokens[i + 2])]);
      i += 3;
    } else if (t === "Z") {
      i += 1; // subpaths are implicitly closed below
    } else {
      throw new Error(`unsupported path token ${t} — the tile is M/L/Z only`);
    }
  }
  layers.push({ color, subpaths });
}
if (layers.length === 0) throw new Error("no polygon paths found");

function hex(h) {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
}

// ---- rasterize at 3x, scanline even-odd fill per layer, then box-downsample
const S = 512;
const SS = 3;
const N = S * SS;
// 0 = transparent, 1 = tile background, 2+k = layers[k]
const idx = new Uint8Array(N * N);

for (let Y = 0; Y < N; Y++) {
  const dy = (Y + 0.5) / SS; // device y in 512-space
  // rounded-rect row extent (circle-corner inset near top/bottom edges)
  const edge = dy < CORNER ? CORNER - dy : dy > S - CORNER ? dy - (S - CORNER) : 0;
  const inset = CORNER - Math.sqrt(Math.max(0, CORNER * CORNER - edge * edge));
  const x0 = Math.max(0, Math.ceil(inset * SS - 0.5));
  const x1 = Math.min(N - 1, Math.floor((S - inset) * SS - 0.5));
  idx.fill(1, Y * N + x0, Y * N + x1 + 1);

  // polygon layers, document order
  const v = (dy - ty) / scale; // svg-space y of this row
  for (let k = 0; k < layers.length; k++) {
    const xs = [];
    for (const sp of layers[k].subpaths) {
      for (let e = 0; e < sp.length; e++) {
        const [ax, ay] = sp[e];
        const [bx, by] = sp[(e + 1) % sp.length]; // includes the closing edge
        if (ay <= v !== by <= v) xs.push(ax + ((v - ay) * (bx - ax)) / (by - ay));
      }
    }
    xs.sort((a, b) => a - b);
    for (let p = 0; p + 1 < xs.length; p += 2) {
      const from = Math.max(x0, Math.ceil((xs[p] * scale + tx) * SS - 0.5));
      const to = Math.min(x1, Math.floor((xs[p + 1] * scale + tx) * SS - 0.5));
      if (to >= from) idx.fill(2 + k, Y * N + from, Y * N + to + 1);
    }
  }
}

// ---- downsample 3x3 → 512 (premultiplied average so edges blend cleanly)
const palette = [[0, 0, 0], TILE_BG, ...layers.map((l) => l.color)];
const px = new Uint8Array(S * S * 4);
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const i = idx[(y * SS + sy) * N + (x * SS + sx)];
        if (i === 0) continue;
        const c = palette[i];
        r += c[0]; g += c[1]; b += c[2]; a += 255;
      }
    }
    const o = (y * S + x) * 4;
    const n = SS * SS;
    px[o] = a ? Math.round((r / a) * 255) : 0;
    px[o + 1] = a ? Math.round((g / a) * 255) : 0;
    px[o + 2] = a ? Math.round((b / a) * 255) : 0;
    px[o + 3] = Math.round(a / n);
  }
}

// ---- PNG encode (filter 0 per scanline)
const raw = Buffer.alloc(S * (S * 4 + 1));
for (let y = 0; y < S; y++) {
  raw[y * (S * 4 + 1)] = 0;
  Buffer.from(px.buffer, y * S * 4, S * 4).copy(raw, y * (S * 4 + 1) + 1);
}
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0);
ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);
mkdirSync("scripts/out", { recursive: true });
writeFileSync("scripts/out/icon-source.png", png);
console.log("wrote scripts/out/icon-source.png");
