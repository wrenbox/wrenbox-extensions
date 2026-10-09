/**
 * Packs dist/ into two store uploads, with manifest.json at the zip root:
 *
 *   release/bowerline-<version>.zip        Chrome Web Store
 *   release/bowerline-<version>-edge.zip   Microsoft Edge Add-ons
 *
 * Both hold the same build: Bowerline names the browser and its store at
 * runtime (src/shared/browser.ts). The Edge manifest is checked against Edge
 * Add-ons' rules (name of at most 45 characters, no update_url) and has any
 * update_url removed. Source maps and dotfiles are excluded. Dependency-free
 * (zlib only), with fixed timestamps so the same build always yields the same zips.
 */
import { deflateRawSync } from 'node:zlib';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(import.meta.dirname, '..');
const dist = join(root, 'dist');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8'));
if (manifest.version !== pkg.version)
  throw new Error(`dist is stale: manifest ${manifest.version} vs package ${pkg.version}`);

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function files(dir) {
  return readdirSync(dir)
    .sort()
    .flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : [p];
    });
}

// 2026-01-01 00:00 in DOS time.
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

const entries = files(dist)
  .map((p) => ({ path: relative(dist, p).replace(/\\/g, '/'), data: readFileSync(p) }))
  .filter((e) => !e.path.endsWith('.map') && !e.path.split('/').some((s) => s.startsWith('.')));
// manifest.json first, at the root.
entries.sort((a, b) => (a.path === 'manifest.json' ? -1 : b.path === 'manifest.json' ? 1 : 0));

function zip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.path, 'utf8');
    const deflated = deflateRawSync(e.data, { level: 9 });
    const useDeflate = deflated.length < e.data.length;
    const body = useDeflate ? deflated : e.data;
    const crc = crc32(e.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(useDeflate ? 8 : 0, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, name, body);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(useDeflate ? 8 : 0, 10);
    cen.writeUInt16LE(DOS_TIME, 12);
    cen.writeUInt16LE(DOS_DATE, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(body.length, 20);
    cen.writeUInt32LE(e.data.length, 24);
    cen.writeUInt16LE(name.length, 28);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, name);
    offset += local.length + name.length + body.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, centralBuf, end]);
}

// Edge Add-ons: the extension name may be at most 45 characters, and there must be no update_url.
const EDGE_NAME_LIMIT = 45;
if ([...manifest.name].length > EDGE_NAME_LIMIT)
  throw new Error(`Manifest name is longer than Edge's ${EDGE_NAME_LIMIT}-character limit`);
const edgeManifest = { ...manifest };
delete edgeManifest.update_url;
const edgeEntries = entries.map((e) =>
  e.path === 'manifest.json'
    ? { ...e, data: Buffer.from(`${JSON.stringify(edgeManifest, null, 2)}\n`) }
    : e,
);

mkdirSync(join(root, 'release'), { recursive: true });
for (const [name, list] of [
  [`bowerline-${pkg.version}.zip`, entries],
  [`bowerline-${pkg.version}-edge.zip`, edgeEntries],
]) {
  const out = join(root, 'release', name);
  writeFileSync(out, zip(list));
  console.log(
    `Wrote ${relative(root, out)} (${list.length} files, ${(statSync(out).size / 1024 / 1024).toFixed(2)} MB)`,
  );
}
