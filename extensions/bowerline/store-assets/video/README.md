# Bowerline promo video

| File                              | What it is                                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `bowerline-demo-1080p.mp4`        | 45 s promo, 1920×1080, 30 fps, H.264 (yuv420p), with its soundtrack: AAC 192 kbps, 48 kHz stereo, −14 LUFS. |
| `bowerline-demo-1080p-silent.mp4` | The same picture with a silent track (the soundtrack's input, kept as a backup).                       |
| `bowerline-demo.srt`              | The on-screen captions with their exact timings, for players and upload forms.                          |
| `MUSIC_CREDIT.md`                 | The track, its source and the credit line for the YouTube description.                                  |

Every shot is the real, built extension (`dist/`) running in Chromium, driven by a script. Nothing is mocked up: the article and the PDF are local fixtures, and no real personal data, bookmarks or other extensions appear. The music is the owner's track from the YouTube Audio Library; every sound effect is synthesised in code. Nothing is downloaded.

## Re-record in one command

```sh
cd extensions/bowerline
npm ci                                              # once
pip install -r tools/demo-video/requirements.txt   # once: librosa, numpy, scipy, soundfile
npm run video
```

That builds the extension, records every scene, plans the soundtrack, composes the picture, mixes and masters the audio, muxes it in, and checks everything. It exits non-zero if any check fails. Run it after any UI change that the video shows, or after replacing the music.

**Checks:** 1920×1080, 30 fps, H.264, 40–46 s, under 50 MB, picture copied rather than re-encoded, AAC 192 kbps 48 kHz stereo, −14 LUFS ±1 integrated, true peak at or below −1 dBTP, no clipping, loudnorm stayed linear, every effect on the exact frame its action shows, the music fading to silence exactly as the video ends with no gap before the fade.

**For review:** one frame per second in `tools/demo-video/review/frame-NN.png`, and `tools/demo-video/review/waveform.png` (the mix, the beats, the scene changes, and the effects stem under a marker for the frame each action shows). Measurements are in `tools/demo-video/out/audio/report.json`.

Needs: Node 20+, Python 3 with the packages above, Playwright's Chromium (`PLAYWRIGHT_BROWSERS_PATH` or `npx playwright install chromium`), `ffmpeg`/`ffprobe`, and `xvfb-run` on a machine without a display. The caption font (Poppins, SIL Open Font License) is bundled in `tools/demo-video/fonts/`.

`node tools/demo-video/run.mjs --compose-only` reuses the last recording and redoes everything after it: soundtrack plan, picture, mix and checks.

## Storyboard

Times are where each caption appears; five of the seven scene changes sit on a beat of the music (see below).

| Time        | Scene                                                                                | Caption                                     | Sound                                        |
| ----------- | ------------------------------------------------------------------------------------ | ------------------------------------------- | -------------------------------------------- |
| 0–3 s       | Title card: the wordmark on its yellow swipe                                         | Highlight PDFs and web pages. Privately.    | Music fades in (0.5 s)                       |
| 3–12 s      | Article: select a sentence, the toolbar appears, pick yellow, add a note             | Select. Pick a colour. Add a note.          | Colour click, marker swipe, typing           |
| 12–15.5 s   | Leave the page and come back: highlights and the note are still there               | Still there when you come back.             | Marker swipe as the highlights return        |
| 15.5–23.5 s | Open a PDF from the computer in Bowerline's viewer, highlight a sentence in mint     | Works on PDFs, even files on your computer. | Colour click, marker swipe                   |
| 23.5–30 s   | Side panel next to the PDF: search "retrieval", click a card, the viewer jumps to it | Find any highlight in seconds.              | Typing, results pop                          |
| 30–36 s     | Library export dialog: Obsidian preview, download                                    | Export to Obsidian, Notion or Markdown.     | Music                                        |
| 36–41 s     | Settings, Your data: the counts and "0 servers your data is sent to"                | No account. Nothing leaves your browser.    | Music                                        |
| 41–45 s     | End card: icon, wordmark, "Free on the Chrome Web Store", "Made by Wrenbox"          | (none)                                      | Chime; the phrase ends, 2.2 s fade to silence |

Scene lengths and captions live in `tools/demo-video/config.mjs`; the beat-synced timeline, the `.srt` and the sound are derived from them.

## Soundtrack

- **Music** (`tools/demo-video/audio/music.mp3`, named in `audio/TRACK.txt`). `audio.py plan` analyses the track with librosa: beats (about 89 BPM), downbeats and four-bar phrases (from section boundaries), a 0–1 energy curve, and the key (C# from the harmonic content, tuning −4 cents). It scores every section that starts on a beat and has a phrase boundary 2–3 s before the end of the video. It wants a calm opening, a lift between 14 and 34 s, a strong phrase boundary and as many beat-synced cuts as possible. The chosen section is 0.84–45.84 s of the track: its intro, the lift into the first full section, and the phrase ending at 42.8 s on the end card. The music fades in over 0.5 s and fades out from that phrase boundary to silence exactly at 45.0 s.
- **Beat sync.** Each scene change (the crossfade's midpoint, where the caption appears) moves to the nearest beat if one is within 250 ms. Only the pause after a scene's last visible change gets longer or shorter, never the actions, and every scene keeps at least 0.5 s of stillness before its crossfade. Five of seven changes moved: −106, −239, +141, +198 and −90 ms. The other two had no beat close enough.
- **Effects** (`audio.py`, numpy and scipy, no sample files): colour click (25 ms sine tick at 1.8 kHz, fast decay), marker swipe (180 ms of band-passed noise sweeping 1.3→2.6 kHz with a paper grain), typing (very quiet ticks around 2.9 kHz, pitch, length and level varied per key, one per character), results pop (60 ms rounded pop gliding into 600 Hz), and an end-card chime (two soft bell notes a fifth apart on the track's tonic: C#5 and G#5, tuned to the track).
- **On the frame.** The recorder logs each action's time and the screen area it changes. After composing, `audio.py align` watches those areas in the composed video and puts each effect on the frame where its action first shows: the toolbar vanishing, the highlight colour arriving, each character appearing, the result count changing. This matters because pages paint late: typing appeared 200–400 ms after the keystroke. A typing burst is matched to its changes in order, so no keystroke can slip onto a neighbour's frame. `audio.py verify` then re-checks every effect.
- **Mix.** Effect peaks sit about 6 dB below the music's peak (typing about 14 dB below). The music dips 3 dB under each marker swipe. Two-pass `loudnorm` brings it to −14 LUFS integrated with linear gain, targeting −1.5 dBTP so the AAC encode stays under −1 dBTP. The audio is encoded as AAC 192 kbps, 48 kHz stereo and muxed with the picture stream copied, not re-encoded.

## How it works

- `tools/demo-video/record.mjs` installs `dist/` into a fresh profile, writes the "Always on" site permission into the profile (what Chrome records after the user accepts the prompt, so no prompt is ever shown), creates the supporting highlights off camera, then records each scene with Playwright's `recordVideo` at 1280×800. Each page gets its own window sized so its content area is exactly the recorded size; the side panel and the PDF viewer are two windows recorded side by side. The cursor is a 22 px arrow drawn in the page that follows the real mouse events. Each page flashes magenta once before and once after its scenes; those flashes are found again in the recording to place every scene precisely and to correct the recorder's small speed drift. It logs every click, highlight, keystroke and search update with the screen area it affects.
- `tools/demo-video/audio.py` plans the soundtrack (section, beats, key), aligns effects to the frames their actions show on, synthesises and mixes them, and verifies the result.
- `tools/demo-video/compose.mjs` renders the cards, frame and captions as HTML with the bundled font, lays each recording at 1.2× (1536×960) below a 120 px caption band on `#F4F6FB`, fades each caption in over 200 ms, joins the scenes with 300 ms crossfades and encodes the silent picture.
- `tools/demo-video/soundtrack.mjs` runs the audio steps, the two `loudnorm` passes, the mux and the loudness, sync and ending checks, and draws the review waveform.
- `tools/demo-video/run.mjs` runs the whole thing in order and prints every check.

Intermediate files go to `tools/demo-video/out/` and review files to `tools/demo-video/review/`; both are ignored by git.
