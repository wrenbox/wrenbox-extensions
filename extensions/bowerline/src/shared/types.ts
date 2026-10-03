/**
 * Core data model. Mirrors the IndexedDB schema owned by the service worker
 * (see background/db.ts) and the W3C Web Annotation selector vocabulary.
 */

export type Color = 'yellow' | 'mint' | 'pink' | 'sky';
export const COLORS: readonly Color[] = ['yellow', 'mint', 'pink', 'sky'];

export type SourceKind = 'web' | 'pdf';

export interface Source {
  id: string;
  kind: SourceKind;
  /** Normalised URL for web pages, `pdfDocument.fingerprints[0]` for PDFs. */
  key: string;
  url: string;
  title: string;
  fileName?: string;
  createdAt: number;
  updatedAt: number;
}

/** https://www.w3.org/TR/annotation-model/#text-quote-selector */
export interface TextQuoteSelector {
  type: 'TextQuoteSelector';
  exact: string;
  prefix: string;
  suffix: string;
}

/** https://www.w3.org/TR/annotation-model/#text-position-selector */
export interface TextPositionSelector {
  type: 'TextPositionSelector';
  start: number;
  end: number;
}

export type Selector = TextQuoteSelector | TextPositionSelector;

/** A rectangle in PDF page space at scale 1 (CSS px at 100% zoom), top-left origin. */
export interface PdfRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PdfAnchor {
  /** 1-based page number. */
  page: number;
  rects: PdfRect[];
}

export interface Highlight {
  id: string;
  sourceId: string;
  color: Color;
  /** The highlighted text as the reader saw it (used for display and export). */
  text: string;
  note: string;
  selectors: Selector[];
  pdf?: PdfAnchor;
  /** True when the passage could not be found the last time the source was open. */
  orphaned: boolean;
  createdAt: number;
  updatedAt: number;
}

/** What a page or the viewer knows about itself before a source record exists. */
export interface SourceInput {
  kind: SourceKind;
  key: string;
  url: string;
  title: string;
  fileName?: string;
}

export interface HighlightInput {
  color: Color;
  text: string;
  note?: string;
  selectors: Selector[];
  pdf?: PdfAnchor;
}

export type HighlightPatch = Partial<Pick<Highlight, 'color' | 'note' | 'orphaned'>>;

export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  defaultColor: Color;
  showToolbar: boolean;
  theme: Theme;
  /** Optional user labels, e.g. { yellow: 'key idea' } renders as "Yellow: key idea". */
  labels: Record<Color, string>;
}

export interface Library {
  sources: Source[];
  highlights: Highlight[];
}

export function isColor(value: unknown): value is Color {
  return typeof value === 'string' && (COLORS as readonly string[]).includes(value);
}

export function quoteSelector(h: Pick<Highlight, 'selectors'>): TextQuoteSelector | undefined {
  return h.selectors.find((s): s is TextQuoteSelector => s.type === 'TextQuoteSelector');
}

export function positionSelector(
  h: Pick<Highlight, 'selectors'>,
): TextPositionSelector | undefined {
  return h.selectors.find((s): s is TextPositionSelector => s.type === 'TextPositionSelector');
}
