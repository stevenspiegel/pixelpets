// Shared helpers for the sprite pipeline (scripts/make-sprite.mjs +
// scripts/wire-sprites.mjs). Self-contained: PNG decode/encode is done with
// only Node's built-in zlib, so the pipeline runs offline with no npm install.
//
// Scope of the PNG decoder: 8- and 16-bit, non-interlaced, colour types
// 0 (grayscale), 2 (RGB), 3 (indexed/palette), 4 (gray+alpha), 6 (RGBA).
// That covers what image generators and pixel editors (Aseprite/LibreSprite,
// GIMP, Photoshop) export. Interlaced PNGs are rejected with a clear error.
import fs from 'fs';
import path from 'path';
import zlib from 'node:zlib';

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// ── PNG decode ────────────────────────────────────────────────────────────
export function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(PNG_SIG)) throw new Error('Not a PNG file');
  let off = 8;
  let ihdr = null;
  let palette = null; // [{r,g,b}]
  let trns = null;     // alpha per palette index, or single transparent colour
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        interlace: data[12],
      };
    } else if (type === 'PLTE') {
      palette = [];
      for (let i = 0; i < data.length; i += 3) {
        palette.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
      }
    } else if (type === 'tRNS') {
      trns = Buffer.from(data);
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data));
    } else if (type === 'IEND') {
      break;
    }
    off += 12 + len; // length(4) + type(4) + data + crc(4)
  }
  if (!ihdr) throw new Error('PNG missing IHDR');
  if (ihdr.interlace !== 0) throw new Error('Interlaced PNGs are not supported — re-export without interlacing');

  const { width, height, bitDepth, colorType } = ihdr;
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (channels === undefined) throw new Error(`Unsupported PNG colour type ${colorType}`);
  if (![8, 16].includes(bitDepth) && !(colorType === 3 && [1, 2, 4, 8].includes(bitDepth))) {
    throw new Error(`Unsupported PNG bit depth ${bitDepth} for colour type ${colorType}`);
  }

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bitsPerPixel = channels * bitDepth;
  const bpp = Math.max(1, Math.ceil(bitsPerPixel / 8)); // filter byte stride
  const rowBytes = Math.ceil((bitsPerPixel * width) / 8);
  const unfiltered = unfilter(raw, width, height, bpp, rowBytes);

  const rgba = new Uint8Array(width * height * 4);
  const readSample = sampleReader(unfiltered, bitDepth);
  for (let y = 0; y < height; y++) {
    const rowStart = y * rowBytes * 8; // bit offset into unfiltered
    for (let x = 0; x < width; x++) {
      const base = rowStart + x * bitsPerPixel;
      const o = (y * width + x) * 4;
      let r, g, b, a = 255;
      if (colorType === 0) {            // grayscale
        r = g = b = scale8(readSample(base, 0), bitDepth);
      } else if (colorType === 2) {     // RGB
        r = scale8(readSample(base, 0), bitDepth);
        g = scale8(readSample(base, 1), bitDepth);
        b = scale8(readSample(base, 2), bitDepth);
      } else if (colorType === 3) {     // indexed
        const idx = readSample(base, 0);
        const c = palette?.[idx] ?? { r: 0, g: 0, b: 0 };
        r = c.r; g = c.g; b = c.b;
        if (trns && idx < trns.length) a = trns[idx];
      } else if (colorType === 4) {     // gray + alpha
        r = g = b = scale8(readSample(base, 0), bitDepth);
        a = scale8(readSample(base, 1), bitDepth);
      } else {                          // RGBA
        r = scale8(readSample(base, 0), bitDepth);
        g = scale8(readSample(base, 1), bitDepth);
        b = scale8(readSample(base, 2), bitDepth);
        a = scale8(readSample(base, 3), bitDepth);
      }
      rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = a;
    }
  }
  return { width, height, rgba };
}

