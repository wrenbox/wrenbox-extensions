/**
 * Bowerline service worker: owns the database, routes messages, and activates
 * the content script only after a user action (popup, shortcut, context menu)
 * or, if the user opted in, through a registered content script.
 */
import { createBackup } from '../shared/backup';
import type {
  Broadcast,
  ContentMessage,
  Envelope,
  PingReply,
  PopupState,
  RequestMessage,
  Requests,
  RequestType,
  TabInfo,
} from '../shared/messages';
import { getSettings, saveSettings } from '../shared/settings';
import type { SourceInput } from '../shared/types';
import { looksLikePdfUrl } from '../shared/url';
import { clearAll, counts, getDb, readLibrary } from './db';
import { explainScriptingError, isOwnPage, MSG, restrictionFor, viewerUrl } from './pages';
import * as store from './store';

const CONTENT_JS = 'content/content.js';
const CONTENT_CSS = 'content/content.css';
const ALWAYS_ON_ID = 'bowerline-always-on';
export const ALWAYS_ON_ORIGINS = ['https://*/*', 'http://*/*'];
const MENU_HIGHLIGHT = 'bowerline-highlight';
const MENU_OPEN_PDF = 'bowerline-open-pdf';
const MENU_OPEN_THIS_PDF = 'bowerline-open-this-pdf';
const PDF_LINK_PATTERNS = [
  '*://*/*.pdf',
  '*://*/*.pdf?*',
  '*://*/*.PDF',
  '*://*/*.PDF?*',
  'file:///*.pdf',
  'file:///*.PDF',
];
/** Chrome's extension messaging tops out around 64 MB; base64 adds a third. */
const MAX_TAB_FETCH_BYTES = 45 * 1024 * 1024;

// ── Tab registry ─────────────────────────────────────────────────────────────
// Which tab shows which source. Kept in session storage so it survives the
// service worker going to sleep; nothing here is written to disk.

type Registry = Record<string, Omit<TabInfo, 'tabId'>>;

async function readRegistry(): Promise<Registry> {
  return ((await chrome.storage.session.get('tabs')).tabs as Registry | undefined) ?? {};
}

async function writeRegistry(reg: Registry): Promise<void> {
  await chrome.storage.session.set({ tabs: reg });
}

async function registerTab(tabId: number, page: SourceInput): Promise<void> {
  const reg = await readRegistry();
  const entry: Omit<TabInfo, 'tabId'> = {
    kind: page.kind,
    key: page.key,
    url: page.url,
    title: page.title,
  };
  if (page.fileName) entry.fileName = page.fileName;
  reg[tabId] = entry;
  await writeRegistry(reg);
  broadcast({ type: 'broadcast:tabs' });
}

async function forgetTab(tabId: number): Promise<void> {
  const reg = await readRegistry();
  if (reg[tabId]) {
    delete reg[tabId];
    await writeRegistry(reg);
  }
}

async function ping(tabId: number): Promise<PingReply | null> {
  try {
    const msg: ContentMessage = { type: 'content:ping' };
    return ((await chrome.tabs.sendMessage(tabId, msg, { frameId: 0 })) as PingReply) ?? null;
  } catch {
    return null;
  }
}

/** The registry entry for a tab, verified to still be live. */
async function tabInfo(tabId: number): Promise<TabInfo | null> {
  const entry = (await readRegistry())[tabId];
  if (!entry) return null;
  if (entry.kind === 'web') {
    const alive = await ping(tabId);
    if (!alive || alive.key !== entry.key) {
      await forgetTab(tabId);
      return null;
    }
  } else {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.url && !isOwnPage(tab.url)) {
        await forgetTab(tabId);
        return null;
      }
    } catch {
      await forgetTab(tabId);
      return null;
    }
  }
  return { tabId, ...entry };
}

async function tabsShowing(key: string): Promise<number[]> {
  const reg = await readRegistry();
  return Object.entries(reg)
    .filter(([, v]) => v.key === key)
    .map(([id]) => Number(id));
}

// ── Broadcasting changes ─────────────────────────────────────────────────────

function broadcast(msg: Broadcast): void {
  chrome.runtime.sendMessage(msg).catch(() => {
    /* no extension page is listening */
  });
}

