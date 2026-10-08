#!/usr/bin/env python3
"""Soundtrack for the Huefinch promo video.

Called by soundtrack.mjs (part of `npm run video`):

  audio.py plan    Analyse audio/music.mp3 (beats, downbeats, phrases, energy, key),
                   choose the 45-second section that fits the video, and move each
                   scene crossfade onto the nearest beat (at most 250 ms, only by
                   lengthening or shortening the pause after a scene's last action).
                   Writes out/audio/plan.json, which compose.mjs uses for timings.
  audio.py align   Find, in the composed (silent) video, the exact frame where each
                   logged action becomes visible, by watching the screen region the
                   recorder logged for it (a switch moving, a page recoloring, the
                   identify card appearing).
  audio.py mix     Synthesise the sound effects, place them on those frames, duck the
                   music under the shimmer and the chime, write out/audio/mix.wav.
  audio.py verify  Re-check every placed effect against the picture.

Everything is generated here or comes from the owner's track: no downloaded sounds.
"""

import argparse
import json
import math
import subprocess
import sys
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf

TOOL = Path(__file__).resolve().parent
OUT = TOOL / 'out'
AUD = OUT / 'audio'
SR = 48000

MAX_SHIFT = 0.25  # never move a crossfade further than this to reach a beat
HOLD = 0.5  # a scene's last visible change stays on screen at least this long before its crossfade
FADE_IN = 0.5
FADE_OUT = (2.0, 3.0)  # allowed fade-out lengths; it ends exactly when the video does
CALM = (0.0, 8.0)  # video seconds that should be the calmest part of the section
LIFT = (12.0, 34.0)  # ...and where the music should lift

# Effect peaks relative to the music's peak (dB): "about 6 dB below"; the shimmer is quiet.
LEVELS = {
    'toggle': -6.0,
    'option': -7.0,
    'shimmer': -10.0,
    'press': -6.0,
    'release': -7.0,
    'key': -8.0,
    'pick': -6.0,
    'chime': -6.0,
}
# The music dips under every prominent effect, so an effect never piles onto the track's
# own peaks (a dense, loud track would otherwise force loudnorm out of linear mode).
DUCK_DB = -3.0
DUCKED = {'shimmer', 'press', 'release', 'pick', 'chime'}
SOUNDS = {'toggle', 'option', 'shimmer', 'press', 'release', 'key', 'pick'}  # logged actions with an effect

NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
# Krumhansl–Kessler key profiles.
MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def load_json(path):
    return json.loads(Path(path).read_text())


def write_json(path, data):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(data, indent=2) + '\n')


# ── Analysis ──────────────────────────────────────────────────────────────────


