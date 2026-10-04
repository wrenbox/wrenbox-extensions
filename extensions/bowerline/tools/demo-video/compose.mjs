/**
 * Turns the raw recordings (out/manifest.json, written by record.mjs) into
 * the final 1920×1080 video and its .srt.
 *
 * 1. Stills (title and end cards, the frame background and shadow, the
 *    rounded-corner mask and one caption per scene) are drawn as HTML with the
 *    bundled Poppins font and screenshotted by Chromium.
 * 2. Each scene becomes a lossless-ish segment: the recording trimmed to its
 *    slot, played back at true speed, scaled 1.2× onto the frame, caption
 *    fading in over 200 ms.
 * 3. The segments are joined with 300 ms crossfades, a silent AAC track is
 *    added and the result is encoded as H.264 (yuv420p, 30 fps).
 */
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  CAPTION_BAND,
  CAPTION_IN,
  CROSSFADE,
  FINAL_DIR,
  FPS,
  HEIGHT,
  LEAD,
  OUT,
  REC,
  ROOT,
  SCALE,
  SCENES,
  TOOL_DIR,
  WIDTH,
  scenes,
  timeline,
} from './config.mjs';

export const VIDEO = join(FINAL_DIR, 'bowerline-demo-1080p.mp4');
/** The composed picture with a silent track; soundtrack.mjs muxes the mix into VIDEO. */
export const SILENT = join(FINAL_DIR, 'bowerline-demo-1080p-silent.mp4');
export const SRT = join(FINAL_DIR, 'bowerline-demo.srt');

const NAVY = '#18214D';
const YELLOW = '#FFE14D';
const BG = '#F4F6FB';
const CAPTION_FADE = 0.2;
const RW = REC.width * SCALE; // 1536
const RH = REC.height * SCALE; // 960
const RX = (WIDTH - RW) / 2; // 192
const RY = CAPTION_BAND; // 120: the recording fills the frame below the caption band
const RADIUS = 12;

const STILLS = join(OUT, 'stills');
const SEGMENTS = join(OUT, 'segments');

const ffmpeg = (args) =>
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], {
    stdio: ['ignore', 'inherit', 'inherit'],
  });

// ── 1. Stills ────────────────────────────────────────────────────────────────

const fontFaces = ['Bold', 'SemiBold', 'Medium']
  .map(
    (w, i) =>
      `@font-face { font-family: Poppins; font-weight: ${[700, 600, 500][i]}; src: url("${pathToFileURL(join(TOOL_DIR, `fonts/Poppins-${w}.ttf`))}"); }`,
  )
  .join('\n');

const page = (body, css, transparent = false) => `<!doctype html><meta charset="utf-8"><style>
${fontFaces}
* { box-sizing: border-box; }
html, body { margin: 0; width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; background: ${transparent ? 'transparent' : NAVY}; }
body { font-family: Poppins, sans-serif; -webkit-font-smoothing: antialiased; }
${css}
</style><body>${body}</body>`;

/** The wordmark on a tilted yellow swipe, as on the small promo tile. */
const wordmarkCss = `
.swipe { display: inline-block; background: ${YELLOW}; border-radius: 18px; padding: 6px 54px 22px; transform: rotate(-3.5deg); }
.swipe span { display: block; font-weight: 700; font-size: 168px; line-height: 1.12; color: ${NAVY}; letter-spacing: -0.01em; transform: rotate(3.5deg); }
.ribbons { position: absolute; top: 0; right: 150px; display: flex; gap: 46px; }
.ribbons i { display: block; width: 62px; height: 178px; clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%); }
`;
const ribbons = `<div class="ribbons"><i style="background:#8EF0C6"></i><i style="background:#FFA9D8"></i><i style="background:#9CDCFF"></i></div>`;

