# Music credit

| | |
| --- | --- |
| Track | **Circuit Rush** |
| Artist | **The Mini Vandals** |
| Source | YouTube Audio Library (the owner's download for the Bowerline video, reused; file: `tools/demo-video/audio/music.mp3`, name in `audio/TRACK.txt`) |
| Used | 0:00.84–0:45.84 of the track, faded in over 0.5 s and out over the last 2.2 s |

## Stand-in track: the owner may want to swap it

This is the same track as the Bowerline promo, because it is the only licensed track on the build machine. Downloading from the YouTube Audio Library needs a signed-in account. Two Wrenbox videos with the same music is fine legally, but less distinctive. To give Huefinch its own sound:

1. Download a track from YouTube Studio → Audio Library (about 1–2 minutes, a calm start and a lift; something bright or airy suits Huefinch).
2. Save it as `tools/demo-video/audio/music.mp3` and put `"Title" - Artist` in `audio/TRACK.txt`.
3. Run `npm run video`. The section, beat sync, effect tuning (they follow the track's key), loudness and checks all adapt automatically.
4. Update this file.

## Attribution

Tracks in the YouTube Audio Library show either "Attribution not required" or a Creative Commons licence with the exact credit text. The Mini Vandals' tracks are normally marked **attribution not required**. This couldn't be checked from here. **Owner: check the licence icon in the Audio Library.** If it shows Creative Commons, replace the line below with the exact text the library gives.

Credit line for the YouTube description:

```
Music: "Circuit Rush" by The Mini Vandals (YouTube Audio Library)
```

The YouTube Audio Library licence covers videos uploaded to YouTube. That is how this video reaches the Chrome Web Store, whose promo video field takes a YouTube link. Check the library's terms before using the soundtrack anywhere else.

All sound effects are synthesised in code (`tools/demo-video/audio.py`); no third-party samples are used.