def analyse(music):
    """Beats, downbeats, phrase boundaries, a 0–1 energy curve and the key."""
    y, sr = librosa.load(music, sr=22050, mono=True)
    hop = 512
    onset = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
    tempo, beat_frames = librosa.beat.beat_track(onset_envelope=onset, sr=sr, hop_length=hop, trim=False)
    beats = librosa.frames_to_time(beat_frames, sr=sr, hop_length=hop)
    period = float(np.median(np.diff(beats)))

    # Section structure from beat-synchronous timbre + harmony.
    mfcc = librosa.feature.mfcc(y=y, sr=sr, hop_length=hop, n_mfcc=13)
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop)
    feats = librosa.util.sync(np.vstack([librosa.util.normalize(mfcc, axis=1), chroma]), beat_frames)
    bounds = librosa.segment.agglomerative(feats, 12)
    bounds = [int(b) for b in bounds if 0 < b < len(beats)]
    # Novelty (how much the music changes) at each beat, for phrase strength.
    rec = librosa.segment.recurrence_matrix(feats, mode='affinity', sym=True, width=4)
    lag = librosa.segment.recurrence_to_lag(rec, pad=False)
    novelty = np.concatenate([[0], np.abs(np.diff(lag, axis=1)).sum(axis=0)])
    novelty = np.convolve(novelty, np.hanning(5) / np.hanning(5).sum(), 'same')
    novelty = (novelty - novelty.min()) / (np.ptp(novelty) or 1)

    # Downbeat phase: where section boundaries fall, backed by low-band onsets.
    spec = np.abs(librosa.stft(y, hop_length=hop))
    low = librosa.onset.onset_strength(S=librosa.amplitude_to_db(spec[:40]), sr=sr, hop_length=hop)
    votes = np.zeros(4)
    for b in bounds:
        votes[b % 4] += 1
    lowm = np.array([low[beat_frames[p::4]].mean() for p in range(4)])
    votes += lowm / lowm.max()
    phase = int(np.argmax(votes))
    # Phrases are four bars; their phase comes from the section boundaries too.
    bar_votes = np.zeros(4)
    for b in bounds:
        if (b - phase) % 4 == 0:
            bar_votes[((b - phase) // 4) % 4] += 1
    phrase_phase = int(np.argmax(bar_votes))

    # Energy: RMS in dB, smoothed over ~1 s, scaled 0–1 between the 5th and 95th percentiles.
    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=hop)[0]
    db = librosa.amplitude_to_db(rms + 1e-9)
    win = int(sr / hop)
    db = np.convolve(db, np.ones(win) / win, 'same')
    lo, hi = np.percentile(db, [5, 95])
    energy = np.clip((db - lo) / (hi - lo), 0, 1)
    energy_t = librosa.times_like(rms, sr=sr, hop_length=hop)

    # Key and tuning from the harmonic part of the whole track (more stable than one section).
    harmonic = librosa.effects.harmonic(y)
    tuning = float(librosa.estimate_tuning(y=harmonic, sr=sr))
    key = key_of(librosa.feature.chroma_stft(y=harmonic, sr=sr, tuning=tuning).mean(axis=1))
    key['tuning_cents'] = round(tuning * 100, 1)

    return {
        'duration': len(y) / sr,
        'key': key,
        'tempo': float(np.atleast_1d(tempo)[0]),
        'period': period,
        'beats': beats,
        'downbeat_phase': phase,
        'phrase_phase': phrase_phase,
        'bounds': bounds,
        'novelty': novelty,
        'energy': energy,
        'energy_t': energy_t,
    }


def key_of(chroma):
    """Best-matching major or minor key for a mean chroma vector."""
    best = None
    for mode, profile in (('major', MAJOR), ('minor', MINOR)):
        for tonic in range(12):
            r = np.corrcoef(chroma, np.roll(profile, tonic))[0, 1]
            if best is None or r > best[0]:
                best = (r, tonic, mode)
    r, tonic, mode = best
    return {'tonic': NOTE_NAMES[tonic], 'pitch_class': tonic, 'mode': mode, 'confidence': round(float(r), 3)}


def mean_energy(a, t0, t1):
    m = (a['energy_t'] >= t0) & (a['energy_t'] < t1)
    return float(a['energy'][m].mean()) if m.any() else 0.0


# ── Plan ──────────────────────────────────────────────────────────────────────


def scene_needs(board, manifest):
    """Shortest slot each scene can have: up to its last visible change, plus HOLD."""
    needs = []
    for s in board['scenes']:
        if s['kind'] != 'rec':
            needs.append(1.0)
            continue
        events = manifest[s['id']].get('events', [])
        if not any(e['type'] == 'end' for e in events):
            sys.exit(f"Recording has no 'end' event for {s['id']}; re-record (npm run video).")
        needs.append(board['lead'] + max(e['t'] for e in events) + HOLD)
    return needs


def sync_to_beats(board, needs, beats_video):
    """Move each crossfade (its midpoint, where the caption appears) to the nearest beat."""
    cf, cap = board['crossfade'], board['captionIn']
    starts, t = [], 0.0
    for s in board['scenes']:
        starts.append(t)
        t += s['duration'] - cf
    total = t + cf
    new = list(starts)
    shifts = [0.0] * len(starts)
    for i in range(1, len(starts)):
        target = starts[i] + cap
        b = beats_video[np.argmin(np.abs(beats_video - target))]
        d = float(b - target)
        if abs(d) > MAX_SHIFT + 1e-9:
            continue
        cand = starts[i] + d
        nxt = starts[i + 1] if i + 1 < len(starts) else total
        if cand - new[i - 1] >= needs[i - 1] and nxt - cand >= needs[i]:
            new[i] = cand
            shifts[i] = d
    durations = [new[i + 1] - new[i] + cf for i in range(len(new) - 1)] + [total - new[-1]]
    return new, shifts, durations, total


def plan(args):
    board = load_json(AUD / 'storyboard.json')
    manifest = load_json(OUT / 'manifest.json')
    a = analyse(args.music)
    beats, period = a['beats'], a['period']
    total = sum(s['duration'] for s in board['scenes']) - board['crossfade'] * (len(board['scenes']) - 1)
    needs = scene_needs(board, manifest)
    end_card = board['scenes'][-1]
    end_card_start = total - end_card['duration']

    # Phrase boundaries: every fourth bar on the phrase grid.
    phrase_idx = [i for i in range(len(beats)) if (i - a['downbeat_phase']) % 16 == a['phrase_phase'] * 4]
    candidates = []
    for p in phrase_idx:
        tp = beats[p]
        for back in range(1, p + 1):  # the section starts on a beat
            ts = beats[p - back]
            pv = tp - ts  # where the phrase boundary lands in the video
            fade = total - pv
            if fade < FADE_OUT[0] - 1e-6:
                break
            if fade > FADE_OUT[1] + 1e-6 or pv < end_card_start + 0.2:
                continue
            if ts + total > a['duration'] - 4:  # keep clear of the track's own outro fade
                continue
            calm = mean_energy(a, ts + CALM[0], ts + CALM[1])
            lift = mean_energy(a, ts + LIFT[0], ts + LIFT[1])
            opening = mean_energy(a, ts, ts + 1.5)
            strength = float(a['novelty'][p]) + (1.0 if any(abs(b - p) <= 1 for b in a['bounds']) else 0.0)
            bv = beats - ts
            _, shifts, _, _ = sync_to_beats(board, needs, bv[(bv > -1) & (bv < total + 1)])
            synced = sum(1 for d in shifts[1:] if d != 0.0) / (len(shifts) - 1)
            score = (lift - calm) + 0.25 * strength + 0.15 * synced - (0.5 if opening < 0.15 else 0)
            candidates.append(
                {
                    'start': round(float(ts), 3),
                    'phrase_end': round(float(tp), 3),
                    'phrase_in_video': round(float(pv), 3),
                    'fade_out': round(float(fade), 3),
                    'calm': round(calm, 3),
                    'lift': round(lift, 3),
                    'phrase_strength': round(strength, 3),
                    'synced': round(synced, 3),
                    'score': round(score, 4),
                }
            )
    if not candidates:
        sys.exit('No section of the track fits: no phrase boundary lands in the end card.')
    candidates.sort(key=lambda c: -c['score'])
    best = candidates[0]
    ts = best['start']
    bv = beats - ts
    beats_video = bv[(bv > -1) & (bv < total + 1)]
    starts, shifts, durations, total2 = sync_to_beats(board, needs, beats_video)
    assert abs(total2 - total) < 1e-6

    key = a['key']
    out = {
        'music': {
            'file': str(Path(args.music).relative_to(TOOL)),
            'start': ts,
            'duration': total,
            'tempo': round(a['tempo'], 2),
            'beat': round(period, 4),
            'phrase_end_in_video': best['phrase_in_video'],
            'fade_in': FADE_IN,
            'fade_out_start': best['phrase_in_video'],
            'key': key,
        },
        'total': total,
        'starts': [round(s, 4) for s in starts],
        'shifts': [round(d, 4) for d in shifts],
        'durations': {s['id']: round(d, 4) for s, d in zip(board['scenes'], durations)},
        'beats_video': [round(float(b), 4) for b in beats_video],
        'downbeats_video': [
            round(float(beats[i] - ts), 4)
            for i in range(len(beats))
            if (i - a['downbeat_phase']) % 4 == 0 and -1 < beats[i] - ts < total + 1
        ],
        'section': best,
        'candidates': candidates[:5],
    }
    write_json(AUD / 'plan.json', out)
    moved = sum(1 for d in shifts[1:] if d)
    print(
        f"  music: {ts:.2f}–{ts + total:.2f} s of the track, {a['tempo']:.1f} BPM, "
        f"key {key['tonic']} {key['mode']}; phrase ends at {best['phrase_in_video']:.2f} s, "
        f"fade-out {best['fade_out']:.2f} s"
    )
    print(f"  {moved}/{len(shifts) - 1} crossfades moved onto beats: " + ', '.join(f'{d * 1000:+.0f}' for d in shifts[1:]) + ' ms')


# ── Sound effects (all synthesised) ───────────────────────────────────────────


def n_of(seconds):
    return int(round(seconds * SR))


def time_axis(seconds):
    return np.arange(n_of(seconds)) / SR


def tail_fade(x, seconds=0.003):
    n = min(x.shape[-1], n_of(seconds))
    x[..., -n:] *= np.cos(np.linspace(0, np.pi / 2, n)) ** 2
    return x


def tone(f, seconds, attack=0.0008, decay=0.006):
    t = time_axis(seconds)
    env = (1 - np.exp(-t / attack)) * np.exp(-t / decay)
    return np.sin(2 * np.pi * f * t) * env


def sfx_toggle():
    """A soft two-tone click: about 1.2 kHz, then 1.6 kHz, 20 ms each."""
    a = tail_fade(tone(1200, 0.02))
    b = tail_fade(tone(1600, 0.02))
    return np.concatenate([a, b])


def sfx_option():
    """A 25 ms rounded tick around 1.8 kHz."""
    t = time_axis(0.025)
    env = np.sin(np.minimum(1, t / 0.002) * np.pi / 2) ** 2 * np.exp(-t / 0.006)
    x = np.sin(2 * np.pi * 1800 * t) + 0.06 * np.sin(2 * np.pi * 3600 * t) * np.exp(-t / 0.002)
    return tail_fade(x * env)


def sfx_shimmer(key):
    """Huefinch's signature: a gentle 400 ms rising shimmer, three detuned sine partials
    (the track's tonic, its fifth and the octave) with a slow attack."""
    f0 = 440 * 2 ** ((key['pitch_class'] - 9 + key['tuning_cents'] / 100) / 12)
    while f0 < 600:
        f0 *= 2
    t = time_axis(0.4)
    rise = 2 ** (np.minimum(1, t / 0.4) * 3 / 12)  # glides up a minor third
    env = np.sin(np.minimum(1, t / 0.22) * np.pi / 2) ** 2 * np.minimum(1, (0.4 - t) / 0.12) ** 1.5
    out = []
    for detune in (-6, 6):  # cents, a little different per channel for width
        x = np.zeros(len(t))
        for ratio, gain, cents in ((1.0, 1.0, 0), (1.5, 0.55, 4), (2.0, 0.4, -5)):
            f = f0 * ratio * 2 ** ((detune + cents) / 1200) * rise
            x += gain * np.sin(2 * np.pi * np.cumsum(f) / SR)
        # A soft tremolo makes it sparkle.
        x *= 1 + 0.18 * np.sin(2 * np.pi * 14 * t)
        out.append(tail_fade(x * env, 0.02))
    return np.stack(out)


def sfx_whoomp():
    """A soft low whoomp: a sine falling 160→70 Hz with a quick swell and slow release."""
    t = time_axis(0.32)
    f = 70 + 90 * np.exp(-t / 0.08)
    env = np.sin(np.minimum(1, t / 0.03) * np.pi / 2) ** 2 * np.exp(-t / 0.11)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.25 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    return tail_fade(x * env, 0.02)


def sfx_pick(key):
    """A bright two-note chime a major third apart, on the track's tonic."""
    f1 = 440 * 2 ** ((key['pitch_class'] - 9 + key['tuning_cents'] / 100) / 12)
    while f1 < 880:
        f1 *= 2
    while f1 >= 1760:
        f1 /= 2
    f2 = f1 * 2 ** (4 / 12)
    t = time_axis(0.9)
    out = np.zeros(len(t))
    for f, delay, gain in ((f1, 0.0, 1.0), (f2, 0.09, 0.9)):
        tt = np.clip(t - delay, 0, None)
        on = (t >= delay).astype(float)
        note = np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.32) + 0.2 * np.sin(2 * np.pi * 2 * f * tt) * np.exp(-tt / 0.12)
        out += gain * on * np.minimum(1, tt / 0.004) * note
    return tail_fade(out, 0.1), (round(f1, 1), round(f2, 1))


