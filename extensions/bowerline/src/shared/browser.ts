/**
 * One build serves both stores, so anything that names the browser or its
 * store is decided at runtime.
 */

export type BrowserName = 'Chrome' | 'Edge';

/** "Edge" in Microsoft Edge (its user agent carries "Edg/"), "Chrome" everywhere else. */
export function browserName(ua: string = navigator.userAgent): BrowserName {
  return /\bEdg\//.test(ua) ? 'Edge' : 'Chrome';
}

/** Where the browser lists extensions and their details ("Allow access to file URLs"). */
export function extensionsPage(browser: BrowserName = browserName()): string {
  return browser === 'Edge' ? 'edge://extensions' : 'chrome://extensions';
}

export interface Store {
  name: 'Chrome Web Store' | 'Edge Add-ons';
  /** This item's listing, where people rate and review it. */
  reviewUrl: string;
}

/**
 * The store this copy was installed from, read from its update URL, so an
 * Edge user who installed from the Chrome Web Store is sent there too.
 * Unpacked and development installs have no store: null.
 */
export function storeFor(updateUrl: string | undefined, id: string): Store | null {
  if (!updateUrl) return null;
  const host = (() => {
    try {
      return new URL(updateUrl).hostname;
    } catch {
      return '';
    }
  })();
  if (host === 'edge.microsoft.com' || host.endsWith('.microsoft.com'))
    return {
      name: 'Edge Add-ons',
      reviewUrl: `https://microsoftedge.microsoft.com/addons/detail/${id}`,
    };
  if (host === 'clients2.google.com' || host.endsWith('.google.com'))
    return {
      name: 'Chrome Web Store',
      reviewUrl: `https://chromewebstore.google.com/detail/${id}/reviews`,
    };
  return null;
}

/** The store of this running copy (management.getSelf needs no permission). */
export async function currentStore(): Promise<Store | null> {
  try {
    const self = await chrome.management.getSelf();
    return storeFor(self.updateUrl, chrome.runtime.id);
  } catch {
    return null;
  }
}

/** Fills every `[data-browser]` element (written as "Chrome" in the HTML) with the running browser's name. */
export function nameBrowserIn(root: ParentNode = document): void {
  const name = browserName();
  for (const el of root.querySelectorAll('[data-browser]')) el.textContent = name;
}
