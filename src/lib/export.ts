// Export the figure SVG as SVG, vector PDF (embedded fonts), PNG or TIFF with dpi metadata.

import { builtin, fontBytes, STYLES, toBase64 } from './fonts.svelte';
import type { FontStyle } from './fonts.svelte';

export interface ExportOptions {
  /** the fonts the figure uses (doc font and per-text fonts) */
  families?: string[];
  /** leave the page see-through (PNG, SVG) */
  transparent?: boolean;
}

/** @font-face rules carrying the font files, for a figure drawn outside this page (PNG/TIFF, SVG). */
async function fontFaceCss(families: string[]): Promise<string> {
  const rules: string[] = [];
  for (const fam of families) {
    for (const st of STYLES) {
      const f = await fontBytes(fam, st);
      // a style the font has no file for is left out (not declared with another style's bytes), so the picture
      // shows that text as the screen does: in the closest style the font has, never as a faked bold or italic
      if (!f?.exact) continue;
      rules.push(`@font-face{font-family:'${fam.replace(/'/g, '')}';font-style:${st.includes('italic') ? 'italic' : 'normal'};font-weight:${st.startsWith('bold') ? 700 : 400};src:url(data:font/ttf;base64,${toBase64(f.bytes)}) format('truetype');}`);
    }
  }
  return rules.join('');
}