def sfx_chime(key, total_left):
    """Two soft bell notes a fifth apart (tonic and fifth, right in major or minor), on
    the music's tonic and tuning, in the 520–1040 Hz octave."""
    f1 = 440 * 2 ** ((key['pitch_class'] - 9 + key['tuning_cents'] / 100) / 12)
    while f1 < 520:
        f1 *= 2
    while f1 >= 1040:
        f1 /= 2
    f2 = f1 * 2 ** (7 / 12)
    length = min(2.6, total_left)
    t = time_axis(length)
    out = np.zeros(len(t))
    for f, delay, gain in ((f1, 0.0, 1.0), (f2, 0.14, 0.85)):
        tt = np.clip(t - delay, 0, None)
        on = (t >= delay).astype(float)
        attack = np.minimum(1, tt / 0.006)
        note = (
            np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.75)
            + 0.18 * np.sin(2 * np.pi * 2 * f * tt) * np.exp(-tt / 0.3)
            + 0.05 * np.sin(2 * np.pi * 3 * f * tt) * np.exp(-tt / 0.15)
        )
        out += gain * on * attack * note
    return tail_fade(out, 0.2), (round(f1, 1), round(f2, 1))


# ── Align effects to the picture ──────────────────────────────────────────────

HALF = 2  # analyse the video at half resolution
CHANGE = 10  # grey levels: a pixel "changed" between two frames
MIN_PIXELS = 3  # changed pixels (at half resolution) that make a visible change
SEARCH = (-0.1, 0.75)  # how far before/after the logged time the change may show (s)


