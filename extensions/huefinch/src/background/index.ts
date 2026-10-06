/**
 * Huefinch service worker.
 *
 * - Keeps the content script registered exactly when the user has granted
 *   access to all websites ("Turn on for all websites"), and unregistered
 *   when that access is removed.
 * - Runs the filter on one tab when the user clicks the toolbar icon or
 *   presses the shortcut without automatic mode (activeTab).
 * - Handles the on/off shortcut and keeps the toolbar icon grey while off.
 *
 * It holds no page data. The only thing content scripts send it is whether
 * their tab is recolored, for the icon.
 */
import { canRunOn, isOffOn, siteOf } from '../shared/hostname';
import { excludePatterns, initialFilesFor } from '../shared/initial';
import {
  ALL_SITES,
  CONTENT_SCRIPT_FILE,
  CONTENT_SCRIPT_ID,
  TOGGLE_COMMAND,
  hasAllSites,
  type ActivateResult,
  type ContentRequest,
  type PingReply,
  type WorkerRequest,
} from '../shared/messages';
import {
  SETTING_KEYS,
  loadSettings,
  migrateStorage,
  saveSettings,
  type Settings,
} from '../shared/settings';

const SIZES = [16, 32, 48] as const;
const iconPaths = (on: boolean): Record<string, string> =>
  Object.fromEntries(SIZES.map((s) => [String(s), `icons/icon${on ? '' : '-off'}-${s}.png`]));

// --- Content script registration ---------------------------------------------

let queue: Promise<unknown> = Promise.resolve();
/** Runs registration changes one at a time (install, startup and permission events can overlap). */
function serial<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(job, job);
  queue = next.catch(() => {});
  return next;
}

/**
 * What gets registered: the initial-state files for the current settings,
 * then the content script, on every site except those switched off.
 */
function registration(s: Settings): chrome.scripting.RegisteredContentScript {
  const exclude = excludePatterns(s.offSites);
  return {
    id: CONTENT_SCRIPT_ID,
    js: [...initialFilesFor(s), CONTENT_SCRIPT_FILE],
    matches: ALL_SITES,
    ...(exclude.length ? { excludeMatches: exclude } : {}),
    runAt: 'document_start',
    allFrames: false,
    persistAcrossSessions: true,
  };
}

/**
 * Registers, updates or unregisters the automatic content script to match the
 * permission and the settings. Returns whether automatic mode is on.
 */
export function syncRegistration(): Promise<boolean> {
  return serial(async () => {
    const want = await hasAllSites();
    const existing = await chrome.scripting.getRegisteredContentScripts({
      ids: [CONTENT_SCRIPT_ID],
    });
    if (want) {
      const script = registration(await loadSettings());
      const current = existing[0];
      if (!current) await chrome.scripting.registerContentScripts([script]);
      else if (
        JSON.stringify(current.js) !== JSON.stringify(script.js) ||
        JSON.stringify(current.excludeMatches ?? []) !== JSON.stringify(script.excludeMatches ?? [])
      ) {
        await chrome.scripting.updateContentScripts([
          { ...script, excludeMatches: script.excludeMatches ?? [] },
        ]);
      }
    } else if (existing.length) {
      await chrome.scripting.unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] });
    }
    return want;
  });
}

/** After "Turn on for all websites": recolor the tabs that are already open, without a reload. */
async function recolorOpenTabs(): Promise<void> {
  const tabs = await chrome.tabs.query({ url: ALL_SITES });
  await Promise.all(
    tabs.map((t) => (t.id !== undefined && !t.discarded ? inject(t.id) : Promise.resolve(false))),
  );
}

// --- Running on one tab ----------------------------------------------------------

async function ping(tabId: number): Promise<PingReply | null> {
  try {
    const reply = (await chrome.tabs.sendMessage(tabId, { type: 'ping' } satisfies ContentRequest, {
      frameId: 0,
    })) as PingReply | undefined;
    return reply?.huefinch ? reply : null;
  } catch {
    return null;
  }
}

async function inject(tabId: number): Promise<boolean> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      files: [...initialFilesFor(await loadSettings()), CONTENT_SCRIPT_FILE],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Makes sure the filter runs in this tab. Without automatic mode this works
 * only right after the user clicked the icon or pressed the shortcut
 * (activeTab), and lasts until the tab navigates away.
 */
