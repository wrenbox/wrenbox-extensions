/** Rectangle helpers for PDF highlights. Pure functions, unit-tested. */
import type { PdfRect } from '../shared/types';

/**
 * Merges the many small rects a text-layer selection produces (one per span)
 * into one rect per line. Rects on the same line are joined when they touch or
 * nearly touch.
 */
export function mergeRects(rects: PdfRect[]): PdfRect[] {
  const usable = rects.filter((r) => r.w > 0.5 && r.h > 0.5);
  const sorted = [...usable].sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2) || a.x - b.x);
  const lines: PdfRect[] = [];
  for (const r of sorted) {
    const last = lines[lines.length - 1];
    if (last) {
      const sameLine =
        Math.abs(last.y + last.h / 2 - (r.y + r.h / 2)) < Math.min(last.h, r.h) * 0.5;
      const near = r.x <= last.x + last.w + Math.max(last.h, r.h) * 0.6 && r.x + r.w >= last.x - 1;
      if (sameLine && near) {
        const x = Math.min(last.x, r.x);
        const y = Math.min(last.y, r.y);
        const right = Math.max(last.x + last.w, r.x + r.w);
        const bottom = Math.max(last.y + last.h, r.y + r.h);
        last.x = x;
        last.y = y;
        last.w = right - x;
        last.h = bottom - y;
        continue;
      }
    }
    lines.push({ ...r });
  }
  return lines.map((r) => ({
    x: round(r.x),
    y: round(r.y),
    w: round(r.w),
    h: round(r.h),
  }));
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function containsPoint(r: PdfRect, x: number, y: number, slop = 1): boolean {
  return x >= r.x - slop && x <= r.x + r.w + slop && y >= r.y - slop && y <= r.y + r.h + slop;
}

export function bounds(rects: PdfRect[]): PdfRect | null {
  if (!rects.length) return null;
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.w));
  const bottom = Math.max(...rects.map((r) => r.y + r.h));
  return { x, y, w: right - x, h: bottom - y };
}

/** Lays out note cards top-down so none overlap; returns each card's top. */
export function stackCards(wanted: number[], heights: number[], gap = 10): number[] {
  const order = wanted.map((top, i) => ({ top, i })).sort((a, b) => a.top - b.top);
  const out = new Array<number>(wanted.length);
  let cursor = -Infinity;
  for (const { top, i } of order) {
    const t = Math.max(top, cursor);
    out[i] = t;
    cursor = t + (heights[i] ?? 0) + gap;
  }
  return out;
}

/** True if the bytes look like a PDF (the header may follow some junk bytes). */
export function looksLikePdf(bytes: Uint8Array): boolean {
  const head = String.fromCharCode(...bytes.subarray(0, 1024));
  return head.includes('%PDF-');
}
