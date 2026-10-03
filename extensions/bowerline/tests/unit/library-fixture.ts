/** A small, realistic library used by exporter, backup and database tests. */
import type { Highlight, Library, Settings, Source } from '../../src/shared/types';
import { DEFAULT_SETTINGS } from '../../src/shared/settings';

const T0 = Date.UTC(2026, 8, 14, 9, 30); // 14 Sep 2026

export const WEB: Source = {
  id: 'src-web',
  kind: 'web',
  key: 'https://longread.example/why-we-forget',
  url: 'https://longread.example/why-we-forget',
  title: 'Why we forget most of what we read',
  createdAt: T0,
  updatedAt: T0 + 60_000,
};

export const PDF: Source = {
  id: 'src-pdf',
  kind: 'pdf',
  key: '3f7a9c2e1b5d4f60a8e7c6b5a4938271',
  url: '',
  title: 'Spaced retrieval study',
  fileName: 'spaced-retrieval-study.pdf',
  createdAt: T0 + 120_000,
  updatedAt: T0 + 180_000,
};

const q = (exact: string, prefix = '', suffix = '') => ({
  type: 'TextQuoteSelector' as const,
  exact,
  prefix,
  suffix,
});
const p = (start: number, end: number) => ({ type: 'TextPositionSelector' as const, start, end });

export const HIGHLIGHTS: Highlight[] = [
  {
    id: 'h-web-2',
    sourceId: WEB.id,
    color: 'mint',
    text: 'Pulling an idea back out of memory, even imperfectly, strengthens it far more than reading it again.',
    note: '',
    selectors: [
      q(
        'Pulling an idea back out of memory, even imperfectly, strengthens it far more than reading it again.',
      ),
      p(260, 361),
    ],
    orphaned: false,
    createdAt: T0 + 30_000,
    updatedAt: T0 + 30_000,
  },
  {
    id: 'h-web-1',
    sourceId: WEB.id,
    color: 'yellow',
    text: 'The problem is rarely comprehension; it is that nothing asks us to retrieve what we read.',
    note: 'Good opening line for my essay intro.',
    selectors: [
      q(
        'The problem is rarely comprehension; it is that nothing asks us to retrieve what we read.',
      ),
      p(96, 186),
    ],
    orphaned: false,
    createdAt: T0 + 10_000,
    updatedAt: T0 + 50_000,
  },
  {
    id: 'h-web-3',
    sourceId: WEB.id,
    color: 'pink',
    text: 'Researchers say "test yourself", then = practice, + spaced, at a day, a week and a month later',
    note: 'Quotes, commas and a leading = check CSV escaping.\nSecond line.',
    selectors: [q('Researchers say "test yourself"'), p(400, 480)],
    orphaned: true,
    createdAt: T0 + 40_000,
    updatedAt: T0 + 40_000,
  },
  {
    id: 'h-pdf-2',
    sourceId: PDF.id,
    color: 'sky',
    text: 'Instructors may get more value from short, frequent recall exercises.',
    note: '',
    selectors: [q('Instructors may get more value from short, frequent recall exercises.')],
    pdf: { page: 3, rects: [{ x: 410, y: 160, w: 250, h: 14 }] },
    orphaned: false,
    createdAt: T0 + 150_000,
    updatedAt: T0 + 150_000,
  },
  {
    id: 'h-pdf-1',
    sourceId: PDF.id,
    color: 'mint',
    text: 'The retrieval group retained 61% of key ideas at seven days, compared with 38%.',
    note: 'Key statistic. Quote this in section 2.',
    selectors: [
      q('The retrieval group retained 61% of key ideas at seven days, compared with 38%.'),
    ],
    pdf: {
      page: 3,
      rects: [
        { x: 72, y: 120, w: 240, h: 14 },
        { x: 72, y: 138, w: 200, h: 14 },
      ],
    },
    orphaned: false,
    createdAt: T0 + 140_000,
    updatedAt: T0 + 140_000,
  },
];

export const LIBRARY: Library = { sources: [WEB, PDF], highlights: HIGHLIGHTS };

export const LABELLED: Settings = {
  ...DEFAULT_SETTINGS,
  labels: { yellow: 'key idea', mint: 'evidence', pink: '', sky: '' },
};

export const NOW = new Date(Date.UTC(2026, 9, 3, 12, 0));
