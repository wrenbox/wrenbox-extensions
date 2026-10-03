# Build prompt: Bowerline – PDF & Web Highlighter (Chrome extension, Manifest V3)

Paste everything below into Claude Code from the root of the GitHub repository.

---

You are the lead engineer at **Wrenbox**, a studio that makes small, private, high-quality Chrome extensions. Build the first one, **Bowerline – PDF & Web Highlighter**, completely, then review and improve it until it meets every requirement below. Work autonomously. Only stop to ask me if you are blocked on something only the owner can do (accounts, payments, publishing).

## 0. The studio
- **Studio name:** Wrenbox. The wren is one of the smallest birds with one of the loudest songs: small tools, big impact. Every Wrenbox extension is named after a bird whose behaviour matches what the tool does.
- **Publisher name** on every listing: `Wrenbox`. The repo lives in the `wrenbox` GitHub organisation.
- In each extension's About screen and store description, add one line: "Made by Wrenbox: small, private tools for your browser."
- **This extension's story** (use it in the onboarding page and store description): bowerbirds collect colourful treasures and arrange them in their bower. Bowerline keeps the lines you collect while reading, in colour, in one place. The name is pronounced BOW-er-line ("bower" rhymes with "flower").

## 1. Repository layout

This repo will hold many extensions, each in its own self-contained folder. Create this structure (add to it if parts already exist):

```
/README.md                      ← Wrenbox: index of all extensions in this repo
/docs/bowerline/privacy.md       ← privacy policy, served by GitHub Pages from /docs
/extensions/bowerline/           ← EVERYTHING for this extension lives here
  package.json  tsconfig.json  vite.config.ts (or esbuild script)
  src/
    background/   content/   popup/   sidepanel/   viewer/   library/
    options/      onboarding/   shared/
  public/icons/   icon-16.png icon-32.png icon-48.png icon-128.png   (provided)
  store-assets/   store-icon-128.png, promo tiles, 5 screenshots     (provided)
  tests/unit/  tests/e2e/  tests/fixtures/
  licenses/     third-party licences (pdf.js etc.)
  CHROMEWEBSTORE.md  CHANGELOG.md  README.md  REVIEW.md
  dist/  release/   (both gitignored)
```

Rules: this extension has its own `package.json` and never imports from another extension's folder. The provided images in `public/icons/` and `store-assets/` are already final. Do not regenerate them.

## 2. The product

- **Manifest name and store title:** `Bowerline – PDF & Web Highlighter`. **short_name:** `Bowerline`.
- **Single purpose (use this wording in the store form):** "Highlight and annotate text on web pages and PDFs, and keep those highlights privately in the user's browser."
- **Who it's for:** students, researchers and writers.
- **Active competitor to beat:** an extension titled "PDF & Web Highlighter" by Web Highlights claims 200,000+ users and sells sync and backups. Position Bowerline against it: no account, nothing leaves the browser, PDF highlights tied to the file itself, Obsidian/Notion export free. Never mention competitors by name in the listing.
- **Why it exists:** a popular highlighter with 200,000 users has been abandoned since February 2024. Its reviews say highlights stop saving, PDF highlighting breaks, highlights fail on dynamic sites like Reddit, and it depends on a cloud account. Bowerline fixes each of these: local-first storage, a reliable PDF viewer, robust text anchoring, and no account.

## 3. Non-negotiable rules (store approval and user trust)

1. **Zero data leaves the browser.** No analytics, telemetry, error reporting, remote fonts, CDNs or servers of any kind. The only network request allowed is fetching a PDF the user explicitly chose to open, from that PDF's own URL. Add an automated audit that scans the built bundle for `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon` and `EventSource` and fails unless the only use is the PDF loader.
2. **No remote code.** Everything is bundled, including pdf.js and its worker. No `eval`, no `new Function`, no remotely loaded scripts. Keep the default extension CSP.
3. **Readable code.** TypeScript, built **without minification** so reviewers can read it. Keep source maps out of the release zip.
4. **Minimal permissions, exactly these:** `storage`, `unlimitedStorage`, `activeTab`, `scripting`, `contextMenus`, `sidePanel`, plus `optional_host_permissions: ["https://*/*", "http://*/*"]`. Do **not** add `tabs`, `downloads`, `webRequest`, `declarativeNetRequest` or any required host permission. If you believe another permission is essential, justify it in `CHROMEWEBSTORE.md` first and choose an alternative if one exists.
5. **Settings use `chrome.storage.local`, never `chrome.storage.sync`.** Sync sends data to Google's servers, which would break our privacy promise.
6. **Content scripts never store data in the page's own storage.** Content scripts run in the website's origin, so their IndexedDB belongs to the site. All persistence goes through messages to the service worker, which owns the database.
7. **Never break the host page.** Render web highlights with the **CSS Custom Highlight API** (`CSS.highlights`), which doesn't modify the page's DOM. Put every piece of injected UI inside a closed Shadow DOM root with scoped styles. Never change the page's global CSS.
8. **No paywall, licence check or upgrade prompt in v1.** Everything is free. A one-time Pro licence may come later; don't build any of it now.

