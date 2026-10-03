/**
 * A whitespace-normalised view of a DOM subtree's text, with a mapping back to
 * text nodes. Runs of whitespace (spaces, tabs, newlines, NBSP) collapse to a
 * single space across node boundaries, so the same article yields the same
 * string whether the site re-indents its HTML or not.
 *
 * Only per-node start offsets are stored; exact raw offsets are recomputed on
 * demand by re-scanning a single node, which keeps memory flat on long pages.
 */

const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEMPLATE',
  'TEXTAREA',
  'SELECT',
  'OPTION',
  'IFRAME',
  'OBJECT',
  'CANVAS',
  'VIDEO',
  'AUDIO',
]);

export interface IndexedNode {
  node: Text;
  /** Normalised offset where this node's text starts. */
  start: number;
  end: number;
  /** Whether the last emitted character before this node was a space. */
  collapsed: boolean;
}

export interface TextIndex {
  root: Node;
  text: string;
  nodes: IndexedNode[];
}

const WS = /\s/;

function isEditableHost(el: Element): boolean {
  const ce = el.getAttribute('contenteditable');
  return ce !== null && ce !== 'false';
}

export function isSkippedElement(el: Element, extraSkip?: (el: Element) => boolean): boolean {
  return SKIP_TAGS.has(el.tagName) || isEditableHost(el) || (extraSkip?.(el) ?? false);
}

export function buildTextIndex(root: Node, extraSkip?: (el: Element) => boolean): TextIndex {
  const doc = root.ownerDocument ?? (root as Document);
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        return isSkippedElement(node as Element, extraSkip)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_SKIP;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const parts: string[] = [];
  const nodes: IndexedNode[] = [];
  let length = 0;
  let collapsed = true; // drop leading whitespace
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const textNode = n as Text;
    const data = textNode.data;
    if (!data) continue;
    const start = length;
    const startCollapsed = collapsed;
    let out = '';
    for (let i = 0; i < data.length; i++) {
      const ch = data[i]!;
      if (WS.test(ch)) {
        if (!collapsed) {
          out += ' ';
          collapsed = true;
        }
      } else {
        out += ch;
        collapsed = false;
      }
    }
    length += out.length;
    parts.push(out);
    nodes.push({ node: textNode, start, end: length, collapsed: startCollapsed });
  }
  return { root, text: parts.join(''), nodes };
}

/** Number of normalised characters emitted by node.data[0, rawOffset). */
function normalizedLength(entry: IndexedNode, rawOffset: number): number {
  const data = entry.node.data;
  let collapsed = entry.collapsed;
  let count = 0;
  for (let i = 0; i < rawOffset && i < data.length; i++) {
    if (WS.test(data[i]!)) {
      if (!collapsed) {
        count++;
        collapsed = true;
      }
    } else {
      count++;
      collapsed = false;
    }
  }
  return count;
}

/**
 * Raw offset inside the node for normalised offset `k` (relative to the node).
 * For a start boundary we land on the k-th emitted char; for an end boundary,
 * just after the (k−1)-th.
 */
function rawOffset(entry: IndexedNode, k: number, isEnd: boolean): number {
  const data = entry.node.data;
  let collapsed = entry.collapsed;
  let count = 0;
  for (let i = 0; i < data.length; i++) {
    const ws = WS.test(data[i]!);
    const emits = ws ? !collapsed : true;
    if (emits) {
      if (!isEnd && count === k) return i;
      count++;
      if (isEnd && count === k) return i + 1;
    }
    collapsed = ws ? true : false;
  }
  return data.length;
}

/** Index of the last node whose start <= offset (binary search). */
function nodeAt(index: TextIndex, offset: number, isEnd: boolean): number {
  const nodes = index.nodes;
  let lo = 0;
  let hi = nodes.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const n = nodes[mid]!;
    if (isEnd ? n.start < offset : n.start <= offset) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  // Skip empty-normalised nodes (pure collapsed whitespace) for start boundaries.
  if (!isEnd) {
    while (found >= 0 && found < nodes.length - 1 && nodes[found]!.end <= offset) found++;
  }
  return found;
}

export function rangeFromOffsets(index: TextIndex, start: number, end: number): Range | null {
  if (start >= end || !index.nodes.length) return null;
  const si = nodeAt(index, start, false);
  const ei = nodeAt(index, end, true);
  if (si < 0 || ei < 0) return null;
  const s = index.nodes[si]!;
  const e = index.nodes[ei]!;
  const doc = s.node.ownerDocument;
  const range = doc.createRange();
  range.setStart(s.node, rawOffset(s, start - s.start, false));
  range.setEnd(e.node, rawOffset(e, end - e.start, true));
  return range;
}

/** Normalised offset of a DOM boundary point. */
function pointToOffset(index: TextIndex, container: Node, offset: number, isEnd: boolean): number {
  const nodes = index.nodes;
  if (container.nodeType === Node.TEXT_NODE) {
    // Fast path: the container itself is indexed.
    const i = findNodeIndex(index, container as Text);
    if (i >= 0) {
      const entry = nodes[i]!;
      return entry.start + normalizedLength(entry, offset);
    }
  }
  // General case: find the first indexed text node at or after the point.
  const doc = container.ownerDocument ?? (container as Document);
  const point = doc.createRange();
  point.setStart(container, offset);
  let lo = 0;
  let hi = nodes.length - 1;
  let firstAfter = nodes.length;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    // comparePoint(node, 0) > 0 means the node starts after our point.
    const cmp = point.comparePoint(nodes[mid]!.node, 0);
    if (cmp >= 0) {
      firstAfter = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  if (isEnd) {
    const prev = nodes[firstAfter - 1];
    return prev ? prev.end : 0;
  }
  const next = nodes[firstAfter];
  return next ? next.start : index.text.length;
}

const nodePositions = new WeakMap<TextIndex, Map<Text, number>>();

function findNodeIndex(index: TextIndex, node: Text): number {
  let map = nodePositions.get(index);
  if (!map) {
    map = new Map();
    index.nodes.forEach((n, i) => map!.set(n.node, i));
    nodePositions.set(index, map);
  }
  return map.get(node) ?? -1;
}

/** Normalised [start, end) for a DOM range, trimmed of surrounding whitespace. */
export function offsetsFromRange(
  index: TextIndex,
  range: Range,
): { start: number; end: number } | null {
  let start = pointToOffset(index, range.startContainer, range.startOffset, false);
  let end = pointToOffset(index, range.endContainer, range.endOffset, true);
  while (start < end && index.text[start] === ' ') start++;
  while (end > start && index.text[end - 1] === ' ') end--;
  return start < end ? { start, end } : null;
}
