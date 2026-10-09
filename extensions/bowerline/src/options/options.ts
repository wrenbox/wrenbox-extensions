/** Settings: general, colours and labels, your data, keyboard shortcuts, about. */
import type { ImportReport } from '../shared/backup';
import { COLOR_INFO, colorLabel } from '../shared/colors';
import { send } from '../shared/messages';
import { getSettings, onSettingsChanged, saveSettings, setLabel } from '../shared/settings';
import { COLORS, type Settings, type Theme } from '../shared/types';
import { logoMark, PRIVACY_URL, wordmark } from '../shared/ui/brand';
import { $, h } from '../shared/ui/dom';
import { downloadText, pickFile, plural, toast } from '../shared/ui/feedback';
import { initTheme } from '../shared/ui/theme';
import { browserName, currentStore, nameBrowserIn } from '../shared/browser';

const ALWAYS_ON_ORIGINS = ['https://*/*', 'http://*/*'];
const SECTIONS = ['general', 'colours', 'data', 'shortcuts', 'about'];

let settings: Settings;

function showSection(): void {
  const id = SECTIONS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'general';
  for (const s of SECTIONS) $(`#${s}`).hidden = s !== id;
  for (const a of document.querySelectorAll<HTMLAnchorElement>('.nav a')) {
    if (a.dataset.section === id) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

// ── General ──────────────────────────────────────────────────────────────────

function renderGeneral(): void {
  const wrap = $('#default-colour');
  wrap.replaceChildren(
    ...COLORS.map((c) =>
      h(
        'button',
        {
          type: 'button',
          class: 'colour-radio',
          role: 'radio',
          'aria-checked': String(settings.defaultColor === c),
          tabindex: settings.defaultColor === c ? '0' : '-1',
          title: colorLabel(c, settings.labels),
          dataset: { color: c },
          onClick: async () => {
            settings = await saveSettings({ defaultColor: c });
            renderGeneral();
            wrap.querySelector<HTMLElement>(`[data-color="${c}"]`)?.focus();
          },
        },
        h('span', { class: 'swatch', dataset: { color: c }, 'aria-hidden': 'true' }),
        COLOR_INFO[c].name,
      ),
    ),
  );
  wrap.onkeydown = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = COLORS.indexOf(settings.defaultColor);
    const next = COLORS[(i + (e.key === 'ArrowRight' ? 1 : COLORS.length - 1)) % COLORS.length]!;
    wrap.querySelector<HTMLButtonElement>(`[data-color="${next}"]`)?.click();
  };
  const toolbar = $<HTMLInputElement>('#show-toolbar');
  toolbar.checked = settings.showToolbar;
  const theme = $('#theme');
  const themes: Array<[Theme, string]> = [
    ['system', 'System'],
    ['light', 'Light'],
    ['dark', 'Dark'],
  ];
  theme.replaceChildren(
    ...themes.map(([t, name]) =>
      h('button', {
        type: 'button',
        role: 'radio',
        'aria-checked': String(settings.theme === t),
        'aria-pressed': String(settings.theme === t),
        text: name,
        onClick: async () => {
          settings = await saveSettings({ theme: t });
          renderGeneral();
        },
      }),
    ),
  );
}

// ── Colours and labels ───────────────────────────────────────────────────────

function renderLabels(): void {
  const wrap = $('#labels');
  wrap.replaceChildren(
    ...COLORS.map((c) => {
      const id = `label-${c}`;
      const preview = h('span', {
        class: 'preview-label',
        text: `Shows as "${colorLabel(c, settings.labels)}"`,
      });
      let timer = 0;
      const input = h('input', {
        type: 'text',
        id,
        maxlength: '40',
        placeholder:
          c === 'yellow'
            ? 'e.g. key idea'
            : c === 'mint'
              ? 'e.g. evidence'
              : c === 'pink'
                ? 'e.g. question'
                : 'e.g. to look up',
        value: settings.labels[c],
        onInput: (e: Event) => {
          const value = (e.target as HTMLInputElement).value;
          preview.textContent = `Shows as "${colorLabel(c, { ...settings.labels, [c]: value })}"`;
          window.clearTimeout(timer);
          timer = window.setTimeout(async () => {
            settings = await saveSettings(setLabel(settings, c, value.trim()));
          }, 300);
        },
      });
      return h(
        'div',
        { class: 'row label-row' },
        h('span', { class: 'swatch', dataset: { color: c }, 'aria-hidden': 'true' }),
        h('label', { class: 'name', for: id, text: COLOR_INFO[c].name }),
        input,
        preview,
      );
    }),
  );
}

// ── Your data ────────────────────────────────────────────────────────────────

async function renderStats(): Promise<void> {
  const stats = await send('library:stats', {});
  $('#stat-highlights').textContent = stats.highlights.toLocaleString();
  $('#stat-sources').textContent = stats.sources.toLocaleString();
}

async function renderAlwaysOn(): Promise<void> {
  $<HTMLInputElement>('#always-on').checked = await chrome.permissions.contains({
    origins: ALWAYS_ON_ORIGINS,
  });
}

function reportText(r: ImportReport): string {
  const parts = [`Restored ${plural(r.highlightsAdded, 'highlight')}`];
  if (r.sourcesAdded) parts[0] += ` from ${plural(r.sourcesAdded, 'new source')}`;
  parts[0] += '.';
  if (r.sourcesMerged)
    parts.push(`${plural(r.sourcesMerged, 'page')} matched pages already here and were merged.`);
  parts.push(...r.messages);
  if (r.settingsApplied.length)
    parts.push('Colour labels from the backup were added where you had none.');
  return parts.join(' ');
}

function showReport(text: string, error = false): void {
  const el = $('#restore-report');
  el.hidden = false;
  el.textContent = text;
  el.classList.toggle('error', error);
}

function wireData(): void {
  const alwaysOn = $<HTMLInputElement>('#always-on');
  alwaysOn.addEventListener('change', async () => {
    if (alwaysOn.checked) {
      // Must be called straight from the click so Chrome sees the user gesture.
      const granted = await chrome.permissions.request({ origins: ALWAYS_ON_ORIGINS });
      if (!granted) toast(`Always on stays off. ${browserName()}'s permission wasn't granted.`);
    } else {
      await chrome.permissions.remove({ origins: ALWAYS_ON_ORIGINS });
    }
    await send('alwaysOn:sync', {});
    await renderAlwaysOn();
  });
  chrome.permissions.onAdded.addListener(() => void renderAlwaysOn());
  chrome.permissions.onRemoved.addListener(() => void renderAlwaysOn());

  $('#backup').addEventListener('click', async () => {
    const backup = await send('backup:export', {});
    downloadText(
      `${JSON.stringify(backup, null, 2)}\n`,
      `bowerline-backup-${backup.exportedAt.slice(0, 10)}.json`,
      'application/json',
    );
    toast(`Backed up ${plural(backup.highlights.length, 'highlight')}.`);
  });

  $('#restore').addEventListener('click', async () => {
    const file = await pickFile('.json,application/json');
    if (!file) return;
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      showReport("That file isn't valid JSON, so it can't be a Bowerline backup.", true);
      return;
    }
    try {
      const report = await send('backup:import', { data });
      showReport(reportText(report));
      await renderStats();
    } catch (err) {
      showReport(String((err as Error).message), true);
    }
  });

  const dialog = $<HTMLDialogElement>('#delete-dialog');
  const confirmInput = $<HTMLInputElement>('#delete-confirm');
  const confirmBtn = $<HTMLButtonElement>('#delete-confirm-btn');
  $('#delete-all').addEventListener('click', () => {
    confirmInput.value = '';
    confirmBtn.disabled = true;
    dialog.showModal();
    confirmInput.focus();
  });
  confirmInput.addEventListener('input', () => {
    confirmBtn.disabled = confirmInput.value.trim() !== 'DELETE';
  });
  $('#delete-cancel').addEventListener('click', () => dialog.close());
  $('#delete-form').addEventListener('submit', async (e) => {
    if (confirmInput.value.trim() !== 'DELETE') {
      e.preventDefault();
      return;
    }
    await send('data:deleteAll', {});
    await renderStats();
    toast('All highlights and notes were deleted from this browser.');
  });
}

