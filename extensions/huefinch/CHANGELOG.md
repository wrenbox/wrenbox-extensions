# Changelog

All notable changes to Huefinch are recorded here. Versions follow [Semantic Versioning](https://semver.org/).

## 1.1.0 (2026-10-12)

### Fixed

- **Embedded content from other websites is recolored again on Chrome and Edge 151 and later.** Since Chromium 151 (August 2026), a browser security fix stops a page's color filter from reaching into iframes from another origin, so embedded videos, maps and widgets kept their original colors. Huefinch now recolors those frames itself on 151 and later, and only those, so nothing is ever recolored twice; on older versions nothing changes. Frames follow the switch of the page they are in, and show their original colors while Alt+Shift+X is held.

### Added

- **Microsoft Edge, tested.** The full end-to-end suite now runs in real Microsoft Edge in CI, as well as in Chromium. Each release has `huefinch-<version>-edge.zip` for Edge Add-ons; see [EDGE.md](https://github.com/wrenbox/wrenbox-extensions/blob/main/extensions/huefinch/EDGE.md) for publishing.
- **A one-time rating request.** After at least three days and five popup opens, the toolbar popup asks once, while Huefinch is recoloring the page, whether you'd rate it in the store you installed it from (Chrome Web Store or Edge Add-ons). "No thanks" or "Rate Huefinch" closes it for good. Everything is decided locally; the store page opens only if you click. Settings → About also has a quiet "Rate Huefinch" link.

### Changed

- The privacy policy covers both browsers, the rating request's one local reminder, and frames.

## 1.0.1 (2026-10-06)

- Fixed: on pages shorter than the window, the area below the page showed white instead of the page's background while Huefinch was on.

## 1.0.0 (2026-10-06)

First release.

- Correct colors for red-, green- or blue-weak vision (Fidaner et al. error redistribution on the Machado et al. 2009 model), with a strength slider. Default: Green-weak, 80%.
- Simulate red-, green- or blue-weak vision at any severity, with a pill on the page saying what is simulated.
- Works on every website automatically once allowed, from the first frame (no flash of original colors), including modal dialogs, popovers, full-screen video and iframes, each recolored exactly once. Without that access, works on one tab at a time from the toolbar icon.
- Switch off per site; Alt+Shift+F turns everything on or off; hold Alt+Shift+X to see the original colors.
- Identify any color with Alt+Shift+C or the popup: a plain-English name, the nearest CSS color and the hex code, copied to the clipboard.
- "Find my setting": mark color pairs that look alike, get a suggestion, tune until they separate.
- Gray toolbar icon when off. Dark mode. Full keyboard support.
- No network requests, no page reading, settings in this browser only; audited on every build.