async function notifyChanged(sourceIds: string[], exceptTab?: number): Promise<void> {
  broadcast({ type: 'broadcast:changed', sourceIds });
  const db = await getDb();
  const reg = await readRegistry();
  const keys = new Set<string>();
  for (const id of sourceIds) {
    const s = await db.get('sources', id);
    if (s) keys.add(s.key);
  }
  for (const [tabId, entry] of Object.entries(reg)) {
    const id = Number(tabId);
    if (id === exceptTab || entry.kind !== 'web') continue;
    if (sourceIds.length === 0 || keys.has(entry.key) || keys.size < sourceIds.length) {
      const msg: ContentMessage = { type: 'content:refresh' };
      chrome.tabs.sendMessage(id, msg, { frameId: 0 }).catch(() => forgetTab(id));
    }
  }
}

// ── Activation ───────────────────────────────────────────────────────────────

async function injectContent(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, files: [CONTENT_JS] });
}

async function documentContentType(tabId: number): Promise<string | null> {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId, frameIds: [0] },
    func: () => document.contentType,
  });
  return (result?.result as string | undefined) ?? null;
}

/**
 * Runs Bowerline on a tab after a user gesture. Returns whether text was highlighted.
 * PDFs open in Bowerline's viewer instead, since Chrome's viewer can't be changed.
 */
async function activateTab(
  tab: chrome.tabs.Tab,
  opts: { highlightSelection: boolean; announce: boolean },
): Promise<{ highlighted: boolean }> {
  if (tab.id === undefined) return { highlighted: false };
  const tabId = tab.id;
  if (tab.url && isOwnPage(tab.url)) return { highlighted: false };
  const restriction = await restrictionFor(tab.url);
  if (restriction) {
    if (tab.url && looksLikePdfUrl(tab.url)) await openPdfInViewer(tab.url, tabId);
    else await flagUnavailable(tabId);
    return { highlighted: false };
  }
  try {
    if ((await documentContentType(tabId)) === 'application/pdf') {
      await openPdfInViewer(tab.url ?? '', tabId);
      return { highlighted: false };
    }
    await injectContent(tabId);
    const msg: ContentMessage = { type: 'content:activate', ...opts };
    const reply = (await chrome.tabs.sendMessage(tabId, msg, { frameId: 0 })) as
      { highlighted?: boolean } | undefined;
    return { highlighted: !!reply?.highlighted };
  } catch (err) {
    console.warn('Bowerline could not run on this tab:', explainScriptingError(err).reason);
    await flagUnavailable(tabId);
    return { highlighted: false };
  }
}

/** Marks the toolbar icon so the popup can explain why nothing happened. */
async function flagUnavailable(tabId: number): Promise<void> {
  try {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#5D6690' });
    await chrome.action.setBadgeText({ tabId, text: '!' });
    await chrome.action.setTitle({
      tabId,
      title: "Bowerline can't run on this page. Click for details.",
    });
  } catch {
    /* tab closed */
  }
}

async function openPdfInViewer(url: string, fromTabId?: number): Promise<void> {
  const params: Record<string, string> = { src: url };
  if (fromTabId !== undefined) params.tab = String(fromTabId);
  await chrome.tabs.create({ url: viewerUrl(params), index: undefined });
}

async function popupOpen(tabId: number, url: string | undefined): Promise<PopupState> {
  if (url && isOwnPage(url)) {
    return url.includes('/viewer/')
      ? { state: 'viewer' }
      : { state: 'restricted', reason: MSG.otherExtension, isPdf: false };
  }
  const restriction = await restrictionFor(url);
  if (restriction)
    return { state: 'restricted', reason: restriction.reason, isPdf: looksLikePdfUrl(url), url };
  try {
    if ((await documentContentType(tabId)) === 'application/pdf')
      return { state: 'pdf', url: url ?? '' };
    await injectContent(tabId);
    const msg: ContentMessage = {
      type: 'content:activate',
      highlightSelection: false,
      announce: false,
    };
    await chrome.tabs.sendMessage(tabId, msg, { frameId: 0 });
    const status = await ping(tabId);
    await chrome.action.setBadgeText({ tabId, text: '' });
    return {
      state: 'active',
      count: status?.count ?? 0,
      orphans: status?.orphans ?? 0,
      isPdf: false,
    };
  } catch (err) {
    const why = explainScriptingError(err);
    if (why.restricted)
      return { state: 'restricted', reason: why.reason, isPdf: looksLikePdfUrl(url), url };
    return { state: 'error', reason: why.reason };
  }
}

