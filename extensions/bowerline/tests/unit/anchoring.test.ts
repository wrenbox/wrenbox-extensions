import { describe as group, expect, it } from 'vitest';
import { anchor, describe, FUZZY_THRESHOLD } from '../../src/shared/anchoring/anchor';
import {
  buildTextIndex,
  offsetsFromRange,
  rangeFromOffsets,
} from '../../src/shared/anchoring/text-index';

const ARTICLE =
  'Most readers finish an article feeling they understood it. A week later, little of it remains. ' +
  'The problem is rarely comprehension; it is that nothing asks us to retrieve what we read. ' +
  'Recognition feels like knowing, but it fades quickly. Researchers have repeated the same finding for decades.';

function selectorsFor(text: string, passage: string, occurrence = 0) {
  let at = -1;
  for (let i = 0; i <= occurrence; i++) at = text.indexOf(passage, at + 1);
  if (at < 0) throw new Error('passage not found');
  return describe(text, at, at + passage.length);
}

group('describe', () => {
  it('captures the exact text with 32 characters of context on each side', () => {
    const { quote, position } = selectorsFor(ARTICLE, 'nothing asks us to retrieve what we read');
    expect(quote.type).toBe('TextQuoteSelector');
    expect(quote.exact).toBe('nothing asks us to retrieve what we read');
    expect(quote.prefix).toHaveLength(32);
    expect(quote.suffix).toHaveLength(32);
    expect(ARTICLE.slice(position.start, position.end)).toBe(quote.exact);
  });
});

group('anchor', () => {
  it('finds an exact match', () => {
    const { quote, position } = selectorsFor(ARTICLE, 'Recognition feels like knowing');
    const found = anchor(ARTICLE, quote, position);
    expect(found).toMatchObject({ method: 'exact', score: 1 });
    expect(ARTICLE.slice(found!.start, found!.end)).toBe('Recognition feels like knowing');
  });

  it('finds text that moved because content was added above it', () => {
    const { quote, position } = selectorsFor(ARTICLE, 'nothing asks us to retrieve');
    const moved = `Update: this article was revised and a new introduction was added. ${ARTICLE}`;
    const found = anchor(moved, quote, position)!;
    expect(moved.slice(found.start, found.end)).toBe('nothing asks us to retrieve');
  });

  it('disambiguates duplicate passages by their context', () => {
    const text =
      'Chapter one. The same sentence can appear twice. It opens the chapter. ' +
      'Chapter two. The same sentence can appear twice. It closes the book.';
    const second = selectorsFor(text, 'The same sentence can appear twice.', 1);
    // Even with a misleading position hint, context wins.
    const found = anchor(text, second.quote, { type: 'TextPositionSelector', start: 0, end: 10 })!;
    expect(found.start).toBe(text.lastIndexOf('The same sentence'));
    expect(found.method).toBe('context');
    const first = selectorsFor(text, 'The same sentence can appear twice.', 0);
    expect(anchor(text, first.quote, first.position)!.start).toBe(
      text.indexOf('The same sentence'),
    );
  });

  it('falls back to the position hint when context does not decide', () => {
    const text = 'yes no yes no yes no yes';
    const quote = { type: 'TextQuoteSelector' as const, exact: 'yes', prefix: '', suffix: '' };
    const found = anchor(text, quote, { type: 'TextPositionSelector', start: 14, end: 17 })!;
    expect(found.start).toBe(14);
  });

  it('fuzzy-matches a passage whose wording changed slightly', () => {
    const { quote, position } = selectorsFor(
      ARTICLE,
      'The problem is rarely comprehension; it is that nothing asks us',
    );
    const edited = ARTICLE.replace('rarely comprehension; it is', 'seldom comprehension, it is');
    const found = anchor(edited, quote, position)!;
    expect(found.method).toBe('fuzzy');
    expect(found.score).toBeGreaterThanOrEqual(FUZZY_THRESHOLD);
    expect(edited.slice(found.start, found.end)).toContain(
      'seldom comprehension, it is that nothing asks us',
    );
  });

  it('fuzzy-matches when the text moved and changed, even far from the hint', () => {
    const { quote } = selectorsFor(
      ARTICLE,
      'Researchers have repeated the same finding for decades',
    );
    const changed =
      'Intro. '.repeat(500) + ARTICLE.replace('Researchers have repeated', 'Researchers repeated');
    const found = anchor(changed, quote, { type: 'TextPositionSelector', start: 5, end: 30 })!;
    expect(changed.slice(found.start, found.end)).toContain(
      'Researchers repeated the same finding',
    );
  });

  it('orphans a passage that is gone', () => {
    const { quote, position } = selectorsFor(
      ARTICLE,
      'Recognition feels like knowing, but it fades quickly',
    );
    const gone = ARTICLE.replace(
      'Recognition feels like knowing, but it fades quickly.',
      'An entirely different sentence now stands here.',
    );
    expect(anchor(gone, quote, position)).toBeNull();
  });

  it('does not fuzzy-match very short quotes (too ambiguous)', () => {
    const quote = { type: 'TextQuoteSelector' as const, exact: 'qwerty', prefix: '', suffix: '' };
    expect(anchor('qwerti asdf', quote)).toBeNull();
  });

  it('returns null for an empty quote', () => {
    expect(
      anchor(ARTICLE, { type: 'TextQuoteSelector', exact: '', prefix: '', suffix: '' }),
    ).toBeNull();
  });
});

