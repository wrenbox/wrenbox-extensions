/**
 * Typed message protocol. Every persistent read and write goes through the
 * service worker, which is the only owner of the IndexedDB database.
 */
import type { BackupFile, ImportReport } from './backup';
import type {
  Highlight,
  HighlightInput,
  HighlightPatch,
  Library,
  Source,
  SourceInput,
  SourceKind,
} from './types';

export interface TabInfo {
  tabId: number;
  kind: SourceKind;
  key: string;
  url: string;
  title: string;
  fileName?: string;
}

export type PopupState =
  | { state: 'active'; count: number; orphans: number; isPdf: false }
  | { state: 'pdf'; url: string }
  | { state: 'viewer' }
  | { state: 'restricted'; reason: string; isPdf: boolean; url?: string }
  | { state: 'error'; reason: string };

/** Requests handled by the service worker, keyed by type, with their responses. */
export interface Requests {
  'source:get': { req: { key: string }; res: { source: Source | null; highlights: Highlight[] } };
  'source:touch': { req: { source: SourceInput }; res: Source | null };
  'highlight:create': { req: { source: SourceInput; highlight: HighlightInput }; res: Highlight };
  'highlight:update': { req: { id: string; patch: HighlightPatch }; res: Highlight | null };
  'highlight:delete': {
    req: { id: string };
    res: { highlight: Highlight; source: Source | null } | null;
  };
  'highlight:restore': { req: { highlight: Highlight; source?: Source | null }; res: Highlight };
  'highlight:status': { req: { updates: Array<{ id: string; orphaned: boolean }> }; res: null };
  'highlight:focus': {
    req: { id: string };
    res: { result: 'focused' | 'opened' | 'needs-file'; note?: string };
  };
  'library:get': { req: Record<string, never>; res: Library };
  'library:stats': { req: Record<string, never>; res: { highlights: number; sources: number } };
  'backup:export': { req: Record<string, never>; res: BackupFile };
  'backup:import': { req: { data: unknown }; res: ImportReport };
  'data:deleteAll': { req: Record<string, never>; res: null };
  'source:delete': { req: { id: string }; res: null };
  'content:hello': { req: { page: SourceInput }; res: { pendingFocus: string | null } };
  'tab:register': { req: { page: SourceInput }; res: null };
  'tab:info': { req: { tabId: number }; res: TabInfo | null };
  'popup:open': { req: { tabId: number; url?: string }; res: PopupState };
  'popup:highlight': { req: { tabId: number }; res: { highlighted: boolean } };
  'pdf:fetchViaTab': {
    req: { tabId: number; url: string };
    res: { base64: string } | { error: string };
  };
  'alwaysOn:sync': { req: Record<string, never>; res: { enabled: boolean } };
}

export type RequestType = keyof Requests;
export type RequestMessage<T extends RequestType = RequestType> = { type: T } & Requests[T]['req'];
export type Response<T extends RequestType> = Requests[T]['res'];

export type Envelope<T> = { ok: true; value: T } | { ok: false; error: string };

/** Sends a request to the service worker and unwraps its envelope. */
export async function send<T extends RequestType>(
  type: T,
  payload: Requests[T]['req'],
): Promise<Response<T>> {
  const reply = (await chrome.runtime.sendMessage({ type, ...payload })) as
    Envelope<Response<T>> | undefined;
  if (!reply) throw new Error(`No reply for ${type}`);
  if (!reply.ok) throw new Error(reply.error);
  return reply.value;
}

/** Broadcasts from the service worker to extension pages (side panel, library, viewer). */
export type Broadcast =
  | { type: 'broadcast:changed'; sourceIds: string[] }
  | { type: 'broadcast:tabs' }
  | { type: 'broadcast:viewer-focus'; tabId: number; highlightId: string };

/** Messages from the service worker to a content script in a tab. */
export type ContentMessage =
  | { type: 'content:activate'; highlightSelection: boolean; announce: boolean }
  | { type: 'content:ping' }
  | { type: 'content:refresh' }
  | { type: 'content:focus'; highlightId: string };

export interface PingReply {
  key: string;
  count: number;
  orphans: number;
}

export function isBroadcast(msg: unknown): msg is Broadcast {
  return (
    !!msg &&
    typeof msg === 'object' &&
    String((msg as { type?: unknown }).type).startsWith('broadcast:')
  );
}