def timeline_events(board, manifest, plan_):
    """Every effect on the final timeline from the logs: scene start + LEAD + offset."""
    events = []
    for i, (s, start) in enumerate(zip(board['scenes'], plan_['starts'])):
        if s['kind'] != 'rec':
            continue
        for e in manifest[s['id']].get('events', []):
            if e['type'] not in SOUNDS:
                continue
            events.append({'type': e['type'], 'scene': s['id'], 'index': i, 'logged': start + board['lead'] + e['t'], 'area': e.get('area')})
    events.sort(key=lambda e: e['logged'])
    return events


def roi_of(board, manifest, e):
    """The logged area on the final frame, at analysis resolution: (x0, y0, x1, y1)."""
    a = e['area']
    part = manifest[e['scene']]['parts'][a['part']]
    g = board['frame']
    pad = 4
    x0 = (g['rx'] + (part['x'] + a['x']) * g['scale'] - pad) / HALF
    y0 = (g['ry'] + (part['y'] + a['y']) * g['scale'] - pad) / HALF
    x1 = (g['rx'] + (part['x'] + a['x'] + a['w']) * g['scale'] + pad) / HALF
    y1 = (g['ry'] + (part['y'] + a['y'] + a['h']) * g['scale'] + pad) / HALF
    w, h = g['width'] // HALF, g['height'] // HALF
    return max(0, int(x0)), max(0, int(y0)), min(w, int(math.ceil(x1))), min(h, int(math.ceil(y1)))


