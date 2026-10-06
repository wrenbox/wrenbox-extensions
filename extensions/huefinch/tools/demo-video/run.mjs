/**
 * `npm run video`: build the extension, record the scenes, plan the soundtrack,
 * compose the picture, mix and master the audio, mux, then check everything.
 *
 *   1. node scripts/build.mjs   dist/, exactly what ships
 *   2. record.mjs               headed Chromium (inside xvfb-run when there is no display);
 *                               logs every action's time for the sound effects
 *   3. audio.py plan            music section + crossfades moved onto beats → out/audio/plan.json
 *   4. compose.mjs              stills, popup, LUT inset, crossfades → huefinch-demo-1080p-silent.mp4, .srt
 *   5. soundtrack.mjs           effects + music mix, two-pass loudnorm, AAC muxed with the
 *                               picture copied → huefinch-demo-1080p.mp4, waveform, sync checks
 *   6. one PNG per second into review/, and ffprobe checks on the result
 *
 * `--compose-only` reuses the last recording (out/manifest.json).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { compose, SILENT, SRT, VIDEO } from './compose.mjs';
import { FPS, HEIGHT, REVIEW, ROOT, TOOL_DIR, WIDTH } from './config.mjs';
import { WAVEFORM, checkAudioTools, finishSoundtrack, planSoundtrack } from './soundtrack.mjs';

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { stdio: 'inherit', cwd: ROOT, ...opts });
const rel = (p) => p.replace(ROOT + '/', '');
const composeOnly = process.argv.includes('--compose-only');

checkAudioTools();
if (!composeOnly) {
  console.log('Building the extension…');
  run('node', ['scripts/build.mjs']);
  console.log('Recording scenes (headed Chromium)…');
  const record = join(TOOL_DIR, 'record.mjs');
  if (process.env.DISPLAY) run('node', [record]);
  else run('xvfb-run', ['-a', '-s', '-screen 0 2560x1440x24', 'node', record]);
}

console.log('Planning the soundtrack (section, beats)…');
planSoundtrack();

console.log('Composing and encoding the picture…');
await compose();

console.log('Extracting one frame per second for review…');
rmSync(REVIEW, { recursive: true, force: true });
mkdirSync(REVIEW, { recursive: true });
run('ffmpeg', ['-v', 'error', '-y', '-i', SILENT, '-vf', 'fps=1', join(REVIEW, 'frame-%02d.png')]);

console.log('Mixing, mastering and muxing the soundtrack…');
const sound = finishSoundtrack();

// ── Checks ──────────────────────────────────────────────────────────────────

const probe = (file) =>
  JSON.parse(
    execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], {
      encoding: 'utf8',
    }),
  );
const final = probe(VIDEO);
const silent = probe(SILENT);
const video = final.streams.find((s) => s.codec_type === 'video');
const audio = final.streams.find((s) => s.codec_type === 'audio');
const silentVideo = silent.streams.find((s) => s.codec_type === 'video');
const duration = Number(final.format.duration);
const size = statSync(VIDEO).size;
const frames = readdirSync(REVIEW).filter((f) => /^frame-\d+\.png$/.test(f)).length;
const checks = [
  ['1920×1080', video.width === WIDTH && video.height === HEIGHT, `${video.width}×${video.height}`],
  ['30 fps', video.r_frame_rate === `${FPS}/1`, video.r_frame_rate],
  [
    'H.264, yuv420p',
    video.codec_name === 'h264' && video.pix_fmt === 'yuv420p',
    `${video.codec_name}, ${video.pix_fmt}`,
  ],
  [
    'picture copied, not re-encoded',
    video.nb_frames === silentVideo.nb_frames && video.bit_rate === silentVideo.bit_rate,
    `${video.nb_frames} frames, ${Math.round(video.bit_rate / 1000)} kb/s in both files`,
  ],
  [
    'AAC 192 kbps, 48 kHz stereo',
    audio?.codec_name === 'aac' &&
      audio.sample_rate === '48000' &&
      audio.channels === 2 &&
      Math.abs(Number(audio.bit_rate) - 192000) < 12000,
    `${audio?.codec_name}, ${Math.round(audio?.bit_rate / 1000)} kb/s, ${audio?.sample_rate} Hz, ${audio?.channels} ch`,
  ],
  ['40–46 s', duration >= 40 && duration <= 46, `${duration.toFixed(2)} s`],
  [
    'matches the plan',
    Math.abs(duration - sound.total) < 0.05,
    `${sound.total.toFixed(2)} s planned`,
  ],
  ['under 50 MB', size < 50e6, `${(size / 1e6).toFixed(1)} MB`],
  ['review frames', frames >= Math.floor(duration), `${frames} PNGs in tools/demo-video/review/`],
  ...sound.checks,
];
let failed = 0;
for (const [name, ok, detail] of checks) {
  console.log(`  ${ok ? '✓' : '✗'} ${name.padEnd(32)} ${detail}`);
  if (!ok) failed++;
}
console.log(`\n${rel(VIDEO)}\n${rel(SILENT)}\n${rel(SRT)}\n${rel(WAVEFORM)}`);
if (failed) {
  console.error(`${failed} check(s) failed.`);
  process.exit(1);
}