const STILL_HTML = {
  title: page(
    `${ribbons}<main><div class="swipe"><span>Bowerline</span></div><p>${SCENES[0].caption}</p></main>`,
    `${wordmarkCss}
     main { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding-bottom: 20px; }
     p { margin: 64px 0 0; color: #fff; font-weight: 600; font-size: 54px; letter-spacing: -0.005em; }`,
  ),
  end: page(
    `${ribbons}<main><img src="${pathToFileURL(join(ROOT, 'public/icons/icon-128.png'))}" width="128" height="128"><div class="swipe"><span>Bowerline</span></div><p>Free on the Chrome Web Store</p><small>Made by Wrenbox</small></main>`,
    `${wordmarkCss}
     main { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
     img { margin-bottom: 44px; filter: drop-shadow(0 0 1.5px rgba(255, 255, 255, 0.6)) drop-shadow(0 12px 28px rgba(0, 0, 0, 0.35)); } /* shows the navy tile's edge */
     .swipe span { font-size: 132px; }
     p { margin: 52px 0 0; color: #fff; font-weight: 600; font-size: 54px; }
     small { margin-top: 26px; color: #A9B0D6; font-weight: 500; font-size: 28px; letter-spacing: 0.01em; }`,
  ),
  // Background with the window's soft shadow (the recording is laid on top).
  frame: page(
    `<div class="win"></div>`,
    `body { background: ${BG}; }
     .win { position: absolute; left: ${RX}px; top: ${RY}px; width: ${RW}px; height: ${RH + 40}px; border-radius: ${RADIUS}px ${RADIUS}px 0 0; background: #fff;
            box-shadow: 0 2px 6px rgba(24, 33, 77, 0.08), 0 18px 48px rgba(24, 33, 77, 0.16); }`,
  ),
  // White where the recording shows: top corners rounded, bottom edge runs off the frame.
  mask: page(
    `<div></div>`,
    `html, body { width: ${RW}px; height: ${RH}px; background: #000; } div { width: ${RW}px; height: ${RH + 40}px; background: #fff; border-radius: ${RADIUS}px ${RADIUS}px 0 0; }`,
  ),
};
for (const s of SCENES) {
  if (s.kind !== 'rec') continue;
  STILL_HTML[`caption-${s.id}`] = page(
    `<p>${s.caption}</p>`,
    `html, body { height: ${CAPTION_BAND}px; }
     p { margin: 0; height: ${CAPTION_BAND}px; display: flex; align-items: center; justify-content: center; color: ${NAVY}; font-weight: 700; font-size: 54px; letter-spacing: -0.01em; }`,
    true,
  );
}

async function renderStills() {
  mkdirSync(STILLS, { recursive: true });
  const browser = await chromium.launch();
  const tab = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
  for (const [name, html] of Object.entries(STILL_HTML)) {
    const file = join(STILLS, `${name}.html`);
    writeFileSync(file, html);
    await tab.goto(pathToFileURL(file).href);
    const ok = await tab.evaluate(async () =>
      (
        await Promise.all(
          ['700', '600', '500'].map((w) => document.fonts.load(`${w} 54px Poppins`)),
        )
      ).every((f) => f.length > 0),
    );
    if (!ok) throw new Error('Poppins did not load');
    const size =
      name === 'mask'
        ? { width: RW, height: RH }
        : name.startsWith('caption-')
          ? { width: WIDTH, height: CAPTION_BAND }
          : { width: WIDTH, height: HEIGHT };
    await tab.screenshot({
      path: join(STILLS, `${name}.png`),
      clip: { x: 0, y: 0, ...size },
      omitBackground: name.startsWith('caption-'),
    });
  }
  await browser.close();
}

// ── 2. Scene segments ────────────────────────────────────────────────────────

const ENCODE_SEGMENT = [
  '-c:v',
  'libx264',
  '-preset',
  'veryfast',
  '-crf',
  '6',
  '-pix_fmt',
  'yuv444p',
  '-r',
  String(FPS),
  '-an',
];

function cardSegment(scene, out) {
  ffmpeg([
    '-loop',
    '1',
    '-framerate',
    String(FPS),
    '-i',
    join(STILLS, `${scene.id}.png`),
    '-t',
    String(scene.duration),
    '-vf',
    'format=yuv444p',
    ...ENCODE_SEGMENT,
    out,
  ]);
}

