/**
 * Permissions, privacy and code-policy audit for the built extension.
 *
 * Manifest: permissions are exactly storage, activeTab and scripting; host
 * access is optional only (https/http); default CSP; nothing exposed to web
 * pages or other extensions; no static content scripts; the shortcut is
 * Alt+Shift+F (never Bowerline's Alt+Shift+H).
 * Code: no eval / new Function / string timers, no chrome.storage.sync, no
 * source maps, unminified.
 * Privacy: the content script contains no API that reads page content (text,
 * markup, selection, address beyond the hostname, cookies, page storage,
 * pixels), and no extension code can capture the screen.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(import.meta.dirname, '..');
const dist = join(root, process.argv[2] ?? 'dist');
const manifest = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8'));

const EXPECTED_PERMISSIONS = ['storage', 'activeTab', 'scripting'];
const EXPECTED_OPTIONAL_HOSTS = ['https://*/*', 'http://*/*'];
const NAMES = [
  'Huefinch – Color Blind Filter & Color Identifier',
  'Huefinch – Color Blind Filter & Identifier',
];
const FORBIDDEN_KEYS = [
  'host_permissions',
  'optional_permissions',
  'content_scripts',
  'content_security_policy',
  'externally_connectable',
  'web_accessible_resources',
  'update_url',
  'key',
  'sandbox',
  'oauth2',
  'declarative_net_request',
  'chrome_url_overrides',
];
const CONTENT_SCRIPT_LIMIT = 60 * 1024;

const problems = [];
const ok = [];
const sameSet = (a = [], b = []) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join();

if (manifest.manifest_version !== 3) problems.push('manifest_version must be 3');
if (sameSet(manifest.permissions, EXPECTED_PERMISSIONS))
  ok.push(`permissions are exactly: ${EXPECTED_PERMISSIONS.join(', ')}`);
else
  problems.push(
    `permissions must be exactly [${EXPECTED_PERMISSIONS}], got [${manifest.permissions}]`,
  );
if (sameSet(manifest.optional_host_permissions, EXPECTED_OPTIONAL_HOSTS))
  ok.push(`optional_host_permissions are exactly: ${EXPECTED_OPTIONAL_HOSTS.join(', ')}`);
else
  problems.push(
    `optional_host_permissions must be exactly [${EXPECTED_OPTIONAL_HOSTS}], got [${manifest.optional_host_permissions}]`,
  );
for (const key of FORBIDDEN_KEYS)
  if (key in manifest) problems.push(`manifest must not declare "${key}"`);
ok.push(`none of: ${FORBIDDEN_KEYS.join(', ')}`);
if (!NAMES.includes(manifest.name)) problems.push(`unexpected name "${manifest.name}"`);
if (manifest.name.length > 75) problems.push('name is longer than 75 characters');
if (manifest.short_name !== 'Huefinch') problems.push(`short_name is "${manifest.short_name}"`);
if (!manifest.description || manifest.description.length > 132)
  problems.push('description must be 1–132 characters');
const commands = manifest.commands ?? {};
if (commands['toggle-huefinch']?.suggested_key?.default !== 'Alt+Shift+F')
  problems.push('Alt+Shift+F toggle command missing');
if (JSON.stringify(commands).includes('Alt+Shift+H'))
  problems.push('Alt+Shift+H is Bowerline’s shortcut');
ok.push(`name "${manifest.name}", short_name, description, Alt+Shift+F command`);

const refs = [
  manifest.background?.service_worker,
  manifest.action?.default_popup,
  manifest.options_ui?.page,
  ...Object.values(manifest.icons ?? {}),
  ...Object.values(manifest.action?.default_icon ?? {}),
];
for (const r of refs) {
  try {
    statSync(join(dist, r));
  } catch {
    problems.push(`manifest references a missing file: ${r}`);
  }
}
for (const size of [16, 32, 48, 128]) {
  try {
    statSync(join(dist, `icons/icon-off-${size}.png`));
  } catch {
    problems.push(`grey toolbar icon icons/icon-off-${size}.png is missing`);
  }
}
ok.push('every file the manifest names exists, plus the grey "off" icons');

function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

