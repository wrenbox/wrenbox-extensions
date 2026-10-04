/**
 * The storyboard: scene order, on-screen durations and captions. The video's
 * timeline (and the .srt) is derived from these numbers, so keep them here only.
 *
 * Scenes overlap by CROSSFADE seconds, so a scene's slot on the final timeline
 * is (duration − CROSSFADE) except the last, which keeps its full duration.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TOOL_DIR = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(TOOL_DIR, '../..'); // extensions/bowerline
export const DIST = join(ROOT, 'dist');
export const OUT = join(TOOL_DIR, 'out'); // raw recordings and intermediates (gitignored)
export const REVIEW = join(TOOL_DIR, 'review'); // one PNG per second for checking (gitignored)
export const FINAL_DIR = join(ROOT, 'store-assets/video');
export const FONT = join(TOOL_DIR, 'fonts/Poppins-Bold.ttf');

export const FPS = 30;
export const CROSSFADE = 0.3;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const REC = { width: 1280, height: 800 }; // browser viewport and recording size
export const SCALE = 1.2; // recording drawn at 1536×960
export const CAPTION_BAND = 120;

/** kind: 'card' (rendered still) or 'rec' (recorded browser footage). */
export const SCENES = [
  { id: 'title', kind: 'card', duration: 3.3, caption: 'Highlight PDFs and web pages. Privately.' },
  { id: 'highlight', kind: 'rec', duration: 9.4, caption: 'Select. Pick a colour. Add a note.' },
  { id: 'reload', kind: 'rec', duration: 3.8, caption: 'Still there when you come back.' },
  { id: 'pdf', kind: 'rec', duration: 8.0, caption: 'Works on PDFs, even files on your computer.' },
  { id: 'library', kind: 'rec', duration: 7.0, caption: 'Find any highlight in seconds.' },
  { id: 'export', kind: 'rec', duration: 6.2, caption: 'Export to Obsidian, Notion or Markdown.' },
  {
    id: 'privacy',
    kind: 'rec',
    duration: 5.3,
    caption: 'No account. Nothing leaves your browser.',
  },
  { id: 'end', kind: 'card', duration: 4.1, caption: null },
];

/** Start time of each scene on the final timeline (where its crossfade in begins). */
export function timeline() {
  const starts = [];
  let t = 0;
  for (const s of SCENES) {
    starts.push(t);
    t += s.duration - CROSSFADE;
  }
  const total = t + CROSSFADE;
  return { starts, total };
}
