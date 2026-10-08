# Huefinch – Color Blind Filter & Color Identifier

Most birds see more colors than people do, with four kinds of color-sensing cells where we have three. Huefinch lends your eyes a little of that, by adjusting web pages so colors that look alike become easy to tell apart.

Huefinch recolors web pages for people with red-, green- or blue-weak color vision, names any color on screen, and lets designers simulate color-blind vision. It applies automatically everywhere (including pop-up dialogs and full-screen video), and a "Find my setting" helper takes the guesswork out of setup. No account, no network requests, and it never reads the pages it recolors.

Made by Wrenbox: small, private tools for your browser.

---

## Manual test checklist (for the owner)

**Load it first**

1. In this folder run `npm ci && npm run build` (once; needs Node 20+).
2. Open `chrome://extensions`, turn on **Developer mode** (top right), click **Load unpacked** and select `extensions/huefinch/dist`.
3. Pin it: puzzle-piece icon in the toolbar → pin next to **Huefinch**.

**Then check**

4. **Welcome page** opens by itself. It tells the bird story and shows a live before/after chart. Click **Turn on for all websites** → Chrome asks once → the page changes to "Huefinch is on for every website".
5. Open a colorful page (a Wikipedia article with a map, a stock chart, a weather map). Colors are recolored **from the very first moment**: reload a few times and watch for a flash of the original colors (there should be none).
6. **Popup** (click the icon): switch between Red-, Green- and Blue-weak and move **Strength**: the page follows live. Switch to **Simulate**: a navy pill at the top of the page says "Simulating green-blind vision"; drag Severity below 100% and the pill says "green-weak vision (60%)".
7. **On for this site**: switch it off → the page shows its original colors, and the toolbar icon turns gray on that site. Reload: still off. Open another site: on. Settings → Websites lists the site; remove it there → back on.
8. **Alt+Shift+F** turns Huefinch off everywhere (icon turns gray) and on again.
9. **Hold Alt+Shift+X** on a page: original colors while held, with a small "Showing original colors" pill; let go → recolored. Also try holding it and switching to another window: colors come back.
10. **Alt+Shift+C**, then click a color (try inside a photo): a card in the top-right corner names the color ("Olive green"), shows "Close to: …" and the hex code, and says "copied". Paste somewhere to check. Escape or a click elsewhere closes it. Popup → **Identify a color** shows "Click anywhere to pick a color" first.
11. **Dialogs and full screen:** on a site with a modal dialog (e.g. a cookie banner or a "Delete?" confirmation) and on a full-screen YouTube video, colors are recolored the same as the page — not left original, not doubled.
12. **Settings → Find my setting:** mark the pairs that look alike → a suggestion appears → **Use …** → move the slider until the pairs look different. The note says it's a comfort setting, not a medical test.
13. **Settings → Keyboard shortcuts → Open Chrome shortcuts** opens `chrome://extensions/shortcuts`; change Alt+Shift+F to something else and come back: the settings page and popup show the new key.
14. **Decline path:** remove Huefinch and load it again; on the welcome page click the button and choose **Don't allow**. Open a page: no recoloring. Click the Huefinch icon: that tab is recolored and the popup says "on for this tab until you leave the page" with a **Turn on for all websites** button. Reload: not recolored any more.
15. **Turn off automatic mode:** Settings → Websites → switch off "Turn on automatically on every website" (or remove site access on `chrome://extensions`). New pages are no longer recolored; the switch updates by itself.
16. **Keyboard only:** Tab through the popup and every settings section: focus is always visible, radio groups work with the arrow keys, sliders with arrows, switches with Space.
17. **Dark mode:** set your system to dark: the popup, settings and welcome page switch to dark colors.
18. Chrome's own pages (`chrome://settings`) and the Web Store: the popup explains that Chrome doesn't allow extensions there.
19. **Edge (optional):** load `dist` in `edge://extensions` the same way; the UI says "Edge" where it would say "Chrome".

---

## Development

```
npm ci                 install (Node 20+)
npm run build          build into dist/ (unminified, no source maps)
npm run dev            rebuild on change
npm run verify         typecheck, lint, unit tests, build, network audit,
                       permissions audit, end-to-end tests, zips
npm run screens        capture every screen and rebuild store-assets/captured/
npm run perf           frame-time measurements only (tests/output/perf-*.json)
npm run video          record and render the promo video (see store-assets/video/README.md)
```

