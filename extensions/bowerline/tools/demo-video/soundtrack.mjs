/**
 * The soundtrack: music section, beat-synced timings, synthesised effects, the
 * mix, loudness and the final mux. Analysis and synthesis are in audio.py
 * (librosa + numpy); this file drives it and does the ffmpeg work.
 *
 *   planSoundtrack()   before compose: audio.py plan → out/audio/plan.json (timings)
 *   finishSoundtrack() after compose:  audio.py mix → two-pass loudnorm (−14 LUFS,
 *                      −1 dBTP) → AAC 192 kbps muxed into the silent video with the
 *                      picture copied → checks (loudness, sync, ending, waveform)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SILENT, VIDEO } from './compose.mjs';
import {
  CAPTION_BAND,
  CAPTION_IN,
  CROSSFADE,
  FONT,
  FPS,
  HEIGHT,
  LEAD,
  MUSIC,
  OUT,
  REC,
  REVIEW,
  SCALE,
  SCENES,
  TOOL_DIR,
  TRACK,
  WIDTH,
  timeline,
} from './config.mjs';

const AUD = join(OUT, 'audio');
export const WAVEFORM = join(REVIEW, 'waveform.png');
const TARGET = { I: -14, TP: -1.5, LRA: 20 }; // TP leaves 0.5 dB for the AAC encoder; the check is −1 dBTP
const PYTHON = process.env.PYTHON ?? 'python3';

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28 });
const ffmpegErr = (args) => {
  // ffmpeg prints measurements on stderr.
  try {
    return execFileSync('ffmpeg', ['-hide_banner', '-nostats', ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'ignore', 'pipe'],
      maxBuffer: 1 << 26,
    });
  } catch (e) {
    throw new Error(e.stderr || e.message, { cause: e });
  }
};
const stderrOf = (args) => {
  const r = execFileSync('sh', ['-c', `ffmpeg -hide_banner -nostats ${args} 2>&1 >/dev/null`], {
    encoding: 'utf8',
    maxBuffer: 1 << 26,
  });
  return r;
};
const python = (args) =>
  execFileSync(PYTHON, [join(TOOL_DIR, 'audio.py'), ...args], { stdio: 'inherit' });

export function checkAudioTools() {
  if (!existsSync(MUSIC)) {
    throw new Error(
      `Missing ${MUSIC}. Put the owner's track there (and its name in audio/TRACK.txt).`,
    );
  }
  try {
    sh(PYTHON, ['-c', 'import librosa, numpy, scipy, soundfile']);
  } catch {
    throw new Error(
      `The soundtrack needs Python 3 with librosa, numpy, scipy and soundfile:\n  pip install -r ${join(TOOL_DIR, 'requirements.txt')}`,
    );
  }
}

/** Analyse the track, pick the section and write the beat-synced timings. */
export function planSoundtrack() {
  mkdirSync(AUD, { recursive: true });
  // The storyboard's own durations (not a previous plan's) are the starting point.
  writeFileSync(
    join(AUD, 'storyboard.json'),
    JSON.stringify(
      {
        scenes: SCENES.map(({ id, kind, duration }) => ({ id, kind, duration })),
        crossfade: CROSSFADE,
        captionIn: CAPTION_IN,
        lead: LEAD,
        // Where a recording sits on the final frame, to find logged areas in the video.
        frame: {
          width: WIDTH,
          height: HEIGHT,
          fps: FPS,
          scale: SCALE,
          rx: (WIDTH - REC.width * SCALE) / 2,
          ry: CAPTION_BAND,
        },
      },
      null,
      2,
    ),
  );
  writeFileSync(join(AUD, 'plan.json'), '{}'); // compose must not see a stale plan if this fails
  python(['plan', '--music', MUSIC]);
}

// ── Loudness ────────────────────────────────────────────────────────────────

function loudnorm(input, output) {
  const base = `loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}`;
  const json = (text) => JSON.parse(text.slice(text.lastIndexOf('{'), text.lastIndexOf('}') + 1));
  const first = json(stderrOf(`-i "${input}" -af ${base}:print_format=json -f null -`));
  const measured = [
    `measured_I=${first.input_i}`,
    `measured_TP=${first.input_tp}`,
    `measured_LRA=${first.input_lra}`,
    `measured_thresh=${first.input_thresh}`,
    `offset=${first.target_offset}`,
    'linear=true',
    'print_format=json',
  ].join(':');
  const second = json(
    stderrOf(`-y -i "${input}" -af ${base}:${measured} -ar 48000 -c:a pcm_s24le "${output}"`),
  );
  return { first, second };
}