def change_series(video, rois, board):
    """Per ROI and frame: how many pixels changed against the frame before."""
    g = board['frame']
    w, h = g['width'] // HALF, g['height'] // HALF
    proc = subprocess.Popen(
        ['ffmpeg', '-v', 'error', '-i', video, '-vf', f'scale={w}:{h}', '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'],
        stdout=subprocess.PIPE,
    )
    size = w * h * 3
    change = [[] for _ in rois]
    prev = None
    while True:
        buf = proc.stdout.read(size)
        if len(buf) < size:
            break
        rgb = np.frombuffer(buf, np.uint8).reshape(h, w, 3).astype(np.int16)
        for i, (x0, y0, x1, y1) in enumerate(rois):
            if prev is None:
                change[i].append(0)
            else:
                # Any channel: recoloring can keep the grey level nearly the same.
                d = np.abs(rgb[y0:y1, x0:x1] - prev[y0:y1, x0:x1]).max(axis=2)
                change[i].append(int((d > CHANGE).sum()))
        prev = rgb
    proc.wait()
    return [np.array(x) for x in change]


def align(args):
    board = load_json(AUD / 'storyboard.json')
    manifest = load_json(OUT / 'manifest.json')
    p = load_json(AUD / 'plan.json')
    fps = board['frame']['fps']
    events = timeline_events(board, manifest, p)
    missing = [e for e in events if not e['area']]
    if missing:
        sys.exit(f'Recording has no screen area for {len(missing)} events; re-record (npm run video).')
    series = change_series(args.video, [roi_of(board, manifest, e) for e in events], board)
    starts = p['starts'] + [p['total']]

    def visible(e, s, f):
        # Only frames where the scene is fully on screen (not mid-crossfade).
        lo = math.ceil((starts[e['index']] + board['crossfade']) * fps)
        hi = math.floor(starts[e['index'] + 1] * fps)
        return lo <= f <= hi and f < len(s) and s[f] >= MIN_PIXELS

    for e, s in zip(events, series):
        # The frame in the search window where the area changes most (the switch
        # moving, the page recoloring), not a passing cursor: the first frame that
        # reaches half of the biggest change.
        k = e['logged'] * fps
        frames = [f for f in range(int(math.floor(k + SEARCH[0] * fps)), int(math.ceil(k + SEARCH[1] * fps)) + 1) if visible(e, s, f)]
        if not frames:
            e.update(frame=None, t=e['logged'], lag=None)
            continue
        top = max(s[f] for f in frames)
        f = next(f for f in frames if s[f] >= 0.5 * top)
        e.update(frame=f, t=f / fps, lag=round(f / fps - e['logged'], 4))
    found = sum(1 for e in events if e['frame'] is not None)
    write_json(AUD / 'align.json', {'events': events})
    lags = [e['lag'] for e in events if e['lag'] is not None]
    print(f'  aligned {found}/{len(events)} effects to the frame their action shows on; median lag {np.median(lags) * 1000:+.0f} ms')


