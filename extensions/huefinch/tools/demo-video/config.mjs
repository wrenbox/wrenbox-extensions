/**
 * The storyboard: scene order, on-screen durations and captions. The video's
 * timeline (and the .srt) is derived from these numbers, so keep them here only.
 *
 * Scenes overlap by CROSSFADE seconds, so a scene's slot on the final timeline
 * is (duration − CROSSFADE) except the last, which keeps its full duration.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TOOL_DIR = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(TOOL_DIR, '../..'); // extensions/huefinch
export const DIST = join(ROOT, 'dist');
export const OUT = join(TOOL_DIR, 'out'); // raw recordings and intermediates (gitignored)
export const REVIEW = join(TOOL_DIR, 'review'); // one PNG per second for checking (gitignored)
export const FINAL_DIR = join(ROOT, 'store-assets/video');
export const FONT = join(TOOL_DIR, 'fonts/Poppins-Bold.ttf');
export const LUT = join(OUT, 'deutan.cube'); // written by lut.mjs from src/shared/matrix.ts

export const MUSIC = join(TOOL_DIR, 'audio/music.mp3');
export const TRACK = join(TOOL_DIR, 'audio/TRACK.txt');
export const PLAN = join(OUT, 'audio/plan.json'); // beat-synced timings written by audio.py

export const FPS = 30;
export const LEAD = 0.1; // footage shown before a scene's first action
export const CROSSFADE = 0.3;
// A caption starts fading in this long after its scene starts: mid-crossfade,
// which is also the moment audio.py puts on the beat.
export const CAPTION_IN = 0.15;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const REC = { width: 1280, height: 800 }; // browser viewport and recording size
export const SCALE = 1.2; // recording drawn at 1536×960
export const CAPTION_BAND = 120;

/** The toolbar popup, drawn over the page where Chrome opens it (recorded page CSS px). */
export const POPUP = { x: REC.width - 340 - 12, y: 8, width: 340 };
/** "As a green-weak eye sees it": the whole recording at 40%, bottom right. */
export const INSET = { scale: 0.4, margin: 18, border: 5 };

/**
 * kind: 'card' (rendered still) or 'rec' (recorded browser footage).
 * inset: show the green-weak simulation inset over this scene.
 */
export const SCENES = [
  { id: 'title', kind: 'card', duration: 3.3, caption: 'See colors clearly on every website.' },
  {
    id: 'chart',
    kind: 'rec',
    duration: 9.3,
    caption: 'Tell red and green apart again.',
    inset: true,
  },
  {
    id: 'transit',
    kind: 'rec',
    duration: 6.3,
    caption: 'On every website, automatically.',
    inset: true,
  },
  { id: 'hold', kind: 'rec', duration: 6.3, caption: 'Hold a key to compare.' },
  { id: 'identify', kind: 'rec', duration: 7.3, caption: 'Name any color on screen.' },
  {
    id: 'simulate',
    kind: 'rec',
    duration: 7.3,
    caption: 'Designers: check your work through color-blind eyes.',
  },
  { id: 'privacy', kind: 'rec', duration: 4.3, caption: 'Private. Nothing leaves your browser.' },
  { id: 'end', kind: 'card', duration: 3.0, caption: null },
];

/**
 * The scenes with their final durations: the beat-synced plan (out/audio/plan.json,
 * written by `audio.py plan`) when there is one, otherwise the storyboard's.
 */
export function scenes() {
  let plan = null;
  try {
    plan = JSON.parse(readFileSync(PLAN, 'utf8'));
  } catch {
    /* no plan yet */
  }
  return SCENES.map((s) => ({ ...s, duration: plan?.durations?.[s.id] ?? s.duration }));
}

/** Start time of each scene on the final timeline (where its crossfade in begins). */
export function timeline(list = scenes()) {
  const starts = [];
  let t = 0;
  for (const s of list) {
    starts.push(t);
    t += s.duration - CROSSFADE;
  }
  const total = t + CROSSFADE;
  return { starts, total };
}
