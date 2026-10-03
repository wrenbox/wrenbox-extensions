/**
 * Permissions and code-policy audit for the built extension.
 *
 * Manifest: permissions are exactly the approved list, host access is optional
 * only, the default CSP is kept, nothing is exposed to web pages or other
 * extensions, and no static content scripts need host permissions.
 * Code: no eval / new Function / string timers, no chrome.storage.sync, no
 * remote scripts, and the content script stays under 60 KB.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(import.meta.dirname, '..');
const dist = join(root, process.argv[2] ?? 'dist');
const manifest = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8'));

const EXPECTED_PERMISSIONS = [
  'storage',
  'unlimitedStorage',
  'activeTab',
  'scripting',
  'contextMenus',
  'sidePanel',
];
const EXPECTED_OPTIONAL_HOSTS = ['https://*/*', 'http://*/*'];
const FORBIDDEN_KEYS = [
  'host_permissions',
  'optional_permissions',
  'content_scripts',
  'content_security_policy',
  'externally_connectable',
  'web_accessible_resources',
  'update_url',
  'key',
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
for (const key of FORBIDDEN_KEYS) {
  if (key in manifest) problems.push(`manifest must not declare "${key}"`);
}
ok.push(`none of: ${FORBIDDEN_KEYS.join(', ')}`);
if (manifest.name !== 'Bowerline – PDF & Web Highlighter')
  problems.push(`name is "${manifest.name}"`);
if (manifest.short_name !== 'Bowerline') problems.push(`short_name is "${manifest.short_name}"`);
if (!manifest.description || manifest.description.length > 132)
  problems.push('description must be 1–132 characters');
if (manifest.commands?.['highlight-selection']?.suggested_key?.default !== 'Alt+Shift+H')
  problems.push('Alt+Shift+H command missing');

// Every file the manifest points at must exist.
const refs = [
  manifest.background?.service_worker,
  manifest.action?.default_popup,
  manifest.side_panel?.default_path,
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
  {
    re: /chrome\.storage\.sync|storage\.sync\b/,
    why: 'chrome.storage.sync (would send data to Google)',
  },
  { re: /<script[^>]+src=["']https?:/i, why: 'remote <script>' },
  { re: /sourceMappingURL=/, why: 'source map reference (maps stay out of the release)' },
];

for (const file of files(dist)) {
  const rel = relative(dist, file).replace(/\\/g, '/');
  if (!/\.(js|mjs|html)$/.test(rel)) continue;
  const src = readFileSync(file, 'utf8');
  for (const { re, why } of CODE_RULES) {
    const m = re.exec(src);
    if (m)
      problems.push(
        `${rel} contains ${why}: …${src.slice(Math.max(0, m.index - 50), m.index + 50).replace(/\s+/g, ' ')}…`,
      );
  }
}
ok.push(
  'no eval, new Function, string timers, storage.sync, remote scripts or source map references',
);

const csSize = statSync(join(dist, 'content/content.js')).size;
if (csSize > CONTENT_SCRIPT_LIMIT)
  problems.push(`content script is ${(csSize / 1024).toFixed(1)} KB (limit 60 KB)`);
else ok.push(`content script is ${(csSize / 1024).toFixed(1)} KB (limit 60 KB)`);

// Minification check: reviewers must be able to read the code.
const bg = readFileSync(join(dist, 'background.js'), 'utf8');
const longest = Math.max(...bg.split('\n').map((l) => l.length));
if (longest > 1000) problems.push(`background.js looks minified (a ${longest}-character line)`);
else ok.push('bundles are unminified');

console.log(ok.map((l) => `  ok   ${l}`).join('\n'));
if (problems.length) {
  console.error(
    `\nPermissions audit FAILED (${problems.length}):\n${problems.map((p) => `  ✗ ${p}`).join('\n')}`,
  );
  process.exit(1);
}
console.log('\nPermissions and code-policy audit passed.');