/** Integrated loudness, true peak and sample peak of a file, as ffmpeg measures them. */
export function measure(file) {
  const ebu = stderrOf(`-i "${file}" -map 0:a -af ebur128=peak=true -f null -`);
  const summary = ebu.slice(ebu.lastIndexOf('Summary:'));
  const num = (re) => Number(summary.match(re)?.[1]);
  const stats = stderrOf(`-i "${file}" -map 0:a -af astats=measure_perchannel=none -f null -`);
  return {
    I: num(/I:\s+(-?[\d.]+) LUFS/),
    LRA: num(/LRA:\s+(-?[\d.]+) LU/),
    TP: num(/Peak:\s+(-?[\d.]+) dBFS/),
    samplePeak: Number(stats.match(/Peak level dB:\s+(-?[\d.]+|-inf)/)?.[1]),
  };
}

// ── Ending: no abrupt cut, no silence gap ───────────────────────────────────

function endingCheck(file, total, fadeStart) {
  const raw = execFileSync(
    'ffmpeg',
    ['-v', 'error', '-i', file, '-map', '0:a', '-ac', '1', '-ar', '48000', '-f', 'f32le', '-'],
    { maxBuffer: 1 << 28 },
  );
  const x = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
  const rmsDb = (t0, t1) => {
    const a = Math.max(0, Math.round(t0 * 48000));
    const b = Math.min(x.length, Math.round(t1 * 48000));
    let s = 0;
    for (let i = a; i < b; i++) s += x[i] * x[i];
    return 10 * Math.log10(s / Math.max(1, b - a) + 1e-12);
  };
  // Level in 400 ms steps through the fade: it must keep falling (beats inside a step
  // may lift it a little, never 3 dB) and end far below where it started.
  const steps = [];
  for (let t = fadeStart; t < total - 0.4 + 1e-9; t += 0.4) steps.push(rmsDb(t, t + 0.4));
  const rises = steps.filter((v, i) => i > 0 && v > steps[i - 1] + 3).length;
  return {
    audioSeconds: x.length / 48000,
    beforeFade: rmsDb(fadeStart - 1, fadeStart),
    lastQuarter: steps[steps.length - 1],
    last50ms: rmsDb(total - 0.05, total),
    rises,
    fell: steps[0] - steps[steps.length - 1],
    steps: steps.map((v) => +v.toFixed(1)),
  };
}

// ── Waveform with scene and action markers ──────────────────────────────────

const MARK = {
  scene: '0x18214D',
  click: '0xE0A800',
  swipe: '0x10B981',
  key: '0x9CA3AF',
  pop: '0xEC4899',
  chime: '0x3B82F6',
};

