# Build prompt: Huefinch – Color Blind Filter & Color Identifier (Chrome extension, Manifest V3)

Paste everything below into Claude Code from the root of the GitHub repository.

---

You are the lead engineer at **Wrenbox**, a studio that makes small, private, high-quality Chrome extensions. Bowerline already lives in `extensions/bowerline/`. Build the second extension, **Huefinch**, completely, then review and improve it until it meets every requirement below. Work autonomously. Only stop to ask me if you are blocked on something only the owner can do (accounts, payments, publishing).

## 0. Studio and story
- **Publisher:** Wrenbox. Every Wrenbox extension is named after a bird. In the About screen and store description, include: "Made by Wrenbox: small, private tools for your browser."
- **Huefinch's story** (use it in onboarding and the store description): most birds see more colors than people do, with four kinds of color-sensing cells where we have three. Huefinch lends your eyes a little of that, by adjusting web pages so colors that look alike become easy to tell apart.

## 1. Repository layout
Add to the existing repo:
```
/README.md                     ← add Huefinch to the extensions index
/docs/huefinch/privacy.md      ← privacy policy (GitHub Pages)
/extensions/huefinch/          ← EVERYTHING for this extension lives here
  package.json  tsconfig.json  build config
  src/  background/  content/  popup/  options/  onboarding/  shared/
  public/icons/   icon-16/32/48/128.png        (provided, final)
  store-assets/   screenshots, tiles, YouTube thumbnail  (provided, final; the visual spec)
  tests/unit/  tests/e2e/  tests/fixtures/
  CHROMEWEBSTORE.md  CHANGELOG.md  README.md  REVIEW.md
  dist/  release/   (gitignored)
```
Huefinch has its own `package.json` and must never import from `extensions/bowerline/`. You may **copy** useful tooling from Bowerline (build scripts, test setup, audits), adapting it as needed.

## 2. The product
- **Manifest name and store title:** `Huefinch – Color Blind Filter & Color Identifier`. **short_name:** `Huefinch`.
- **Single purpose (use this wording in the store form):** "Adjust the colors of web pages so people with color vision deficiency can tell colors apart, and identify colors on screen."
- **Who it's for:** people with red-, green- or blue-weak color vision (about 1 in 12 men and 1 in 200 women), plus designers checking accessibility.
- **Why it exists:** Google's own Color Enhancer extension (100,000 users) has had no update since February 2024. Its reviews complain that it must be switched on again on every page, doesn't work on pop-up dialogs, and is hard to set up. The active alternatives are small. Huefinch fixes each complaint: it applies automatically everywhere, covers dialogs and full-screen content, and offers a simple "Find my setting" helper.
- **Spelling:** use US spelling ("color") in all UI and listing text, because that's what people search for. The description may also mention "colour" once so UK users find it.

## 3. Non-negotiable rules
1. **Zero network.** No `fetch`, XHR, WebSocket, beacons, analytics, remote fonts or CDNs anywhere. Add an automated audit that fails the build if any appear in the bundle.
2. **No remote code**, no `eval`, no `new Function`. Default extension CSP. Build **without minification**.
3. **Minimal permissions, exactly:** `storage`, `activeTab`, `scripting`, plus `optional_host_permissions: ["https://*/*", "http://*/*"]`. Nothing else. Justify each one in `CHROMEWEBSTORE.md`.
4. **Settings in `chrome.storage.local`**, never `sync`.
5. **Never read page content.** Huefinch only adds a color filter. It must never read, store or send page text, URLs beyond the hostname (needed for the per-site setting), or images.
6. **No paywall or upgrade prompt in v1.** Everything is free.

## 4. How it works

### 4.1 Activation (keeps the review light)
- **Onboarding** (opens on install) explains why Huefinch needs access to websites ("to recolor the pages you visit; it never reads them") and shows one button, "Turn on for all websites", which calls `chrome.permissions.request` for the optional origins. When granted, register the content script with `chrome.scripting.registerContentScripts` (`runAt: "document_start"`, `allFrames: false`, `persistAcrossSessions: true`).
- **If the user declines**, Huefinch still works per tab: clicking the toolbar icon (activeTab) applies the filter to that tab until it navigates away. The popup explains how to turn on automatic mode later.
- Handle permission removal (`chrome.permissions.onRemoved`): unregister the scripts and update the UI.

