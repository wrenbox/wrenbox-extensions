/**
 * Content script entry. Injected on demand (activeTab) or, if the user opted
 * in to "Always on", by a registered content script. All persistence goes to
 * the service worker; this script never uses the page's own storage.
 */
import type { ContentMessage, PingReply } from '../shared/messages';
import { send } from '../shared/messages';
import { getSettings, onSettingsChanged } from '../shared/settings';
import type { SourceInput } from '../shared/types';
import { Engine, pageInfo, type PageStore } from './engine';

declare global {
  interface Window {
    __bowerline?: true;
  }
}

const store: PageStore = {
  async load(page: SourceInput) {
    return (await send('source:get', { key: page.key })).highlights;
  },
  create: (source, highlight) => send('highlight:create', { source, highlight }),
  update: (id, patch) => send('highlight:update', { id, patch }),
  remove: (id) => send('highlight:delete', { id }),
  restore: (highlight, source) => send('highlight:restore', { highlight, source }),
  reportStatus(updates) {
    void send('highlight:status', { updates }).catch(() => undefined);
  },
  async pageChanged(page) {
    return (await send('content:hello', { page })).pendingFocus;
  },
};

/** Pages that draw text on a canvas expose nothing to select. */
function isCanvasRendered(): boolean {
  if (
    location.hostname === 'docs.google.com' &&
    /^\/(document|spreadsheets|presentation)\//.test(location.pathname)
  )
    return true;
  const text = document.body?.innerText?.trim().length ?? 0;
  if (text > 400) return false;
  const vw = window.innerWidth * window.innerHeight;
  return [...document.querySelectorAll('canvas')].some((c) => {
    const r = c.getBoundingClientRect();
    return r.width * r.height > vw * 0.4;
  });
}

interface Ready {
  engine: Engine;
  started: Promise<void>;
}

async function boot(): Promise<Ready & { pendingFocus: string | null }> {
  const settings = await getSettings();
  const page = pageInfo();
  const engine = new Engine({ store, settings });
  onSettingsChanged((s) => engine.setSettings(s));
  // Register with the service worker first: it injects the highlight colours
  // and tells us whether the side panel asked to focus a highlight here.
  const hello = await send('content:hello', { page }).catch(() => ({ pendingFocus: null }));
  return { engine, started: engine.start(), pendingFocus: hello.pendingFocus };
}

function main(): void {
  const ready = boot();

  // Listen synchronously: the service worker messages us right after injecting.
  chrome.runtime.onMessage.addListener((msg: ContentMessage, _sender, reply) => {
    switch (msg?.type) {
      case 'content:ping':
        void ready.then(({ engine }) =>
          reply({ key: engine.pageKey, ...engine.counts } satisfies PingReply),
        );
        return true;
      case 'content:refresh':
        void ready.then(({ engine }) => engine.load());
        return false;
      case 'content:focus':
        void ready
          .then(async ({ engine, started }) => {
            await started;
            await engine.whenLoaded();
            return engine.focus(msg.highlightId);
          })
          .then((focused) => reply({ focused }));
        return true;
      case 'content:activate':
        void ready.then(async ({ engine, started }) => {
          await started;
          let highlighted = false;
          if (msg.highlightSelection) highlighted = await engine.highlightSelection();
          if (msg.announce && !highlighted) {
            engine.ui.toast(
              isCanvasRendered()
                ? "This page draws its text on a canvas (like Google Docs), so there's no selectable text for Bowerline to highlight."
                : engine.statusLine(),
              undefined,
              4000,
            );
          }
          reply({ highlighted });
        });
        return true;
      default:
        return false;
    }
  });

  void ready.then(async ({ engine, started, pendingFocus }) => {
    await started;
    if (pendingFocus) engine.focus(pendingFocus);
  });
}

// executeScript may run this file again on the same page; only start once.
if (!window.__bowerline) {
  window.__bowerline = true;
  main();
}