const CODE_RULES = [
  { re: /(?<![\w$.])eval\s*\(/, why: 'eval()' },
  { re: /\bnew\s+Function\s*\(/, why: 'new Function()' },
  { re: /(?<![\w$.])Function\s*\(\s*["'`]/, why: 'Function("…")' },
  { re: /\bset(?:Timeout|Interval)\s*\(\s*["'`]/, why: 'string passed to setTimeout/setInterval' },
  { re: /storage\.sync\b/, why: 'chrome.storage.sync (would copy settings to Google)' },
  { re: /<script[^>]+src=["']https?:/i, why: 'remote <script>' },
  { re: /sourceMappingURL=/, why: 'source map reference' },
  { re: /captureVisibleTab|tabCapture|desktopCapture/, why: 'screen capture' },
  { re: /\binnerHTML\b|\bouterHTML\b|insertAdjacentHTML/, why: 'HTML string injection' },
];
for (const file of files(dist)) {
  const rel = relative(dist, file).replace(/\\/g, '/');
  if (!/\.(js|mjs|html)$/.test(rel)) continue;
  const src = readFileSync(file, 'utf8');
  if (rel.endsWith('.map')) problems.push(`${rel}: source map in dist`);
  for (const { re, why } of CODE_RULES) {
    const m = re.exec(src);
    if (m)
      problems.push(
        `${rel} contains ${why}: …${src.slice(Math.max(0, m.index - 50), m.index + 50).replace(/\s+/g, ' ')}…`,
      );
  }
}
ok.push(
  'no eval, new Function, string timers, storage.sync, innerHTML, screen capture or source maps',
);

// The content script runs inside web pages. It may add its filter and UI, but
// must contain nothing that reads what the page says or shows.
const PAGE_READS = [
  [/\.innerText\b/, 'innerText'],
  [/\.outerText\b/, 'outerText'],
  [/getSelection\s*\(/, 'getSelection()'],
  [/document\.title\b/, 'document.title'],
  [/document\.(URL|documentURI|referrer|cookie)\b/, 'document address/cookies'],
  [/location\.(href|pathname|search|hash|origin|host)\b(?!name)/, 'location beyond hostname'],
  [/\b(localStorage|sessionStorage|indexedDB)\b/, 'page storage'],
  [/\b(drawImage|getImageData|toDataURL|toBlob|readPixels)\b/, 'reading pixels'],
  [/\bquerySelector(All)?\s*\(/, 'querying page elements'],
  [/\b(getElementsBy\w+|getElementById)\s*\(/, 'querying page elements'],
  [/\bXMLSerializer\b|\bcloneNode\b/, 'copying page markup'],
];
const content = readFileSync(join(dist, 'content/content.js'), 'utf8');
for (const [re, why] of PAGE_READS) {
  const m = re.exec(content);
  if (m)
    problems.push(
      `content script reads page content (${why}): …${content.slice(Math.max(0, m.index - 60), m.index + 40).replace(/\s+/g, ' ')}…`,
    );
}
if (!/location\.hostname/.test(content))
  problems.push('content script should use location.hostname only');
ok.push('content script reads nothing from the page except location.hostname');

const csSize = statSync(join(dist, 'content/content.js')).size;
if (csSize > CONTENT_SCRIPT_LIMIT)
  problems.push(`content script is ${(csSize / 1024).toFixed(1)} KB (limit 60 KB)`);
else ok.push(`content script is ${(csSize / 1024).toFixed(1)} KB (limit 60 KB)`);

for (const f of ['background.js', 'content/content.js', 'popup/popup.js', 'options/options.js']) {
  const longest = Math.max(
    ...readFileSync(join(dist, f), 'utf8')
      .split('\n')
      .map((l) => l.length),
  );
  if (longest > 1000) problems.push(`${f} looks minified (a ${longest}-character line)`);
}
ok.push('bundles are unminified');

console.log(ok.map((l) => `  ok   ${l}`).join('\n'));
if (problems.length) {
  console.error(
    `\nPermissions audit FAILED (${problems.length}):\n${problems.map((p) => `  ✗ ${p}`).join('\n')}`,
  );
  process.exit(1);
}
console.log('\nPermissions, privacy and code-policy audit passed.');
