/** Which pages Bowerline can run on, and plain-language reasons when it can't. */
import { looksLikePdfUrl } from '../shared/url';

export interface Restriction {
  reason: string;
}

export const MSG = {
  chromePage:
    "Chrome doesn't let extensions run on its own pages, like Settings, History or the New Tab page.",
  webStore: "Chrome doesn't let extensions run on the Chrome Web Store, so installs stay safe.",
  otherExtension: 'This page belongs to another extension, and Chrome keeps extensions apart.',
  special: "This kind of page (data, blob or view-source) can't be highlighted.",
  fileAccess:
    'To highlight files on your computer, turn on "Allow access to file URLs" for Bowerline on its details page in chrome://extensions.',
  pdfViewer:
    "This PDF is open in Chrome's built-in viewer, which extensions can't change. Open it in Bowerline's viewer instead.",
  errorPage: 'This tab is showing an error page. Reload it, then try again.',
  noAccess:
    "Bowerline doesn't have access to this tab yet. Click the Bowerline icon while you're on the page, then try again.",
  generic: "Bowerline can't run on this page.",
};

export function viewerUrl(params: Record<string, string> = {}): string {
  const qs = new URLSearchParams(params).toString();
  return chrome.runtime.getURL(`viewer/viewer.html${qs ? `?${qs}` : ''}`);
}

export function isOwnPage(url: string): boolean {
  return url.startsWith(chrome.runtime.getURL(''));
}

export async function restrictionFor(url: string | undefined): Promise<Restriction | null> {
  if (!url) return null;
  if (
    /^(chrome|edge|brave|opera|vivaldi|about|devtools|chrome-untrusted|chrome-search|chrome-error):/i.test(
      url,
    )
  )
    return { reason: MSG.chromePage };
  if (/^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)(\/|$)/i.test(url))
    return { reason: MSG.webStore };
  if (/^chrome-extension:/i.test(url)) return { reason: MSG.otherExtension };
  if (/^(data|blob|view-source|javascript|filesystem):/i.test(url)) return { reason: MSG.special };
  if (/^file:/i.test(url) && !(await chrome.extension.isAllowedFileSchemeAccess())) {
    return { reason: looksLikePdfUrl(url) ? MSG.pdfViewer : MSG.fileAccess };
  }
  return null;
}

/** Turns a chrome.scripting error into a reason a person can act on. */
export function explainScriptingError(err: unknown): { reason: string; restricted: boolean } {
  const m = String((err as Error)?.message ?? err);
  if (/chrome:\/\/|chrome-untrusted|cannot be scripted.*chrome|devtools/i.test(m))
    return { reason: MSG.chromePage, restricted: true };
  if (/gallery cannot be scripted|webstore/i.test(m))
    return { reason: MSG.webStore, restricted: true };
  if (/chrome-extension:\/\//i.test(m)) return { reason: MSG.otherExtension, restricted: true };
  if (/error page/i.test(m)) return { reason: MSG.errorPage, restricted: false };
  if (/file:\/\//i.test(m)) return { reason: MSG.fileAccess, restricted: true };
  if (/permission|Cannot access contents/i.test(m))
    return { reason: MSG.noAccess, restricted: false };
  return { reason: MSG.generic, restricted: false };
}
