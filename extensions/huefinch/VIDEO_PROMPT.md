# Build prompt: Huefinch promo video (45 seconds, 1080p, with soundtrack)

Paste everything below into Claude Code from the repo root, after Huefinch is built and its tests pass.

**Before running it**, download one music track from the YouTube Audio Library (YouTube Studio → Audio library). Filter for Mood: Bright or Calm; Genre: Ambient, Electronic or Pop; at least 50 seconds; no vocals; licence "No attribution required" if possible. Save it as `extensions/huefinch/tools/demo-video/audio/music.mp3` and write the track name in `TRACK.txt` next to it.

---

Create a 40–46 second promo video for **Huefinch – Color Blind Filter & Color Identifier** (`extensions/huefinch/`), recorded from the **real, built extension**, never mock-ups. Start from Bowerline's pipeline in `extensions/bowerline/tools/demo-video/` by **copying** it into `extensions/huefinch/tools/demo-video/` and adapting it. Don't import across extension folders. Add an npm script `video` that does everything end to end: build, record, compose, add audio, encode.

## Output files (in `extensions/huefinch/store-assets/video/`)
- `huefinch-demo-1080p.mp4`: 1920×1080, 30 fps, H.264 `yuv420p`, AAC 192 kbps 48 kHz stereo, under 50 MB.
- `huefinch-demo-1080p-silent.mp4`: the same video without audio.
- `huefinch-demo.srt`: subtitles matching the captions.
- `MUSIC_CREDIT.md`: track name, source, and attribution text if one is needed.
- `README.md`: how to re-render after UI changes.

## Recording
- Use Playwright Chromium in headed mode with the extension loaded (`--load-extension`, `--disable-extensions-except`), a 1280×800 viewport, and `recordVideo` per scene. Grant host permissions in the test profile, so no permission prompts appear.
- Use local fixture pages:
  - the sales chart (red and green lines, red/green status dots)
  - a transit map with colored lines
  - the T-shirt shop
  - the sign-up form
  
  Reuse the content shown in `store-assets/screenshot-*.png`.
- Popup and options pages: open `popup.html` and `options.html` as tabs in the extension's origin.
- Inject a visible cursor that follows the mouse. Move in smooth steps, and pause about 600 ms after each visible change.
- **Log every action's timestamp** (toggle, option click, key press, colour pick), so sound effects can land on the exact frame.

## Showing the benefit to viewers with normal vision
Most viewers see colors normally. The corrected colors alone will just look "different" to them, so in scenes 2 and 3 add an inset panel labelled **"As a green-weak eye sees it"**.
- Build it **by maths, not by guessing:** generate a 33×33×33 `.cube` 3D LUT from the deutan simulation matrix in `src/shared` (sRGB → linear → matrix → sRGB), and apply it to the recorded frames with ffmpeg `lut3d`.
- Place the inset at the bottom right, at 40% size, with a white border, a soft shadow and its label.
- Add a unit test that checks the LUT against the TypeScript maths at 50 random colors.

## Composition
- Background `#F4F6FB`. The recording is centred at 1.2× (1536×960) with 12 px rounded corners and a soft shadow, under a 120 px caption band.
- Captions: `#18214D`, 54 px bold, using a bundled free font (TeX Gyre Adventor or Poppins; never downloaded at render time). 200 ms fade-in. 300 ms crossfades between scenes.

## Storyboard
| Time | Scene | Caption |
|---|---|---|
| 0–3 s | Title card: navy `#18214D`, the "Huefinch" wordmark in white, the three-color bar (`#FF6B5B`, `#3CC98A`, `#4C8DFF`), and the finch from `public/icons/icon-128.png` | "See colors clearly on every website." |
| 3–12 s | Chart page with Huefinch off. Open the popup, choose Green-weak, switch on. The inset shows the two lines going from look-alike to clearly different. | "Tell red and green apart again." |
| 12–18 s | Go to the transit map; it's already corrected. Inset stays on. | "On every website, automatically." |
| 18–24 s | Hold Alt+Shift+X: original colors appear; release: corrected again. Show a small key-hint pill while held. | "Hold a key to compare." |
| 24–31 s | Shop page: press Alt+Shift+C, click the first T-shirt, the card shows "Olive green". | "Name any color on screen." |
| 31–38 s | Sign-up form: switch the popup to Simulate, Green-weak. The "Simulating" pill appears. | "Designers: check your work through color-blind eyes." |
| 38–42 s | Options, Websites: the auto-on toggle and the privacy line | "Private. Nothing leaves your browser." |
| 42–45 s | End card: navy, the icon, the wordmark, "Free on the Chrome Web Store", and "Made by Wrenbox" small | (none) |

## Soundtrack
**Music:**
- Analyse the track's beats (`librosa`, or `aubio` as a fallback) and choose the best 45-second section.
- Move each scene crossfade to the nearest beat, never more than 250 ms; adjust pauses, never actions.
- 0.5 s fade-in. End on a phrase boundary during the end card with a 2–3 s fade-out.

**Sound effects**, synthesised in code (numpy, soundfile or ffmpeg generators). **Never download sound files.**
- **Toggle switch:** a soft two-tone click (about 1.2 kHz, then 1.6 kHz, 20 ms each).
- **Option selected:** a 25 ms rounded tick around 1.8 kHz.
- **Filter turning on:** a gentle 400 ms rising shimmer (three detuned sine partials with a slow attack), quiet. This is Huefinch's signature sound.
- **Hold-to-compare:** a soft low "whoomp" on press and a reversed one on release.
- **Colour picked:** a bright two-note chime a major third apart.
- **End card:** two soft notes a fifth apart, in the track's key if detectable.

**Mix:**
- Effects about 6 dB below the music peaks; duck the music by 3 dB under the shimmer and the chime.
- Loudness −14 LUFS integrated, true peak ≤ −1 dBTP (two-pass `loudnorm`).
- Copy the video stream when muxing; don't re-encode it.

## Rules
- Make no claims the product doesn't support: no medical claims, "#1", ratings or user counts.
- If a scene reveals a bug, fix the extension (with a test), rebuild and re-record. Never hide bugs in editing.

## Quality loop (repeat until everything passes)
1. Extract one frame per second into `tools/demo-video/review/` and check each: captions readable and inside the safe area, the inset correctly labelled, no permission prompts, the cursor visible, nothing blurry or cut off.
2. Audio:
   - `ffmpeg -af ebur128` reads −14 LUFS ±1 with no clipping
   - render a `showwavespic` waveform image with action markers and confirm every effect lines up
   - the music ends cleanly on the end card
3. `ffprobe` confirms 1920×1080, 30 fps, H.264, 40–46 s, under 50 MB.
4. Fix and re-render, then summarise the result and print the music credit text for the YouTube description.