// Returns a fn (bitOffset, sampleIndex) -> raw sample value (in its bit depth).
function sampleReader(bytes, bitDepth) {
  if (bitDepth === 8) {
    return (bitOff, i) => bytes[bitOff / 8 + i];
  }
  if (bitDepth === 16) {
    return (bitOff, i) => (bytes[bitOff / 8 + i * 2] << 8) | bytes[bitOff / 8 + i * 2 + 1];
  }
  // sub-byte (indexed 1/2/4): single sample per pixel
  return (bitOff) => {
    const bytePos = Math.floor(bitOff / 8);
    const shift = 8 - bitDepth - (bitOff % 8);
    return (bytes[bytePos] >> shift) & ((1 << bitDepth) - 1);
  };
}

function scale8(v, bitDepth) {
  if (bitDepth === 8) return v;
  if (bitDepth === 16) return v >> 8;
  return Math.round((v * 255) / ((1 << bitDepth) - 1)); // 1/2/4-bit gray/indexed
}

function unfilter(raw, width, height, bpp, rowBytes) {
  const out = Buffer.alloc(height * rowBytes);
  let inPos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[inPos++];
    const row = out.subarray(y * rowBytes, (y + 1) * rowBytes);
    const prev = y > 0 ? out.subarray((y - 1) * rowBytes, y * rowBytes) : null;
    for (let x = 0; x < rowBytes; x++) {
      const cur = raw[inPos++];
      const a = x >= bpp ? row[x - bpp] : 0;       // left
      const b = prev ? prev[x] : 0;                // up
      const c = prev && x >= bpp ? prev[x - bpp] : 0; // upper-left
      let val;
      switch (filter) {
        case 0: val = cur; break;
        case 1: val = cur + a; break;
        case 2: val = cur + b; break;
        case 3: val = cur + ((a + b) >> 1); break;
        case 4: val = cur + paeth(a, b, c); break;
        default: throw new Error(`Unknown PNG filter ${filter}`);
      }
      row[x] = val & 0xff;
    }
  }
  return out;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

