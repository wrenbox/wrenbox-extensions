/**
 * Hostnames are the only part of an address Huefinch ever keeps: they key the
 * "off on these sites" list. Paths, queries and fragments are never stored.
 */

/** Pages Chrome never lets extensions change, even with host access. */
const BLOCKED_HOSTS = new Set(['chromewebstore.google.com', 'microsoftedge.microsoft.com']);

/**
 * Normalizes a hostname into the key used in the off-list: lowercase, no
 * trailing dot, and "www." dropped so www.example.com and example.com are one
 * site. Returns "" for anything that isn't a plausible hostname.
 */
export function siteKey(hostname: string): string {
  let h = hostname.trim().toLowerCase();
  if (h.endsWith('.')) h = h.slice(0, -1);
  if (h.startsWith('www.') && h.length > 4 && h.indexOf('.', 4) > 0) h = h.slice(4);
  if (/^\[[0-9a-f:.]+\]$/.test(h)) return h; // IPv6 literal
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(h) || h.length > 253) return '';
  return h;
}

/** The site key for a web page address, or null if it isn't an http(s) page. */
export function siteOf(url: string | undefined | null): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  return siteKey(parsed.hostname) || null;
}

/**
 * Whether Huefinch can recolor this page at all. Chrome's own pages, other
 * extensions, the Web Store and local files (without "Allow access to file
 * URLs") are off limits to every extension.
 */
export function canRunOn(url: string | undefined | null): boolean {
  const site = siteOf(url);
  if (!site) return false;
  if (BLOCKED_HOSTS.has(site)) return false;
  if (site === 'chrome.google.com' && /^https:\/\/chrome\.google\.com\/webstore/i.test(url ?? ''))
    return false;
  return true;
}

export function isOffOn(offSites: readonly string[], site: string | null): boolean {
  return !!site && offSites.includes(site);
}

/** Returns a new off-list with `site` switched on (removed) or off (added). */
export function withSite(offSites: readonly string[], site: string, on: boolean): string[] {
  const key = siteKey(site);
  if (!key) return [...offSites];
  const rest = offSites.filter((s) => s !== key);
  return on ? rest : [...rest, key];
}

/** Cleans a stored off-list: valid keys only, no duplicates, original order kept. */
export function cleanSiteList(value: unknown, limit = 2000): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) {
    if (typeof v !== 'string') continue;
    const key = siteKey(v);
    if (key && !out.includes(key)) out.push(key);
    if (out.length >= limit) break;
  }
  return out;
}