`npm run verify` writes `release/huefinch-<version>.zip` (Chrome Web Store) and `release/huefinch-<version>-edge.zip` (Microsoft Edge Add-ons; same build, only the manifest name is shortened to Edge's 45-character limit: "Huefinch – Color Blind Filter & Identifier"). Both are reproducible byte for byte.

The end-to-end tests run the real extension in Playwright's Chromium. Install the browser once with `npx playwright install chromium` if it isn't already there.

### Releasing

Bump `version` in `package.json`, add a `## <version>` section to `CHANGELOG.md`, merge to `main`. The **Huefinch** GitHub workflow runs `verify` and publishes a GitHub Release tagged `huefinch-v<version>` with both zips and the promo video (`store-assets/video/huefinch-demo-1080p.mp4`) attached and notes from the changelog. Upload the Chrome zip to the Web Store (step by step, with every text to paste: `LAUNCH.md`).

## How it works

```
src/
  background/   service worker: registration, activeTab injection, Alt+Shift+F, toolbar icon
  content/      the page filter (filter.ts), in-page pill/picker/card (ui.ts), keys (index.ts)
  popup/  options/  onboarding/
  shared/       color maths (matrix.ts), color names (color.ts), settings and migrations,
                hostnames, Find my setting pairs, UI building blocks
scripts/        build, audits, zip, PNG helpers (gray "off" icons), initial-state files
tests/unit/     Vitest       tests/e2e/   Playwright      tests/fixtures/  test "websites"
```

- **The filter.** One inline `<svg>` with `<filter id="huefinch-filter"><feColorMatrix type="matrix">`, and a style rule `html { filter: url(#huefinch-filter) !important }`, both in a `<huefinch-root>` element attached to `<html>` at `document_start` and re-attached by a MutationObserver if a page removes them. The browser converts each pixel sRGB → linear, applies the matrix, clamps and converts back (`color-interpolation-filters: linearRGB`, set inline so site CSS can't change it).
- **The top layer.** Modal dialogs, popovers, full-screen elements and their backdrops are painted outside `<html>`, so they get the same filter themselves. Being outside `<html>`, they are recolored exactly once. Iframes are inside the page, so the top-frame filter covers them; Huefinch runs in the top frame only.
- **The maths** (`src/shared/matrix.ts`): simulation matrices from Machado, Oliveira & Fernandes (2009) at severity 1, `S(s) = (1−s)·I + s·S`; correction by error redistribution after Fidaner, Lin & Ozguven (2005), `C(k) = I + k·E·(I − S)`. Default: Correct, Green-weak, 80%.
- **No flash.** The content script must know the setting before the first frame, but `chrome.storage` is asynchronous. So the automatic registration lists three generated one-line files first (`content/initial/mode-correct.js`, `type-deutan.js`, `amount-80.js`); the service worker swaps them with `updateContentScripts` when settings change, and puts switched-off sites in `excludeMatches`. A test checks the filter is in place at the first animation frame on 12 pages.
- **Color names** (`src/shared/color.ts`): a hue family from HSL with everyday names (dark orange is brown, dark yellow olive, light red pink) and modifiers (very dark, dark, light, pale, grayish, muted, bright); "dark" uses the mean of HSL lightness and CIE L*, because HSL calls vivid greens dark. The nearest of the 139 CSS named colors by CIEDE2000.
- **Find my setting pairs** (`src/shared/pairs.ts`) were found by searching sRGB with the same matrices: each pair is near-identical for its type, clearly different for the other two, and pulled apart by Huefinch's correction. Unit tests check all three properties.
- **Privacy, enforced:** `scripts/audit-network.mjs` fails the build on any request API or unexpected URL; `scripts/audit-permissions.mjs` checks the exact permissions and that the content script contains nothing that reads page content (text, selection, address beyond the hostname, cookies, storage, pixels).

## FAQ

**Is this a medical test or treatment?** No. It's a comfort setting for the screen.

**Why can't Huefinch recolor Chrome's own pages?** Chrome doesn't let any extension change `chrome://` pages, the Web Store or (unless you allow it) local files.

**Does it work in iframes?** Yes: embedded content is drawn inside the page, so the page's filter recolors it once.

**Why does copying sometimes show a "Copy hex" button?** Some sites block clipboard access, or are plain `http` pages where the Clipboard API isn't available. Huefinch then falls back to the copy command, and if that's blocked too, offers a button (a click is always allowed to copy).

**Does it slow pages down?** The browser draws the filter. In software rendering (no GPU) fast scrolling on a very busy page drops from 60 to about 40 frames per second; see `REVIEW.md` for the measurements.

## Out of scope for v1

Paid features, accounts, sync, any network use, per-site profiles, pattern overlays, mobile.
