# Bowerline review log

The quality loop from the build brief (§11), recorded as it ran. Every requirement was re-read section by section and checked against the build. Gaps found were fixed and ticked off; deliberate differences from the brief or the visual spec are listed with the reason.

## 1. `npm run verify`

- [x] typecheck, lint (ESLint + Prettier), unit tests, build, network audit, permissions audit, end-to-end tests, zip: all green. See "Final run" at the end.

## 2. Requirements walk-through

| §   | Requirement                                                                                                                                           | Status | Where                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| 0   | Studio line in About and store description; bowerbird story in onboarding and store description; pronunciation                                        | ✅     | `options.html` About, `CHROMEWEBSTORE.md`, `onboarding.html`                                                                 |
| 1   | Repository layout, self-contained extension folder, own `package.json`, `dist/` and `release/` gitignored                                             | ✅     | repo root, `.gitignore`                                                                                                      |
| 2   | Manifest name / short_name; single-purpose wording                                                                                                    | ✅     | `src/manifest.json`, `CHROMEWEBSTORE.md`                                                                                     |
| 3.1 | Zero data leaves the browser; automated audit of `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `EventSource`                                  | ✅     | `scripts/audit-network.mjs` (own code must carry the PDF-loader marker; every pdf.js call site is on a justified allow list) |
| 3.2 | No remote code, no `eval` / `new Function`, default CSP kept                                                                                          | ✅     | `scripts/audit-permissions.mjs`; pdf.js 6 contains no `eval`                                                                 |
| 3.3 | TypeScript, unminified build, no source maps in the zip                                                                                               | ✅     | `scripts/build.mjs`, `scripts/zip.mjs`                                                                                       |
| 3.4 | Exactly the six permissions plus optional host permissions                                                                                            | ✅     | audited on every build                                                                                                       |
| 3.5 | `chrome.storage.local` only                                                                                                                           | ✅     | lint rule + audit forbid `storage.sync`                                                                                      |
| 3.6 | Content scripts never use page storage                                                                                                                | ✅     | lint rule forbids `indexedDB` / `localStorage` outside `background/db.ts`                                                    |
| 3.7 | CSS Custom Highlight API; closed Shadow DOM with scoped styles; page CSS untouched                                                                    | ✅     | `content/engine.ts`, `content/ui.ts`; e2e asserts no wrappers in the page DOM. See deviation D1                              |
| 3.8 | No paywall or licence code                                                                                                                            | ✅     |                                                                                                                              |
| 4.1 | Activation by popup, Alt+Shift+H, context menu; restore; highlight selection                                                                          | ✅     | `background/index.ts` `activateTab`. See deviation D2                                                                        |
| 4.1 | Always on: request, `registerContentScripts` (`persistAcrossSessions`, `document_idle`), unregister on revoke, toggle follows                         | ✅     | e2e `always-on.spec.ts`                                                                                                      |
| 4.1 | Restricted pages explained; PDFs offered "Open this PDF in Bowerline"                                                                                 | ✅     | `background/pages.ts`, e2e `restricted.spec.ts`                                                                              |
| 4.2 | Popup contents and actions                                                                                                                            | ✅     |                                                                                                                              |
| 4.3 | Toolbar above selection, flips below, never covers it; mouse and keyboard selections                                                                  | ✅     | `content/ui.ts` `positionToolbar`                                                                                            |
| 4.3 | Click-to-edit via `caretPositionFromPoint`; note markers with hover card                                                                              | ✅     | e2e `notes.spec.ts`                                                                                                          |
| 4.3 | TextQuote (32-char context) + TextPosition over normalised text; exact → position → fuzzy; orphan, never delete                                       | ✅     | `shared/anchoring/*`, unit tests                                                                                             |
| 4.3 | 500 ms debounced MutationObserver, 1 s URL poll + `popstate`, 30 s orphan retry                                                                       | ✅     | e2e `spa.spec.ts`                                                                                                            |
| 4.3 | No highlighting in inputs/textareas/contenteditable; canvas notice                                                                                    | ✅     | e2e                                                                                                                          |
| 4.3 | URL normalisation                                                                                                                                     | ✅     | unit tests. See deviation D3                                                                                                 |
| 4.4 | pdf.js viewer, text layer, overlay rects at every zoom, licence copied                                                                                | ✅     | e2e checks overlay growth on zoom                                                                                            |
| 4.4 | Three ways to open; per-origin permission button; CORS explanation + download fallback                                                                | ✅     | e2e `pdf.spec.ts`                                                                                                            |
| 4.4 | Fingerprint identity; file name, URL, title stored                                                                                                    | ✅     | e2e reopens from a different URL and name                                                                                    |
| 4.4 | Layout (top bar, thumbnails, margin notes); shortcuts H, N, +/−, arrows, Page Up/Down                                                                 | ✅     |                                                                                                                              |
| 4.5 | Side panel tabs, search, colour chips, grouping with Web/PDF labels, click to focus, "Not found on this page", inline notes, 5 s undo, `library.html` | ✅     | e2e `sidepanel-*.spec.ts`                                                                                                    |
| 4.6 | Export scopes and five formats; Blob download; Copy; restore with validation, merge by id and report                                                  | ✅     | golden-file tests, e2e download test                                                                                         |
| 4.7 | Settings sections and every control listed                                                                                                            | ✅     |                                                                                                                              |
| 4.8 | Onboarding on install, three steps, demo needs no permission                                                                                          | ✅     | e2e `onboarding.spec.ts`                                                                                                     |
| 5   | IndexedDB `bowerline` via `idb`, migration framework, schemas and indexes                                                                             | ✅     | `background/db.ts`, unit tests                                                                                               |
| 6   | Design tokens, highlight colours plus dark values, system font, inline-SVG wordmark, radii, accessibility                                             | ✅     | `shared/ui/tokens.css`                                                                                                       |
| 7   | Strict TS, esbuild, allowed dependencies only, lockfile, Node 20+, all npm scripts                                                                    | ✅     | See note N1                                                                                                                  |
| 8   | All listed unit and e2e tests                                                                                                                         | ✅     | 69 unit tests, 19 e2e tests                                                                                                  |
| 9   | `CHROMEWEBSTORE.md`                                                                                                                                   | ✅     | See note N2                                                                                                                  |
| 10  | Privacy policy                                                                                                                                        | ✅     | `/docs/bowerline/privacy.md`                                                                                                 |
| 11  | Quality loop                                                                                                                                          | ✅     | this file                                                                                                                    |
| 12  | Nothing out of scope built                                                                                                                            | ✅     |                                                                                                                              |

### Gaps found during the walk-through, all fixed

- [x] **Highlights didn't paint.** Chrome ignores `::highlight()` rules in user-origin stylesheets, so the first build registered highlights that showed no colour. The stylesheet is now injected with author origin (it still contains only `::highlight(bowerline-*)` rules). Found by the screenshot pass.
- [x] **Edit toolbar vanished.** A click on a highlight opened the edit toolbar, then the selection-settled handler closed it 10 ms later. The UI now tracks which toolbar is showing.
- [x] **`hidden` was ignored** wherever a component set `display`, so the popup showed "Open this PDF" on normal pages and the empty viewer showed its pager. Fixed globally (`[hidden] { display: none !important }`).
- [x] **Always-on race.** `permissions.onRemoved` and the settings page both unregistered the content script, and the second threw. Sync is now serialised.
- [x] **Selection made before Bowerline loaded** (common with Always on) got no toolbar until reselected. The engine now offers the toolbar for an existing selection on start.
- [x] **Viewer "Fit"** measured the width before the thumbnail rail appeared, and the notes margin appeared only once a note existed, so pages jumped. The rail is now shown before layout, with a fixed notes gutter on wide windows.
- [x] Note markers sat on the next word. They now sit like footnote marks, just above the end of the line (web and PDF).
- [x] The popup's shortcut badge was white-on-white, and the label truncated. Fixed, and the popup widened to 340 px.
- [x] Orphan-report timers piled up on every reload. Now cleared.
- [x] Opening the viewer with `?focus=` could race the page layout. It now waits for both the pages and the highlights.
- [x] The in-page UI host re-attaches itself if a site rebuilds `<html>`.
- [x] The side panel's "This page" tab had no end-to-end coverage. Added `?tabId=` pinning and a test.
- [x] Hardening: content scripts run inside web pages' processes, so the service worker now accepts only page-level requests from them (read this page, create/edit/delete its highlights). Reading the whole library, restore, delete-all and the PDF tab fetch are limited to Bowerline's own pages.
- [x] In dark mode the navy logo square vanished on the navy background; it now has a faint edge.

## 3. Screens vs `store-assets/` (1280×800)

Captured with `npm run screens` into `tests/output/screens/` and compared one by one.

| Spec                  | Result                                                                                                                                                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Web highlighting    | Toolbar (navy pill, four swatches with the default ringed, divider, "Add note", "Copy", pointer notch) and the yellow "Your note" card match. Highlight colours are the specified values.                                        |
| 2 PDF highlighting    | Top bar order and pills, thumbnail rail with the current page outlined in navy, "Note on page N" card with a colour bar in the right margin all match. Differences: D4.                                                          |
| 3 Library search      | Side panel matches: logo, segmented "This page / Library", "Search" label inside the field, colour dots + "All colours", "N matches in N sources", groups with Web/PDF labels, cards with colour bar, marked matches, note line. |
| 4 Export              | Dialog matches: title, scope chips, five formats with the specified descriptions, preview with purple callout markers, "Copy" and "Download .md file". Differences: D5, D6.                                                      |
| 5 Privacy / Your data | Matches the copy, three stat cards, Always-on row, backup row with two buttons, red "Delete all".                                                                                                                                |

Dark theme, popup, onboarding and the viewer's empty and error states were also captured and checked.

## 4. Audits

- [x] Permissions exactly as listed (`npm run audit:permissions`).
- [x] No network calls other than the PDF fetch (`npm run audit:network`). Defence in depth: every extension page has a CSP `<meta>` limiting `connect-src` to the extension; the viewer sets its own to the extension plus the opened PDF's origin.
- [x] No `eval`, `new Function` or string timers anywhere in `dist/`, including pdf.js.
- [x] No console errors across the fixture pages: every e2e test asserts an empty error log (the blocked-PDF test ignores only Chrome's own CORS line).
- [x] Content script: **53.9 KB** unminified (limit 60 KB).
- [x] Restoring 200 highlights: about 60 ms in total, with **zero long tasks**. The test first proves the long-task observer works by catching a deliberate 80 ms task.

## Deliberate deviations

- **D1: Highlight colours come from an injected stylesheet.** The Custom Highlight API can only be styled by a stylesheet in the document. Bowerline injects one with `chrome.scripting.insertCSS`; it isn't visible in `document.styleSheets` and contains only `::highlight(bowerline-yellow|mint|pink|sky|focus)` rules, so no page element is restyled. User origin would be ideal but Chrome ignores `::highlight` there (verified).
- **D2: Opening the popup doesn't auto-highlight the selection.** Opening the popup injects Bowerline and restores highlights. Highlighting the current selection is one click on "Highlight this page", so opening the popup just to change a setting never creates a surprise highlight. The shortcut and context menu highlight immediately, as specified.
- **D3: Hash routes are kept.** URLs keep `#/…` and `#!…` fragments, because in hash-routed single-page apps the fragment is the page; stripping it would merge every view into one source. A few more well-known click-id parameters are stripped besides the four named (`msclkid`, `dclid`, `gbraid`, `wbraid`, `mc_cid`, `igshid`, `yclid`, `_hsenc`, `_hsmi`).
- **D4: Viewer top bar.** It adds a small "Open another PDF" icon before the file name, puts −/+ buttons inside the zoom pill, and makes the page number an editable field. These keep zoom and navigation keyboard- and mouse-accessible. The page is drawn by pdf.js at real proportions, so it is wider than the mock's.
- **D5: Callout names.** The export mock shows `[!highlight-green]` / `[!highlight-blue]`; Bowerline uses its own colour names (`[!highlight-mint]`, `[!highlight-sky]`), as §4.6's `[!highlight-yellow]` example implies, so callout names match the colour names users see everywhere.
- **D6: "This page" scope in the library.** The full-page library has no current page, so the "This page" chip appears there only after the user picks a source (click a source title). It is always present in the side panel and the viewer.
- **D7: Side panel extras.** A settings gear in the header and a footer with "Export" and "Open full library", which the mock leaves out of frame.
- **D8: Popup shows the shortcut** (`Alt+Shift+H`) inside the "Highlight this page" button, so it can be discovered.

## Notes

- **N1: Node version.** The current `pdfjs-dist` (6.4) declares Node ≥ 22.13 for its own Node entry points. Bowerline only bundles it for the browser, so the build works on Node 20 with an npm engine warning. `package.json` keeps `"node": ">=20"`. Node 20 itself reached end of life in April 2026; Node 22 LTS is recommended.
- **N2: Store definitions.** The Chrome developer documentation was blocked by this environment's network policy. The category was verified on the live store ("Workflow & Planning"). The data-use answers are deliberately conservative, and `CHROMEWEBSTORE.md` asks the owner to re-read the dashboard's definitions before submitting.
- **N3: Minimum Chrome version is 140.** pdf.js 6 uses `Uint8Array.prototype.toHex/fromBase64` (Chrome 140). Newer built-ins it relies on (`Map.prototype.getOrInsertComputed`, `Math.sumPrecise`, `RegExp.escape`) are polyfilled in `viewer/polyfills.ts`. End-to-end tests run on Chromium 141.
- **N4: E2E permissions.** Chrome's permission prompt can't be clicked headlessly. The tests seed the granted origins in the test profile (what Chrome records when a user accepts) and test the unmodified `dist/`. The "request" step of Always on is covered by asserting exactly which origins are requested.

## Release process

Releases are published as GitHub Releases by `.github/workflows/bowerline.yml`. Every push and pull request runs `npm run verify`. On `main`, when `package.json` has a version with no release yet, a separate job (the only one with write access) tags `bowerline-v<version>` and publishes the release with the zip attached. On CI only, end-to-end tests may retry once, because shared runners are slower than a developer machine.

## Owner actions before publishing

1. ~~Re-capture real store screenshots~~ Done: `store-assets/captured/` holds real, framed captures (`npm run store-screenshots`).
2. Replace the placeholder contact email in `/docs/bowerline/privacy.md`.
3. Enable GitHub Pages from `/docs` so the privacy URL resolves.
4. Register the developer account as **Wrenbox**, as a non-trader.
5. Re-read the Privacy practices definitions in the dashboard (N2).

## Final run

`npm run verify` on the final commit:

- typecheck ✅ · ESLint + Prettier ✅
- unit tests: **69 passed** (anchoring, URL normalisation, every exporter against golden files, backup import/merge, database migrations and store, search, geometry)
- build ✅ (unminified; content script 53.9 KB)
- network audit ✅: own code has only the two marked PDF-loader `fetch` calls; every pdf.js call site is on the justified allow list
- permissions audit ✅
- end-to-end: **19 passed** in Chromium 141 with the extension loaded, no console errors; 200 highlights restored in ~55 ms with zero long tasks
- zip ✅ `release/bowerline-1.0.0.zip` (322 files, 2.7 MB, `manifest.json` at the root, no source maps)

The loop (verify → walk-through → screens → audits) was repeated until it found nothing left to fix.
