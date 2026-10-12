/**
 * Which store this copy of Huefinch came from, so "Rate Huefinch" opens the
 * listing people can actually rate. One build serves both stores, so this is
 * decided at runtime, from the update URL the browser keeps for the install.
 */

export interface Store {
  name: 'Chrome Web Store' | 'Edge Add-ons';
  /** This item's listing, where people rate and review it. */
  reviewUrl: string;
}

// Listing addresses, completed with the extension id. Huefinch never requests
// them; they open as a normal tab, and only when the user clicks.
const CHROME_LISTING = 'https://chromewebstore.google.com/detail/';
const EDGE_LISTING = 'https://microsoftedge.microsoft.com/addons/detail/';

/**
 * The store behind an update URL: an Edge user who installed from the Chrome
 * Web Store is sent there too. Unpacked, development and self-hosted copies
 * have no store: null.
 */
export function storeFor(updateUrl: string | undefined, id: string): Store | null {
  if (!updateUrl) return null;
  let host: string;
  try {
    host = new URL(updateUrl).hostname;
  } catch {
    return null;
  }
  if (host === 'microsoft.com' || host.endsWith('.microsoft.com'))
    return { name: 'Edge Add-ons', reviewUrl: EDGE_LISTING + id };
  if (host === 'google.com' || host.endsWith('.google.com'))
    return { name: 'Chrome Web Store', reviewUrl: `${CHROME_LISTING + id}/reviews` };
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

/** "the Chrome Web Store" / "Edge Add-ons", for the middle of a sentence. */
export const storeInSentence = (store: Store): string =>
  store.name === 'Edge Add-ons' ? 'Edge Add-ons' : 'the Chrome Web Store';
