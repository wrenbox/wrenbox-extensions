/**
 * Turns the raw recordings (out/manifest.json, written by record.mjs) into
 * the final 1920×1080 video and its .srt.
 *
 * 1. Stills (title and end cards, the frame background and shadow, the
 *    rounded-corner masks, the popup's shadow, the inset's frame and label, and
 *    one caption per scene) are drawn as HTML with the bundled Poppins font and
 *    screenshotted by Chromium.
 * 2. Each scene becomes a near-lossless segment: the recording trimmed to its
 *    slot, played back at true speed, scaled 1.2× onto the frame, the toolbar
 *    popup drawn where Chrome opens it while it is open, the "As a green-weak
 *    eye sees it" inset (the same footage through out/deutan.cube) at the bottom
 *    right, and the caption fading in over 200 ms.
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
  INSET,
  LEAD,
  LUT,
  OUT,
  POPUP,
  REC,
  ROOT,
  SCALE,
  SCENES,
  TOOL_DIR,
  WIDTH,
  scenes,
  timeline,
} from './config.mjs';
import { writeLut } from './lut.mjs';

export const VIDEO = join(FINAL_DIR, 'huefinch-demo-1080p.mp4');
/** The composed picture with a silent track; soundtrack.mjs muxes the mix into VIDEO. */
export const SILENT = join(FINAL_DIR, 'huefinch-demo-1080p-silent.mp4');
export const SRT = join(FINAL_DIR, 'huefinch-demo.srt');

const NAVY = '#18214D';
const BG = '#F4F6FB';
const BAR = ['#FF6B5B', '#3CC98A', '#4C8DFF'];
const CAPTION_FADE = 0.2;
const POPUP_FADE = 0.15;
const RW = REC.width * SCALE; // 1536
const RH = REC.height * SCALE; // 960
const RX = (WIDTH - RW) / 2; // 192
const RY = CAPTION_BAND; // 120: the recording fills the frame below the caption band
const RADIUS = 12;

/** The inset on the final frame: 40% of the recording, bottom right, inside the window. */
const even = (n) => 2 * Math.round(n / 2);
export const INSET_BOX = (() => {
  const w = even(RW * INSET.scale);
  const h = even(RH * INSET.scale);
  return { w, h, x: RX + RW - INSET.margin - w, y: RY + RH - INSET.margin - h };
})();

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

const page = (
  body,
  css,
  size = { width: WIDTH, height: HEIGHT },
  background = NAVY,
) => `<!doctype html><meta charset="utf-8"><style>
${fontFaces}
* { box-sizing: border-box; }
html, body { margin: 0; width: ${size.width}px; height: ${size.height}px; overflow: hidden; background: ${background}; }
body { font-family: Poppins, sans-serif; -webkit-font-smoothing: antialiased; position: relative; }
${css}
</style><body>${body}</body>`;

const icon = pathToFileURL(join(ROOT, 'public/icons/icon-128.png')).href;
/** The white wordmark over the three-color Wrenbox bar. */
const wordmark = (size) =>
  `<div class="mark"><span style="font-size:${size}px">Huefinch</span><div class="bar">${BAR.map((c) => `<i style="background:${c}"></i>`).join('')}</div></div>`;
const cardCss = `
main { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
img { width: 128px; height: 128px; border-radius: 28px; box-shadow: 0 0 0 2px rgba(255,255,255,.18), 0 16px 40px rgba(0,0,0,.35); }
.mark { display: flex; flex-direction: column; align-items: stretch; margin-top: 30px; }
.mark span { color: #fff; font-weight: 700; line-height: 1.05; letter-spacing: -0.02em; }
.bar { display: flex; height: 14px; border-radius: 7px; overflow: hidden; margin-top: 18px; }
.bar i { flex: 1; }
p { margin: 56px 0 0; color: #fff; font-weight: 600; font-size: 54px; letter-spacing: -0.005em; }
small { margin-top: 24px; color: #A9B0D6; font-weight: 500; font-size: 28px; letter-spacing: 0.01em; }
`;