### 4.2 The filter
- Inject one inline `<svg>` containing `<filter id="huefinch-filter">` with an `feColorMatrix type="matrix"` (keep the default `color-interpolation-filters="linearRGB"`, because the matrices below are defined in linear RGB). Apply it with a style element: `html { filter: url(#huefinch-filter) !important; }`.
- Insert the SVG and style as early as possible (`document_start`) to avoid a flash of uncorrected color. Put them in a container attached to `document.documentElement`, and re-attach with a `MutationObserver` if a site removes them.
- **Top-layer content** (modal `<dialog>`, popovers, full-screen elements) isn't covered by the filter on `<html>`. Also apply the filter to `dialog:modal`, `:popover-open`, `:fullscreen` and `::backdrop`. Verify with pixel tests that these elements are filtered **exactly once**, never twice.
- **iframes** are composited inside the parent page, so the top-frame filter already covers them. Run in the top frame only and test that iframe content is filtered once.
- Images, video and canvas are filtered too, since the filter applies to the whole rendered page.
- Measure performance on a heavy fixture page (long scroll, video). Report the results in `REVIEW.md`.

### 4.3 Color maths (use exactly these, so the store screenshots stay accurate)
Simulation matrices, Machado, Oliveira & Fernandes (2009), severity 1.0, linear RGB:
```
protan: [[0.152286, 1.052583,-0.204868],[0.114503, 0.786281, 0.099216],[-0.003882,-0.048116, 1.051998]]
deutan: [[0.367322, 0.860646,-0.227968],[0.280085, 0.672501, 0.047413],[-0.011820, 0.042940, 0.968881]]
tritan: [[1.255528,-0.076749,-0.178779],[-0.078411, 0.930809, 0.147602],[0.004733, 0.691367, 0.303900]]
```
- **Simulate** (severity s, 0–1): `S(s) = (1−s)·I + s·S`.
- **Correct** (strength k, 0–1): `C(k) = I + k·E·(I − S)`, where E (error redistribution, Fidaner et al.) is
  - protan and deutan: `[[0,0,0],[0.7,1,0],[0.7,0,1]]`
  - tritan: `[[1,0,0.7],[0,1,0.7],[0,0,0]]`
- **Unit tests must reproduce these correction matrices at k = 1** (to 4 decimals):
  - deutan: `[[1,0,0],[0.1628,0.7250,0.1122],[0.4547,-0.6454,1.1907]]`
  - protan: `[[1,0,0],[0.4789,0.4769,0.0442],[0.5973,-0.6887,1.0914]]`
  - tritan: `[[0.7412,-0.4072,0.6660],[0.0751,0.5852,0.3397],[0,0,1]]`
- **Default:** Correct mode, Green-weak, strength 80%.

### 4.4 Popup (visual spec: `store-assets/screenshot-2-popup.png` and `screenshot-4-simulate.png`)
- A master on/off toggle.
- A segmented control: "Correct colors" / "Simulate".
- The type options: Red-weak (protan), Green-weak (deutan), Blue-weak (tritan).
- A slider labelled "Strength" in Correct mode or "Severity" in Simulate mode. Changes apply live.
- An "On for this site" toggle (adds or removes the hostname in the off-list).
- Shortcut hints at the bottom.
- In Simulate mode, show a small pill at the top of the page: "Simulating green-blind vision" (or the matching type and severity wording).

### 4.5 Keyboard
- `Alt+Shift+F`: toggle Huefinch on/off (`chrome.commands`, user-changeable). Don't use `Alt+Shift+H`, which Bowerline uses.
- **Hold `Alt+Shift+X`:** show the original colors while held. Handle keydown/keyup in the content script, and restore the filter on blur too.
- `Alt+Shift+C`: identify a color (4.6).

### 4.6 Color identifier (visual spec: `screenshot-3-identify.png`)
- `Alt+Shift+C` (a keydown in the content script counts as a user gesture) opens the browser's `EyeDropper`. **Remove the filter while picking**, so the result is the page's true color, then restore it.
- The popup also has an "Identify a color" button. Because the popup closes, show an in-page overlay "Click anywhere to pick a color"; that click provides the gesture for `EyeDropper.open()`.
- **Show a card** (Shadow DOM, closed) with: a swatch, a **descriptive name** built from HSL (hue family plus modifiers such as "dark", "light", "muted", "bright", for example "Olive green", "Dark muted red"), the nearest CSS named color ("Close to: dark olive"), and the hex value. Copy the hex to the clipboard and say so on the card. Close it on Escape or click-away.
- Unit-test the naming on at least 40 reference colors, including greys, browns, pastels and near-black.

