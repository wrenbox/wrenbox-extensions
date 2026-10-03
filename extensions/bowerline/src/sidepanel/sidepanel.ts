/** Side panel: "This page" and "Library" tabs over the same searchable list. */
import { isBroadcast, send, type TabInfo } from '../shared/messages';
import { DEFAULT_SETTINGS, getSettings, onSettingsChanged } from '../shared/settings';
import type { Color, Library, Settings } from '../shared/types';
import { wordmark } from '../shared/ui/brand';
import { $, h } from '../shared/ui/dom';
import { openExportDialog } from '../shared/ui/export-dialog';
import {
  colorFilter,
  filterLibrary,
  isEditing,
  renderGroups,
  summary,
} from '../shared/ui/highlight-list';
import { icon } from '../shared/ui/icons';
import { initTheme } from '../shared/ui/theme';

type Tab = 'page' | 'library';

const state = {
  tab: 'page' as Tab,
  query: '',
  colors: new Set<Color>(),
  library: { sources: [], highlights: [] } as Library,
  settings: DEFAULT_SETTINGS as Settings,
  current: null as TabInfo | null,
};

const list = $('#list');
const orphans = $('#orphans');
const orphanList = $('#orphan-list');
const summaryEl = $('#summary');
const filters = $('#filters');
const q = $<HTMLInputElement>('#q');

function currentSource() {
  if (!state.current) return null;
  return state.library.sources.find((s) => s.key === state.current!.key) ?? null;
}

function emptyPage(): Node {
  if (!state.current) {
    return h(
      'div',
      null,
      h('strong', { text: "Bowerline isn't on in this tab yet." }),
      h('br'),
      'Click the Bowerline icon in the toolbar or press ',
      h('kbd', { text: 'Alt+Shift+H' }),
      ' to show and add highlights here.',
    );
  }
  if (state.query || state.colors.size)
    return document.createTextNode('No highlights on this page match.');
  return h(
    'div',
    null,
    h('strong', { text: 'No highlights on this page yet.' }),
    h('br'),
    state.current.kind === 'pdf'
      ? 'Select text in the PDF, then pick a colour or press H.'
      : 'Select some text, then pick a colour in the toolbar that appears.',
  );
}

function render(): void {
  if (isEditing()) return; // don't yank an open note editor away
  const { labels } = state.settings;
  filters.replaceChildren(colorFilter(state.colors, labels, render));
  const base = { query: state.query, colors: state.colors };
  orphans.hidden = true;
  if (state.tab === 'page') {
    const source = currentSource();
    const groups = source
      ? filterLibrary(state.library, { ...base, sourceIds: new Set([source.id]) })
      : [];
    const found = groups
      .map((g) => ({ ...g, highlights: g.highlights.filter((x) => !x.orphaned) }))
      .filter((g) => g.highlights.length);
    const lost = groups.flatMap((g) => g.highlights.filter((x) => x.orphaned));
    renderGroups(list, found, {
      query: state.query,
      labels,
      emptyMessage: lost.length ? undefined : emptyPage(),
    });
    if (lost.length && source) {
      orphans.hidden = false;
      renderGroups(orphanList, [{ source, highlights: lost }], { query: state.query, labels });
    }
    summaryEl.textContent = groups.length
      ? summary(groups, state.query, state.colors.size > 0)
      : '';
  } else {
    const groups = filterLibrary(state.library, base);
    renderGroups(list, groups, {
      query: state.query,
      labels,
      showOrphanBadge: true,
      emptyMessage:
        state.library.highlights.length === 0
          ? h(
              'div',
              null,
              h('strong', { text: 'Your library is empty.' }),
              h('br'),
              'Highlights from every page and PDF collect here.',
            )
          : 'Nothing matches your search.',
    });
    summaryEl.textContent = summary(groups, state.query, state.colors.size > 0);
  }
}

async function refreshLibrary(): Promise<void> {
  state.library = await send('library:get', {});
  render();
}

async function refreshTab(): Promise<void> {
  // ?tabId= pins the panel to one tab (used when the panel is opened as a page, e.g. in tests).
  const pinned = new URLSearchParams(location.search).get('tabId');
  const [tab] = pinned
    ? [await chrome.tabs.get(Number(pinned)).catch(() => undefined)]
    : await chrome.tabs.query({ active: true, currentWindow: true });
  state.current = tab?.id !== undefined ? await send('tab:info', { tabId: tab.id }) : null;
  render();
}

function setTab(tab: Tab): void {
  state.tab = tab;
  for (const t of ['page', 'library'] as Tab[]) {
    const btn = $(`#tab-${t}`);
    btn.setAttribute('aria-selected', String(t === tab));
    btn.tabIndex = t === tab ? 0 : -1;
  }
  $('#view').setAttribute('aria-labelledby', `tab-${tab}`);
  render();
}

const timers = new Map<string, number>();
function debounced(key: string, fn: () => void): void {
  window.clearTimeout(timers.get(key));
  timers.set(key, window.setTimeout(fn, 80));
}

async function init(): Promise<void> {
  await initTheme();
  $('#brand').append(wordmark(26));
  $('#settings').append(icon('gear', 18));
  state.settings = await getSettings();
  onSettingsChanged((s) => {
    state.settings = s;
    render();
  });
  $('#tab-page').addEventListener('click', () => setTab('page'));
  $('#tab-library').addEventListener('click', () => setTab('library'));
  $('[role=tablist]').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const next: Tab = state.tab === 'page' ? 'library' : 'page';
      setTab(next);
      $(`#tab-${next}`).focus();
    }
  });
  q.addEventListener('input', () => {
    state.query = q.value;
    render();
  });
  $('#settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
  $('#open-library').addEventListener('click', () =>
    chrome.tabs.create({ url: chrome.runtime.getURL('library/library.html') }),
  );
  $('#export').addEventListener('click', () =>
    openExportDialog({
      library: state.library,
      settings: state.settings,
      currentSourceId: currentSource()?.id ?? null,
      scope: state.tab === 'page' && currentSource() ? 'page' : 'library',
    }),
  );
  chrome.runtime.onMessage.addListener((msg) => {
    if (!isBroadcast(msg)) return;
    if (msg.type === 'broadcast:changed') debounced('library', () => void refreshLibrary());
    if (msg.type === 'broadcast:tabs') debounced('tab', () => void refreshTab());
  });
  chrome.tabs.onActivated.addListener(() => debounced('tab', () => void refreshTab()));
  await Promise.all([refreshLibrary(), refreshTab()]);
}

void init();
