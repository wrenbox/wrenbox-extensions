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

const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
const lines = changelog.split('\n');
const start = lines.findIndex((l) => l.startsWith(`## ${version}`));
if (start < 0)
  throw new Error(`CHANGELOG.md has no "## ${version}" section. Add one before tagging.`);
let end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
if (end < 0) end = lines.length;
const section = lines
  .slice(start + 1, end)
  .join('\n')
  .trim();

const sha = (file) => {
  const p = join(root, 'release', file);
  return existsSync(p)
    ? ` (SHA-256 \`${createHash('sha256').update(readFileSync(p)).digest('hex')}\`)`
    : '';
};
const chrome = `bowerline-${version}.zip`;
const edge = `bowerline-${version}-edge.zip`;

console.log(`${section}

---

**Chrome Web Store upload:** \`${chrome}\`${sha(chrome)}

**Microsoft Edge Add-ons upload:** \`${edge}\`${sha(edge)}. How to publish it: [EDGE.md](https://github.com/wrenbox/wrenbox-extensions/blob/main/extensions/bowerline/EDGE.md).

To try either before publishing: unzip it, open \`chrome://extensions\` (or \`edge://extensions\`), turn on **Developer mode**, click **Load unpacked** and select the unzipped folder.`);