# ── Mix ───────────────────────────────────────────────────────────────────────


def place(dst, src, t):
    i = n_of(t)
    src = np.atleast_2d(src)
    if src.shape[0] == 1:
        src = np.repeat(src, 2, axis=0)
    j = min(dst.shape[1], i + src.shape[1])
    if i < dst.shape[1]:
        dst[:, i:j] += src[:, : j - i]


def mix(args):
    board = load_json(AUD / 'storyboard.json')
    p = load_json(AUD / 'plan.json')
    music_cfg, total = p['music'], p['total']
    key = music_cfg['key']
    n = n_of(total)

    music, _ = librosa.load(TOOL / music_cfg['file'], sr=SR, mono=False, offset=music_cfg['start'], duration=total + 0.2)
    music = np.atleast_2d(music)
    if music.shape[0] == 1:
        music = np.repeat(music, 2, axis=0)
    music = music[:, :n]
    if music.shape[1] < n:
        music = np.pad(music, ((0, 0), (0, n - music.shape[1])))
    t = np.arange(n) / SR
    fade_in = np.sin(np.clip(t / music_cfg['fade_in'], 0, 1) * np.pi / 2) ** 2
    fo = music_cfg['fade_out_start']
    fade_out = np.cos(np.clip((t - fo) / (total - fo), 0, 1) * np.pi / 2) ** 2
    music *= fade_in * fade_out
    peak = float(np.abs(music).max())

    events = load_json(AUD / 'align.json')['events']
    events.append({'type': 'chime', 'scene': board['scenes'][-1]['id'], 't': p['starts'][-1] + board['captionIn']})
    whoomp = sfx_whoomp()
    library = {
        'toggle': sfx_toggle,
        'option': sfx_option,
        'shimmer': lambda: sfx_shimmer(key),
        'press': lambda: whoomp,
        'release': lambda: whoomp[::-1].copy(),  # the reversed whoomp
        'key': sfx_option,
    }
    duck = np.ones(n)
    sfx = np.zeros((2, n))
    for e in events:
        if e['type'] == 'chime':
            x, notes = sfx_chime(key, total - e['t'])
            e['notes_hz'] = notes
        elif e['type'] == 'pick':
            x, notes = sfx_pick(key)
            e['notes_hz'] = notes
        else:
            x = library[e['type']]()
        # A reversed whoomp swells into its frame, so it ends where the change shows.
        at = e['t'] - (0.22 if e['type'] == 'release' else 0.0)
        gain = peak * 10 ** (LEVELS[e['type']] / 20) / np.abs(x).max()
        place(sfx, x * gain, at)
        if e['type'] in DUCKED:
            length = np.atleast_2d(x).shape[1] / SR
            a0, a1 = at - 0.05, at
            b0, b1 = at + length, at + length + 0.2
            w = np.clip(np.minimum((t - a0) / (a1 - a0), (b1 - t) / (b1 - b0)), 0, 1)
            duck = np.minimum(duck, 1 - (1 - 10 ** (DUCK_DB / 20)) * w)
    out = music * duck + sfx
    AUD.mkdir(parents=True, exist_ok=True)
    sf.write(AUD / 'mix.wav', out.T.astype(np.float32), SR, subtype='FLOAT')
    sf.write(AUD / 'music.wav', (music * duck).T.astype(np.float32), SR, subtype='FLOAT')
    sf.write(AUD / 'sfx.wav', sfx.T.astype(np.float32), SR, subtype='FLOAT')
    write_json(AUD / 'events.json', {'music_peak': peak, 'sfx_peak': float(np.abs(sfx).max()), 'events': events})
    counts = {}
    for e in events:
        counts[e['type']] = counts.get(e['type'], 0) + 1
    print('  effects: ' + ', '.join(f'{k} ×{v}' for k, v in counts.items()))