### 4.7 "Find my setting" (options page)
- Show pairs of colors that are commonly confused for each type. The user marks which pairs look alike, Huefinch suggests a type, and a live strength slider lets them tune until the pairs separate.
- Add a clear note: this is a comfort setting, **not a medical test**.

### 4.8 Options page (visual spec: `screenshot-5-settings.png`)
Sections:
- **Color vision:** mode, type, strength.
- **Websites:** the auto-on toggle tied to the permission, and the off-list with remove buttons.
- **Keyboard shortcuts:** a button that opens `chrome://extensions/shortcuts` via `chrome.tabs.create`.
- **Find my setting.**
- **About:** version, privacy link, the Wrenbox line, and credits for the Machado and Fidaner methods.

### 4.9 Toolbar icon state
Use a greyed variant of the icon when Huefinch is off. Generate it from the provided icons at build time with a grayscale filter, saved as files. No canvas at runtime.

## 5. Design system (match `store-assets/`)
- Same Wrenbox tokens as Bowerline: ink `#18214D`, ink-2 `#2C3870`, paper `#F4F6FB`, line `#DCE1EC`, muted `#5D6690`.
- Brand accent: a three-color bar in `#FF6B5B` / `#3CC98A` / `#4C8DFF`.
- System font stack. Radii 10–14 px.
- **Accessibility matters more than usual here:**
  - never use color alone to show state (toggles also show On/Off text to screen readers)
  - WCAG AA contrast
  - full keyboard support and visible focus
  - `prefers-reduced-motion` respected
  - every UI element must stay usable when the filter itself is on

## 6. Tests
- **Unit (Vitest):**
  - the matrix maths (the expected values above)
  - building the 4×5 `feColorMatrix` values string
  - color naming
  - settings migrations
  - hostname handling
- **End-to-end (Playwright, Chromium with `--load-extension`):**
  - **Pixel checks:** on a fixture with pure color blocks, compare screenshot pixels with the expected colors computed by the same maths (sRGB → linear → matrix → sRGB), tolerance ±3.
  - A modal `<dialog>` and a full-screen element are filtered exactly once.
  - An iframe is filtered exactly once.
  - Holding `Alt+Shift+X` restores the original pixels.
  - The per-site off-list works.
  - The decline-permission path works through activeTab.
  - The identifier: mock `EyeDropper` and check the card text.

## 7. Store paperwork: write `CHROMEWEBSTORE.md`
- **Title:** `Huefinch – Color Blind Filter & Color Identifier`
- **Summary (124 characters):** `Helps color-blind eyes tell colors apart on any website and names any color on screen. Private: nothing leaves your browser.`
- **Category:** Accessibility.
- **Description:** open with the bird story in one sentence. Then cover the features, who it helps, a FAQ (including "Is this a medical test? No"), and the credits for the methods. Make no medical claims.
- **Single purpose:** the text from section 2.
- **One justification per permission.**
- **Remote code:** No.
- **Data use:** none collected. Verify the current form wording.
- **Privacy policy URL:** `https://wrenbox.github.io/<repo-name>/huefinch/privacy`
- **Screenshots in order:** before/after, popup, identify, simulate, settings.

## 8. Privacy policy (`/docs/huefinch/privacy.md`)
Plain language covering:
- Huefinch stores only its settings and a list of hostnames where it's switched off, in this browser.
- It never reads, stores or sends page content.
- It makes no network requests.
- What each permission is for.
- How to delete everything (remove the extension).
- A contact address placeholder and the effective date.

## 9. Quality loop (do not skip)
1. Run `verify` (typecheck, lint, unit, e2e, network audit, permission audit, zip). Fix until fully green.
2. Re-read this prompt section by section, record any gaps in `REVIEW.md`, fix them and tick them off.
3. Capture each screen at 1280×800 and compare with the matching `store-assets` PNG. Match layout and wording, or note intentional differences.
4. Test manually-style on 10 fixture pages (article, dashboard, dialog, video, iframe, dark-themed site, SPA): no double filtering, no flash of uncorrected color, no console errors.
5. Repeat until nothing is left. Then build `release/huefinch-<version>.zip`, write the owner's manual test checklist in `README.md` (Load unpacked steps first), and also produce `release/huefinch-<version>-edge.zip` for the Microsoft Edge Add-ons store, the same build with any manifest differences Edge needs.

## 10. Out of scope for v1
Paid features, accounts, sync, any network use, per-site profiles, pattern overlays, mobile.
