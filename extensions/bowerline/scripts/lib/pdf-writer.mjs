/**
 * A minimal, dependency-free PDF writer: text pages in Helvetica with a fixed
 * /ID, so pdf.js computes a stable fingerprint. Used for the onboarding sample
 * PDF and for test fixtures.
 */
import { createHash } from 'node:crypto';

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

/** Greedy word wrap by an approximate character budget. */
export function wrap(text, width) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    if (line && (line + ' ' + w).length > width) {
      lines.push(line);
      line = w;
    } else line = line ? `${line} ${w}` : w;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * pages: Array<Array<{ text: string, size?: number, bold?: boolean, gap?: number }>>
 * Each block is wrapped and laid out top-down on a US Letter page.
 */
export function makePdf({ title, pages, seed = title }) {
  const W = 612;
  const H = 792;
  const margin = 72;
  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length;
  };
  const catalogId = add(null);
  const pagesId = add(null);
  const fontId = add(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  );
  const boldId = add(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  );
  const pageIds = [];
  for (const blocks of pages) {
    let y = H - margin;
    const ops = [];
    for (const b of blocks) {
      const size = b.size ?? 12;
      const leading = size * 1.45;
      const chars = Math.floor((W - margin * 2) / (size * 0.5));
      y -= b.gap ?? 0;
      for (const line of wrap(b.text, chars)) {
        y -= leading;
        ops.push(
          `BT /${b.bold ? 'F2' : 'F1'} ${size} Tf ${margin} ${y.toFixed(2)} Td (${esc(line)}) Tj ET`,
        );
      }
      y -= size * 0.6;
    }
    const stream = ops.join('\n');
    const contentId = add(
      `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
    );
    const pageId = add(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    pageIds.push(pageId);
  }
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] =
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  const infoId = add(`<< /Title (${esc(title)}) /Producer (Bowerline test writer) >>`);

  let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  const id = createHash('md5').update(seed).digest('hex');
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R /ID [<${id}> <${id}>] >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
