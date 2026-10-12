/**
 * Huefinch content script. Runs at document_start in every frame when
 * automatic mode is on, or in the tab the user clicked the toolbar icon on
 * (activeTab). The top frame does the work; a frame below it recolors itself
 * only when the top page's filter can't reach it (see frames.ts).
 *
 * It adds the color filter and listens for Huefinch's keys. It never reads
 * page text, images or the address beyond the hostname (for the per-site
 * switch), and it sends nothing anywhere except "on/off" to its own service
 * worker for the toolbar icon.
 */
import { identifyColor } from '../shared/color';
import { settingsFromInitial, type Initial } from '../shared/initial';
import { siteKey, isOffOn } from '../shared/hostname';
import { simulationLabel } from '../shared/labels';
import { feColorMatrixValues, matrixFor } from '../shared/matrix';
import type { ContentRequest, PingReply, WorkerRequest } from '../shared/messages';
import {
  amountOf,
  applyChanges,
  sanitize,
  SETTING_KEYS,
  STORAGE_KEYS,
  type Settings,
} from '../shared/settings';
import { PageFilter } from './filter';
import { frameRole, topSiteOf } from './frames';
import { PageUi, copyText } from './ui';

interface EyeDropperResult {
  sRGBHex: string;
}
interface EyeDropperCtor {
  new (): { open(): Promise<EyeDropperResult> };
}

const flag = globalThis as { __huefinch?: true; __huefinchInitial?: Initial };
const isHtml = document.documentElement?.namespaceURI === 'http://www.w3.org/1999/xhtml';

if (!flag.__huefinch && isHtml) {
  flag.__huefinch = true;
  start();
}

function start(): void {
  const role = frameRole(window, navigator.userAgent);
  if (role === 'covered') return;
  const top = role === 'top';
  // A frame follows the switch of the page it's embedded in.
  const site = top
    ? siteKey(location.hostname) || null
    : topSiteOf(location.ancestorOrigins as unknown as string[]);
  // Known synchronously when registered with the initial-state files, so the
  // very first frame is already recolored; storage confirms a moment later.
  // A frame waits for storage instead: the initial files can't know whether
  // the page around it is switched off.
  let settings: Settings | null = top ? settingsFromInitial(flag.__huefinchInitial) : null;
  /** Alt+Shift+X is held: show the original colors. */
  let holding = false;
  /** The eyedropper is open: show the original colors so the pick is the true color. */
  let picking = false;
  /** In a frame: the top page is showing original colors (held key or eyedropper). */
  let original = false;
  let reported: boolean | null = null;
  let told = false;

  const filter = new PageFilter();
  // The pill, card and keys belong to the top page only.
  const ui = top ? new PageUi(filter.root, { onPick: () => pick() }) : null;

  const active = (): boolean => !!settings && settings.enabled && !isOffOn(settings.offSites, site);

  function render(): void {
    const on = active();
    const s = settings;
    // At 0% the matrix is the identity: no filter at all, so no rendering cost.
    const amount = s ? amountOf(s) : 0;
    filter.set(
      on && s && amount > 0 && !holding && !picking && !original
        ? feColorMatrixValues(matrixFor(s.mode, s.type, amount))
        : null,
    );
    if (!ui) return;
    let pill: string | null = null;
    if (on && s && !picking) {
      if (holding) pill = 'Showing original colors';
      else if (s.mode === 'simulate') pill = simulationLabel(s.type, s.severity);
    }
    ui.setPill(pill);
    if (on !== reported) {
      reported = on;
      send({ type: 'state', applied: on });
    }
    // Frames that recolor themselves show their original colors along with the page.
    const showOriginal = holding || picking;
    if (showOriginal !== told) {
      told = showOriginal;
      send({ type: 'original', on: showOriginal });
    }
  }

  function send(msg: WorkerRequest): void {
    try {
      void chrome.runtime.sendMessage(msg).catch(() => {});
    } catch {
      // The extension was updated or removed; this page keeps its last state.
    }
  }

  /** Opens the browser's eyedropper with the filter removed, then shows the card. */
  function pick(): void {
    if (!ui) return;
    ui.hide(false);
    const Dropper = (globalThis as { EyeDropper?: EyeDropperCtor }).EyeDropper;
    if (!Dropper) {
      ui.showCard(null, Promise.resolve(false));
      return;
    }
    picking = true;
    render();
    let result: Promise<EyeDropperResult>;
    try {
      result = new Dropper().open();
    } catch {
      picking = false;
      render();
      return;
    }
    result.then(
      ({ sRGBHex }) => {
        picking = false;
        render();
        const report = identifyColor(sRGBHex);
        const copied = report ? copyText(report.hex) : Promise.resolve(false);
        ui.showCard(report, copied);
      },
      () => {
        // Cancelled with Escape.
        picking = false;
        render();
      },
    );
  }

  // --- Settings ------------------------------------------------------------

  if (settings) render();
  void chrome.storage.local.get([...STORAGE_KEYS]).then((raw) => {
    settings = sanitize(raw);
    render();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    // Only settings matter here (the popup also keeps its rating reminder in storage).
    if (area !== 'local' || !settings || !SETTING_KEYS.some((k) => k in changes)) return;
    settings = applyChanges(settings, changes);
    render();
  });

  if (!ui) {
    // A frame: only follows the page's settings and its held key.
    chrome.runtime.onMessage.addListener((msg: ContentRequest, sender) => {
      if (sender.id !== chrome.runtime.id || msg.type !== 'original') return false;
      original = msg.on;
      render();
      return false;
    });
    return;
  }

  // --- Keys ----------------------------------------------------------------
  // Matched on the physical key (e.code), so they work on every keyboard
  // layout, including macOS where Option+Shift+X types a symbol.

  const isCombo = (e: KeyboardEvent, code: string) =>
    e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && e.code === code;

  /** Typing in a field stays untouched (Option+Shift+C types "Ç" on a Mac). */
  const inField = (e: KeyboardEvent): boolean => {
    const t = e.composedPath()[0];
    if (!(t instanceof HTMLElement)) return false;
    if (t.isContentEditable) return true;
    if (t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return true;
    return (
      t instanceof HTMLInputElement &&
      ![
        'button',
        'checkbox',
        'color',
        'radio',
        'range',
        'reset',
        'submit',
        'file',
        'image',
      ].includes(t.type)
    );
  };

  window.addEventListener(
    'keydown',
    (e) => {
      if (!active() || inField(e)) return;
      if (isCombo(e, 'KeyX')) {
        e.preventDefault();
        if (!holding) {
          holding = true;
          render();
        }
      } else if (isCombo(e, 'KeyC')) {
        e.preventDefault();
        if (!e.repeat && !picking) pick();
      }
    },
    true,
  );

  const release = () => {
    if (!holding) return;
    holding = false;
    render();
  };
  window.addEventListener(
    'keyup',
    (e) => {
      if (e.code === 'KeyX' || e.key === 'Alt' || e.key === 'Shift') release();
    },
    true,
  );
  window.addEventListener('blur', release);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) release();
  });

  // --- Messages from the popup and service worker ---------------------------

  chrome.runtime.onMessage.addListener((msg: ContentRequest, sender, reply) => {
    if (sender.id !== chrome.runtime.id) return false;
    if (msg.type === 'ping') {
      reply({ huefinch: true, applied: active() } satisfies PingReply);
    } else if (msg.type === 'identify') {
      ui!.showOverlay();
      reply({ ok: true });
    }
    return false;
  });
}
