# Huefinch promo video

| File                             | What it is                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `huefinch-demo-1080p.mp4`        | 45 s promo, 1920×1080, 30 fps, H.264 (yuv420p), with its soundtrack: AAC 192 kbps, 48 kHz stereo, −14 LUFS. |
| `huefinch-demo-1080p-silent.mp4` | The same picture with a silent track (the soundtrack's input, kept as a backup).                             |
| `huefinch-demo.srt`              | The on-screen captions with their exact timings, for players and upload forms.                               |
| `MUSIC_CREDIT.md`                | The track, its source and the credit line for the YouTube description.                                       |

Every shot is the real, built extension (`dist/`) running in Chromium, driven by a script. The websites are local fixtures served under made-up `.example` names (`dashboard.example`, `metro.example`, `shop.example`, `app.example`), so the popup shows a plain site name. No real personal data, other extensions or real brands appear. Every sound effect is synthesised in code; nothing is downloaded.

Recording this video found a real bug: on pages shorter than the window, the area below the page turned white while Huefinch was on. It was fixed in the extension (1.0.1, with a pixel test; see `REVIEW.md` G8) and the video was re-recorded. The bug was not edited out.

## Re-record in one command

```sh
cd extensions/huefinch
npm ci                                              # once
pip install -r tools/demo-video/requirements.txt   # once: librosa, numpy, scipy, soundfile
npm run video
```

This builds the extension, writes the LUT, records every scene, plans the soundtrack, composes the picture, mixes and masters the audio, muxes it in, and checks everything. It exits non-zero if any check fails. Run it after any UI change the video shows, or after replacing the music.

`node tools/demo-video/run.mjs --compose-only` reuses the last recording and redoes everything after it.

**Checks:**

- Picture: 1920×1080, 30 fps, H.264, 40–46 s, matches the planned length, under 50 MB, copied rather than re-encoded.
- Audio: AAC 192 kbps 48 kHz stereo, −14 LUFS ±1 integrated, true peak at or below −1 dBTP, no clipping, loudnorm stayed linear.
- Sync: every effect lands on the exact frame its action shows.
- Ending: the music fades to silence exactly as the video ends, with no gap before the fade.

Last run: 45.00 s, 4.3 MB, −14 LUFS, −2.2 dBTP, 8/8 effects on their frame.

**For review:** one frame per second in `tools/demo-video/review/frame-NN.png`, and `tools/demo-video/review/waveform.png`. The waveform shows the mix, the beats, the scene changes, and the effects stem under a marker for the frame each action shows.

**Needs:**

- Node 20+ and Python 3 with the packages above.
- Playwright's Chromium (`PLAYWRIGHT_BROWSERS_PATH` or `npx playwright install chromium`).
- `ffmpeg`/`ffprobe`, and `xvfb-run` on a machine without a display.

The caption font (Poppins, SIL Open Font License) is bundled in `tools/demo-video/fonts/`.

## Storyboard

Times are where each caption appears. All seven scene changes sit on a beat of the music.

| Time        | Scene                                                                                                                                                                             | Caption                                              | Sound                                        |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------- |
| 0–3.4 s     | Title card: icon, wordmark over a red, green and blue bar                                                                                                                         | See colors clearly on every website.                 | Music fades in                               |
| 3.4–12.1 s  | A sales chart whose red and green lines a green-weak eye can't tell apart. The popup opens, Green-weak is picked, Huefinch is switched on, and the red line turns pink. The inset shows both states as a green-weak eye sees them. | Tell red and green apart again.                      | Option tick, toggle click, shimmer           |
| 12.1–18.2 s | A transit map on another site is already corrected (the inset again)                                                                                                              | On every website, automatically.                     | Music                                        |
| 18.2–24.3 s | Hold Alt+Shift+X: a key pill appears, the page shows its original colors, then corrects again on release                                                                          | Hold a key to compare.                               | Whoomp down on press, reversed on release    |
| 24.3–31 s   | Alt+Shift+C on a shop page, click the first T-shirt: "Olive green, #65732A, copied, Close to: dark olive green"                                                                   | Name any color on screen.                            | Key click, pick chime (a major third)        |
| 31–38.2 s   | A sign-up form; the popup switches to Simulate, and the page shows the design as a green-weak eye sees it, with the "Simulating" pill                                             | Designers: check your work through color-blind eyes. | Option tick                                  |
| 38.2–42 s   | Settings → Websites: the on-every-site switch and "Your privacy"                                                                                                                  | Private. Nothing leaves your browser.                | Music                                        |
| 42–45 s     | End card: icon, wordmark, "Free on the Chrome Web Store", "Made by Wrenbox"                                                                                                       | (none)                                               | Chime (a fifth); 2.2 s fade to silence       |

Scene lengths and captions live in `tools/demo-video/config.mjs`; the beat-synced timeline, the `.srt` and the sound are derived from them.

## The "As a green-weak eye sees it" inset

The chart and transit scenes show a small inset of the same frame as a person with deuteranopia sees it. It makes the problem visible to viewers with typical color vision. Before the switch, the inset's two lines are the same olive. After it, one turns gray-blue and the other stays olive.

The inset is not hand-tinted. `tools/demo-video/lut.mjs` bundles Huefinch's own maths (`src/shared/matrix.ts`, Machado et al. 2009 at full severity, in linear RGB) through `src/shared/lut.ts` into a 33×33×33 `.cube` LUT. ffmpeg applies it with `lut3d` (tetrahedral). `tests/unit/lut.test.ts` checks that the LUT matches the exact maths within 3/255 at 50 random colors, and exactly at the grid points. The video and the extension therefore can't disagree.

## How it works

- **Recording** (`tools/demo-video/record.mjs`):
  - Installs `dist/` into a fresh profile and writes the "every website" permission into it. That is what Chrome records after the user allows it, so no prompt is shown.
  - Records each scene with Playwright's `recordVideo` at 1280×800, in a window sized so its content area is exactly that.
  - The cursor is a 22 px arrow drawn in the page that follows the real mouse events. The key-hint pill is drawn the same way.
- **The popup.** An extension popup can't be recorded in place. The real `popup.html` is opened for the scene's tab in its own window, recorded alongside the page and laid over the page's top-right corner. It sits where Chrome would show it, with a shadow, and fades in and out when it opens and closes. The clicks in it are real clicks on the real popup.
- **The color picker.** Chrome's EyeDropper opens a native picker that a recording can't capture. For the identify scene only, the recorder installs a stand-in in Huefinch's content world that returns the true pixel under the click. That pixel (#65732A) is measured from a screenshot of the page with Huefinch off. Everything after the pick (naming, the card, copying to the clipboard) is the real extension. The demo origins are treated as secure, as real `https` sites are, so the clipboard and EyeDropper exist.
- **Sync flashes.** Each window flashes black once before and once after its scenes. Black, because Huefinch recolors everything else. The flashes place every scene to the frame and correct the recorder's speed drift.
- **Event log.** Every click, toggle, key press and pick is logged with the screen area it changes.
- **Audio** (`tools/demo-video/audio.py`): plans the soundtrack (section, beats, key), aligns effects to the frames their actions show on, synthesises and mixes them, and verifies the result.
- **Composing** (`tools/demo-video/compose.mjs`):
  - Renders the cards, frame, inset frame, label and captions as HTML with the bundled font.
  - Lays each recording at 1.2× (1536×960) below a 120 px caption band.
  - Builds the inset with `lut3d`, fades each caption in, and joins the scenes with 300 ms crossfades.
- **Mux and checks** (`tools/demo-video/soundtrack.mjs`): runs the two `loudnorm` passes, the mux, and the loudness, sync and ending checks, and draws the review waveform. `tools/demo-video/run.mjs` runs everything in order.

Intermediate files go to `tools/demo-video/out/` and review files to `tools/demo-video/review/`; git ignores both.

## Soundtrack

**Music.** The file is `tools/demo-video/audio/music.mp3`, named in `audio/TRACK.txt`. `audio.py plan` analyses it with librosa: beats, phrases, energy and key. It picks the section that opens calmly, lifts mid-video and ends a phrase on the end card. The chosen section is 1:04.71–1:49.71 of the track (89.1 BPM, C major). It starts quiet under the title card and the chart, then lifts at 9.8 s, right after the chart's colors switch. It fades in over 0.5 s and fades out from the phrase end at 42.7 s to silence exactly at 45.0 s.

**Beat sync.** Each scene change moves to the nearest beat if one is within 250 ms. Only the stillness after a scene's last change is stretched or shortened, never the actions. All seven changes moved: +170, −168, −155, −164, +174, −162 and −145 ms.

**Effects.** All are synthesised in numpy and scipy, with no sample files:

- **Toggle:** a soft two-tone click at 1.2 then 1.6 kHz.
- **Option:** a 25 ms tick at 1.8 kHz.
- **Correction on:** a 400 ms rising, stereo shimmer of three detuned partials in the music's key.
- **Hold key:** a low whoomp falling 160→70 Hz on press, and the same sound reversed on release, so the colors "go away and come back".
- **Pick:** a two-note chime a major third apart.
- **End card:** a chime a fifth apart, on the music's tonic and tuned to it.

**On the frame.** `audio.py align` watches each action's screen area in the composed video and puts its effect on the frame where the change first shows. The median lag was +98 ms. `audio.py verify` re-checks every effect.

**Mix.** The music dips 3 dB under every prominent effect (shimmer, whoomps, pick and end chime), so an effect never stacks on the track's own peaks. Two-pass `loudnorm` brings the mix to −14 LUFS integrated with linear gain. The audio is encoded as AAC 192 kbps and muxed with the picture copied.
