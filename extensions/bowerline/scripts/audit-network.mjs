/**
 * Network audit: scans every built script, page and stylesheet for ways to
 * reach a server and fails unless each one is the PDF loader.
 *
 * - Bowerline's own code may only use fetch() where it is marked with the
 *   comment `bowerline-network-allow: PDF loader` (pdf-loader.ts and the
 *   same-origin tab fallback in the service worker).
 * - pdf.js is third-party; each of its network call sites is listed below with
 *   the enclosing function and why it is safe. Any new call site fails the audit.
 * - XMLHttpRequest, WebSocket, sendBeacon, EventSource, importScripts, remote
 *   <script>/<link>/@import/url() and any http(s) URL used as a resource fail.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(import.meta.dirname, '..');
const dist = join(root, process.argv[2] ?? 'dist');

const isPdfjsFile = (rel) =>
  rel === 'viewer/viewer.js' ||
  rel === 'viewer/pdf.worker.mjs' ||
  rel.startsWith('viewer/pdfjs/wasm/');

/**
 * pdf.js call sites. Bowerline passes pdf.js the PDF's bytes (getDocument({ data })),
 * so pdf.js's own URL loaders never run; its other requests are for files inside
 * the extension (cMaps, fonts, wasm decoders, ICC profile).
 */
const PDFJS_ALLOWED = {
  'fetch(': {
    fetchData:
      'pdf.js resource loader: cMaps / standard fonts / ICC from the extension (cMapUrl etc. point at chrome-extension://)',
    fetchBinaryData: 'worker-side loader for cMaps / standard fonts, from the extension',
    fetchUrl: "pdf.js's own PDF loader (unused: Bowerline passes bytes, not a URL)",
    JBig2: 'Emscripten loader for the bundled JBIG2 decoder, from the extension (wasmUrl)',
    OpenJPEG: 'Emscripten loader for the bundled OpenJPEG decoder, from the extension (wasmUrl)',
    PDFFetchStream: "pdf.js's own PDF loader (unused: Bowerline passes bytes, not a URL)",
    PDFFetchStreamReader: "pdf.js's own PDF loader (unused: Bowerline passes bytes)",
    PDFFetchStreamRangeReader: "pdf.js's own PDF loader (unused: Bowerline passes bytes)",
    createFetchOptions: "pdf.js's own PDF loader (unused)",
    __wbg_init: 'wasm-bindgen loader for qcms_bg.wasm, from the extension (wasmUrl)',
    __wbg_load: 'wasm-bindgen loader for qcms_bg.wasm, from the extension (wasmUrl)',
    instantiateWasm: 'JBIG2 / OpenJPEG decoder wasm, from the extension (wasmUrl)',
    getInstance: 'JBIG2 / OpenJPEG decoder wasm, from the extension (wasmUrl)',
    '#getJsModule': 'JBIG2 / OpenJPEG decoder wasm, from the extension (wasmUrl)',
    '#instantiateWasm': 'JBIG2 / OpenJPEG decoder wasm, from the extension (wasmUrl)',
  },
  XMLHttpRequest: {
    fetchData: 'pdf.js resource loader fallback for non-fetchable URLs (extension files only)',
    fetchSync: 'synchronous load of qcms wasm / ICC profile from the extension (wasmUrl, iccUrl)',
    PDFNetworkStream: "pdf.js's legacy XHR PDF loader (unused: Bowerline passes bytes)",
    PDFNetworkStreamFullRequestReader: "pdf.js's legacy XHR PDF loader (unused)",
    NetworkManager: "pdf.js's legacy XHR PDF loader (unused)",
    request: "pdf.js's legacy XHR PDF loader (unused)",
    _request: "pdf.js's legacy XHR PDF loader (unused)",
  },
};

