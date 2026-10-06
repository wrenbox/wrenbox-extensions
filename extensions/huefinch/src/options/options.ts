/** The settings page: color vision, websites, shortcuts, Find my setting, About. */
import { TYPE_LABEL, TYPE_TERM, simulationLabel } from '../shared/labels';
import { correctionMatrix, matrixFor, type CvdType } from '../shared/matrix';
import { ALL_SITES, hasAllSites } from '../shared/messages';
import { PAIRS, suggestType, type ConfusionPair } from '../shared/pairs';
import {
  amountOf,
  applyChanges,
  loadSettings,
  saveSettings,
  type Settings,
} from '../shared/settings';
import { withSite } from '../shared/hostname';
import { NOT_MEDICAL, PRIVACY_URL, STORY, STUDIO_LINE } from '../shared/ui/brand';
import { PreviewFilter, switchControl, visionControls } from '../shared/ui/controls';
import { $, h } from '../shared/ui/dom';
import { checkIcon, closeIcon } from '../shared/ui/icons';
import { browserName, keyLabel, toggleShortcut } from '../shared/ui/keys';

let settings: Settings = await loadSettings();

// --- Sections (hash navigation) ---------------------------------------------------

const SECTIONS = ['vision', 'websites', 'shortcuts', 'find', 'about'];
function showSection(focus: boolean): void {
  const id = SECTIONS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'vision';
  for (const s of SECTIONS) $(`#${s}`).hidden = s !== id;
  for (const a of document.querySelectorAll<HTMLAnchorElement>('.side nav a')) {
    if (a.hash === `#${id}`) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  if (focus) {
    const title = $(`#${id} h2`);
    title.tabIndex = -1;
    title.focus({ preventScroll: true });
  }
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', () => showSection(true));
showSection(false);

// --- Color vision -----------------------------------------------------------------

const master = switchControl(
  'master',
  'Huefinch is on',
  (on) => void saveSettings({ enabled: on }),
);
$('#master').replaceWith(master.el);

const vision = visionControls('options', (patch) => {
  settings = { ...settings, ...patch };
  void renderVision();
  void saveSettings(patch);
});
$('#vision-controls').replaceWith(vision.el);

const STRIP = [
  '#E53935',
  '#FB8C00',
  '#FDD835',
  '#43A047',
  '#00897B',
  '#1E88E5',
  '#8E24AA',
  '#D81B60',
];
for (const id of ['#strip-original', '#strip-filtered'])
  $(id).append(...STRIP.map((c) => h('span', { style: { background: c } })));
const stripFilter = new PreviewFilter('huefinch-preview');
$('#strip-filtered').style.filter = stripFilter.url;

async function renderVision(): Promise<void> {
  master.set(settings.enabled);
  vision.update(settings);
  const toggle = await toggleShortcut();
  $('#master-sub').textContent = settings.enabled
    ? `Recoloring pages with your setting below.${toggle ? ` ${toggle} turns it off.` : ''}`
    : `Off everywhere.${toggle ? ` ${toggle} turns it back on.` : ''}`;
  stripFilter.set(
    settings.enabled ? [matrixFor(settings.mode, settings.type, amountOf(settings))] : [],
  );
  $('#preview-label').textContent = !settings.enabled
    ? 'With Huefinch (off)'
    : settings.mode === 'simulate'
      ? simulationLabel(settings.type, settings.severity).replace('Simulating', 'Simulated:')
      : 'With Huefinch';
}

// --- Websites ---------------------------------------------------------------------

const auto = switchControl('auto', 'Turn on automatically on every website', async (on) => {
  if (on) {
    const granted = await chrome.permissions.request({ origins: ALL_SITES });
    if (!granted) auto.set(false);
  } else {
    await chrome.permissions.remove({ origins: ALL_SITES });
  }
  await renderAccess();
});
$('#auto').replaceWith(auto.el);
($('#privacy-link') as HTMLAnchorElement).href = PRIVACY_URL;

async function renderAccess(): Promise<void> {
  const granted = await hasAllSites();
  auto.set(granted);
  $('#auto-sub').textContent = granted
    ? `${browserName()} asked once for permission to adjust colors on the pages you visit.`
    : `Off: Huefinch works on a tab when you click its icon. ${browserName()} will ask once for permission to adjust colors on the pages you visit. Huefinch never reads them.`;
}

function renderSites(): void {
  const list = $('#off-list');
  list.replaceChildren(
    ...settings.offSites.map((site) =>
      h(
        'li',
        { class: 'chip' },
        h('span', null, site),
        h(
          'button',
          {
            type: 'button',
            'aria-label': `Turn Huefinch back on for ${site}`,
            title: 'Turn back on',
            onclick: () => {
              settings = { ...settings, offSites: withSite(settings.offSites, site, true) };
              void saveSettings({ offSites: settings.offSites });
              renderSites();
              list.querySelector<HTMLButtonElement>('button')?.focus();
            },
          },
          closeIcon(),
        ),
      ),
    ),
  );
  if (!settings.offSites.length)
    list.append(
      h(
        'li',
        { class: 'empty' },
        'None. Huefinch is on for every site. Switch it off for a site from the toolbar popup.',
      ),
    );
}

// --- Shortcuts --------------------------------------------------------------------

async function renderShortcuts(): Promise<void> {
  const toggle = await toggleShortcut();
  $('#toggle-key').textContent = toggle ?? 'Not set';
  $('#pick-key').textContent = keyLabel('Alt+Shift+C');
  $('#hold-key').textContent = keyLabel('Alt+Shift+X');
}
const openShortcuts = $<HTMLButtonElement>('#open-shortcuts');
openShortcuts.textContent = `Open ${browserName()} shortcuts`;
openShortcuts.addEventListener('click', () => {
  void chrome.tabs.create({
    url: `${browserName() === 'Edge' ? 'edge' : 'chrome'}://extensions/shortcuts`,
  });
});
// Shortcut changes in Chrome don't fire an event; refresh when the user comes back.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) void renderShortcuts().then(renderVision);
});