// ── PNG encode (8-bit RGBA, colour type 6, filter 0) ───────────────────────
export function encodePng(width, height, rgba) {
  const rowBytes = width * 4;
  const raw = Buffer.alloc(height * (rowBytes + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (rowBytes + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * rowBytes, rowBytes)
      .copy(raw, y * (rowBytes + 1) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type RGBA
  return Buffer.concat([
    PNG_SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)) >>> 0, 8 + data.length);
  return out;
}

const CRC_TABLE = (() => {
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
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

// ── Image ops ───────────────────────────────────────────────────────────────
// Area-average resample with premultiplied alpha (avoids dark/halo fringes on
// transparent edges). Good for downscaling high-res renders; for upscaling it
// degrades gracefully to nearest-ish sampling.
export function resample(src, sw, sh, dw, dh) {
  const out = new Uint8Array(dw * dh * 4);
  const sx = sw / dw, sy = sh / dh;
  for (let dy = 0; dy < dh; dy++) {
    const y0 = dy * sy, y1 = (dy + 1) * sy;
    for (let dx = 0; dx < dw; dx++) {
      const x0 = dx * sx, x1 = (dx + 1) * sx;
      let r = 0, g = 0, b = 0, a = 0, cov = 0;
      for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy++) {
        const wy = Math.min(y1, yy + 1) - Math.max(y0, yy);
        if (wy <= 0) continue;
        for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx++) {
          const wx = Math.min(x1, xx + 1) - Math.max(x0, xx);
          if (wx <= 0) continue;
          const w = wx * wy;
          const o = (yy * sw + xx) * 4;
          const al = src[o + 3] / 255;
          r += src[o] * al * w; g += src[o + 1] * al * w; b += src[o + 2] * al * w;
          a += src[o + 3] * w; cov += w;
        }
      }
      const o = (dy * dw + dx) * 4;
      if (cov > 0 && a > 0) {
        const aNorm = a / cov;          // 0..255 average alpha
        const alScale = a / 255;        // for un-premultiplying colour
        out[o] = Math.round(r / alScale);
        out[o + 1] = Math.round(g / alScale);
        out[o + 2] = Math.round(b / alScale);
        out[o + 3] = Math.round(aNorm);
      } else {
        out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0;
      }
    }
  }
  return out;
}

// Remove stray opaque islands (background remnants like kept shadows) by
// labelling connected opaque components and clearing any smaller than
// `minFracOfLargest` of the biggest one. Keeps the subject (and any substantial
// detached part) while dropping specks.
export function removeSpecks(rgba, w, h, alphaThreshold = 1, minFracOfLargest = 0.02) {
  const n = w * h;
  const label = new Int32Array(n).fill(-1);
  const opaque = (p) => rgba[p * 4 + 3] >= alphaThreshold;
  const sizes = [];
  const stack = [];
  for (let s = 0; s < n; s++) {
    if (label[s] !== -1 || !opaque(s)) continue;
    const id = sizes.length; let size = 0; label[s] = id; stack.push(s);
    while (stack.length) {
      const p = stack.pop(); size++;
      const x = p % w, y = (p / w) | 0;
      if (x > 0 && label[p - 1] === -1 && opaque(p - 1)) { label[p - 1] = id; stack.push(p - 1); }
      if (x < w - 1 && label[p + 1] === -1 && opaque(p + 1)) { label[p + 1] = id; stack.push(p + 1); }
      if (y > 0 && label[p - w] === -1 && opaque(p - w)) { label[p - w] = id; stack.push(p - w); }
      if (y < h - 1 && label[p + w] === -1 && opaque(p + w)) { label[p + w] = id; stack.push(p + w); }
    }
    sizes.push(size);
  }
  if (sizes.length <= 1) return;
  let largest = 0;
  for (const s of sizes) if (s > largest) largest = s;
  const minSize = largest * minFracOfLargest;
  for (let p = 0; p < n; p++) {
    const id = label[p];
    if (id >= 0 && sizes[id] < minSize) rgba[p * 4 + 3] = 0;
  }
}

// Crop to the subject's bounding box (pixels with alpha >= threshold), adding a
// small proportional margin. Run after background removal so the subject fills
// the sprite frame instead of floating tiny inside the render's empty margins.
export function trimToContent(rgba, w, h, alphaThreshold = 1, padFrac = 0.06) {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rgba[(y * w + x) * 4 + 3] >= alphaThreshold) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { rgba, width: w, height: h }; // fully transparent: leave as-is
  const bw = maxX - minX + 1, bh = maxY - minY + 1;
  const pad = Math.round(Math.max(bw, bh) * padFrac);
  const x0 = Math.max(0, minX - pad), y0 = Math.max(0, minY - pad);
  const x1 = Math.min(w - 1, maxX + pad), y1 = Math.min(h - 1, maxY + pad);
  const nw = x1 - x0 + 1, nh = y1 - y0 + 1;
  const out = new Uint8Array(nw * nh * 4);
  for (let y = 0; y < nh; y++) {
    const srcRow = ((y0 + y) * w + x0) * 4;
    out.set(rgba.subarray(srcRow, srcRow + nw * 4), y * nw * 4);
  }
  return { rgba: out, width: nw, height: nh };
}

// Fit src into a size×size transparent canvas. mode: contain|cover|stretch.
export function fitToCanvas(src, sw, sh, size, mode = 'contain') {
  let scale;
  if (mode === 'stretch') return resample(src, sw, sh, size, size);
  if (mode === 'cover') scale = Math.max(size / sw, size / sh);
  else scale = Math.min(size / sw, size / sh); // contain
  const dw = Math.max(1, Math.round(sw * scale));
  const dh = Math.max(1, Math.round(sh * scale));
  const scaled = resample(src, sw, sh, dw, dh);
  const canvas = new Uint8Array(size * size * 4);
  const ox = Math.round((size - dw) / 2), oy = Math.round((size - dh) / 2);
  for (let y = 0; y < dh; y++) {
    const cy = y + oy; if (cy < 0 || cy >= size) continue;
    for (let x = 0; x < dw; x++) {
      const cx = x + ox; if (cx < 0 || cx >= size) continue;
      const s = (y * dw + x) * 4, d = (cy * size + cx) * 4;
      canvas[d] = scaled[s]; canvas[d + 1] = scaled[s + 1];
      canvas[d + 2] = scaled[s + 2]; canvas[d + 3] = scaled[s + 3];
    }
  }
  return canvas;
}

// Knock out a solid background colour (e.g. a generator's flat backdrop) by
// making pixels within `tolerance` of `hex` fully transparent.
export function keyOutBackground(rgba, hex, tolerance) {
  const { r, g, b } = hexToRgb(hex);
  const t2 = tolerance * tolerance * 3;
  for (let i = 0; i < rgba.length; i += 4) {
    const dr = rgba[i] - r, dg = rgba[i + 1] - g, db = rgba[i + 2] - b;
    if (dr * dr + dg * dg + db * db <= t2) rgba[i + 3] = 0;
  }
}

// Remove the connected background by flood-filling inward from the image edges,
// where the backdrop always sits. Reference colour = the average of the border
// pixels. A neighbour is crossed only if it passes BOTH gates:
//   - global: within `tolerance` of the sampled background colour, and
//   - local:  within `localStep` of the adjacent background pixel we spread
//     from (i.e. no colour edge between them).
// The local gate makes the flood stop at the subject's outline even when the
// subject's overall colour is close to the backdrop (e.g. a purple bat or grey
// elephant on grey): a flat backdrop has tiny pixel-to-pixel variation, while a
// subject edge is a real step. This prevents the flood from leaking through
// faint channels — which otherwise either eats the body (high tolerance) or
// punches interior holes (low tolerance). High-contrast subjects (e.g. an
// orange fox) fail the global gate anyway, so their cutout is unchanged.
// `localStep` defaults to ~half the tolerance (min 16).
export function removeBackgroundFlood(rgba, w, h, tolerance, localStep) {
  let rs = 0, gs = 0, bs = 0, ss = 0, n = 0;
  const sample = (x, y) => {
    const o = (y * w + x) * 4;
    if (rgba[o + 3] > 0) {
      rs += rgba[o]; gs += rgba[o + 1]; bs += rgba[o + 2];
      ss += rgba[o] * rgba[o] + rgba[o + 1] * rgba[o + 1] + rgba[o + 2] * rgba[o + 2];
      n++;
    }
  };
  for (let x = 0; x < w; x++) { sample(x, 0); sample(x, h - 1); }
  for (let y = 0; y < h; y++) { sample(0, y); sample(w - 1, y); }
  if (n === 0) return;
  const rr = rs / n, rg = gs / n, rb = bs / n;

  // Adaptive global tolerance. The passed `tolerance` is treated as an upper
  // cap; the effective one is derived from how much the border pixels actually
  // vary. A flat backdrop (tiny std) auto-tightens to a small tolerance so a
  // low-contrast subject whose colour merely *approaches* the backdrop (purple
  // bat, grey elephant) is NOT swallowed — the prior fixed-60 default ate such
  // bodies once 2px anti-aliasing bridged the outline. A noisy/gradient backdrop
  // widens it (still capped). std² = E[c²] - E[c]² summed over channels.
  const variance = Math.max(0, ss / n - (rr * rr + rg * rg + rb * rb));
  const std = Math.sqrt(variance);
  const effTol = Math.min(tolerance, Math.max(12, Math.round(std * 5 + 8)));

  const globalT2 = effTol * effTol * 3;
  const step = localStep == null ? Math.max(12, Math.round(effTol / 2)) : localStep;
  const stepT2 = step * step * 3;

  const visited = new Uint8Array(w * h);
  const isBg = new Uint8Array(w * h);
  const stack = [];
  const dist2 = (o, r, g, b) => {
    const dr = rgba[o] - r, dg = rgba[o + 1] - g, db = rgba[o + 2] - b;
    return dr * dr + dg * dg + db * db;
  };

  // Seed from the four borders: an edge pixel is background if it is already
  // transparent or within the global tolerance of the sampled backdrop.
  const edgeSeed = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (visited[p]) return;
    const o = p * 4;
    if (rgba[o + 3] === 0 || dist2(o, rr, rg, rb) <= globalT2) {
      visited[p] = 1; isBg[p] = 1; stack.push(p);
    }
  };
  for (let x = 0; x < w; x++) { edgeSeed(x, 0); edgeSeed(x, h - 1); }
  for (let y = 0; y < h; y++) { edgeSeed(0, y); edgeSeed(w - 1, y); }

  // Cross from background pixel p into neighbour q only if q is globally
  // background-like AND locally close to p (skip the local gate when p is
  // transparent and thus has no meaningful colour).
  const spread = (px, py, qx, qy) => {
    if (qx < 0 || qy < 0 || qx >= w || qy >= h) return;
    const q = qy * w + qx;
    if (visited[q]) return;
    visited[q] = 1;
    const qo = q * 4;
    if (rgba[qo + 3] === 0) { isBg[q] = 1; stack.push(q); return; }
    if (dist2(qo, rr, rg, rb) > globalT2) return;
    const po = (py * w + px) * 4;
    if (rgba[po + 3] !== 0 && dist2(qo, rgba[po], rgba[po + 1], rgba[po + 2]) > stepT2) return;
    isBg[q] = 1; stack.push(q);
  };
  while (stack.length) {
    const p = stack.pop();
    const x = p % w, y = (p / w) | 0;
    spread(x, y, x + 1, y); spread(x, y, x - 1, y);
    spread(x, y, x, y + 1); spread(x, y, x, y - 1);
  }

  for (let p = 0; p < w * h; p++) if (isBg[p]) rgba[p * 4 + 3] = 0;
}