function waveform(file, total, events, plan) {
  const W = 1920;
  const MIX = { y: 34, h: 280 }; // the final mix
  const FX = { y: 350, h: 150 }; // the effects stem alone, under its action markers
  const H = 560;
  const x = (t) => Math.round((t / total) * (W - 1));
  const draw = [];
  // Beats (downbeats taller) between the lanes, so beat-synced crossfades can be seen.
  for (const b of plan.beats_video) {
    if (b < 0 || b > total) continue;
    const down = plan.downbeats_video.some((d) => Math.abs(d - b) < 0.01);
    draw.push(
      `drawbox=x=${x(b)}:y=${down ? 318 : 324}:w=1:h=${down ? 22 : 12}:color=0x5D6690@0.7:t=fill`,
    );
  }
  // Scene changes (crossfade midpoints) across everything.
  timeline()
    .starts.slice(1)
    .forEach((t) =>
      draw.push(
        `drawbox=x=${x(t + CAPTION_IN)}:y=${MIX.y}:w=2:h=${FX.y + FX.h - MIX.y}:color=${MARK.scene}@0.85:t=fill`,
      ),
    );
  // Each action at the frame it shows on.
  for (const e of events) {
    draw.push(
      `drawbox=x=${x(e.t)}:y=${FX.y}:w=${e.type === 'key' ? 1 : 3}:h=${FX.h}:color=${MARK[e.type]}@0.8:t=fill`,
    );
  }
  for (let s = 0; s <= Math.floor(total); s += 5) {
    draw.push(
      `drawtext=fontfile=${FONT}:text='${s}s':x=${Math.min(x(s) + 4, W - 40)}:y=8:fontsize=18:fontcolor=0x5D6690`,
    );
  }
  const label = (text, y) =>
    `drawtext=fontfile=${FONT}:text='${text}':x=W-tw-12:y=${y}:fontsize=17:fontcolor=0x5D6690`;
  draw.push(
    label('mix', MIX.y + 4),
    label('effects stem · lines mark the frame each action shows', FX.y + 4),
  );
  Object.keys(MARK).forEach((k, i) =>
    draw.push(
      `drawtext=fontfile=${FONT}:text='${k}':x=${20 + i * 110}:y=${H - 36}:fontsize=20:fontcolor=${MARK[k]}`,
    ),
  );
  mkdirSync(REVIEW, { recursive: true });
  ffmpegErr([
    '-y',
    '-i', file,
    '-i', join(AUD, 'sfx.wav'),
    '-filter_complex',
    `[0:a]aformat=channel_layouts=mono,showwavespic=s=${W}x${MIX.h}:colors=0xA9B0D6:scale=lin[m];` +
      `[1:a]aformat=channel_layouts=mono,volume=${(0.95 / plan.sfxPeak).toFixed(3)},showwavespic=s=${W}x${FX.h}:colors=0x18214D:scale=lin[f];` +
      `color=c=0xF4F6FB:s=${W}x${H}[bg];[bg][m]overlay=0:${MIX.y}[a];[a][f]overlay=0:${FX.y},${draw.join(',')}[out]`,
    '-map', '[out]',
    '-frames:v', '1',
    WAVEFORM,
  ]); // prettier-ignore
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function finishSoundtrack() {
  const plan = JSON.parse(readFileSync(join(AUD, 'plan.json'), 'utf8'));
  const total = plan.total;
  // Effects go on the frame where their action shows, then are checked again.
  python(['align', '--video', SILENT]);
  python(['mix']);
  python(['verify', '--video', SILENT]);
  const verify = JSON.parse(readFileSync(join(AUD, 'verify.json'), 'utf8'));
  const events = JSON.parse(readFileSync(join(AUD, 'events.json'), 'utf8')).events;

  const master = join(AUD, 'master.wav');
  const norm = loudnorm(join(AUD, 'mix.wav'), master);
  execFileSync('ffmpeg', [
    '-v', 'error', '-y',
    '-i', SILENT,
    '-i', master,
    '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    '-t', total.toFixed(3),
    '-movflags', '+faststart',
    VIDEO,
  ]); // prettier-ignore

  const loud = measure(VIDEO);
  const ending = endingCheck(VIDEO, total, plan.music.fade_out_start);
  const sfxPeak = JSON.parse(readFileSync(join(AUD, 'events.json'), 'utf8')).sfx_peak;
  waveform(VIDEO, total, events, { ...plan, sfxPeak });
  const report = {
    music: plan.music,
    shifts: plan.shifts,
    loudnorm: { pass1: norm.first, pass2: norm.second },
    loudness: loud,
    ending,
    sync: { ...verify, report: undefined },
  };
  writeFileSync(join(AUD, 'report.json'), JSON.stringify(report, null, 2));
  const visible = verify.events;
  return {
    total,
    checks: [
      ['−14 LUFS ±1', Math.abs(loud.I - -14) <= 1, `${loud.I} LUFS integrated`],
      ['true peak ≤ −1 dBTP', loud.TP <= -1, `${loud.TP} dBTP`],
      ['no clipping', loud.samplePeak < 0, `sample peak ${loud.samplePeak} dBFS`],
      [
        'loudnorm stayed linear',
        norm.second.normalization_type === 'linear',
        norm.second.normalization_type,
      ],
      [
        'effects on their frames',
        verify.on_frame === visible,
        `${verify.on_frame}/${visible} on the exact frame their action shows`,
      ],
      [
        'music ends with the video',
        Math.abs(ending.audioSeconds - total) < 0.03 &&
          ending.last50ms < -50 &&
          ending.rises === 0 &&
          ending.fell > 15,
        `${ending.audioSeconds.toFixed(3)} s audio, last 50 ms ${ending.last50ms.toFixed(0)} dBFS, smooth ${plan.music.fade_out_start.toFixed(2)}→${total.toFixed(2)} s fade`,
      ],
      [
        'no silence gap',
        ending.beforeFade > -30,
        `${ending.beforeFade.toFixed(1)} dBFS in the second before the fade`,
      ],
    ],
  };
}

export const trackName = () => readFileSync(TRACK, 'utf8').trim();