function stillHtml() {
  const html = {
    title: page(
      `<main><img src="${icon}">${wordmark(150)}<p>${SCENES[0].caption}</p></main>`,
      cardCss,
    ),
    end: page(
      `<main><img src="${icon}">${wordmark(124)}<p>Free on the Chrome Web Store</p><small>Made by Wrenbox</small></main>`,
      cardCss,
    ),
    // Background with the window's soft shadow (the recording is laid on top).
    frame: page(
      `<div class="win"></div>`,
      `.win { position: absolute; left: ${RX}px; top: ${RY}px; width: ${RW}px; height: ${RH + 40}px; border-radius: ${RADIUS}px ${RADIUS}px 0 0; background: #fff;
              box-shadow: 0 2px 6px rgba(24, 33, 77, 0.08), 0 18px 48px rgba(24, 33, 77, 0.16); }`,
      undefined,
      BG,
    ),
    // White where the recording shows: top corners rounded, bottom edge runs off the frame.
    mask: page(
      `<div></div>`,
      `div { width: ${RW}px; height: ${RH + 40}px; background: #fff; border-radius: ${RADIUS}px ${RADIUS}px 0 0; }`,
      { width: RW, height: RH },
      '#000',
    ),
    // The inset's white border, soft shadow and label (transparent elsewhere).
    'inset-frame': page(
      `<div class="box"></div>`,
      `.box { position: absolute; left: ${INSET_BOX.x - INSET.border}px; top: ${INSET_BOX.y - INSET.border}px;
              width: ${INSET_BOX.w + 2 * INSET.border}px; height: ${INSET_BOX.h + 2 * INSET.border}px;
              border-radius: 14px; background: #fff;
              box-shadow: 0 2px 6px rgba(24, 33, 77, 0.16), 0 18px 44px rgba(24, 33, 77, 0.32); }`,
      undefined,
      'transparent',
    ),
    'inset-label': page(
      `<span>As a green-weak eye sees it</span>`,
      `span { position: absolute; left: ${INSET_BOX.x + 14}px; top: ${INSET_BOX.y + INSET_BOX.h - 58}px;
              padding: 9px 16px; border-radius: 999px; background: ${NAVY}; color: #fff;
              font-weight: 600; font-size: 24px; letter-spacing: -0.005em;
              box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3); }`,
      undefined,
      'transparent',
    ),
    'inset-mask': page(
      `<div></div>`,
      `div { width: ${INSET_BOX.w}px; height: ${INSET_BOX.h}px; background: #fff; border-radius: 10px; }`,
      { width: INSET_BOX.w, height: INSET_BOX.h },
      '#000',
    ),
  };
  for (const s of SCENES) {
    if (s.kind !== 'rec') continue;
    html[`caption-${s.id}`] = page(
      `<p>${s.caption}</p>`,
      `p { margin: 0; height: ${CAPTION_BAND}px; display: flex; align-items: center; justify-content: center; color: ${NAVY}; font-weight: 700; font-size: 54px; letter-spacing: -0.01em; }`,
      { width: WIDTH, height: CAPTION_BAND },
      'transparent',
    );
  }
  return html;
}

/** The popup's shadow and edge on the final frame, and its rounded mask, for a popup height. */
function popupStills(height) {
  const x = RX + POPUP.x * SCALE;
  const y = RY + POPUP.y * SCALE;
  const w = POPUP.width * SCALE;
  const h = height * SCALE;
  return {
    [`popup-shadow-${height}`]: page(
      `<div></div>`,
      `div { position: absolute; left: ${x - 1}px; top: ${y - 1}px; width: ${w + 2}px; height: ${h + 2}px; border-radius: 15px; background: #DCE1EC;
             box-shadow: 0 4px 10px rgba(24, 33, 77, 0.10), 0 22px 56px rgba(24, 33, 77, 0.26); }`,
      undefined,
      'transparent',
    ),
    [`popup-mask-${height}`]: page(
      `<div></div>`,
      `div { width: ${POPUP.width}px; height: ${height}px; background: #fff; border-radius: 12px; }`,
      { width: POPUP.width, height },
      '#000',
    ),
  };
}

