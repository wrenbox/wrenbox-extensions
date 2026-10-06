/**
 * Network audit: Huefinch makes no network requests at all. This scans every
 * built script, page and stylesheet and fails the build if anything could
 * reach a server:
 *
 * - fetch, XMLHttpRequest, WebSocket, sendBeacon, EventSource, importScripts,
 *   RTCPeerConnection, WebTransport, dynamic import() of a URL;
 * - remote <script>, <link>, <img>, <iframe>, <source>, preconnect/prefetch hints;
 * - CSS @import, url(), @font-face pointing anywhere but the extension;
 * - any http(s) URL in the code, except the few listed below, which are
 *   never requested by Huefinch (namespaces, permission patterns, and the
 *   privacy policy, which opens only as a link the user clicks).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(import.meta.dirname, '..');
const dist = join(root, process.argv[2] ?? 'dist');

const ALLOWED_URLS = new Map([
  ['http://www.w3.org/2000/svg', 'SVG namespace for createElementNS (not a request)'],
  ['http://www.w3.org/1999/xhtml', 'HTML namespace check (not a request)'],
  ['https://*/*', 'optional host permission pattern (not a request)'],
  ['http://*/*', 'optional host permission pattern (not a request)'],
  [
    'https://wrenbox.github.io/wrenbox-extensions/huefinch/privacy',
    'privacy policy: a link the user can click, opened as a normal tab',
  ],
]);

const PATTERNS = [
  { name: 'fetch()', re: /(?<![\w$.])fetch\s*\(|\.fetch\s*\(/g },
  { name: 'XMLHttpRequest', re: /\bXMLHttpRequest\b/g },
  { name: 'WebSocket', re: /\bWebSocket\b/g },
  { name: 'sendBeacon', re: /\bsendBeacon\b/g },
  { name: 'EventSource', re: /\bEventSource\b/g },
  { name: 'importScripts', re: /\bimportScripts\s*\(/g },
  { name: 'RTCPeerConnection', re: /\bRTCPeerConnection\b/g },
  { name: 'WebTransport', re: /\bWebTransport\b/g },
  { name: 'dynamic import()', re: /(?<![\w$.])import\s*\(/g },
  { name: 'navigator.connection', re: /navigator\.connection\b/g },
];

function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

const problems = [];
const seenUrls = new Map();
let scanned = 0;
for (const file of files(dist)) {
  const rel = relative(dist, file).replace(/\\/g, '/');
  if (!/\.(js|mjs|html|css|json)$/.test(rel)) continue;
  scanned++;
  const src = readFileSync(file, 'utf8');
  const line = (i) => src.slice(0, i).split('\n').length;

  if (/\.(js|mjs)$/.test(rel)) {
    for (const { name, re } of PATTERNS) {
      re.lastIndex = 0;
      for (let m = re.exec(src); m; m = re.exec(src))
        problems.push(
          `${rel}:${line(m.index)} uses ${name}: …${src.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, ' ')}…`,
        );
    }
  }
  if (/\.html$/.test(rel)) {
    for (const m of src.matchAll(
      /<(script|link|img|iframe|source|video|audio|object|embed)\b[^>]*\b(src|href)\s*=\s*["']\s*(https?:)?\/\//gi,
    ))
      problems.push(`${rel}: remote resource in <${m[1]}>`);
    for (const m of src.matchAll(
      /<link\b[^>]*rel\s*=\s*["'][^"']*(preconnect|dns-prefetch|prefetch|preload|prerender)/gi,
    ))
      problems.push(`${rel}: resource hint <link rel="${m[1]}">`);
  }
  if (/\.css$/.test(rel) || /\.(js|html)$/.test(rel)) {
    for (const m of src.matchAll(/@import\b|@font-face\b/g))
      problems.push(`${rel}:${line(m.index)} ${m[0]} (no external stylesheets or fonts)`);
    for (const m of src.matchAll(/url\(\s*["']?\s*(https?:)?\/\//gi))
      problems.push(`${rel}:${line(m.index)} remote url()`);
  }
  for (const m of src.matchAll(/(?:https?|wss?|ftp):\/\/[^\s"'`)<>\\]+/g)) {
    const url = m[0].replace(/[.,;]+$/, '');
    if (ALLOWED_URLS.has(url)) {
      seenUrls.set(url, ALLOWED_URLS.get(url));
      continue;
    }
    problems.push(`${rel}:${line(m.index)} unexpected URL ${url}`);
  }
}

console.log(`  scanned ${scanned} files in ${relative(root, dist)}/`);
for (const [url, why] of seenUrls) console.log(`  ok   ${url} — ${why}`);
if (problems.length) {
  console.error(
    `\nNetwork audit FAILED (${problems.length}):\n${problems.map((p) => `  ✗ ${p}`).join('\n')}`,
  );
  process.exit(1);
}
console.log('\nNetwork audit passed: Huefinch contains no way to make a network request.');
