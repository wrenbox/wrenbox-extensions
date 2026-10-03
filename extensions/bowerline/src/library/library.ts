/** The full-page library: every highlight, grouped by source, with search, filters and export. */
import { sourceTitle } from '../shared/export';
import { isBroadcast, send } from '../shared/messages';
import { DEFAULT_SETTINGS, getSettings, onSettingsChanged } from '../shared/settings';
import type { Color, Library, Settings, Source } from '../shared/types';
import { wordmark } from '../shared/ui/brand';
import { $, h } from '../shared/ui/dom';
import { openExportDialog } from '../shared/ui/export-dialog';
import {
  colorFilter,
  filterLibrary,
  isEditing,
  renderGroups,
  summary,
  type Filter,
} from '../shared/ui/highlight-list';
import { icon } from '../shared/ui/icons';
import { initTheme } from '../shared/ui/theme';

type View = 'all' | 'web' | 'pdf' | 'notes';

const TITLES: Record<View, string> = {
  all: 'Library',
  web: 'Web pages',
  pdf: 'PDFs',
  notes: 'Notes',
};

const state = {
  view: 'all' as View,
  query: '',
  colors: new Set<Color>(),
  source: null as Source | null,
  library: { sources: [], highlights: [] } as Library,
  settings: DEFAULT_SETTINGS as Settings,
};

function filter(): Filter {
  const f: Filter = { query: state.query, colors: state.colors };
  if (state.view === 'web' || state.view === 'pdf') f.kind = state.view;
  if (state.view === 'notes') f.notesOnly = true;
  if (state.source) f.sourceIds = new Set([state.source.id]);
  return f;
}

function render(): void {
  if (isEditing()) return;
  const { labels } = state.settings;
  $('#title').textContent = TITLES[state.view];
  $('#filters').replaceChildren(colorFilter(state.colors, labels, render));
  const groups = filterLibrary(state.library, filter());
  $('#summary').textContent = summary(
    groups,
    state.query,
    state.colors.size > 0 || state.view !== 'all',
  );
  const chip = $('#source-filter');
  chip.replaceChildren();
  if (state.source) {
    chip.append(
      h(
        'span',
        { class: 'source-chip' },
        h('span', { text: `Showing ${sourceTitle(state.source)}` }),
        h(
          'button',
          {
            type: 'button',
            class: 'icon-btn',
            'aria-label': 'Show all sources',
            title: 'Show all sources',
            onClick: () => {
              state.source = null;
              render();
            },
          },
          icon('close', 14),
        ),
      ),
    );
  }
  renderGroups($('#list'), groups, {
    query: state.query,
    labels,
    showOrphanBadge: true,
    onSourceClick: (s) => {
      state.source = s;
      render();
    },
    emptyMessage:
      state.library.highlights.length === 0
        ? h(
            'div',
            null,
            h('strong', { text: 'Nothing here yet.' }),
            h('br'),
            'Highlight a web page or open a PDF, and your lines collect here, in colour, in one place.',
          )
        : 'Nothing matches. Try another search or colour.',
  });
}

function setView(view: View): void {
  state.view = view;
  for (const b of document.querySelectorAll<HTMLButtonElement>('#nav button')) {
    if (b.dataset.view === view) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  render();
}

async function refresh(): Promise<void> {
  state.library = await send('library:get', {});
  if (state.source && !state.library.sources.some((s) => s.id === state.source!.id))
    state.source = null;
  render();
}

async function init(): Promise<void> {
  await initTheme();
  $('#brand').append(wordmark(26));
  state.settings = await getSettings();
  onSettingsChanged((s) => {
    state.settings = s;
    render();
  });
  for (const b of document.querySelectorAll<HTMLButtonElement>('#nav button')) {
    b.addEventListener('click', () => setView(b.dataset.view as View));
  }
  const input = $<HTMLInputElement>('#q');
  input.addEventListener('input', () => {
    state.query = input.value;
    render();
  });
  $('#export').addEventListener('click', () =>
    openExportDialog({
      library: state.library,
      settings: state.settings,
      currentSourceId: state.source?.id ?? null,
    }),
  );
  $('#settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
  $('#open-pdf').addEventListener('click', () =>
    chrome.tabs.create({ url: chrome.runtime.getURL('viewer/viewer.html') }),
  );
  let timer = 0;
  chrome.runtime.onMessage.addListener((msg) => {
    if (isBroadcast(msg) && msg.type === 'broadcast:changed') {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void refresh(), 80);
    }
  });
  const params = new URLSearchParams(location.search);
  if (params.get('export') === '1') {
    await refresh();
    openExportDialog({ library: state.library, settings: state.settings });
    return;
  }
  await refresh();
}

void init();
