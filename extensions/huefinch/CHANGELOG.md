# Changelog

All notable changes to Huefinch are recorded here. Versions follow [Semantic Versioning](https://semver.org/).

## 1.0.0 (2026-10-06)

First release.

- Correct colors for red-, green- or blue-weak vision (Fidaner et al. error redistribution on the Machado et al. 2009 model), with a strength slider. Default: Green-weak, 80%.
- Simulate red-, green- or blue-weak vision at any severity, with a pill on the page saying what is simulated.
- Works on every website automatically once allowed, from the first frame (no flash of original colors), including modal dialogs, popovers, full-screen video and iframes, each recolored exactly once. Without that access, works on one tab at a time from the toolbar icon.
- Switch off per site; Alt+Shift+F turns everything on or off; hold Alt+Shift+X to see the original colors.
- Identify any color with Alt+Shift+C or the popup: a plain-English name, the nearest CSS color and the hex code, copied to the clipboard.
- "Find my setting": mark color pairs that look alike, get a suggestion, tune until they separate.
- gray toolbar icon when off. Dark mode. Full keyboard support.
- No network requests, no page reading, settings in this browser only; audited on every build.
