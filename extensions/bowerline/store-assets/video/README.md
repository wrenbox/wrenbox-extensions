# Bowerline promo video

| File                       | What it is                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------- |
| `bowerline-demo-1080p.mp4` | 45 s promo, 1920×1080, 30 fps, H.264 (yuv420p) with a silent AAC track. No music.  |
| `bowerline-demo.srt`       | The on-screen captions with their exact timings, for players and upload forms.     |

Every shot is the real, built extension (`dist/`) running in Chromium, driven by a script. Nothing is mocked up: the article and the PDF are local fixtures, and no real personal data, bookmarks or other extensions appear.

## Re-record in one command

```sh
cd extensions/bowerline
npm ci            # once
npm run video
```

That builds the extension, records every scene in headed Chromium (inside `xvfb-run` when there is no display), composes and encodes the video, writes the `.srt`, saves one frame per second to `tools/demo-video/review/` for checking, and verifies the result with `ffprobe` (1920×1080, 30 fps, H.264, 40–46 s, under 50 MB). It exits non-zero if any check fails. Run it after any UI change that the video shows.

Needs: Node 20+, Playwright's Chromium (`PLAYWRIGHT_BROWSERS_PATH` or `npx playwright install chromium`), `ffmpeg`/`ffprobe`, and `xvfb-run` on a machine without a display. The caption font (Poppins, SIL Open Font License) is bundled in `tools/demo-video/fonts/`, so nothing is downloaded at render time.

`node tools/demo-video/run.mjs --compose-only` re-composes from the last recording, which is handy when only captions or timings change.

## Storyboard

| Time      | Scene                                                                                   | Caption                                       |
| --------- | --------------------------------------------------------------------------------------- | --------------------------------------------- |
| 0–3 s     | Title card: the wordmark on its yellow swipe                                            | Highlight PDFs and web pages. Privately.      |
| 3–12 s    | Article: select a sentence, the toolbar appears, pick yellow, add a note                | Select. Pick a colour. Add a note.            |
| 12–15.5 s | Leave the page and come back: highlights and the note are still there                  | Still there when you come back.               |
| 15.5–23.5 s | Open a PDF from the computer in Bowerline's viewer, highlight a sentence in mint        | Works on PDFs, even files on your computer.   |
| 23.5–30 s | Side panel next to the PDF: search "retrieval", click a card, the viewer jumps to it    | Find any highlight in seconds.                |
| 30–36 s   | Library export dialog: Obsidian preview, download                                       | Export to Obsidian, Notion or Markdown.       |
| 36–41 s   | Settings, Your data: the counts and "0 servers your data is sent to"                   | No account. Nothing leaves your browser.      |
| 41–45 s   | End card: icon, wordmark, "Free on the Chrome Web Store", "Made by Wrenbox"            | (none)                                        |

Scene lengths and captions live in `tools/demo-video/config.mjs`; the timeline and the `.srt` are derived from them.

## How it works

- `tools/demo-video/record.mjs` installs `dist/` into a fresh profile, writes the "Always on" site permission into the profile (what Chrome records after the user accepts the prompt, so no prompt is ever shown), creates the supporting highlights off camera, then records each scene with Playwright's `recordVideo` at 1280×800. Each page gets its own window sized so its content area is exactly the recorded size; the side panel and the PDF viewer are two windows recorded side by side. The cursor is a 22 px arrow drawn in the page that follows the real mouse events. Each page flashes magenta once before and once after its scenes; those flashes are found again in the recording to place every scene precisely and to correct the recorder's small speed drift.
- `tools/demo-video/compose.mjs` renders the cards, frame and captions as HTML with the bundled font, lays each recording at 1.2× (1536×960) below a 120 px caption band on `#F4F6FB`, fades each caption in over 200 ms, joins the scenes with 300 ms crossfades and encodes the final file.
- `tools/demo-video/run.mjs` runs the whole thing and checks the output.

Intermediate files go to `tools/demo-video/out/` and review frames to `tools/demo-video/review/`; both are ignored by git.