## 4. How it works

### 4.1 Activation model (keeps the store review light)
- **Default, with no host permissions:** Bowerline runs on a tab only after a user action: clicking the toolbar icon (popup), the keyboard shortcut `Alt+Shift+H` (`chrome.commands`, user-changeable), or the context-menu item "Highlight with Bowerline". Each grants `activeTab`. Inject the content script with `chrome.scripting.executeScript`, restore that page's saved highlights, and if text is selected, highlight it immediately in the default colour.
- **"Always on" (opt-in):** the toggle "Show my highlights automatically when I revisit a page" (onboarding and settings) calls `chrome.permissions.request` for the optional origins. If granted, register the content script with `chrome.scripting.registerContentScripts` (`persistAcrossSessions: true`, `runAt: "document_idle"`). If revoked in settings or at `chrome://extensions` (`chrome.permissions.onRemoved`), unregister it and update the toggle.
- **Restricted pages** (`chrome://`, the Chrome Web Store, other extensions, Chrome's built-in PDF viewer): the popup explains plainly why Bowerline can't run there, and for PDFs offers "Open this PDF in Bowerline".

### 4.2 Popup
Shows: whether Bowerline is active on this tab, the default colour, and these actions: "Highlight this page", "Open side panel", "Open a PDF from your computer", "Open this PDF in Bowerline" (only when the tab looks like a PDF), "Settings".

### 4.3 Web highlighting (visual spec: `store-assets/screenshot-1-web-highlighting.png`)
- A selection toolbar (navy pill, Shadow DOM) appears **above** the selection after a mouse or keyboard selection: four colour swatches (yellow, mint, pink, sky), "Add note", "Copy". It must never cover the selected text. Flip below the selection when there's no room above.
- Clicking an existing highlight (hit-test with `document.caretPositionFromPoint` against stored ranges) opens an edit toolbar: change colour, edit note, copy, delete.
- A highlight with a note gets a small marker at its end. Hovering the marker shows the note card.
- **Anchoring** uses W3C Web Annotation selectors: a `TextQuoteSelector` (exact text, 32-character prefix and suffix) plus a `TextPositionSelector` over whitespace-normalised page text. To restore: exact match with context, then position hint, then fuzzy match (bitap or the MIT `approx-string-match` package) above a confidence threshold. If nothing matches, mark the highlight **orphaned**. Never delete it.
- **Dynamic pages:** debounced `MutationObserver` (500 ms) and URL-change detection (poll `location.href` each second plus `popstate`). Retry orphaned highlights as content appears, for up to 30 seconds.
- Don't highlight inside inputs, textareas or contenteditable areas. On canvas-rendered apps such as Google Docs, show a short notice that the page doesn't expose selectable text.
- **URL normalisation:** strip the hash and tracking parameters (`utm_*`, `fbclid`, `gclid`, `mc_eid`); keep other query parameters.
- iframes are out of scope for v1. Say so in the README FAQ.

### 4.4 PDF viewer (visual spec: `store-assets/screenshot-2-pdf-highlighting.png`)
- `viewer.html` built on `pdfjs-dist` (Apache-2.0; copy its licence into `licenses/`). It uses the text layer for selection and draws highlights as overlay rectangles that re-render correctly at every zoom level.
- **Ways to open a PDF:**
  1. Popup → "Open a PDF from your computer": the viewer offers a file picker and drag-and-drop. No permission needed.
  2. Popup → "Open this PDF in Bowerline" when the active tab is a PDF: open `viewer.html?src=<url>` and fetch it using the `activeTab` grant.
  3. Context menu on links ending in `.pdf` → "Open in Bowerline PDF viewer": open the viewer, and if access is missing, show a button "Allow Bowerline to open this PDF" that requests `https://<that-origin>/*` only (the click is the user gesture).
  - If a fetch fails because of CORS or permissions, explain it and offer: "Download the PDF, then open the file here."
- **Identity:** key PDF highlights by `pdfDocument.fingerprints[0]`, so the same file shows the same highlights wherever it's opened from. Also store the file name, URL and title for display.
- **Layout:** top bar (file name, "Page X of Y", zoom, colour swatches, Export), thumbnail rail on the left, note cards in the right margin.
- **Shortcuts:** arrow keys and Page Up/Down, `+`/`-` zoom, `H` highlight the selection, `N` add a note.
- **Phase 2, not v1:** "Download PDF with highlights" (flatten with `pdf-lib`). Record it in the README roadmap.

### 4.5 Side panel (visual spec: `store-assets/screenshot-3-library-search.png`)
- Two tabs, "This page" and "Library". Search is case- and accent-insensitive across highlight text and notes. Colour filter chips. Results grouped by source, labelled Web or PDF.
- Clicking a card focuses that source and scrolls to the highlight (message the content script or the viewer).
- A section "Not found on this page" lists orphaned highlights.
- Inline note editing. Deleting shows an "Undo" option for 5 seconds.
- The library is also a full page, `library.html`.

### 4.6 Export and backup (visual spec: `store-assets/screenshot-4-export.png`)
- **Scope:** this page, whole library, or chosen sources.
- **Formats:**
  - **Obsidian:** YAML front matter plus callouts such as `> [!highlight-yellow]`, with page numbers for PDFs.
  - **Markdown:** clean notes for any app.
  - **Notion:** paste-friendly Markdown, using quote blocks with the note in bold.
  - **CSV:** RFC 4180, UTF-8 with BOM so Excel opens it correctly.
  - **Backup file:** versioned JSON containing everything.
- Download via a Blob and `<a download>` from an extension page (no `downloads` permission). Also offer "Copy".
- **Restore from backup:** validate the schema, merge by id, report what was added and skipped.

### 4.7 Settings (visual spec: `store-assets/screenshot-5-privacy.png`)
- **General:** default colour, show selection toolbar on or off, theme (system, light, dark).
- **Colours and labels:** rename colours (for example "Yellow: key idea"). Labels appear in tooltips and exports.
- **Your data:** highlight and source counts, "0 servers your data is sent to", the Always-on toggle, "Back up now", "Restore", "Delete all" (confirm by typing DELETE).
- **Keyboard shortcuts:** show the current shortcut. A button opens `chrome://extensions/shortcuts` via `chrome.tabs.create`.
- **About:** version, privacy policy link, licences.

### 4.8 Onboarding (opens on install)
One page, three short steps:
1. Try highlighting a demo paragraph on the onboarding page itself. This works without any permission.
2. Open a PDF.
3. Optionally turn on Always on, with a plain explanation of Chrome's permission prompt.

## 5. Data model
IndexedDB database `bowerline`, owned by the service worker, accessed with `idb` (MIT). Build a migration framework from day one.
- `sources`: `{ id (uuid), kind: 'web' | 'pdf', key (normalised URL or PDF fingerprint), url, title, fileName?, createdAt, updatedAt }`, indexed by `key`.
- `highlights`: `{ id, sourceId, color: 'yellow' | 'mint' | 'pink' | 'sky', text, note, selectors, pdf?: { page, rects/offsets }, orphaned, createdAt, updatedAt }`, indexed by `sourceId`.

## 6. Design system (match `store-assets/`)
- **Colours:** ink `#18214D`, ink-2 `#2C3870`, paper `#F4F6FB`, line `#DCE1EC`, muted `#5D6690`.
- **Highlights:** yellow `rgba(255,225,77,.78)`, mint `rgba(142,240,198,.85)`, pink `rgba(255,169,216,.85)`, sky `rgba(156,220,255,.9)`. Create matching dark-theme values.
- **UI font:** the system stack (`system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`). The Bowerline wordmark is an inline SVG.
- **Radii:** 10–12 px for cards and inputs, 16 px for dialogs. The toolbar is a navy pill.
- **Accessibility:** WCAG AA contrast, visible focus rings, full keyboard operation, ARIA labels, `prefers-reduced-motion` respected. Always show the colour's name or label in text or tooltip, never colour alone.
- The screenshots are the visual spec. Match their layout and wording. Where you deliberately differ, record it in `REVIEW.md`. The owner will re-capture real screenshots before publishing.

## 7. Tech stack and scripts
- TypeScript in strict mode. Vite with multiple entry points, or a plain esbuild script. No heavy UI framework; Preact is acceptable only if it keeps bundles small.
- **Dependencies limited to:** `pdfjs-dist`, `idb`, `approx-string-match` (optional), plus dev tooling. Commit the lockfile. Node 20+.
- **npm scripts:**
  - `dev`: watch build into `dist/`
  - `build`
  - `typecheck`
  - `lint`: ESLint and Prettier
  - `test`: unit tests
  - `test:e2e`
  - `audit:network` and `audit:permissions`
  - `zip`: `release/bowerline-<version>.zip` with `manifest.json` at the zip root and no source maps
  - `verify`: runs all of the above

## 8. Tests
- **Unit (Vitest + jsdom):**
  - Anchoring: exact match, moved text, changed whitespace, duplicate passages disambiguated by context, fuzzy match, orphaning.
  - URL normalisation.
  - Every exporter, using golden files.
  - Backup import and merge.
  - Database migrations.
- **End-to-end (Playwright, Chromium launched with `--load-extension`):**
  - Highlight on a local fixture article, reload, confirm it's restored.
  - SPA fixture whose content loads late.
  - Add and edit a note.
  - Side panel search.
  - Exported Markdown content.
  - Generate a small PDF fixture, highlight it, reopen it, confirm restore by fingerprint.
  - Always-on permission flow.
  - Restricted-page message.

## 9. Store paperwork: write `CHROMEWEBSTORE.md`
- **Title:** `Bowerline – PDF & Web Highlighter`
- **Short description (130 characters):** `Highlight web pages and PDFs, add notes, export to Obsidian, Notion or Markdown. Private: no account, nothing leaves your browser.`
- **Detailed description:** natural, keyword-rich (PDF highlighter, web highlighter, annotate, notes, research, study, export), with a short FAQ and honest limits (Google Docs, iframes). Open with the bowerbird story in one sentence.
- **Category:** Workflow & Planning. Verify the current category names first.
- **Single purpose statement:** the text from section 2.
- **One justification per permission.**
- **Remote code:** No.
- **Data-use disclosures:** check Chrome's current definitions before choosing answers. Data is stored only on the device; answer accurately and conservatively, and make the privacy policy match exactly.
- **Privacy policy URL:** `https://wrenbox.github.io/<repo-name>/bowerline/privacy`
- **Screenshots:** list the five files in order, each with its caption.
- **Developer account notes:** register as a non-trader while the extension is free; switch to trader before adding any paid features.

## 10. Privacy policy (`/docs/bowerline/privacy.md`)
Plain language covering:
- What is stored, and where (this browser only).
- That nothing is transmitted.
- That a PDF is fetched only from its own URL when the user opens it.
- What each permission is for.
- How to delete everything.
- A contact email placeholder.
- The effective date.

## 11. Quality loop (do not skip)
1. Run `verify`. Fix every failure until it is fully green.
2. Re-read this prompt section by section and check the build against it. Write any gaps in `REVIEW.md`, fix them, and tick them off.
3. Capture every screen at 1280×800 with Playwright and compare it with the matching `store-assets` PNG. Fix spacing, wording and states.
4. Audit:
   - Permissions are exactly as listed.
   - No network calls other than the PDF fetch.
   - No `eval`.
   - No console errors across the fixture pages.
   - The content script is under 60 KB.
   - Restoring 200 highlights causes no task longer than 50 ms.
5. Repeat steps 1–4 until nothing is left to fix.
6. Then build the release zip and write a short manual test checklist in `README.md` for the owner. Start it with: open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, select `extensions/bowerline/dist`.

## 12. Out of scope for v1
Accounts, cloud sync, AI features, paid features, iframes, Google Docs support, flattened PDF export, and browsers other than Chrome.
