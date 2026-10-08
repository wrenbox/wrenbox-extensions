# Music credit

| | |
| --- | --- |
| Track | **After Sunset** |
| Artist | **Alex Jones / Xander Jones** (as named in `tools/demo-video/audio/TRACK.txt`) |
| Source | Chosen and supplied by the owner (file: `tools/demo-video/audio/music.mp3`, 2:40, 320 kbps) |
| Licence | **Attribution not required** (confirmed by the owner, 8 October 2026) |
| Used | 1:04.71–1:49.71 of the track, faded in over 0.5 s and out over the last 2.35 s |

## Attribution

None is required, so the YouTube description doesn't need a music line. If you want one anyway (harmless, and some viewers ask), use:

```
Music: "After Sunset" by Alex Jones / Xander Jones
```

## Changing the music

Save the new track as `tools/demo-video/audio/music.mp3`, put `Title - Artist` in `audio/TRACK.txt`, and run `npm run video`. The section, beat sync, effect tuning (they follow the track's key), loudness and checks all adapt automatically. Then update this file.

All sound effects in the video are synthesised in code (`tools/demo-video/audio.py`); no third-party samples are used.