function recSegment(scene, shot, out) {
  const inputs = [];
  const filters = [];
  shot.parts.forEach((p, i) => {
    // The recordings run slightly slower than real time; `rate` maps them back.
    const start = Math.max(0, p.offset - LEAD * p.rate);
    inputs.push(
      '-ss',
      start.toFixed(3),
      '-t',
      ((scene.duration + 0.5) * p.rate).toFixed(3),
      '-i',
      p.video,
    );
    const crop = p.crop ? `,crop=${p.crop.w}:${p.crop.h}:0:0` : '';
    filters.push(`[${i}:v]setpts=(PTS-STARTPTS)/${p.rate},fps=${FPS}${crop},setsar=1[p${i}]`);
  });
  const n = shot.parts.length;
  if (n === 1) filters.push('[p0]null[rec]');
  else {
    // Side panel to the right of the page, with the panel's 1 px border.
    filters.push(
      `${shot.parts.map((_, i) => `[p${i}]`).join('')}hstack=inputs=${n},drawbox=x=${shot.parts[1].x}:y=0:w=1:h=${REC.height}:color=0xDCDFEA:t=fill[rec]`,
    );
  }
  inputs.push('-loop', '1', '-framerate', String(FPS), '-i', join(STILLS, 'frame.png'));
  inputs.push('-loop', '1', '-framerate', String(FPS), '-i', join(STILLS, 'mask.png'));
  inputs.push(
    '-loop',
    '1',
    '-framerate',
    String(FPS),
    '-i',
    join(STILLS, `caption-${scene.id}.png`),
  );
  const [bg, mask, cap] = [n, n + 1, n + 2];
  filters.push(
    `[rec]scale=${RW}:${RH}:flags=lanczos,format=rgba[big]`,
    `[${mask}:v]format=gray[m]`,
    `[big][m]alphamerge[win]`,
    `[${cap}:v]format=rgba,fade=t=in:st=${CAPTION_IN}:d=${CAPTION_FADE}:alpha=1[cap]`,
    `[${bg}:v][win]overlay=${RX}:${RY}:shortest=1[f1]`,
    `[f1][cap]overlay=0:0,format=yuv444p[out]`,
  );
  ffmpeg([
    ...inputs,
    '-filter_complex',
    filters.join(';'),
    '-map',
    '[out]',
    '-t',
    String(scene.duration),
    ...ENCODE_SEGMENT,
    out,
  ]);
}

// ── 3. Join, encode, subtitles ───────────────────────────────────────────────

function joinSegments(segments) {
  const { starts, total } = timeline();
  const inputs = segments.flatMap((s) => ['-i', s]);
  const f = [];
  let last = '[0:v]';
  for (let i = 1; i < segments.length; i++) {
    const label = i === segments.length - 1 ? '[v]' : `[x${i}]`;
    f.push(
      `${last}[${i}:v]xfade=transition=fade:duration=${CROSSFADE}:offset=${starts[i].toFixed(3)}${label}`,
    );
    last = label;
  }
  f.push('[v]format=yuv420p[vout]');
  mkdirSync(FINAL_DIR, { recursive: true });
  ffmpeg([
    ...inputs,
    '-f',
    'lavfi',
    '-i',
    `anullsrc=channel_layout=stereo:sample_rate=48000`,
    '-filter_complex',
    f.join(';'),
    '-map',
    '[vout]',
    '-map',
    `${segments.length}:a`,
    '-t',
    total.toFixed(3),
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '18',
    '-profile:v',
    'high',
    '-pix_fmt',
    'yuv420p',
    '-r',
    String(FPS),
    '-g',
    String(FPS * 2),
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-movflags',
    '+faststart',
    SILENT,
  ]);
}

const stamp = (t) => {
  const ms = Math.round(t * 1000);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};

/** One cue per caption, from when it starts to appear until the next one does. */
export function srt() {
  const list = scenes();
  const { starts } = timeline(list);
  const cues = [];
  list.forEach((s, i) => {
    if (!s.caption) return;
    const from = i === 0 ? 0 : starts[i] + CAPTION_IN;
    const to = starts[i + 1] + (list[i + 1].caption ? CAPTION_IN : CROSSFADE);
    cues.push(`${cues.length + 1}\n${stamp(from)} --> ${stamp(to)}\n${s.caption}\n`);
  });
  return cues.join('\n');
}

export async function compose() {
  const manifest = JSON.parse(readFileSync(join(OUT, 'manifest.json'), 'utf8'));
  await renderStills();
  mkdirSync(SEGMENTS, { recursive: true });
  const segments = [];
  for (const s of scenes()) {
    const out = join(SEGMENTS, `${segments.length}-${s.id}.mp4`);
    if (s.kind === 'card') cardSegment(s, out);
    else recSegment(s, manifest[s.id], out);
    segments.push(out);
    console.log(`  segment ${s.id}`);
  }
  joinSegments(segments);
  writeFileSync(SRT, srt());
  console.log(
    `  ${SILENT.replace(ROOT + '/', '')} (${(statSync(SILENT).size / 1e6).toFixed(1)} MB)`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await compose();
