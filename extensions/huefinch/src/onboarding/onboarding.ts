/**
 * Welcome page, opened once on install. Tells Huefinch's story, shows what it
 * does (a live before/after drawn with the same maths as the filter), and asks
 * for website access with one button.
 */
import { correctionMatrix, simulationMatrix } from '../shared/matrix';
import { ALL_SITES, hasAllSites } from '../shared/messages';
import { DEFAULTS } from '../shared/settings';
import { PRIVACY_URL, STORY, STUDIO_LINE, brandBar } from '../shared/ui/brand';
import { PreviewFilter } from '../shared/ui/controls';
import { $, h, svg } from '../shared/ui/dom';
import { browserName, keyLabel, toggleShortcut } from '../shared/ui/keys';

$('#bar').replaceWith(brandBar());
$('#story').textContent = STORY;
$('#studio').textContent = STUDIO_LINE;
($('#privacy') as HTMLAnchorElement).href = PRIVACY_URL;

$('#warning').textContent =
  `${browserName()} will ask with its standard wording for this kind of access ("read and change all your data on all websites"), ` +
  'because recoloring a page needs the same permission as reading it. Huefinch only adds a filter, and makes no network requests at all.';

// --- The before/after demo ----------------------------------------------------------

/**
 * A common chart red and green that green-weak eyes confuse: CIEDE2000 3.8
 * between them as seen with deuteranopia, 26.7 with Huefinch at 80%.
 */
const NORTH = '#DC3545';
const SOUTH = '#558833';
const north = [62, 48, 40, 37, 40, 46, 52, 54, 52, 44];
const south = [40, 41, 47, 53, 54, 50, 42, 34, 30, 30];

function chart(): SVGElement {
  const x = (i: number) => 20 + i * 51;
  const y = (v: number) => 30 + v * 3;
  const line = (data: number[], color: string) =>
    svg('polyline', {
      points: data.map((v, i) => `${x(i)},${y(v)}`).join(' '),
      fill: 'none',
      stroke: color,
      'stroke-width': 5,
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round',
    });
  const grid = [0, 1, 2, 3, 4].map((i) =>
    svg('line', {
      x1: 10,
      x2: 490,
      y1: 60 + i * 40,
      y2: 60 + i * 40,
      stroke: '#e6e9f2',
      'stroke-width': 1,
    }),
  );
  const text = (t: string, attrs: Record<string, string | number>) => {
    const el = svg('text', { 'font-size': 13, fill: '#18214d', ...attrs });
    el.textContent = t;
    return el;
  };
  const legend = (label: string, color: string, at: number) => [
    svg('rect', { x: at, y: 30, width: 22, height: 5, rx: 2.5, fill: color }),
    text(label, { x: at + 28, y: 37 }),
  ];
  const dot = (label: string, color: string, col: number, row: number) => [
    svg('rect', {
      x: 10 + col * 245,
      y: 268 + row * 40,
      width: 235,
      height: 32,
      rx: 8,
      fill: '#fff',
      stroke: '#dce1ec',
    }),
    svg('circle', { cx: 28 + col * 245, cy: 284 + row * 40, r: 6, fill: color }),
    text(label, { x: 42 + col * 245, y: 289 + row * 40 }),
  ];
  return svg(
    'svg',
    {
      viewBox: '0 0 500 350',
      role: 'img',
      'aria-label': 'Line chart of weekly orders: North and South cross twice.',
    },
    text('Weekly orders by region', { x: 10, y: 16, 'font-size': 16, 'font-weight': 700 }),
    ...legend('North', NORTH, 10),
    ...legend('South', SOUTH, 90),
    ...grid,
    line(north, NORTH),
    line(south, SOUTH),
    ...dot('Store 14 on track', SOUTH, 0, 0),
    ...dot('Store 22 behind', NORTH, 1, 0),
    ...dot('Store 47 behind', NORTH, 0, 1),
    ...dot('Store 31 on track', SOUTH, 1, 1),
  );
}

const before = new PreviewFilter('huefinch-demo-before');
const after = new PreviewFilter('huefinch-demo-after');
const seenBy = simulationMatrix('deutan', 1);
before.set([seenBy]);
after.set([correctionMatrix('deutan', DEFAULTS.strength / 100), seenBy]);
for (const [id, f] of [
  ['#chart-before', before],
  ['#chart-after', after],
] as const) {
  const box = $(id);
  box.append(chart());
  box.style.filter = f.url;
}

// --- Website access -----------------------------------------------------------------

async function render(): Promise<void> {
  const granted = await hasAllSites();
  $('#ask').hidden = granted;
  $('#done').hidden = !granted;
}

$('#grant').addEventListener('click', async () => {
  const granted = await chrome.permissions.request({ origins: ALL_SITES });
  // The service worker registers the filter for every site (permissions.onAdded).
  $('#declined').hidden = granted;
  await render();
  if (granted) $('#done-title').focus();
});
chrome.permissions.onAdded.addListener(() => void render());
chrome.permissions.onRemoved.addListener(() => void render());

// --- Tips ---------------------------------------------------------------------------

const toggle = await toggleShortcut();
$('#tip-toggle').append(
  h('strong', null, toggle ?? 'A shortcut'),
  toggle
    ? ' turns Huefinch on or off on every tab.'
    : ' to turn Huefinch on or off can be set in Settings.',
);
$('#tip-hold').append(
  h('strong', null, `Hold ${keyLabel('Alt+Shift+X')}`),
  ' to see a page’s original colors for a moment.',
);
$('#tip-pick').append(
  h('strong', null, keyLabel('Alt+Shift+C')),
  ', then click anywhere, names the color under the pointer and copies its hex code. Even inside photos.',
);

await render();
document.documentElement.dataset.ready = 'true';
