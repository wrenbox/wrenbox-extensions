/** Messages between Huefinch's popup, service worker and content script. */

export const ALL_SITES = ['https://*/*', 'http://*/*'];
export const CONTENT_SCRIPT_ID = 'huefinch-filter';
export const CONTENT_SCRIPT_FILE = 'content/content.js';
export const TOGGLE_COMMAND = 'toggle-huefinch';

/** Popup or settings page → service worker. */
export type WorkerRequest =
  | { type: 'activate'; tabId: number }
  | { type: 'identify'; tabId: number }
  /** Content script → service worker: what this tab shows now (for the toolbar icon). */
  | { type: 'state'; applied: boolean };

export interface ActivateResult {
  ok: boolean;
  /** Why it failed, in words for the popup. */
  reason?: 'restricted' | 'no-access' | 'error';
}

/** Service worker or popup → content script. */
export type ContentRequest = { type: 'ping' } | { type: 'identify' };

export interface PingReply {
  huefinch: true;
  applied: boolean;
}

export async function hasAllSites(): Promise<boolean> {
  return chrome.permissions.contains({ origins: ALL_SITES });
}
