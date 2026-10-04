# Bowerline – PDF & Web Highlighter

_Pronounced BOW-er-line ("bower" rhymes with "flower")._

Bowerbirds collect colourful treasures and arrange them in their bower. Bowerline keeps the lines you collect while reading, in colour, in one place.

Highlight and annotate text on web pages and PDFs, and keep those highlights privately in your browser. For students, researchers and writers. No account, nothing leaves the browser, PDF highlights tied to the file itself, and Obsidian/Notion/Markdown export for free.

Made by Wrenbox: small, private tools for your browser.

---

## Manual test checklist (for the owner)

1. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and select `extensions/bowerline/dist` (run `npm ci && npm run build` first if `dist/` is missing).
2. **Onboarding** opens in a new tab. Select words in the demo paragraph, pick a colour, click the highlight and add a note. Hover the note marker. Nothing is saved (the library stays empty).
3. Open a long article (e.g. a Wikipedia page). Click the Bowerline icon: the popup says **Active on this page**. Select text: the navy toolbar appears above the selection (below it if the selection is at the top of the window). Highlight in each of the four colours.
4. Click a highlight: change its colour, add a note, copy, delete, then click **Undo** in the toast.
5. Reload the page and press **Alt+Shift+H**: highlights come back. Select text and press **Alt+Shift+H** again: it is highlighted in the default colour.
6. Right-click a selection → **Highlight with Bowerline**.
7. Try a dynamic site (e.g. a Reddit thread): highlight a comment, reload, activate before the comments load. The highlight appears once the comment does. Navigate to another thread and back.
8. Popup → **Open side panel**. Check **This page** and **Library**, search (try a word without its accents), filter by colour, edit a note inline, delete with undo, click a card to jump to the passage.
9. Popup → **Open a PDF from your computer**: open any PDF, select text, press **H**; select more text and press **N** to add a note (the note card appears in the right margin). Zoom with **+**/**−**: highlights stay aligned. Close the tab, open the same file again (or a renamed copy): highlights are restored.
10. Open a PDF link in a tab (Chrome's viewer), click the Bowerline icon: the popup offers **Open this PDF in Bowerline**. Also right-click a link ending in `.pdf` → **Open in Bowerline PDF viewer**. If the site blocks it, the viewer offers **Allow Bowerline to open this PDF** and the download fallback.
11. Open `chrome://settings` and click the icon: the popup explains why Bowerline can't run there.
12. **Export** (side panel or library): try every format, every scope, **Copy** and **Download**. Open the CSV in Excel/Sheets (accents and quotes intact). Paste the Notion export into Notion.
13. Settings → **Your data**: counts are right; **Back up now** saves a file; **Delete all** (type DELETE) empties the library; **Restore** brings everything back and reports what was added and skipped.
14. Settings → turn on **Show my highlights automatically**: Chrome asks for permission. Revisit a highlighted page: highlights appear without clicking. Turn it off (or revoke site access at `chrome://extensions`): the toggle updates and pages no longer load Bowerline.
15. Settings → **Colours and labels**: name a colour ("key idea"); the name appears in toolbar tooltips, the library and exports. Switch the theme to Dark.
16. Keyboard only: Tab through the popup, side panel, library and settings; focus rings are visible everywhere.

---

## FAQ

**Is my data sent anywhere?** No. Highlights, notes and settings are stored in this browser only (IndexedDB owned by the service worker, plus `chrome.storage.local`). The only network request Bowerline ever makes is downloading a PDF you chose to open, from that PDF's own address. `npm run audit:network` enforces this on every build.

**Why doesn't Bowerline run until I click it?** It asks for no website access at install. Clicking the icon, pressing Alt+Shift+H or using the right-click menu gives it temporary access to that one tab (`activeTab`). Turn on "Always on" in Settings if you'd rather see highlights automatically.

**Does it work inside iframes?** Not in v1. Bowerline highlights the main page only; text inside embedded frames (some comment widgets, embedded documents) can't be highlighted yet.

**Does it work on Google Docs?** No. Google Docs draws text on a canvas, so there is no selectable text; Bowerline shows a short notice there instead.

**Why can't it highlight in Chrome's own PDF viewer?** Chrome doesn't let extensions change it. Bowerline opens the PDF in its own viewer instead, and your highlights belong to the file's fingerprint, so they follow the file wherever it is.

**What happens if a page changes?** Bowerline re-finds each highlight from its exact text plus surrounding context, then the position, then a fuzzy match. If the passage is truly gone, the highlight is kept and listed under "Not found on this page". It is never deleted.

**Which URL parameters are ignored?** The fragment (`#…`, except hash routes like `#/notes/1`) and tracking parameters: `utm_*`, `fbclid`, `gclid`, `mc_eid`, plus `mc_cid`, `dclid`, `gbraid`, `wbraid`, `msclkid`, `igshid`, `yclid`, `_hsenc`, `_hsmi`. Other query parameters are kept.

**Obsidian callouts look plain.** `[!highlight-yellow]` and friends are custom callout types. Add a CSS snippet in Obsidian if you want colours, e.g. `.callout[data-callout="highlight-yellow"] { --callout-color: 255, 216, 74; }`.

---

## Roadmap

- **Phase 2: "Download PDF with highlights"**: flatten highlights and notes into a copy of the PDF with `pdf-lib`. Not in v1.
- Highlighting inside same-origin iframes.
- A one-time Pro licence may come later. Everything in v1 is free, with no licence checks.

Out of scope for v1: accounts, cloud sync, AI features, paid features, iframes, Google Docs, flattened PDF export, browsers other than Chrome.

---

## Releasing

Releases are built by GitHub Actions, never by hand, so every zip on the [Releases page](https://github.com/wrenbox/wrenbox-extensions/releases) comes from a commit on `main` that passed the full suite.

1. Bump `version` in `package.json` (run `npm install` so the lockfile matches).
2. Add a `## <version> (<date>)` section at the top of `CHANGELOG.md`. It becomes the release notes.
3. Merge to `main`.

The **Bowerline** workflow (`.github/workflows/bowerline.yml`) then runs `npm run verify` (typecheck, lint, unit tests, build, audits, e2e, zip). If it passes and that version has no release yet, it creates the tag `bowerline-v<version>` on that commit and publishes the GitHub Release **Bowerline <version>**, with `bowerline-<version>.zip` attached and its SHA-256 in the notes. Pushes that don't change the version are verified but publish nothing. Download the zip from the release and upload it to the Chrome Web Store.

Tags carry the extension's name (`bowerline-v…`) because this repository will hold several extensions. Pull requests run the same checks, and every run keeps the built zip as a downloadable artifact for 7 days. `release/` stays out of git.

## Development

Requires Node 20+ (the pinned pdf.js declares Node ≥ 22.13 for its _Node_ entry points; Bowerline only bundles it for the browser, so Node 20 works with an engine warning) and Chromium for end-to-end tests (Playwright's bundled Chromium, or set `PLAYWRIGHT_BROWSERS_PATH`).

```sh
npm ci
npm run dev          # watch build into dist/ (with source maps)
npm run build        # production build into dist/ (unminified, no source maps)
npm run typecheck    # tsc, strict
npm run lint         # ESLint + Prettier check
npm test             # unit tests (Vitest + jsdom)
npm run test:e2e     # end-to-end tests (Playwright + Chromium with the extension loaded)
npm run audit:network
npm run audit:permissions
npm run zip          # release/bowerline-<version>.zip
npm run verify       # all of the above, in order
npm run screens      # capture every screen at 1280×800 into tests/output/screens/ (for review)
npm run store-screenshots  # the five framed Chrome Web Store screenshots → store-assets/captured/
npm run video        # the 45 s promo video with soundtrack, recorded from dist/ → store-assets/video/
                     # (needs ffmpeg and: pip install -r tools/demo-video/requirements.txt)
```

Golden files for the exporters live in `tests/fixtures/golden/`; regenerate with `UPDATE_GOLDEN=1 npm test` and review the diff.

### How the end-to-end tests get permissions

Chrome's permission prompts can't be clicked in headless Chromium. The tests write the granted origins into the test profile's `Preferences` (what Chrome itself records after the user accepts a prompt or clicks the toolbar icon), then call the same `activateTab` code path a click would. The shipped `dist/` is tested unmodified.

### Architecture

```
src/
  background/   service worker: owns IndexedDB (idb + migrations), message router,
                activation (activeTab + scripting), context menus, shortcut,
                Always-on registration, tab registry, PDF tab fallback
  content/      content script (IIFE, < 60 KB): anchoring, CSS Custom Highlight
                rendering, closed-shadow-root toolbar / note editor / markers,
                MutationObserver + URL watching
  viewer/       pdf.js viewer: loader (the only network code), overlay
                highlights, margin notes, thumbnails, shortcuts
  sidepanel/    "This page" and "Library" tabs
  library/      full-page library
  options/      settings
  onboarding/   three-step welcome page with a live demo
  popup/        toolbar popup
  shared/       types, anchoring (TextQuote/TextPosition selectors + fuzzy
                match), URL normalisation, exporters, backup, settings, UI kit
```

Key decisions:

- **Highlights never touch the page DOM.** They are `Range`s registered with `CSS.highlights`; colours come from an injected stylesheet containing only `::highlight(bowerline-*)` rules. The toolbar, note editor, markers and toasts live in one closed Shadow DOM root with adopted (constructed) stylesheets.
- **One database owner.** Content scripts run in the site's origin, so they never use IndexedDB or `localStorage`; all reads and writes go to the service worker by message.
- **Anchoring** uses W3C Web Annotation selectors over whitespace-normalised text: exact quote with 32-character context, then position, then a bit-parallel fuzzy search (`approx-string-match`) at ≥ 80% similarity. Restores yield to the page every ~8 ms of work, so they never cause long tasks (verified with 200 highlights).
- **PDF identity** is `pdfDocument.fingerprints[0]`. Rectangles are stored in PDF units at scale 1 and multiplied by the current zoom when drawn.
- **Network lockdown.** Every extension page carries a CSP meta tag limiting `connect-src` to the extension itself; the viewer sets its own at runtime to the extension plus the opened PDF's origin.

### Dependencies

Runtime: `pdfjs-dist` (Apache-2.0), `idb` (ISC), `approx-string-match` (MIT). Licences are in `licenses/` and shipped in the extension (Settings → About → Third-party licences).
