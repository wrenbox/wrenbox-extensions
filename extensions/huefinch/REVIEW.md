# Huefinch review log

The quality loop from the build brief (§9), recorded as it ran. Every section of the brief was re-read and checked against the build; gaps found were fixed and are ticked off below. Deliberate differences from the brief or the visual spec are listed with the reason.

## 1. `npm run verify`

- [x] typecheck, lint (ESLint + Prettier), unit tests, build, network audit, permissions/privacy audit, end-to-end tests, Chrome and Edge zips: all green. See "Final run" at the end.
- [x] Stress: the end-to-end suite passed 4 times in a row (`--repeat-each=4`, 180/180), and the no-flash checks 5 times (60/60).

## 2. Requirements walk-through

| §   | Requirement                                                                                                                                                                                        | Status | Where / how it is checked                                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Wrenbox line in About and store description; bird story in onboarding and store description                                                                                                        | ✅     | `options.html` About, `onboarding.ts`, `CHROMEWEBSTORE.md`; e2e `ui.spec.ts` checks both pages                                                                                    |
| 1   | Layout, own `package.json`, no imports from Bowerline, `dist/` and `release/` gitignored                                                                                                           | ✅     | tooling copied and adapted (build, zip, audits, e2e harness, store frame)                                                                                                         |
| 2   | Manifest name / short_name; single purpose; US spelling ("colour" once in the description)                                                                                                         | ✅     | `src/manifest.json`, audited; `CHROMEWEBSTORE.md`                                                                                                                                 |
| 3.1 | Zero network, with an audit that fails the build                                                                                                                                                   | ✅     | `scripts/audit-network.mjs` (verified to fail on planted fetch, WebSocket, sendBeacon, @import, preconnect and unknown URLs)                                                      |
| 3.2 | No remote code, eval or new Function; default CSP; unminified                                                                                                                                      | ✅     | `scripts/audit-permissions.mjs`, ESLint rules                                                                                                                                     |
| 3.3 | Exactly `storage`, `activeTab`, `scripting` + optional `https://*/*`, `http://*/*`                                                                                                                 | ✅     | audited; justified in `CHROMEWEBSTORE.md`                                                                                                                                         |
| 3.4 | `chrome.storage.local` only                                                                                                                                                                        | ✅     | lint rule + audit forbid `storage.sync`                                                                                                                                           |
| 3.5 | Never read page content; hostname only                                                                                                                                                             | ✅     | audit fails if the content script contains innerText, getSelection, document.title/URL/cookie, location beyond hostname, page storage, pixel reads or element queries. See gap G7 |
| 3.6 | No paywall                                                                                                                                                                                         | ✅     |                                                                                                                                                                                   |
| 4.1 | Onboarding: why access is needed, one button, `registerContentScripts` (`document_start`, `allFrames: false`, `persistAcrossSessions: true`); decline → activeTab per tab; `permissions.onRemoved` | ✅     | e2e `activation.spec.ts`, `ui.spec.ts`                                                                                                                                            |
| 4.2 | Inline SVG `feColorMatrix`, linearRGB, `html { filter: url(#huefinch-filter) !important; }`, container on `<html>`, MutationObserver re-attach                                                     | ✅     | e2e `pages.spec.ts` (hostile page strips it 6 times)                                                                                                                              |
| 4.2 | Top layer (`dialog:modal`, `:popover-open`, `:fullscreen`, `::backdrop`) filtered exactly once                                                                                                     | ✅     | e2e `toplayer.spec.ts`: pixels match "once", not "twice" or "never"                                                                                                               |
| 4.2 | Top frame only; iframe filtered once                                                                                                                                                               | ✅     | cross-origin iframe pixel test                                                                                                                                                    |
| 4.2 | Images, video, canvas filtered                                                                                                                                                                     | ✅     | `video.html` (canvas-fed `<video>`)                                                                                                                                               |
| 4.2 | Performance on a heavy page                                                                                                                                                                        | ✅     | §6 below                                                                                                                                                                          |
| 4.3 | Exact matrices; S(s), C(k); expected k = 1 values to 4 decimals; default Correct / Green-weak / 80%                                                                                                | ✅     | `tests/unit/matrix.test.ts`, `settings.test.ts`                                                                                                                                   |
| 4.4 | Popup: master toggle, segmented mode, three types, Strength/Severity live, "On for this site", shortcut hints; Simulate pill                                                                       | ✅     | e2e `ui.spec.ts`, `sites.spec.ts`, `keys.spec.ts`                                                                                                                                 |
| 4.5 | Alt+Shift+F command (changeable); hold Alt+Shift+X incl. blur; Alt+Shift+C                                                                                                                         | ✅     | e2e `keys.spec.ts`, `activation.spec.ts`                                                                                                                                          |
| 4.6 | EyeDropper with the filter removed while picking; popup overlay; closed-shadow card with swatch, name, "Close to", hex, "copied"; Escape / click-away; ≥ 40 reference names                        | ✅     | e2e `identify.spec.ts` (mocked EyeDropper records the page's filter while open: `none`); 54 reference names in `color.test.ts`                                                    |
| 4.7 | Find my setting: confusable pairs, suggestion, live strength; "not a medical test"                                                                                                                 | ✅     | pairs found mathematically and unit-tested (§5 below); e2e `ui.spec.ts`                                                                                                           |
| 4.8 | Settings sections: Color vision, Websites, Keyboard shortcuts (`chrome.tabs.create` to `chrome://extensions/shortcuts`), Find my setting, About (version, privacy, Wrenbox line, credits)          | ✅     | e2e `ui.spec.ts`                                                                                                                                                                  |
| 4.9 | Gray icon generated at build time, no canvas                                                                                                                                                       | ✅     | `scripts/lib/png.mjs` `grayIcon`; unit test; audit checks the files exist                                                                                                         |
| 5   | Wrenbox tokens, three-color bar, system fonts, radii 10–14, never color alone, WCAG AA, keyboard, focus, reduced motion, usable under the filter                                                   | ✅     | `tokens.css`; `contrast.test.ts` (in-page UI under all 24 mode/type/amount matrices, page tokens light and dark); e2e keyboard, dark mode, reduced motion                         |
| 6   | Unit: maths, feColorMatrix string, naming, migrations, hostnames. E2E: pixels ±3, dialog/full screen once, iframe once, Alt+Shift+X, off-list, decline path, identifier                            | ✅     | 185 unit tests, 48 end-to-end tests                                                                                                                                               |
| 7   | `CHROMEWEBSTORE.md`                                                                                                                                                                                | ✅     | See N2                                                                                                                                                                            |
| 8   | Privacy policy                                                                                                                                                                                     | ✅     | `/docs/huefinch/privacy.md`. See D6                                                                                                                                               |
| 9   | Quality loop, release zips, owner checklist, Edge zip                                                                                                                                              | ✅     | this file; `README.md`; `release/`                                                                                                                                                |
| 10  | Nothing out of scope built                                                                                                                                                                         | ✅     |                                                                                                                                                                                   |

### Gaps found during the loop, all fixed

- [x] **G1. Flash of uncorrected color.** The first pixel test of the "no flash" probe (filter must be in place at the first animation frame, which runs right before the first paint) failed on 4 of 12 pages: the asynchronous `chrome.storage` read lost the race on fast pages. Fixed with initial-state files: the registered content script is preceded by three generated one-line files carrying the mode, type and amount, swapped with `updateContentScripts` whenever settings change; switched-off sites go into `excludeMatches`. Now 12/12 pages, 60/60 under stress.
- [x] **G2. The identifier failed on plain `http` sites.** There `navigator.clipboard` is undefined, so `writeText` threw and the card never appeared. Now the copy falls back to the copy command, and if that is blocked too the card offers a "Copy hex" button. Regression test on an insecure origin.
- [x] **G3. Styles blocked by strict CSP.** `style=""` attributes (card swatch, preview filter) are blocked by a strict Content-Security-Policy, including the extension pages' own. All styles are now set through the CSSOM; shadow-root styles use a constructed stylesheet. A strict-CSP fixture page is pixel-tested.
- [x] **G4. The before/after didn't show the problem.** The first dashboard used pink and green lines that a green-weak eye can already tell apart. Switched to a common chart red and green (`#DC3545` / `#558833`) found by search: CIEDE2000 3.8 between them as seen with deuteranopia, 26.7 with Huefinch at 80%. Used in the dashboard, sign-up form and onboarding demo.
- [x] **G5. Extension updates.** After an update, open tabs keep the old version's orphaned script; a new injection would add a second container with a duplicate filter id (the stale one would win). Orphans now stop maintaining themselves, a new instance replaces any stale container, and the worker re-applies the new version to open tabs on update. Tested with a planted stale container.
- [x] **G6. Service-worker race in the tests.** Chrome can report the worker before its module finished running (1 failure in 141). The harness now waits for it.
- [x] **G7. Address beyond the hostname.** `canRunOn` looked at the URL path to recognize the old Web Store address. It now uses scheme and hostname only (anything else Chrome refuses is reported when injection fails).
- [x] **G8. Short pages showed a white band (found by the promo video, fixed in 1.0.1).** With a filter on the root element, Chrome paints the page background only over `<html>`'s own box, so below a page shorter than the window the background stopped and the canvas showed white. Huefinch now also sets `:where(html) { min-height: 100% }` (zero specificity, so a page that sizes `<html>` keeps its own rule). Pixel-tested at the top and bottom of the window on two short fixtures (background on `<html>` and on `<body>`); the scroll size of all 13 other fixtures is unchanged.
- [x] Label spacing in the popup (fieldset legends ignore grid gaps): rebuilt as `role="radiogroup"` with a labelled heading.
- [x] Section headings receive focus on navigation (for screen readers) but showed a large focus box; programmatic-focus targets no longer draw a ring.
- [x] The Simulate pill's shadow overlapped a sampled pixel (the pixel tests caught it); samples moved below the pill's reach.
- [x] "Chrome" in UI text now says "Edge" in Edge (one build for both stores).
- [x] US spelling sweep: "gray" everywhere in UI, docs and listing.
- [x] Strength or severity 0% now removes the filter entirely (no rendering cost for an identity matrix).

## 3. Screens vs `store-assets/` (1280×800)

`npm run screens` captures every screen into `tests/output/screens/` and builds real store screenshots in `store-assets/captured/`, framed like the designed mockups. Compared one by one:

| Spec           | Result                                                                                                                                                                                                                                                                                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Before/after | Same headline, subtitle, two cards with "Lines look the same" / "Easy to tell apart", chart and store dots, footnote. Real capture of the dashboard with Huefinch off and on (Green-weak, 80%), then the deuteranopia simulation applied to both with Huefinch's own maths. "Without": both lines olive. "With": gray vs olive-yellow, as in the design. |
| 2 Popup        | Matches: icon + name + switch, segmented "Correct colors / Simulate", "My color vision", three rows with the term on the right and the selected one bold with a heavier border, "Strength: 80%", "On for this site" + switch, hints. See D1.                                                                                                             |
| 3 Identify     | Same page, card "Olive green", "#6B7A2E, copied", "Close to: dark olive green". See D2, D3.                                                                                                                                                                                                                                                              |
| 4 Simulate     | Same form, "Simulating green-blind vision" pill, popup in Simulate mode with "Simulate this vision" and "Severity: 100%". Under the simulation the green and red inputs, messages and buttons all turn olive, as in the design.                                                                                                                          |
| 5 Settings     | Matches: sidebar with the five sections, "Websites", the automatic-mode row and wording, "Off on these sites" chips, "Your privacy" with "Privacy policy". The chips have a visible × remove button (required by §4.8).                                                                                                                                  |

Also captured and checked: every settings section, Find my setting with a suggestion and the tuning step, the onboarding page (story, live before/after, granted state), the popup when off, the picker overlay.

### Intentional differences

- **D1. Popup extras.** Under the site switch the popup shows the site's hostname, a row with **Identify a color** (required by §4.6) and **Settings**, and a third hint line with the on/off shortcut. Without automatic mode, a note explains per-tab use and offers "Turn on for all websites" (§4.1).
- **D2. Card position.** The browser's EyeDropper returns only the color, not where the user clicked, so the card appears in the top-right corner of the page rather than next to the picked point, and the design's ring marker is not drawn. It is in the top layer, so it also shows over dialogs and full-screen video.
- **D3. "Close to" wording.** The design says "Close to: dark olive"; there is no such CSS color, so Huefinch says "dark olive green" (the CSS keyword `darkolivegreen`, which is also in the tooltip).
- **D4. Corrected page in screenshot 2.** The real popup screenshot shows the page as Huefinch shows it (corrected), not the original colors.
- **D5. Edge name.** Edge Add-ons limits the manifest name to 45 characters, so the Edge package is named "Huefinch – Color Blind Filter & Identifier" (42). Everything else is identical. The Edge requirements page (learn.microsoft.com) was blocked by this environment's network policy; the limit comes from a search summary, so the owner should confirm it in Partner Center.
- **D6. Contact address.** The brief asks for a placeholder. The privacy policy uses the studio address already published in Bowerline's policy (wrenbox.studio@gmail.com), so the page is ready to go live.
- **D7. Focus on the card.** The identify card moves keyboard focus to its Close button (Escape works anywhere) and returns focus afterwards, so keyboard and screen-reader users can reach it.

## 4. Fixture pages, checked like a manual pass

Each page is opened with automatic mode on; the test checks that the filter is in place at the first animation frame (no flash), that there is exactly one Huefinch container and no element inside `<html>` filtered again (no double filtering), and that there are no console errors (`pages.spec.ts`).

| Page                                       | What it exercises                                    | Result                                             |
| ------------------------------------------ | ---------------------------------------------------- | -------------------------------------------------- |
| `article.html`                             | long text, gradient heat map, links, quote           | ✅                                                 |
| `dashboard.html`                           | red/green lines, dashed target, status dots          | ✅                                                 |
| `dialog.html`                              | modal dialog with backdrop, popover menu             | ✅ dialog, backdrop and popover each filtered once |
| `video.html`                               | playing video, 200 tiles, sticky header, long scroll | ✅                                                 |
| `iframe.html`                              | cross-origin embedded dashboard                      | ✅ filtered once by the top frame                  |
| `dark.html`                                | dark theme with the background on `<html>`           | ✅                                                 |
| `spa.html`                                 | pushState routing, `<base href>`, body re-rendered   | ✅ filter survives navigation and Back             |
| `shop.html`, `signup.html`, `transit.html` | store-screenshot scenes, inputs, SVG map             | ✅                                                 |
| `csp/blocks.html`                          | strict Content-Security-Policy, no inline styles     | ✅ pixel-exact                                     |
| `hostile.html`                             | page strips `<html>`'s extra children 6 times        | ✅ re-attached every time                          |
| stale container                            | leftover from an older version                       | ✅ replaced                                        |

## 5. Color maths and naming

- All three k = 1 correction matrices match the brief to 4 decimals; C(0) = I; rows sum to 1 (grays stay gray).
- Pixel checks: 12 pure colors × 2 modes × 3 types × 2 amounts, within ±3 of sRGB → linear → matrix → sRGB; observed error is at most 1.
- **Find my setting pairs** were found by searching the sRGB cube with the same matrices: under full simulation of their type the two colors are within CIEDE2000 5, they differ by more than 20 in normal vision and by more than 14 for the other two types, and Huefinch's correction at 80% at least doubles their separation and takes it above 10. Red/green pairs separate strongly (ΔE 33–51); tritan pairs separate less (ΔE 10–12), because blue-weak correction is gentler under this model, so Find my setting suggests trying a higher strength for them.
- 54 reference colors are named in tests, including grays, browns, pastels and near-blacks (`#0A0A2A` "Very dark blue", `#140A00` "Black"). "Dark" uses the mean of HSL lightness and CIE L*, because HSL calls vivid greens dark and saturated blues light. The nearest CSS color uses CIEDE2000, verified against Sharma, Wu & Dalal's published test pairs.

## 6. Performance (heavy page)

`npm run perf`, run after all other tests in its own Playwright project. Headless Chromium, software rendering (no GPU), 1280×800. Each value is the median of three interleaved 3-second runs, scrolling 40 px per frame. Full numbers: `tests/output/perf-*.json`.

| Page                                             | Huefinch                | Frames in 3 s | Mean frame | p95 frame | Frames > 25 ms |
| ------------------------------------------------ | ----------------------- | ------------- | ---------- | --------- | -------------- |
| `video.html` (video + 200 tiles + sticky header) | off                     | 180           | 16.7 ms    | 16.7 ms   | 0              |
|                                                  | Correct, Green-weak 80% | 124           | 24.5 ms    | 33.4 ms   | 56             |
|                                                  | Simulate, green-blind   | 116           | 25.9 ms    | 33.4 ms   | 61             |
| `article.html` (typical article)                 | off                     | 181           | 16.7 ms    | 16.7 ms   | 0              |
|                                                  | Correct, Green-weak 80% | 181           | 16.7 ms    | 16.7 ms   | 0              |
|                                                  | Simulate, green-blind   | 127           | 23.8 ms    | 33.4 ms   | 49             |

- A settings change reaches the page in about 50 ms (slider → storage → filter).
- The page is filtered from its first frame; static pages have no ongoing cost (the browser filters only what it repaints).
- **Where the cost comes from.** A separate experiment on the same page compared filters on `<html>`: none 16.7 ms; a plain CSS `saturate()` 16.7 ms; the same matrix with `color-interpolation-filters: sRGB` 17.2 ms; with linearRGB 24.2 ms; with explicit gamma or 256-step table transfer functions around the matrix, 31–34 ms; `will-change: filter` made no difference. The cost is the linear-light conversion, which software rendering performs per pixel on each repainted frame. The brief requires linear RGB (the published matrices are defined there, and the store screenshots rely on them), so it stays. On computers with GPU compositing the browser runs this filter on the GPU.
- The test enforces a floor (above 25 fps in software rendering), not a target.

## 7. Notes

- **N1. Initial-state files.** `dist/content/initial/` holds 27 generated one-line files (`mode-*`, `type-*`, `amount-0…100` in steps of 5). They exist only to beat the first paint (G1); the content script confirms the exact values from storage a moment later.
- **N2. Store form wording.** developer.chrome.com was blocked from this environment, so the data-usage wording in `CHROMEWEBSTORE.md` comes from Bowerline's verified submission (3 October 2026) plus a web search; the owner should glance at the live form. The answer doesn't change: nothing is collected.
- **N3. In-page shortcuts and typing.** Alt+Shift+X and Alt+Shift+C do nothing while focus is in a text field, so they never block typing (Option+Shift+C types "Ç" on a Mac). They work only on pages where Huefinch is on; the popup's Identify button works everywhere it can run.
- **N4. Per-site icon.** The toolbar icon is gray when Huefinch is off, and gray on a tab whose site is switched off.

## 8. For the owner (can't be done from here)

- Trademark check, store accounts, uploads and submission: see `LAUNCH.md`.
- Confirm the Chrome data-usage form wording (N2) and Edge's 45-character name limit (D5) in the dashboards.
- Make sure GitHub Pages serves `https://wrenbox.github.io/wrenbox-extensions/huefinch/privacy` after merging.

## Final run

```
npm run verify
  typecheck            ok
  lint                 ok (ESLint + Prettier)
  unit                 188 passed (9 files)
  build                ok
  audit:network        passed: no way to make a network request
  audit:permissions    passed: permissions, privacy and code policy
  e2e                  50 passed (48 functional + 2 performance)
  zip                  release/huefinch-1.0.1.zip, release/huefinch-1.0.1-edge.zip
```
