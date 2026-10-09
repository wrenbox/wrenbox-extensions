# Changelog

All notable changes to Bowerline are recorded here. Versions follow [Semantic Versioning](https://semver.org/).

## 1.0.2 (2026-10-09)

### Added

- **Microsoft Edge.** Each release now includes `bowerline-<version>-edge.zip` for Edge Add-ons, built from the same code, and the full end-to-end suite runs in real Microsoft Edge in CI. In Edge, Bowerline says "Edge" wherever it would say "Chrome", points to `edge://extensions`, and explains that Edge doesn't let extensions run on its own pages or on the Edge Add-ons store. See [EDGE.md](https://github.com/wrenbox/wrenbox-extensions/blob/main/extensions/bowerline/EDGE.md) for publishing.
- **A one-time rating request.** After at least three days and ten highlights, the toolbar popup asks once, while Bowerline is working on the page, whether you'd rate it in the store you installed it from (Chrome Web Store or Edge Add-ons). "No thanks" or "Rate Bowerline" closes it for good. Everything is decided locally; the store page opens only if you click. Settings → About also has a quiet "Rate Bowerline" link.

### Changed

- The privacy policy covers both browsers and mentions the rating request's one local reminder.

## 1.0.1 (2026-10-04)

### Fixed

- PDF highlights and copied text that wrap onto the next line no longer lose the space between the lines ("seven days,compared" is now "seven days, compared").
- A note card that doesn't fit in the right margin now opens below the line instead of covering the highlighted text.
- The export dialog fits short windows: the preview shrinks so Copy and Download stay on screen.

### Added

- `npm run store-screenshots` generates the five Chrome Web Store screenshots from the real extension.

## 1.0.0 (2026-10-03)

First release.

### Web highlighting

- Selection toolbar (four colours, Add note, Copy) in a closed Shadow DOM root, placed above the selection and flipped below when there's no room.
- Click a highlight to change its colour, edit its note, copy or delete it (with undo).
- Note markers at the end of noted highlights; hover or focus to read the note.
- Rendering with the CSS Custom Highlight API: the page's DOM and CSS are never modified.
- Anchoring with W3C TextQuote and TextPosition selectors, falling back to a fuzzy match; unfound highlights are marked "not found", never deleted.
- Dynamic pages: debounced MutationObserver, URL-change detection (polling plus `popstate`) and a 30-second retry window.
- No highlighting inside inputs, textareas or contenteditable areas; a notice on canvas-rendered pages such as Google Docs.
- URL normalisation that drops fragments and tracking parameters.

### Activation

- Runs on a tab only after a user action: toolbar popup, Alt+Shift+H, or "Highlight with Bowerline" in the context menu (activeTab).
- Optional "Always on" mode using a registered content script, kept in sync with granted permissions.
- Plain explanations on pages where extensions can't run, and "Open this PDF in Bowerline" for PDFs.

### PDF viewer

- pdf.js viewer with text-layer selection, overlay highlights that follow zoom, margin note cards, page thumbnails with highlight dots.
- Open from your computer (picker or drag and drop), from the current tab, or from a PDF link's context menu; per-site permission request and download fallback when a site blocks access.
- Highlights keyed by PDF fingerprint; keyboard shortcuts H, N, +/−, arrows, Page Up/Down.
- Password-protected PDFs; a bundled sample PDF.

### Library, export and settings

- Side panel with "This page" and "Library" tabs, accent-insensitive search, colour filters, inline note editing, delete with undo, and a "Not found on this page" section. Full-page library.
- Export to Obsidian, Markdown, Notion, CSV (RFC 4180, UTF-8 BOM) and a versioned JSON backup, for this page, the whole library or chosen sources. Download or copy.
- Restore from backup with validation, merge by id and a report.
- Settings: default colour, toolbar on/off, theme, colour labels, data counts, Always on, backup/restore, Delete all, shortcut, About.
- Onboarding page with a live demo.

### Quality

- Strict TypeScript, unminified bundles, unit tests (anchoring, URLs, exporters with golden files, backup, migrations) and end-to-end tests in Chromium.
- Network and permission audits, and a reproducible release zip.