# ── Verify ────────────────────────────────────────────────────────────────────


def verify(args):
    """Independent re-check: each effect's own frame must show a change in its area."""
    board = load_json(AUD / 'storyboard.json')
    manifest = load_json(OUT / 'manifest.json')
    fps = board['frame']['fps']
    events = [e for e in load_json(AUD / 'events.json')['events'] if e['type'] in SOUNDS]
    series = change_series(args.video, [roi_of(board, manifest, e) for e in events], board)
    report = []
    for e, s in zip(events, series):
        f = int(round(e['t'] * fps))  # the frame on screen when the effect lands
        shows = lambda g: 0 <= g < len(s) and s[g] >= MIN_PIXELS  # noqa: E731
        near = [d for d in (0, -1, 1) if shows(f + d)]
        report.append({'type': e['type'], 't': round(e['t'], 3), 'frame': f, 'off_by': near[0] if near else None})
    on = sum(1 for r in report if r['off_by'] == 0)
    within = sum(1 for r in report if r['off_by'] is not None)
    summary = {'events': len(report), 'on_frame': on, 'within_one_frame': within, 'report': report}
    write_json(AUD / 'verify.json', summary)
    print(f'  sync: {on}/{len(report)} effects on the exact frame their action shows, {within}/{len(report)} within one frame')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('plan')
    p.add_argument('--music', default=str(TOOL / 'audio/music.mp3'))
    a = sub.add_parser('align')
    a.add_argument('--video', required=True)
    sub.add_parser('mix')
    v = sub.add_parser('verify')
    v.add_argument('--video', required=True)
    args = ap.parse_args()
    {'plan': plan, 'align': align, 'mix': mix, 'verify': verify}[args.cmd](args)


if __name__ == '__main__':
    main()