export async function activateTab(tabId: number): Promise<ActivateResult> {
  if (await ping(tabId)) return { ok: true };
  let url: string | undefined;
  try {
    url = (await chrome.tabs.get(tabId)).url;
  } catch {
    return { ok: false, reason: 'error' };
  }
  // Without access the URL is hidden from us; with it, some pages are still off limits.
  if (url === undefined) return { ok: false, reason: 'no-access' };
  if (!canRunOn(url)) return { ok: false, reason: 'restricted' };
  return (await inject(tabId)) ? { ok: true } : { ok: false, reason: 'no-access' };
}

/** Shows the "Click anywhere to pick a color" overlay in a tab. */
export async function identify(tabId: number): Promise<ActivateResult> {
  const result = await activateTab(tabId);
  if (!result.ok) return result;
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'identify' } satisfies ContentRequest, {
      frameId: 0,
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/** Alt+Shift+F: turns Huefinch on or off everywhere. */
export async function toggle(tab?: chrome.tabs.Tab): Promise<boolean> {
  const { enabled } = await loadSettings();
  await saveSettings({ enabled: !enabled });
  // Turning on from the keyboard also counts as "use it on this tab" (activeTab).
  if (!enabled && tab?.id !== undefined) await activateTab(tab.id);
  return !enabled;
}

// --- Toolbar icon ------------------------------------------------------------------

async function setGlobalIcon(): Promise<void> {
  const { enabled } = await loadSettings();
  await chrome.action.setIcon({ path: iconPaths(enabled) });
  await chrome.action.setTitle({ title: enabled ? 'Huefinch' : 'Huefinch (off)' });
}

/** Per tab, the icon is grey where Huefinch is switched off for that site. */
async function setTabIcon(tabId: number, applied: boolean | null): Promise<void> {
  try {
    if (applied === null) {
      const { enabled } = await loadSettings();
      applied = enabled;
    }
    await chrome.action.setIcon({ tabId, path: iconPaths(applied) });
  } catch {
    // The tab closed.
  }
}

// --- Events ------------------------------------------------------------------------

const ownPage = (sender: chrome.runtime.MessageSender): boolean =>
  sender.id === chrome.runtime.id && !!sender.url?.startsWith(chrome.runtime.getURL(''));

chrome.runtime.onMessage.addListener((msg: WorkerRequest, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return false;
  if (msg.type === 'state') {
    if (sender.tab?.id !== undefined && sender.frameId === 0)
      void setTabIcon(sender.tab.id, msg.applied === true);
    return false;
  }
  // Only Huefinch's own pages (popup, settings) may start things in a tab.
  if (!ownPage(sender)) return false;
  if (msg.type === 'activate') {
    void activateTab(msg.tabId).then(reply);
    return true;
  }
  if (msg.type === 'identify') {
    void identify(msg.tabId).then(reply);
    return true;
  }
  return false;
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === TOGGLE_COMMAND) void toggle(tab);
});

chrome.permissions.onAdded.addListener((p) => {
  void syncRegistration().then((on) => {
    if (on && p.origins?.length) void recolorOpenTabs();
  });
});
chrome.permissions.onRemoved.addListener(() => void syncRegistration());

let resync: ReturnType<typeof setTimeout> | undefined;
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if ('enabled' in changes) void setGlobalIcon();
  // Keep the initial-state files in step (debounced: the slider writes often).
  if (SETTING_KEYS.some((k) => k in changes)) {
    clearTimeout(resync);
    resync = setTimeout(() => void syncRegistration().catch(() => {}), 150);
  }
});

// After a navigation the page may no longer run Huefinch (activeTab ends there).
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== 'complete') return;
  void ping(tabId).then(async (r) => {
    if (r) return setTabIcon(tabId, r.applied);
    // Not running here. With website access the URL is visible: grey on sites switched off.
    const s = await loadSettings();
    return setTabIcon(tabId, s.enabled && !isOffOn(s.offSites, siteOf(tab.url)));
  });
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install')
    void chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/onboarding.html') });
});

/** Runs on every service worker start (install, browser start, wake-up). */
export const ready: Promise<void> = (async () => {
  try {
    await migrateStorage();
  } catch {
    // Storage unavailable for a moment; settings fall back to defaults when read.
  }
  await syncRegistration().catch(() => false);
  await setGlobalIcon().catch(() => {});
})();

// For the end-to-end tests, which drive the worker the way the popup and keys do.
(globalThis as Record<string, unknown>).huefinch = {
  activateTab,
  identify,
  toggle,
  syncRegistration,
  ready,
};