// ── Shortcuts and about ──────────────────────────────────────────────────────

async function renderShortcut(): Promise<void> {
  const cmd = (await chrome.commands.getAll()).find((c) => c.name === 'highlight-selection');
  const el = $('#current-shortcut');
  el.replaceChildren(
    cmd?.shortcut
      ? h('kbd', { text: cmd.shortcut })
      : h('span', { class: 'muted', text: 'Not set' }),
  );
}

async function init(): Promise<void> {
  nameBrowserIn();
  await initTheme();
  $('#brand').append(wordmark(26));
  $('#about-mark').append(logoMark(56));
  $('#version').textContent = `version ${chrome.runtime.getManifest().version}`;
  $<HTMLAnchorElement>('#privacy-link').href = PRIVACY_URL;
  void currentStore().then((store) => {
    if (!store) return;
    $<HTMLAnchorElement>('#rate-link').href = store.reviewUrl;
    $('#rate-where').textContent =
      `on ${store.name === 'Edge Add-ons' ? 'Edge Add-ons' : 'the Chrome Web Store'}`;
    $('#rate-item').hidden = false;
  });
  settings = await getSettings();
  onSettingsChanged((s) => {
    settings = s;
    renderGeneral();
  });
  renderGeneral();
  renderLabels();
  $<HTMLInputElement>('#show-toolbar').addEventListener('change', async (e) => {
    settings = await saveSettings({ showToolbar: (e.target as HTMLInputElement).checked });
  });
  $('#change-shortcut').addEventListener('click', () =>
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }),
  );
  $('#open-library').addEventListener('click', () =>
    chrome.tabs.create({ url: chrome.runtime.getURL('library/library.html') }),
  );
  wireData();
  window.addEventListener('hashchange', showSection);
  window.addEventListener('focus', () => {
    void renderShortcut();
    void renderAlwaysOn();
    void renderStats();
  });
  showSection();
  await Promise.all([renderStats(), renderAlwaysOn(), renderShortcut()]);
}

void init();