// Post-cutout cleanup of the framed sprite: (1) drop isolated opaque islands
// smaller than `minIsland` px (stray fringe specks left by an imperfect cutout)
// and (2) fill enclosed transparent holes of `maxHole` px or fewer (pinholes
// from low-contrast interior shading) by copying an adjacent opaque colour.
// Both operate on 4-connected components. General — helps every species, not
// just hard cutouts. Pass {minIsland: 0} / {maxHole: 0} to disable either.
export function cleanupSprite(rgba, w, h, { minIsland = 6, maxHole = 4 } = {}) {
  const N = w * h;
  const opaque = (p) => rgba[p * 4 + 3] >= 128;

  // Label 4-connected components over a predicate; return {comp, sizes}.
  const components = (pred) => {
    const comp = new Int32Array(N).fill(-1);
    const sizes = [];
    const stack = [];
    for (let s = 0; s < N; s++) {
      if (comp[s] !== -1 || !pred(s)) continue;
      const id = sizes.length;
      let size = 0;
      comp[s] = id; stack.push(s);
      while (stack.length) {
        const p = stack.pop(); size++;
        const x = p % w, y = (p / w) | 0;
        const nb = [];
        if (x > 0) nb.push(p - 1);
        if (x < w - 1) nb.push(p + 1);
        if (y > 0) nb.push(p - w);
        if (y < h - 1) nb.push(p + w);
        for (const q of nb) if (comp[q] === -1 && pred(q)) { comp[q] = id; stack.push(q); }
      }
      sizes.push(size);
    }
    return { comp, sizes };
  };

  // (1) Remove tiny opaque islands.
  if (minIsland > 0) {
    const { comp, sizes } = components(opaque);
    for (let p = 0; p < N; p++) {
      if (comp[p] !== -1 && sizes[comp[p]] < minIsland) rgba[p * 4 + 3] = 0;
    }
  }

  // (2) Fill small enclosed transparent holes (components not touching the
  // border). Border-connected transparent regions are the real background.
  if (maxHole > 0) {
    const transparent = (p) => rgba[p * 4 + 3] < 128;
    const { comp, sizes } = components(transparent);
    const touchesBorder = new Uint8Array(sizes.length);
    for (let x = 0; x < w; x++) {
      if (comp[x] !== -1) touchesBorder[comp[x]] = 1;
      const b = (h - 1) * w + x;
      if (comp[b] !== -1) touchesBorder[comp[b]] = 1;
    }
    for (let y = 0; y < h; y++) {
      if (comp[y * w] !== -1) touchesBorder[comp[y * w]] = 1;
      const r = y * w + (w - 1);
      if (comp[r] !== -1) touchesBorder[comp[r]] = 1;
    }
    for (let p = 0; p < N; p++) {
      const id = comp[p];
      if (id === -1 || touchesBorder[id] || sizes[id] > maxHole) continue;
      // Fill from an adjacent opaque pixel's colour.
      const x = p % w, y = (p / w) | 0;
      const nb = [];
      if (x > 0) nb.push(p - 1);
      if (x < w - 1) nb.push(p + 1);
      if (y > 0) nb.push(p - w);
      if (y < h - 1) nb.push(p + w);
      for (const q of nb) {
        if (opaque(q)) {
          rgba[p * 4] = rgba[q * 4]; rgba[p * 4 + 1] = rgba[q * 4 + 1];
          rgba[p * 4 + 2] = rgba[q * 4 + 2]; rgba[p * 4 + 3] = 255;
          break;
        }
      }
    }
  }
}

