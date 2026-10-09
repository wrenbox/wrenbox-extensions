/**
 * Toolbar popup. Opening it is a user action that grants activeTab, so the
 * service worker injects Bowerline and restores this page's highlights.
 */
import { colorLabel } from '../shared/colors';
import { send, type PopupState } from '../shared/messages';
import { getSettings, saveSettings } from '../shared/settings';
import { COLORS, type Settings } from '../shared/types';
import { looksLikePdfUrl } from '../shared/url';
import { wordmark } from '../shared/ui/brand';
import { $, h } from '../shared/ui/dom';
import { plural } from '../shared/ui/feedback';
import { icon, type IconName } from '../shared/ui/icons';
import { initTheme } from '../shared/ui/theme';
import { browserName, currentStore } from '../shared/browser';
import { finishRating, rateState, shouldAsk } from './rate';

let tab: chrome.tabs.Tab | undefined;
let settings: Settings;
let state: PopupState | null = null;

function label(el: HTMLElement, name: IconName, text: string, kbd?: string): void {
  el.replaceChildren(icon(name, 18), h('span', { text, style: { flex: '1' } }));
  if (kbd) el.append(h('kbd', { text: kbd }));
}

function setStatus(kind: string, title: string, sub = ''): void {
  $('#status').dataset.state = kind;
  $('#status-title').textContent = title;
  $('#status-sub').textContent = sub;
}

function renderColours(): void {
  const wrap = $('#colours');
  wrap.replaceChildren();
  for (const c of COLORS) {
    const name = colorLabel(c, settings.labels);
    wrap.append(
      h('button', {
        type: 'button',
        class: 'swatch',
        role: 'radio',
        dataset: { color: c },
        title: name,
        'aria-label': name,
        'aria-checked': String(settings.defaultColor === c),
        tabindex: settings.defaultColor === c ? '0' : '-1',
        onClick: async () => {
          settings = await saveSettings({ defaultColor: c });
          renderColours();
          wrap.querySelector<HTMLElement>(`[data-color="${c}"]`)?.focus();
        },
      }),
    );
  }
  wrap.onkeydown = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = COLORS.indexOf(settings.defaultColor);
    const next = COLORS[(i + (e.key === 'ArrowRight' ? 1 : COLORS.length - 1)) % COLORS.length]!;
    wrap.querySelector<HTMLButtonElement>(`[data-color="${next}"]`)?.click();
  };
  $('#colour-name').textContent = colorLabel(settings.defaultColor, settings.labels);
}

function renderState(s: PopupState): void {
  state = s;
  const highlight = $<HTMLButtonElement>('#highlight');
  const openThis = $<HTMLButtonElement>('#open-this-pdf');
  highlight.disabled = s.state !== 'active';
  openThis.hidden = true;
  switch (s.state) {
    case 'active': {
      const sub = s.count
        ? `${plural(s.count - s.orphans, 'highlight')} shown${s.orphans ? ` · ${s.orphans} not found yet` : ''}`
        : 'Select text on the page to highlight it.';
      setStatus('active', 'Active on this page', sub);
      break;
    }
    case 'viewer':
      setStatus(
        'active',
        "You're in the Bowerline PDF viewer",
        'Select text, then press H or pick a colour.',
      );
      break;
    case 'pdf':
      setStatus(
        'restricted',
        `This PDF is in ${browserName()}'s viewer`,
        `Extensions can't change ${browserName()}'s built-in viewer. Open it in Bowerline's viewer to highlight it.`,
      );
      openThis.hidden = false;
      break;
    case 'restricted':
      setStatus('restricted', "Bowerline can't run on this page", s.reason);
      openThis.hidden = !s.isPdf;
      break;
    case 'error':
      setStatus('error', "Bowerline couldn't start here", s.reason);
      break;
  }
  if (!openThis.hidden) openThis.classList.add('primary');
}

/** Once, to someone who clearly uses Bowerline, while it's working on this page. */
async function maybeAskForRating(): Promise<void> {
  if (state?.state !== 'active' && state?.state !== 'viewer') return;
  const store = await currentStore();
  if (!store) return; // unpacked or development copy: no listing to send anyone to
  const rate = await rateState();
  if (rate.done) return;
  const { highlights } = await send('library:stats', {});
  if (!shouldAsk(rate, Date.now(), highlights)) return;
  $('#rate-store').textContent =
    store.name === 'Edge Add-ons' ? 'Edge Add-ons' : 'the Chrome Web Store';
  $('#rate-yes').addEventListener('click', async () => {
    await finishRating(rate);
    await chrome.tabs.create({ url: store.reviewUrl });
    window.close();
  });
  $('#rate-no').addEventListener('click', async () => {
    await finishRating(rate);
    $('#rate').hidden = true;
  });
  $('#rate').hidden = false;
}

async function shortcut(): Promise<string> {
  const all = await chrome.commands.getAll();
  return all.find((c) => c.name === 'highlight-selection')?.shortcut ?? '';
}

async function init(): Promise<void> {
  await initTheme();
  $('#brand').append(wordmark(24));
  settings = await getSettings();
  renderColours();

  const forced = new URLSearchParams(location.search).get('tabId');
  tab = forced
    ? await chrome.tabs.get(Number(forced))
    : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];

  label($('#highlight'), 'highlight', 'Highlight this page', await shortcut());
  label($('#open-this-pdf'), 'file', 'Open this PDF in Bowerline');
  label($('#panel'), 'panel', 'Open side panel');
  label($('#open-pdf'), 'upload', 'Open a PDF from your computer');
  label($('#settings'), 'gear', 'Settings');

  $('#highlight').addEventListener('click', async () => {
    if (!tab?.id) return;
    const res = await send('popup:highlight', { tabId: tab.id });
    if (res.highlighted) window.close();
    else
      setStatus(
        'active',
        'Active on this page',
        'Select some text on the page first, then click here again.',
      );
  });
  $('#open-this-pdf').addEventListener('click', async () => {
    const url = tab?.url ?? (state && 'url' in state ? state.url : '');
    const params = new URLSearchParams({ src: url ?? '' });
    if (tab?.id !== undefined) params.set('tab', String(tab.id));
    await chrome.tabs.create({ url: chrome.runtime.getURL(`viewer/viewer.html?${params}`) });
    window.close();
  });
  $('#panel').addEventListener('click', async () => {
    if (tab?.windowId !== undefined) await chrome.sidePanel.open({ windowId: tab.windowId });
    window.close();
  });
  $('#open-pdf').addEventListener('click', async () => {
    await chrome.tabs.create({ url: chrome.runtime.getURL('viewer/viewer.html') });
    window.close();
  });
  $('#settings').addEventListener('click', () => {
    void chrome.runtime.openOptionsPage();
    window.close();
  });

  if (!tab?.id) {
    renderState({ state: 'error', reason: 'There is no active tab.' });
    return;
  }
  try {
    renderState(await send('popup:open', { tabId: tab.id, url: tab.url }));
  } catch (err) {
    renderState({ state: 'error', reason: String((err as Error).message) });
  }
  // A tab whose URL ends in .pdf can always be opened in the viewer.
  if (looksLikePdfUrl(tab.url) && state?.state !== 'viewer') $('#open-this-pdf').hidden = false;
  await maybeAskForRating().catch(() => undefined);
}

void init();