const PATTERNS = [
  {
    name: 'fetch(',
    re: /(?<![\w$.])fetch\s*\(|\.fetch\s*\(\s*(?:url|this\.url|pdfUrl|module_or_path)/g,
  },
  { name: 'XMLHttpRequest', re: /\bXMLHttpRequest\b/g },
  { name: 'WebSocket', re: /\bWebSocket\b/g },
  { name: 'sendBeacon', re: /\bsendBeacon\b/g },
  { name: 'EventSource', re: /\bEventSource\b/g },
  { name: 'importScripts', re: /\bimportScripts\s*\(/g },
  { name: 'RTCPeerConnection', re: /\bRTCPeerConnection\b/g },
];

const ALLOW_MARK = 'bowerline-network-allow: PDF loader';

function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

/** Name of the nearest enclosing function, method or class before `index`. */
function enclosing(src, index) {
  const before = src.slice(Math.max(0, index - 20000), index);
  const re =
    /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?(?:static\s+)?(?:get\s+)?(?:function\s*\*?\s*([#\w$]+)|class\s+([\w$]+)|(#?[\w$]+)\s*\([^)\n]*\)\s*\{)/g;
  let name = null;
  for (let m = re.exec(before); m; m = re.exec(before)) {
    const n = m[1] ?? m[2] ?? m[3];
    if (n && !['if', 'for', 'while', 'switch', 'catch', 'return'].includes(n)) name = n;
  }
  return name;
}

const problems = [];
const report = [];
for (const file of files(dist)) {
  const rel = relative(dist, file).replace(/\\/g, '/');
  if (/\.(map)$/.test(rel)) continue;
  if (/\.(js|mjs)$/.test(rel)) {
    const src = readFileSync(file, 'utf8');
    for (const { name, re } of PATTERNS) {
      re.lastIndex = 0;
      for (let m = re.exec(src); m; m = re.exec(src)) {
        const line = src.slice(0, m.index).split('\n').length;
        // A method that happens to be called fetch (e.g. XRef.fetch(ref) {…}) is not a request.
        const lineText = src.slice(src.lastIndexOf('\n', m.index) + 1, src.indexOf('\n', m.index));
        if (name === 'fetch(' && /^\s*(async\s+)?fetch\s*\([^)]*\)?\s*\{?\s*$/.test(lineText))
          continue;
        const context = src.slice(Math.max(0, m.index - 400), m.index);
        if (context.includes(ALLOW_MARK) && name === 'fetch(') {
          report.push(`  ok   ${rel}:${line} fetch() — Bowerline PDF loader (marked)`);
          continue;
        }
        if (isPdfjsFile(rel) && PDFJS_ALLOWED[name]) {
          const fn = enclosing(src, m.index);
          const why = fn && PDFJS_ALLOWED[name][fn];
          if (why) {
            report.push(`  ok   ${rel}:${line} ${name} in pdf.js ${fn} — ${why}`);
            continue;
          }
          problems.push(
            `${rel}:${line} ${name} in pdf.js function "${fn}" is not on the allow list`,
          );
          continue;
        }
        problems.push(
          `${rel}:${line} uses ${name}: ${src.slice(m.index - 60, m.index + 60).replace(/\s+/g, ' ')}`,
        );
      }
    }
    // Remote script loading.
    for (const m of src.matchAll(/import\s*\(\s*["'`]https?:/g))
      problems.push(`${rel}: dynamic import of a remote URL (${m[0]})`);
  }
  if (/\.html$/.test(rel)) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(
      /<(script|link|img|iframe|source)[^>]+(src|href)\s*=\s*["']\s*(https?:)?\/\//gi,
    )) {
      problems.push(`${rel}: remote resource in <${m[1]}>`);
    }
  }
  if (/\.css$/.test(rel)) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/(@import|url\()\s*["']?\s*(https?:)?\/\//gi))
      problems.push(`${rel}: remote ${m[1]} in CSS`);
  }
}

console.log(report.join('\n'));
if (problems.length) {
  console.error(
    `\nNetwork audit FAILED (${problems.length}):\n${problems.map((p) => `  ✗ ${p}`).join('\n')}`,
  );
  process.exit(1);
}
console.log('\nNetwork audit passed: the only network request Bowerline makes is the PDF loader.');