// ── PDF fallback: fetch from inside the PDF's own tab ───────────────────────

async function fetchPdfViaTab(
  tabId: number,
  url: string,
): Promise<{ base64: string } | { error: string }> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || new URL(tab.url).origin !== new URL(url).origin)
      return { error: 'The tab no longer shows this PDF.' };
    const [res] = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      args: [url, MAX_TAB_FETCH_BYTES],
      // Runs in the PDF's own tab, so this is a same-origin request for the PDF
      // the user asked to open, and nothing else.
      func: async (pdfUrl: string, maxBytes: number) => {
        /*! bowerline-network-allow: PDF loader (same-origin fetch of the PDF open in this tab) */
        const response = await fetch(pdfUrl, { credentials: 'include' });
        if (!response.ok) return { error: `The server answered ${response.status}.` };
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength > maxBytes) return { error: 'too-large' };
        return { base64: (bytes as Uint8Array & { toBase64(): string }).toBase64() };
      },
    });
    return (
      (res?.result as { base64: string } | { error: string } | undefined) ?? { error: 'No result.' }
    );
  } catch (err) {
    return { error: String((err as Error)?.message ?? err) };
  }
}

// ── Always on (opt-in) ───────────────────────────────────────────────────────

async function applyAlwaysOn(): Promise<boolean> {
  const granted = await chrome.permissions.contains({ origins: ALWAYS_ON_ORIGINS });
  const registered = await chrome.scripting.getRegisteredContentScripts({ ids: [ALWAYS_ON_ID] });
  if (granted && registered.length === 0) {
    await chrome.scripting.registerContentScripts([
      {
        id: ALWAYS_ON_ID,
        matches: ALWAYS_ON_ORIGINS,
        js: [CONTENT_JS],
        runAt: 'document_idle',
        allFrames: false,
        persistAcrossSessions: true,
      },
    ]);
  } else if (!granted && registered.length > 0) {
    await chrome.scripting.unregisterContentScripts({ ids: [ALWAYS_ON_ID] });
  }
  return granted;
}

let alwaysOnQueue: Promise<boolean> = Promise.resolve(false);

/**
 * Registers or unregisters the Always-on content script to match the granted
 * permission. Calls are serialised: permission events and the settings page
 * often ask at the same moment.
 */
function syncAlwaysOn(): Promise<boolean> {
  alwaysOnQueue = alwaysOnQueue.catch(() => false).then(applyAlwaysOn);
  return alwaysOnQueue;
}

// ── Focusing a highlight from the side panel or library ─────────────────────

async function focusHighlight(id: string): Promise<Requests['highlight:focus']['res']> {
  const db = await getDb();
  const h = await db.get('highlights', id);
  if (!h) return { result: 'needs-file', note: 'This highlight no longer exists.' };
  const source = await db.get('sources', h.sourceId);
  if (!source) return { result: 'needs-file', note: 'This highlight no longer has a source.' };

  for (const tabId of await tabsShowing(source.key)) {
    const info = await tabInfo(tabId);
    if (!info) continue;
    const tab = await chrome.tabs.update(tabId, { active: true });
    if (tab?.windowId !== undefined) await chrome.windows.update(tab.windowId, { focused: true });
    if (source.kind === 'web') {
      const msg: ContentMessage = { type: 'content:focus', highlightId: id };
      await chrome.tabs.sendMessage(tabId, msg, { frameId: 0 }).catch(() => undefined);
    } else {
      broadcast({ type: 'broadcast:viewer-focus', tabId, highlightId: id });
    }
    return { result: 'focused' };
  }

  if (source.kind === 'pdf') {
    if (source.url && /^(https?|file):/i.test(source.url)) {
      await chrome.tabs.create({ url: viewerUrl({ src: source.url, focus: id }) });
      return { result: 'opened' };
    }
    await chrome.tabs.create({
      url: viewerUrl({ focus: id, expect: source.fileName || source.title }),
    });
    return {
      result: 'needs-file',
      note: `Open “${source.fileName || source.title}” in the viewer to see this highlight.`,
    };
  }

  await chrome.storage.session.set({ pendingFocus: { key: source.key, id } });
  await chrome.tabs.create({ url: source.url });
  const alwaysOn = await chrome.permissions.contains({ origins: ALWAYS_ON_ORIGINS });
  return alwaysOn
    ? { result: 'opened' }
    : {
        result: 'opened',
        note: 'Page opened. Click the Bowerline icon there to show your highlights.',
      };
}

