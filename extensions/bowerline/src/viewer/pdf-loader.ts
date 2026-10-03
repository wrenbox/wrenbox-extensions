/**
 * The PDF loader: the only place in Bowerline's own code that makes a network
 * request. It fetches exactly one URL, the PDF the user chose to open, and
 * nothing else. A Content-Security-Policy added before the fetch limits this
 * page's connections to that PDF's own origin.
 */
import { send } from '../shared/messages';
import { looksLikePdf } from './geometry';

export type LoadFailure =
  | { kind: 'blocked' } // CORS or missing host permission
  | { kind: 'file-access' } // file:// without "Allow access to file URLs"
  | { kind: 'http'; status: number }
  | { kind: 'not-pdf' }
  | { kind: 'too-large' };

export class PdfLoadError extends Error {
  constructor(readonly failure: LoadFailure) {
    super(failure.kind);
  }
}

/** Match pattern for the PDF's origin, e.g. https://example.org/* (ports are not allowed in patterns). */
export function originPattern(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return `${u.protocol}//${u.hostname}/*`;
  } catch {
    return null;
  }
}

export async function hasOriginAccess(url: string): Promise<boolean> {
  const pattern = originPattern(url);
  return pattern ? chrome.permissions.contains({ origins: [pattern] }) : false;
}

/**
 * Restricts this page's connections to the extension itself plus the PDF's
 * origin. Policies only ever tighten, so this is set once, before any request.
 */
export function lockConnections(url: string | null): void {
  let extra = '';
  if (url) {
    try {
      const u = new URL(url);
      if (u.protocol === 'file:') extra = ' file:';
      else if (u.protocol === 'https:' || u.protocol === 'http:') extra = ` ${u.origin}`;
    } catch {
      /* invalid URL: allow nothing extra */
    }
  }
  const meta = document.createElement('meta');
  meta.httpEquiv = 'Content-Security-Policy';
  meta.content = `connect-src 'self' blob: data:${extra}; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'`;
  document.head.prepend(meta);
}

async function fetchDirect(url: string): Promise<Uint8Array> {
  const credentials: RequestCredentials = (await hasOriginAccess(url)) ? 'include' : 'omit';
  let response: Response;
  try {
    /*! bowerline-network-allow: PDF loader (fetches the PDF the user chose to open, from its own URL) */
    response = await fetch(url, { credentials, cache: 'default', redirect: 'follow' });
  } catch {
    throw new PdfLoadError(url.startsWith('file:') ? { kind: 'file-access' } : { kind: 'blocked' });
  }
  if (!response.ok) throw new PdfLoadError({ kind: 'http', status: response.status });
  return new Uint8Array(await response.arrayBuffer());
}

function fromBase64(b64: string): Uint8Array {
  const U8 = Uint8Array as unknown as { fromBase64?: (s: string) => Uint8Array };
  if (U8.fromBase64) return U8.fromBase64(b64);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Loads the PDF at `url`. If the direct request is blocked and the PDF is open
 * in a tab Bowerline was activated on, it is read from inside that tab instead
 * (a same-origin request for the same file).
 */
export async function loadPdf(url: string, tabId?: number): Promise<Uint8Array> {
  let bytes: Uint8Array;
  try {
    bytes = await fetchDirect(url);
  } catch (err) {
    if (!(err instanceof PdfLoadError) || err.failure.kind !== 'blocked' || tabId === undefined)
      throw err;
    const res = await send('pdf:fetchViaTab', { tabId, url }).catch(() => ({
      error: 'unavailable',
    }));
    if ('error' in res) {
      if (res.error === 'too-large') throw new PdfLoadError({ kind: 'too-large' });
      throw err;
    }
    bytes = fromBase64(res.base64);
  }
  if (!looksLikePdf(bytes)) throw new PdfLoadError({ kind: 'not-pdf' });
  return bytes;
}
