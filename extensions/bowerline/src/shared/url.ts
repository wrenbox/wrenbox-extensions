/**
 * URL normalisation for web sources. Two visits to the same article must map to
 * the same key even when a newsletter or social network appended tracking
 * parameters, while genuinely different pages (?page=2, ?id=7) stay distinct.
 */

const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'mc_eid',
  // Same family, equally content-free:
  'mc_cid',
  'dclid',
  'gbraid',
  'wbraid',
  'msclkid',
  'igshid',
  'yclid',
  '_hsenc',
  '_hsmi',
]);

function isTrackingParam(rawName: string): boolean {
  let name: string;
  try {
    name = decodeURIComponent(rawName.replace(/\+/g, ' ')).toLowerCase();
  } catch {
    name = rawName.toLowerCase();
  }
  return name.startsWith('utm_') || TRACKING_PARAMS.has(name);
}

/**
 * Strips the fragment and tracking parameters, keeping every other query
 * parameter byte-for-byte and in order. Hash-routed single-page apps
 * (`#/route` or `#!/route`) keep their route, because there the hash *is* the page.
 */
export function normalizeUrl(href: string): string {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return href;
  }
  const hash = url.hash;
  url.hash = '';
  if (url.search) {
    const kept = url.search
      .slice(1)
      .split('&')
      .filter((pair) => pair !== '' && !isTrackingParam(pair.split('=')[0] ?? ''));
    url.search = kept.length ? `?${kept.join('&')}` : '';
  }
  let out = url.href;
  if (out.endsWith('?')) out = out.slice(0, -1);
  if (hash.startsWith('#/') || hash.startsWith('#!')) out += hash;
  return out;
}

/** A short, readable form for cards: "longread.example/why-we-forget". */
export function displayUrl(href: string): string {
  try {
    const url = new URL(href);
    if (url.protocol === 'file:') return decodeURIComponent(url.pathname.split('/').pop() || href);
    const path = url.pathname === '/' ? '' : url.pathname;
    return `${url.host.replace(/^www\./, '')}${path}`;
  } catch {
    return href;
  }
}

export function looksLikePdfUrl(href: string | undefined): boolean {
  if (!href) return false;
  try {
    const url = new URL(href);
    return /\.pdf$/i.test(url.pathname);
  } catch {
    return false;
  }
}

/** File name from a URL path, used when a PDF has no title. */
export function fileNameFromUrl(href: string): string {
  try {
    const url = new URL(href);
    const last = url.pathname.split('/').filter(Boolean).pop();
    return last ? decodeURIComponent(last) : url.host;
  } catch {
    return href;
  }
}