async function renderStills(manifest) {
  mkdirSync(STILLS, { recursive: true });
  const html = stillHtml();
  for (const scene of Object.values(manifest))
    for (const p of scene.parts) if (p.overlay) Object.assign(html, popupStills(p.crop.h));
  const browser = await chromium.launch();
  const tab = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
  for (const [name, doc] of Object.entries(html)) {
    const file = join(STILLS, `${name}.html`);
    writeFileSync(file, doc);
    await tab.goto(pathToFileURL(file).href);
    const ok = await tab.evaluate(async () =>
      (
        await Promise.all(
          ['700', '600', '500'].map((w) => document.fonts.load(`${w} 54px Poppins`)),
        )
      ).every((f) => f.length > 0),
    );
    if (!ok) throw new Error('Poppins did not load');
    await tab.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
    const size = await tab.evaluate(() => ({
      width: document.body.offsetWidth,
      height: document.body.offsetHeight,
    }));
    await tab.screenshot({
      path: join(STILLS, `${name}.png`),
      clip: { x: 0, y: 0, ...size },
      omitBackground: true,
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
    '-loop', '1', '-framerate', String(FPS), '-i', join(STILLS, `${scene.id}.png`),
    '-t', String(scene.duration), '-vf', 'format=yuv444p', ...ENCODE_SEGMENT, out,
  ]); // prettier-ignore
}

/** When the popup is on screen in a scene: segment seconds from its `show` and `hide` events. */
function popupWindow(shot) {
  const show = shot.events.find((e) => e.type === 'show');
  const hide = shot.events.find((e) => e.type === 'hide');
  if (!show || !hide) throw new Error('A scene with the popup needs show and hide events');
  return { from: LEAD + show.t, to: LEAD + hide.t };
}

function recSegment(scene, shot, out) {
  const inputs = [];
  const f = [];
  const still = (name) => {
    inputs.push('-loop', '1', '-framerate', String(FPS), '-i', join(STILLS, `${name}.png`));
    return `${inputs.filter((x) => x === '-i').length - 1}:v`;
  };
  const video = (p) => {
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
    return `${inputs.filter((x) => x === '-i').length - 1}:v`;
  };
  const base = shot.parts.find((p) => !p.overlay);
  const popup = shot.parts.find((p) => p.overlay);
  f.push(
    `[${video(base)}]setpts=(PTS-STARTPTS)/${base.rate},fps=${FPS},setsar=1,format=rgba[page]`,
  );

  let popupLayers = null;
  if (popup) {
    const { from, to } = popupWindow(shot);
    const fades = `fade=t=in:st=${from.toFixed(3)}:d=${POPUP_FADE}:alpha=1,fade=t=out:st=${(to - POPUP_FADE).toFixed(3)}:d=${POPUP_FADE}:alpha=1`;
    const v = video(popup);
    const mask = still(`popup-mask-${popup.crop.h}`);
    const shadow = still(`popup-shadow-${popup.crop.h}`);
    f.push(
      `[${v}]setpts=(PTS-STARTPTS)/${popup.rate},fps=${FPS},crop=${popup.crop.w}:${popup.crop.h}:0:0,setsar=1,format=rgba[pv]`,
      `[${mask}]format=gray[pm]`,
      `[pv][pm]alphamerge,${fades}[pa]`,
      // The inset needs the popup too (what the eye sees); split only when there is one.
      scene.inset ? `[pa]split[pa1][pa2]` : `[pa]null[pa2]`,
      `[pa2]scale=${Math.round(popup.crop.w * SCALE)}:${Math.round(popup.crop.h * SCALE)}:flags=lanczos[pbig]`,
      `[${shadow}]format=rgba,${fades}[pshadow]`,
    );
    popupLayers = { small: '[pa1]', big: '[pbig]', shadow: '[pshadow]' };
  }

  // The window: the page alone (the popup is drawn above everything, below).
  const winMask = still('mask');
  const bg = still('frame');
  const cap = still(`caption-${scene.id}`);
  if (scene.inset) f.push('[page]split[page1][page2]');
  const pageMain = scene.inset ? '[page1]' : '[page]';
  f.push(
    `${pageMain}scale=${RW}:${RH}:flags=lanczos[big]`,
    `[${winMask}]format=gray[m]`,
    `[big][m]alphamerge[win]`,
    `[${bg}][win]overlay=${RX}:${RY}:shortest=1[f1]`,
  );
  let last = '[f1]';

  if (scene.inset) {
    // What the eye sees is the whole screen: the page and, while open, the popup.
    let seen = '[page2]';
    if (popupLayers) {
      f.push(`[page2]${popupLayers.small}overlay=${POPUP.x}:${POPUP.y}[seen]`);
      seen = '[seen]';
    }
    const frame = still('inset-frame');
    const label = still('inset-label');
    const imask = still('inset-mask');
    f.push(
      `${seen}format=rgb24,lut3d=file='${LUT}':interp=tetrahedral,scale=${INSET_BOX.w}:${INSET_BOX.h}:flags=lanczos,format=rgba[ins]`,
      `[${imask}]format=gray[im]`,
      `[ins][im]alphamerge[insm]`,
      `${last}[${frame}]overlay=0:0[f2]`,
      `[f2][insm]overlay=${INSET_BOX.x}:${INSET_BOX.y}[f3]`,
      `[f3][${label}]overlay=0:0[f4]`,
    );
    last = '[f4]';
  }
  if (popupLayers) {
    f.push(
      `${last}${popupLayers.shadow}overlay=0:0[f5]`,
      `[f5]${popupLayers.big}overlay=${Math.round(RX + POPUP.x * SCALE)}:${Math.round(RY + POPUP.y * SCALE)}[f6]`,
    );
    last = '[f6]';
  }
  f.push(
    `[${cap}]format=rgba,fade=t=in:st=${CAPTION_IN}:d=${CAPTION_FADE}:alpha=1[cap]`,
    `${last}[cap]overlay=0:0,format=yuv444p[out]`,
  );
  ffmpeg([
    ...inputs,
    '-filter_complex',
    f.join(';'),
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
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-filter_complex', f.join(';'),
    '-map', '[vout]', '-map', `${segments.length}:a`,
    '-t', total.toFixed(3),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-r', String(FPS), '-g', String(FPS * 2),
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart',
    SILENT,
  ]); // prettier-ignore
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
  await writeLut();
  await renderStills(manifest);
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