group('text index (DOM)', () => {
  function dom(html: string): HTMLElement {
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.replaceChildren(div);
    return div;
  }

  it('collapses whitespace across nodes and skips scripts, styles and textareas', () => {
    const root = dom(
      '<p>Hello\n   <b>bold</b>\tworld</p><script>var x = 1;</script><style>p{}</style><textarea>no</textarea><p>  next  </p>',
    );
    const index = buildTextIndex(root);
    expect(index.text).toBe('Hello bold world next ');
  });

  it('round-trips offsets to DOM ranges', () => {
    const root = dom('<p>The problem is <em>rarely</em>   comprehension.</p>');
    const index = buildTextIndex(root);
    const start = index.text.indexOf('rarely comprehension');
    const range = rangeFromOffsets(index, start, start + 'rarely comprehension'.length)!;
    expect(range.toString().replace(/\s+/g, ' ')).toBe('rarely comprehension');
    expect(offsetsFromRange(index, range)).toEqual({
      start,
      end: start + 'rarely comprehension'.length,
    });
  });

  it('anchors the same highlight after the page re-indents its HTML (changed whitespace)', () => {
    const before = buildTextIndex(dom('<p>Pulling an idea back out of memory strengthens it.</p>'));
    const at = before.text.indexOf('back out of memory');
    const { quote, position } = describe(before.text, at, at + 'back out of memory'.length);

    const after = buildTextIndex(
      dom(
        '<div>\n  <p>\n    Pulling an idea\n    back   out of\n    memory strengthens it.\n  </p>\n</div>',
      ),
    );
    const found = anchor(after.text, quote, position)!;
    expect(found.method).toBe('exact');
    const range = rangeFromOffsets(after, found.start, found.end)!;
    expect(range.toString().replace(/\s+/g, ' ')).toBe('back out of memory');
  });

  it('maps element boundary points (e.g. a triple-click selection) to text offsets', () => {
    const root = dom('<p id="a">First paragraph.</p><p id="b">Second paragraph.</p>');
    const index = buildTextIndex(root);
    const range = document.createRange();
    range.setStart(root.querySelector('#b')!, 0);
    range.setEnd(root, 2);
    expect(offsetsFromRange(index, range)).toEqual({
      start: index.text.indexOf('Second'),
      end: index.text.length,
    });
  });

  it('ignores contenteditable regions', () => {
    const root = dom(
      '<p>Read me.</p><div contenteditable="true">Editable draft</div><div contenteditable="false">Static</div>',
    );
    expect(buildTextIndex(root).text).toBe('Read me.Static');
  });
});
