/**
 * `npm run video`: build the extension, record the scenes, compose and encode
 * the promo video, then check it.
 *
 *   1. node scripts/build.mjs                (dist/, exactly what ships)
 *   2. record.mjs                            (headed Chromium; inside xvfb-run when there is no display)
 *   3. compose.mjs                           (stills, segments, crossfades, H.264 + silent AAC, .srt)
 *   4. one PNG per second into review/, and ffprobe checks on the result
 *
 * `--compose-only` reuses the last recording (out/manifest.json).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { compose, SRT, VIDEO } from './compose.mjs';
import { FPS, HEIGHT, REVIEW, ROOT, TOOL_DIR, WIDTH, timeline } from './config.mjs';

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { stdio: 'inherit', cwd: ROOT, ...opts });
const composeOnly = process.argv.includes('--compose-only');

if (!composeOnly) {
  console.log('Building the extension…');
  run('node', ['scripts/build.mjs']);
  console.log('Recording scenes (headed Chromium)…');
  const record = join(TOOL_DIR, 'record.mjs');
  if (process.env.DISPLAY) run('node', [record]);
  else run('xvfb-run', ['-a', '-s', '-screen 0 2560x1440x24', 'node', record]);
}

console.log('Composing and encoding…');
await compose();

console.log('Extracting one frame per second for review…');
rmSync(REVIEW, { recursive: true, force: true });
mkdirSync(REVIEW, { recursive: true });
run('ffmpeg', ['-v', 'error', '-y', '-i', VIDEO, '-vf', 'fps=1', join(REVIEW, 'frame-%02d.png')]);

// ── Checks ──────────────────────────────────────────────────────────────────

const probe = JSON.parse(
  execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', VIDEO], {
    encoding: 'utf8',
  }),
);
const video = probe.streams.find((s) => s.codec_type === 'video');
const audio = probe.streams.find((s) => s.codec_type === 'audio');
const duration = Number(probe.format.duration);
const size = statSync(VIDEO).size;
const frames = readdirSync(REVIEW).filter((f) => f.endsWith('.png')).length;
const checks = [
  ['1920×1080', video.width === WIDTH && video.height === HEIGHT, `${video.width}×${video.height}`],
  ['30 fps', video.r_frame_rate === `${FPS}/1`, video.r_frame_rate],
  [
    'H.264, yuv420p',
    video.codec_name === 'h264' && video.pix_fmt === 'yuv420p',
    `${video.codec_name}, ${video.pix_fmt}`,
  ],
  ['silent AAC track', audio?.codec_name === 'aac', audio?.codec_name ?? 'none'],
  ['40–46 s', duration >= 40 && duration <= 46, `${duration.toFixed(2)} s`],
  [
    'matches the storyboard',
    Math.abs(duration - timeline().total) < 0.05,
    `${timeline().total.toFixed(2)} s planned`,
  ],
  ['under 50 MB', size < 50e6, `${(size / 1e6).toFixed(1)} MB`],
  ['review frames', frames >= Math.floor(duration), `${frames} PNGs in tools/demo-video/review/`],
];
let failed = 0;
for (const [name, ok, detail] of checks) {
  console.log(`  ${ok ? '✓' : '✗'} ${name.padEnd(24)} ${detail}`);
  if (!ok) failed++;
}
console.log(`\n${VIDEO.replace(ROOT + '/', '')}\n${SRT.replace(ROOT + '/', '')}`);
if (failed) {
  console.error(`${failed} check(s) failed.`);
  process.exit(1);
}
