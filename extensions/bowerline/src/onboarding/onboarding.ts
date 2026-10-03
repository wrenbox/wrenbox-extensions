/**
 * Onboarding: three steps, opened on install. Step 1 runs the real highlighting
 * engine on a demo paragraph with an in-memory store, so it needs no permission
 * and nothing it does is saved.
 */
import { Engine, type PageStore } from '../content/engine';
import { send } from '../shared/messages';
import { getSettings, onSettingsChanged } from '../shared/settings';
import type { Highlight, Source, SourceInput } from '../shared/types';
import { wordmark } from '../shared/ui/brand';
import { $ } from '../shared/ui/dom';
import { initTheme } from '../shared/ui/theme';

const ALWAYS_ON_ORIGINS = ['https://*/*', 'http://*/*'];
const DEMO_PAGE: SourceInput = {
  kind: 'web',
  key: 'bowerline:onboarding-demo',
  url: '',
  title: 'Bowerline welcome',
};

function memoryStore(onChange: (count: number) => void): PageStore {
  const items = new Map<string, Highlight>();
  const now = Date.now();
  // One example so people can see what a note looks like before trying.
  const seeded: Highlight = {
    id: 'demo-seed',
    sourceId: 'demo',
    color: 'mint',
    text: 'strengthens it far more than reading it again',
    note: 'Notes appear as a small marker. Hover it to read, click it to edit.',
    selectors: [
      {
        type: 'TextQuoteSelector',
        exact: 'strengthens it far more than reading it again',
        prefix: 'out of memory, even imperfectly, ',
        suffix: '. Mark only what you would want',
      },
    ],
    orphaned: false,
    createdAt: now,
    updatedAt: now,
  };
  items.set(seeded.id, seeded);
  const source: Source = {
    id: 'demo',
    kind: 'web',
    key: DEMO_PAGE.key,
    url: '',
    title: DEMO_PAGE.title,
    createdAt: now,
    updatedAt: now,
  };
  const changed = () => onChange(items.size);
  return {
    async load() {
      return [...items.values()].map((x) => ({ ...x }));
    },
    async create(_page, input) {
      const t = Date.now();
      const hl: Highlight = {
        id: crypto.randomUUID(),
        sourceId: 'demo',
        orphaned: false,
        createdAt: t,
        updatedAt: t,
        ...input,
        note: input.note ?? '',
      };
      items.set(hl.id, hl);
      changed();
      return { ...hl };
    },
    async update(id, patch) {
      const hl = items.get(id);
      if (!hl) return null;
      Object.assign(hl, patch, { updatedAt: Date.now() });
      changed();
      return { ...hl };
    },
    async remove(id) {
      const hl = items.get(id);
      if (!hl) return null;
      items.delete(id);
      changed();
      return { highlight: hl, source };
    },
    async restore(hl) {
      items.set(hl.id, hl);
      changed();
      return hl;
    },
    reportStatus() {
      /* the demo never orphans */
    },
  };
}

async function initDemo(): Promise<void> {
  const status = $('#demo-status');
  const store = memoryStore((n) => {
    const yours = n - 1;
    status.textContent =
      yours > 0
        ? `Nice. ${yours} highlight${yours === 1 ? '' : 's'} so far. On real pages they're saved and come back every time you return. This practice paragraph isn't saved.`
        : 'Select a few words to try it.';
  });
  const settings = await getSettings();
  const demo = $('#demo');
  const engine = new Engine({
    store,
    settings,
    root: () => demo,
    page: () => DEMO_PAGE,
    watchUrl: false,
  });
  onSettingsChanged((s) => engine.setSettings(s));
  await engine.start();
  status.textContent = 'Select a few words to try it.';
}

async function initAlwaysOn(): Promise<void> {
  const toggle = $<HTMLInputElement>('#always-on');
  const sync = async () => {
    toggle.checked = await chrome.permissions.contains({ origins: ALWAYS_ON_ORIGINS });
  };
  await sync();
  toggle.addEventListener('change', async () => {
    if (toggle.checked) await chrome.permissions.request({ origins: ALWAYS_ON_ORIGINS });
    else await chrome.permissions.remove({ origins: ALWAYS_ON_ORIGINS });
    await send('alwaysOn:sync', {});
    await sync();
  });
  chrome.permissions.onAdded.addListener(() => void sync());
  chrome.permissions.onRemoved.addListener(() => void sync());
}

async function init(): Promise<void> {
  await initTheme();
  $('#brand').append(wordmark(40));
  const cmd = (await chrome.commands.getAll()).find((c) => c.name === 'highlight-selection');
  if (cmd?.shortcut) $('#shortcut').textContent = cmd.shortcut;
  $('#open-pdf').addEventListener('click', () =>
    chrome.tabs.create({ url: chrome.runtime.getURL('viewer/viewer.html') }),
  );
  $('#sample-pdf').addEventListener('click', () =>
    chrome.tabs.create({ url: chrome.runtime.getURL('viewer/viewer.html?sample=1') }),
  );
  await Promise.all([initDemo(), initAlwaysOn()]);
}

void init();