async function takePendingFocus(key: string): Promise<string | null> {
  const { pendingFocus } = (await chrome.storage.session.get('pendingFocus')) as {
    pendingFocus?: { key: string; id: string };
  };
  if (pendingFocus?.key !== key) return null;
  await chrome.storage.session.remove('pendingFocus');
  return pendingFocus.id;
}

// ── Message router ───────────────────────────────────────────────────────────

type Handler<T extends RequestType> = (
  msg: RequestMessage<T>,
  sender: chrome.runtime.MessageSender,
) => Promise<Requests[T]['res']>;

const handlers: { [T in RequestType]: Handler<T> } = {
  'source:get': async ({ key }) => store.getSource(await getDb(), key),
  'source:touch': async ({ source }) => store.touchSource(await getDb(), source),
  'highlight:create': async ({ source, highlight }, sender) => {
    const created = await store.createHighlight(await getDb(), source, highlight);
    void notifyChanged([created.source.id], sender.tab?.id);
    return created.highlight;
  },
  'highlight:update': async ({ id, patch }, sender) => {
    const h = await store.updateHighlight(await getDb(), id, patch);
    if (h) void notifyChanged([h.sourceId], sender.tab?.id);
    return h;
  },
  'highlight:delete': async ({ id }, sender) => {
    const res = await store.deleteHighlight(await getDb(), id);
    if (res) void notifyChanged([res.highlight.sourceId], sender.tab?.id);
    return res;
  },
  'highlight:restore': async ({ highlight, source }, sender) => {
    const h = await store.restoreHighlight(await getDb(), highlight, source);
    void notifyChanged([h.sourceId], sender.tab?.id);
    return h;
  },
  'highlight:status': async ({ updates }, sender) => {
    const changed = await store.setStatuses(await getDb(), updates);
    if (changed.length) void notifyChanged(changed, sender.tab?.id);
    return null;
  },
  'highlight:focus': async ({ id }) => focusHighlight(id),
  'library:get': async () => readLibrary(await getDb()),
  'library:stats': async () => counts(await getDb()),
  'backup:export': async () =>
    createBackup(
      await readLibrary(await getDb()),
      await getSettings(),
      chrome.runtime.getManifest().version,
    ),
  'backup:import': async ({ data }) => {
    const { report, settings } = await store.importBackup(await getDb(), data, await getSettings());
    if (settings) await saveSettings(settings);
    void notifyChanged([]);
    return report;
  },
  'data:deleteAll': async () => {
    await clearAll(await getDb());
    void notifyChanged([]);
    return null;
  },
  'source:delete': async ({ id }) => {
    await store.deleteSource(await getDb(), id);
    void notifyChanged([id]);
    return null;
  },
  'content:hello': async ({ page }, sender) => {
    const tabId = sender.tab?.id;
    if (tabId === undefined) return { pendingFocus: null };
    // Highlight colours go in as an injected stylesheet. It is invisible to the
    // page's scripts (not in document.styleSheets) and only contains
    // ::highlight(bowerline-*) rules, so no page element is restyled. (Chrome
    // ignores ::highlight() in user-origin sheets, so it must be AUTHOR.)
    await chrome.scripting
      .insertCSS({
        target: { tabId, frameIds: [sender.frameId ?? 0] },
        files: [CONTENT_CSS],
        origin: 'AUTHOR',
      })
      .catch(() => undefined);
    await registerTab(tabId, page);
    void chrome.action.setBadgeText({ tabId, text: '' }).catch(() => undefined);
    return { pendingFocus: await takePendingFocus(page.key) };
  },
  'tab:register': async ({ page }, sender) => {
    if (sender.tab?.id !== undefined) await registerTab(sender.tab.id, page);
    return null;
  },
  'tab:info': async ({ tabId }) => tabInfo(tabId),
  'popup:open': async ({ tabId, url }) => popupOpen(tabId, url),
  'popup:highlight': async ({ tabId }) => {
    const tab = await chrome.tabs.get(tabId);
    return activateTab(tab, { highlightSelection: true, announce: false });
  },
  'pdf:fetchViaTab': async ({ tabId, url }) => fetchPdfViaTab(tabId, url),
  'alwaysOn:sync': async () => ({ enabled: await syncAlwaysOn() }),
};