// Snap every opaque pixel to the nearest palette colour; pixels below
// alphaThreshold become fully transparent, the rest become fully opaque
// (crisp pixel-art edges, matching the existing hand-drawn sprites).
export function quantizeToPalette(rgba, palette, alphaThreshold) {
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < alphaThreshold) {
      rgba[i] = rgba[i + 1] = rgba[i + 2] = rgba[i + 3] = 0;
      continue;
    }
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    let best = null, bestD = Infinity;
    for (const c of palette) {
      // Weighted RGB distance (approximates perceived colour difference).
      const dr = (r - c.r) * 0.3, dg = (g - c.g) * 0.59, db = (b - c.b) * 0.11;
      const d = dr * dr + dg * dg + db * db;
      if (d < bestD) { bestD = d; best = c; }
    }
    rgba[i] = best.r; rgba[i + 1] = best.g; rgba[i + 2] = best.b; rgba[i + 3] = 255;
  }
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

// ── Project palette (parsed from src/sprites/palette.ts) ────────────────────
export function loadPalette(root) {
  const file = path.join(root, 'src/sprites/palette.ts');
  const text = fs.readFileSync(file, 'utf8');
  const colors = [];
  // Match lines like:  k: '#1a1a1a', // outline black   (skip transparent)
  const re = /['"]?([A-Za-z.])['"]?\s*:\s*'(#[0-9a-fA-F]{6})'/g;
  let m;
  while ((m = re.exec(text))) {
    const { r, g, b } = hexToRgb(m[2]);
    colors.push({ key: m[1], hex: m[2], r, g, b });
  }
  if (colors.length === 0) throw new Error('No colours parsed from palette.ts');
  return colors;
}

// ── Species registry (slug <-> emoji) ───────────────────────────────────────
export function loadRegistry(root) {
  const file = path.join(root, 'scripts/species-map.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export const STAGES = ['baby', 'child', 'teen', 'adult', 'ascended'];