// --- Find my setting --------------------------------------------------------------

const alike = new Set<string>();
const tuneFilter = new PreviewFilter('huefinch-tune');
let tuneType: CvdType | null = null;
$('#find-note').textContent = NOT_MEDICAL;

function pairCard(p: ConfusionPair, index: number, interactive: boolean): HTMLElement {
  const swatches = h(
    'span',
    { class: 'pair-swatches', 'aria-hidden': 'true' },
    h('span', { style: { background: p.a } }),
    h('span', { style: { background: p.b } }),
  );
  if (!interactive) return h('div', { class: 'pair' }, swatches);
  const state = h('span', { class: 'pair-state' });
  const button = h(
    'button',
    {
      type: 'button',
      class: 'pair',
      'aria-pressed': 'false',
      'aria-label': `Pair ${index + 1}: the two colors look alike`,
      onclick: () => {
        if (alike.has(p.id)) alike.delete(p.id);
        else alike.add(p.id);
        paint();
        renderSuggestion();
      },
    },
    swatches,
    state,
  );
  const paint = () => {
    const on = alike.has(p.id);
    button.setAttribute('aria-pressed', String(on));
    state.replaceChildren(...(on ? [checkIcon(), 'Look alike'] : ['Look different']));
  };
  paint();
  return button;
}

$('#pairs').append(...PAIRS.map((p, i) => pairCard(p, i, true)));

function renderSuggestion(): void {
  const out = $('#find-result');
  out.replaceChildren();
  if (!alike.size) return;
  const s = suggestType(alike);
  if (!s.type) return;
  const type = s.type;
  const n = s.counts[type];
  const total = PAIRS.filter((p) => p.type === type).length;
  out.append(
    h('p', { class: 'result-title' }, `Suggested: ${TYPE_LABEL[type]} (${TYPE_TERM[type]})`),
    h(
      'p',
      null,
      `${n} of the ${total} pairs that ${TYPE_LABEL[type].toLowerCase()} eyes tend to confuse looked alike to you.` +
        (s.alsoTry
          ? ` ${TYPE_LABEL[s.alsoTry]} scored the same, so try both and keep the one that separates the pairs best.`
          : ''),
    ),
    h(
      'div',
      { class: 'find-actions' },
      h(
        'button',
        { type: 'button', class: 'btn primary', onclick: () => void useType(type) },
        `Use ${TYPE_LABEL[type]}`,
      ),
      s.alsoTry
        ? h(
            'button',
            { type: 'button', class: 'btn', onclick: () => void useType(s.alsoTry!) },
            `Try ${TYPE_LABEL[s.alsoTry]}`,
          )
        : null,
    ),
  );
}

async function useType(type: CvdType): Promise<void> {
  settings = { ...settings, mode: 'correct', type, enabled: true };
  await saveSettings({ mode: 'correct', type, enabled: true });
  tuneType = type;
  const marked = PAIRS.filter((p) => p.type === type && alike.has(p.id));
  const shown = marked.length ? marked : PAIRS.filter((p) => p.type === type);
  $('#tuned').replaceChildren(...shown.map((p, i) => pairCard(p, i, false)));
  $('#tuned').style.filter = tuneFilter.url;
  $('#tune-sub').textContent =
    `${TYPE_LABEL[type]} is on. Here are the pairs again, with Huefinch. Move the slider until the two colors in each pair look clearly different. A lower strength keeps colors more natural.`;
  $('#tune').hidden = false;
  renderTune();
  $('#tune-amount').focus();
}

const tuneSlider = $<HTMLInputElement>('#tune-amount');
function renderTune(): void {
  if (!tuneType) return;
  if (document.activeElement !== tuneSlider) tuneSlider.value = String(settings.strength);
  const v = Number(tuneSlider.value);
  tuneSlider.style.setProperty('--fill', `${v}%`);
  tuneSlider.setAttribute('aria-valuetext', `${v}%`);
  $('#tune-label').textContent = `Strength: ${v}%`;
  tuneFilter.set([correctionMatrix(tuneType, v / 100)]);
}
tuneSlider.addEventListener('input', () => {
  settings = { ...settings, strength: Number(tuneSlider.value) };
  renderTune();
  void saveSettings({ strength: settings.strength });
});

// --- About ------------------------------------------------------------------------

$('#version').textContent = `Version ${chrome.runtime.getManifest().version}`;
$('#story').textContent = STORY;
$('#studio').textContent = STUDIO_LINE;
($('#about-privacy') as HTMLAnchorElement).href = PRIVACY_URL;
$('#not-medical').textContent = NOT_MEDICAL;

// --- Live updates -------------------------------------------------------------------

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  settings = applyChanges(settings, changes);
  void renderVision();
  renderSites();
  renderTune();
});
chrome.permissions.onAdded.addListener(() => void renderAccess());
chrome.permissions.onRemoved.addListener(() => void renderAccess());

await Promise.all([renderVision(), renderAccess(), renderShortcuts()]);
renderSites();
document.documentElement.dataset.ready = 'true';
