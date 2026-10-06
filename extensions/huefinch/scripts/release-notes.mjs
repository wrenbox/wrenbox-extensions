/**
 * Prints GitHub Release notes for a version: its CHANGELOG section, then the
 * zips' SHA-256 and how to install them.
 *
 *   node scripts/release-notes.mjs 1.0.0
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const version = process.argv[2];
if (!version) throw new Error('Usage: node scripts/release-notes.mjs <version>');

const lines = readFileSync(join(root, 'CHANGELOG.md'), 'utf8').split('\n');
const start = lines.findIndex((l) => l.startsWith(`## ${version}`));
if (start < 0)
  throw new Error(`CHANGELOG.md has no "## ${version}" section. Add one before releasing.`);
let end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
if (end < 0) end = lines.length;
const section = lines
  .slice(start + 1, end)
  .join('\n')
  .trim();

const sha = (name) => {
  const p = join(root, 'release', name);
  return existsSync(p)
    ? ` (SHA-256 \`${createHash('sha256').update(readFileSync(p)).digest('hex')}\`)`
    : '';
};
const chrome = `huefinch-${version}.zip`;
const edge = `huefinch-${version}-edge.zip`;

console.log(`${section}

---

**Chrome Web Store upload:** \`${chrome}\`${sha(chrome)}
**Microsoft Edge Add-ons upload:** \`${edge}\`${sha(edge)}

To try it before publishing: unzip it, open \`chrome://extensions\`, turn on **Developer mode**, click **Load unpacked** and select the unzipped folder.`);