/** Clean, standalone SVG markup of the figure, sized in mm. */
export function svgMarkup(svg: SVGSVGElement, fontCss = ''): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.removeAttribute('class');
  // as on screen: a bold or italic the font has no file for stays regular instead of being faked by the viewer
  clone.style.setProperty('font-synthesis', 'none');
  clone.querySelectorAll('[data-ui]').forEach((n) => n.remove());
  clone.querySelectorAll('[data-pick]').forEach((n) => n.removeAttribute('data-pick')); // click targets of the editor only
  if (fontCss) {
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = fontCss;
    clone.insertBefore(style, clone.firstChild);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n` + new XMLSerializer().serializeToString(clone);
}

export function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export async function exportSvg(svg: SVGSVGElement, opts: ExportOptions = {}): Promise<Blob> {
  // the bundled fonts fall back to the fonts they copy (Arial, Times New Roman...) in other programs; a font the
  // user added travels inside the file so the SVG looks the same anywhere
  const added = (opts.families ?? []).filter((f) => !builtin(f));
  return new Blob([svgMarkup(svg, added.length ? await fontFaceCss(added) : '')], { type: 'image/svg+xml' });
}

export async function exportPdf(svg: SVGSVGElement, widthMm: number, heightMm: number, title: string, caption = '', opts: ExportOptions = {}): Promise<Blob> {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  const doc = new jsPDF({ unit: 'mm', format: [widthMm, heightMm], orientation: widthMm > heightMm ? 'landscape' : 'portrait', compress: true, putOnlyUsedFonts: true });
  // every style of every font the figure uses is embedded (a style a font lacks uses its closest one),
  // so no text falls back to an unembedded standard font
  const families = [...new Set(['Arimo', ...(opts.families ?? [])])];
  for (const fam of families) {
    for (const style of STYLES) {
      const f = await fontBytes(fam, style as FontStyle);
      if (!f) continue;
      const file = `${fam.replace(/[^A-Za-z0-9]/g, '')}-${style}.ttf`;
      doc.addFileToVFS(file, toBase64(f.bytes));
      doc.addFont(file, fam, style);
    }
  }
  doc.setFont('Arimo', 'normal');
  doc.setProperties({ title, subject: caption, keywords: 'study area map, location map', creator: 'StudyMap' });
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll('[data-ui]').forEach((n) => n.remove());
  clone.querySelectorAll('[data-pick]').forEach((n) => n.removeAttribute('data-pick')); // click targets of the editor only
  // svg2pdf measures in the document's unit; the viewBox is already in mm.
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:-99999px;top:0;';
  holder.appendChild(clone);
  document.body.appendChild(holder);
  try {
    await svg2pdf(clone, doc, { x: 0, y: 0, width: widthMm, height: heightMm });
  } finally {
    holder.remove();
  }
  return doc.output('blob');
}

// Safari on iPhone and iPad draws at most 16.7 million pixels (4096 × 4096) on one canvas; past that it draws nothing.
const IOS = typeof navigator !== 'undefined' && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
const MAX_SIDE = 16384;
const MAX_AREA = IOS ? 16_777_216 : 200_000_000;

/** Highest dpi this browser can draw for a page of this size. */
export function maxDpi(widthMm: number, heightMm: number): number {
  const bySide = MAX_SIDE / (Math.max(widthMm, heightMm) / 25.4);
  const byArea = Math.sqrt(MAX_AREA / ((widthMm / 25.4) * (heightMm / 25.4)));
  let dpi = Math.floor(Math.min(bySide, byArea));
  while (dpi > 1 && !rasterSize(widthMm, heightMm, dpi).ok) dpi--; // pixel counts are rounded: stay inside the limit
  return dpi;
}

export function rasterSize(widthMm: number, heightMm: number, dpi: number) {
  const w = Math.round((widthMm / 25.4) * dpi);
  const h = Math.round((heightMm / 25.4) * dpi);
  return { w, h, ok: w <= MAX_SIDE && h <= MAX_SIDE && w * h <= MAX_AREA };
}

async function rasterize(svg: SVGSVGElement, widthMm: number, heightMm: number, dpi: number, opts: ExportOptions = {}, white = true): Promise<HTMLCanvasElement> {
  const { w, h, ok } = rasterSize(widthMm, heightMm, dpi);
  if (!ok) throw new Error(`${w} × ${h} pixels is larger than this browser can draw. Lower the dpi or the figure size.`);
  // a figure drawn as an image cannot see this page's fonts, so they go inside it
  const markup = svgMarkup(svg, await fontFaceCss([...new Set(['Arimo', ...(opts.families ?? [])])]));
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser could not create a drawing surface that large.');
    if (white) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
    ctx.drawImage(img, 0, 0, w, h);
    // a browser short of memory hands back a canvas that silently stays empty: say so instead of saving a blank file
    if (white && ctx.getImageData(0, 0, 1, 1).data[3] === 0) throw new Error(`This device ran out of memory drawing ${w} × ${h} pixels. Lower the dpi or the figure size.`);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ---------- PNG with pHYs (dpi) ---------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function withPngDpi(png: Uint8Array, dpi: number): Uint8Array {
  const ppm = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(21);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // pHYs
  dv.setUint32(8, ppm);
  dv.setUint32(12, ppm);
  chunk[16] = 1; // metre
  dv.setUint32(17, crc32(chunk.subarray(4, 17)));
  const ihdrEnd = 8 + 25; // signature + IHDR chunk
  const out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, ihdrEnd), 0);
  out.set(chunk, ihdrEnd);
  out.set(png.subarray(ihdrEnd), ihdrEnd + chunk.length);
  return out;
}

/** PNG tEXt chunks (Title, Description, Software), so the file carries its own caption and credits. */
function withPngText(png: Uint8Array, entries: [string, string][]): Uint8Array {
  const enc = (s: string) => Uint8Array.from(s.normalize('NFKD').replace(/[^\x20-\x7E]/g, ''), (ch) => ch.charCodeAt(0));
  const chunks = entries.filter(([, v]) => v).map(([k, v]) => {
    const data = new Uint8Array([...enc(k), 0, ...enc(v)]);
    const c = new Uint8Array(12 + data.length);
    const dv = new DataView(c.buffer);
    dv.setUint32(0, data.length);
    c.set([0x74, 0x45, 0x58, 0x74], 4); // tEXt
    c.set(data, 8);
    dv.setUint32(8 + data.length, crc32(c.subarray(4, 8 + data.length)));
    return c;
  });
  const extra = chunks.reduce((s, c) => s + c.length, 0);
  const at = 8 + 25; // after IHDR
  const out = new Uint8Array(png.length + extra);
  out.set(png.subarray(0, at), 0);
  let p = at;
  for (const c of chunks) { out.set(c, p); p += c.length; }
  out.set(png.subarray(at), p);
  return out;
}

export async function exportPng(svg: SVGSVGElement, widthMm: number, heightMm: number, dpi: number, title = '', caption = '', opts: ExportOptions = {}): Promise<Blob> {
  const canvas = await rasterize(svg, widthMm, heightMm, dpi, opts, !opts.transparent);
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('PNG encoding failed.'))), 'image/png'));
  const bytes = withPngText(withPngDpi(new Uint8Array(await blob.arrayBuffer()), dpi), [['Title', title], ['Description', caption], ['Software', 'StudyMap']]);
  canvas.width = canvas.height = 0;
  return new Blob([bytes as BlobPart], { type: 'image/png' });
}

/* ---------- TIFF (RGB, LZW, dpi tags) ---------- */

function lzwEncode(data: Uint8Array): Uint8Array {
  const out: number[] = [];
  let bitBuf = 0, bitCnt = 0, codeLen = 9;
  const emit = (code: number) => {
    bitBuf = (bitBuf << codeLen) | code;
    bitCnt += codeLen;
    while (bitCnt >= 8) {
      out.push((bitBuf >>> (bitCnt - 8)) & 0xff);
      bitCnt -= 8;
    }
    bitBuf &= (1 << bitCnt) - 1;
  };
  const CLEAR = 256, EOI = 257;
  let dict = new Map<number, number>();
  let next = 258;
  emit(CLEAR);
  let w = data.length ? data[0] : -1;
  for (let i = 1; i < data.length; i++) {
    const c = data[i];
    const key = (w << 8) | c;
    const hit = dict.get(key);
    if (hit !== undefined) { w = hit; continue; }
    emit(w);
    dict.set(key, next++);
    // Same rule as libtiff's encoder: widen once the next free code passes the current maximum.
    if (next === 4094) {
      emit(CLEAR);
      dict = new Map();
      next = 258;
      codeLen = 9;
    } else if (next === 512) codeLen = 10;
    else if (next === 1024) codeLen = 11;
    else if (next === 2048) codeLen = 12;
    w = c;
  }
  if (w >= 0) {
    emit(w);
    // The decoder adds one more entry after reading the last code; match its width before EOI.
    next++;
    if (next === 512) codeLen = 10;
    else if (next === 1024) codeLen = 11;
    else if (next === 2048) codeLen = 12;
  }
  emit(EOI);
  if (bitCnt > 0) out.push((bitBuf << (8 - bitCnt)) & 0xff);
  return Uint8Array.from(out);
}

export async function exportTiff(svg: SVGSVGElement, widthMm: number, heightMm: number, dpi: number, opts: ExportOptions = {}): Promise<Blob> {
  const canvas = await rasterize(svg, widthMm, heightMm, dpi, opts); // TIFF here has no transparency: always on white
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d')!;
  const rowsPerStrip = Math.max(1, Math.floor(65536 / (W * 3)));
  const strips: Uint8Array[] = [];
  for (let y = 0; y < H; y += rowsPerStrip) {
    const rows = Math.min(rowsPerStrip, H - y);
    const rgba = ctx.getImageData(0, y, W, rows).data;
    const rgb = new Uint8Array(W * rows * 3);
    for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) { rgb[j] = rgba[i]; rgb[j + 1] = rgba[i + 1]; rgb[j + 2] = rgba[i + 2]; }
    strips.push(lzwEncode(rgb));
    if (strips.length % 20 === 0) await new Promise((r) => setTimeout(r));
  }
  canvas.width = canvas.height = 0;

  const entries: [number, number, number, number | number[]][] = []; // tag, type, count, value(s)
  const SHORT = 3, LONG = 4, RATIONAL = 5;
  const n = strips.length;
  const headerSize = 8;
  const tagCount = 14;
  const ifdSize = 2 + tagCount * 12 + 4;
  let off = headerSize + ifdSize;
  const bpsOff = off; off += 6;
  const xresOff = off; off += 8;
  const yresOff = off; off += 8;
  const stripOffOff = off; off += n > 1 ? 4 * n : 0;
  const stripCntOff = off; off += n > 1 ? 4 * n : 0;
  const dataStart = off;
  const offsets: number[] = [];
  let p = dataStart;
  for (const s of strips) { offsets.push(p); p += s.length; }
  const total = p;

  entries.push([256, LONG, 1, W], [257, LONG, 1, H], [258, SHORT, 3, bpsOff], [259, SHORT, 1, 5], [262, SHORT, 1, 2]);
  entries.push([273, LONG, n, n > 1 ? stripOffOff : offsets[0]], [277, SHORT, 1, 3], [278, LONG, 1, rowsPerStrip]);
  entries.push([279, LONG, n, n > 1 ? stripCntOff : strips[0].length], [282, RATIONAL, 1, xresOff], [283, RATIONAL, 1, yresOff]);
  entries.push([284, SHORT, 1, 1], [296, SHORT, 1, 2], [305, 2, 9, 0]);

  const buf = new Uint8Array(total + 16);
  const dv = new DataView(buf.buffer);
  buf[0] = 0x49; buf[1] = 0x49; dv.setUint16(2, 42, true); dv.setUint32(4, headerSize, true);
  dv.setUint16(headerSize, tagCount, true);
  // Software tag text goes after the strips.
  const softOff = total;
  buf.set(new TextEncoder().encode('StudyMap\0'), softOff);
  entries.forEach(([tag, type, count, val], i) => {
    const e = headerSize + 2 + i * 12;
    dv.setUint16(e, tag, true);
    dv.setUint16(e + 2, type, true);
    dv.setUint32(e + 4, count, true);
    if (tag === 305) dv.setUint32(e + 8, softOff, true);
    else if (type === SHORT && count === 1) dv.setUint16(e + 8, val as number, true);
    else dv.setUint32(e + 8, val as number, true);
  });
  dv.setUint32(headerSize + 2 + tagCount * 12, 0, true);
  dv.setUint16(bpsOff, 8, true); dv.setUint16(bpsOff + 2, 8, true); dv.setUint16(bpsOff + 4, 8, true);
  dv.setUint32(xresOff, dpi, true); dv.setUint32(xresOff + 4, 1, true);
  dv.setUint32(yresOff, dpi, true); dv.setUint32(yresOff + 4, 1, true);
  if (n > 1) {
    offsets.forEach((o, i) => dv.setUint32(stripOffOff + i * 4, o, true));
    strips.forEach((s, i) => dv.setUint32(stripCntOff + i * 4, s.length, true));
  }
  strips.forEach((s, i) => buf.set(s, offsets[i]));
  return new Blob([buf as BlobPart], { type: 'image/tiff' });
}

/**
 * Everything for a submission in one .zip: the figure as PDF, as a TIFF (or PNG) at the chosen dpi and as SVG,
 * the caption with its data credits, and the project file to open and change it again later.
 */
export async function exportBundle(svg: SVGSVGElement, w: number, h: number, dpi: number, title: string, caption: string, project: string, base: string, raster: 'tiff' | 'png', opts: ExportOptions = {}): Promise<Blob> {
  const { zipFiles } = await import('./zip');
  const pdf = await exportPdf(svg, w, h, title, caption, opts);
  const img = raster === 'tiff' ? await exportTiff(svg, w, h, dpi, opts) : await exportPng(svg, w, h, dpi, title, caption, opts);
  const vec = await exportSvg(svg, opts);
  return zipFiles([
    { name: `${base}.pdf`, data: pdf },
    { name: `${base}-${dpi}dpi.${raster === 'tiff' ? 'tif' : 'png'}`, data: img },
    { name: `${base}.svg`, data: vec },
    { name: `${base}-caption.txt`, data: caption.replace(/\n/g, '\r\n') + '\r\n' },
    { name: `${base}.studymap.json`, data: project },
  ]);
}