const CONTENT_SCRIPT_REQUESTS = new Set<RequestType>([
  'source:get',
  'highlight:create',
  'highlight:update',
  'highlight:delete',
  'highlight:restore',
  'highlight:status',
  'content:hello',
]);

chrome.runtime.onMessage.addListener((msg: RequestMessage, sender, sendResponse) => {
  if (!msg || typeof msg.type !== 'string' || !(msg.type in handlers)) return false;
  // Only Bowerline's own pages and content scripts can reach this listener
  // (there is no externally_connectable), but check the sender anyway.
  if (sender.id !== chrome.runtime.id) return false;
  // Content scripts run inside web pages' processes, so they get only what they
  // need for the page they are on, never the whole library or bulk operations.
  const fromContentScript = !sender.url?.startsWith(chrome.runtime.getURL(''));
  if (fromContentScript && !CONTENT_SCRIPT_REQUESTS.has(msg.type)) {
    sendResponse({ ok: false, error: 'Not allowed from a web page.' } satisfies Envelope<unknown>);
    return false;
  }
  const handler = handlers[msg.type] as Handler<RequestType>;
  handler(msg, sender).then(
    (value) => sendResponse({ ok: true, value } satisfies Envelope<unknown>),
    (err: unknown) =>
      sendResponse({
        ok: false,
        error: String((err as Error)?.message ?? err),
      } satisfies Envelope<unknown>),
  );
  return true;
});

// ── Context menus, shortcut, lifecycle ───────────────────────────────────────

function createMenus(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_HIGHLIGHT,
      title: 'Highlight with Bowerline',
      contexts: ['selection', 'page'],
    });
    chrome.contextMenus.create({
      id: MENU_OPEN_PDF,
      title: 'Open in Bowerline PDF viewer',
      contexts: ['link'],
      targetUrlPatterns: PDF_LINK_PATTERNS,
    });
    chrome.contextMenus.create({
      id: MENU_OPEN_THIS_PDF,
      title: 'Open this PDF in Bowerline',
      contexts: ['page'],
      documentUrlPatterns: PDF_LINK_PATTERNS,
    });
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_OPEN_PDF && info.linkUrl) {
    void openPdfInViewer(info.linkUrl);
  } else if (info.menuItemId === MENU_OPEN_THIS_PDF && tab) {
    void openPdfInViewer(info.pageUrl ?? tab.url ?? '', tab.id);
  } else if (info.menuItemId === MENU_HIGHLIGHT && tab) {
    void activateTab(tab, { highlightSelection: !!info.selectionText, announce: true });
  }
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'highlight-selection' && tab)
    void activateTab(tab, { highlightSelection: true, announce: true });
});

chrome.runtime.onInstalled.addListener((details) => {
  createMenus();
  void syncAlwaysOn();
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => undefined);
  if (details.reason === 'install') {
    void chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/onboarding.html') });
  }
});

chrome.runtime.onStartup.addListener(() => void syncAlwaysOn());
chrome.permissions.onAdded.addListener(() => void syncAlwaysOn());
chrome.permissions.onRemoved.addListener(() => void syncAlwaysOn());
chrome.tabs.onRemoved.addListener((tabId) => void forgetTab(tabId));
chrome.tabs.onActivated.addListener(() => broadcast({ type: 'broadcast:tabs' }));
chrome.tabs.onUpdated.addListener((_tabId, change) => {
  if (change.status === 'complete') broadcast({ type: 'broadcast:tabs' });
});

// Exposed for end-to-end tests, which drive the same code paths a click would.
Object.assign(globalThis, { bowerline: { activateTab, syncAlwaysOn, getDb } });
