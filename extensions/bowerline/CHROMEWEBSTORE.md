# Chrome Web Store listing: Bowerline

Everything needed to fill in the Chrome Web Store Developer Dashboard, field by field. Publisher: **Wrenbox**.

## Package

- Upload: `release/bowerline-1.0.0.zip` (built by `npm run zip`; `manifest.json` at the zip root, no source maps).
- Code is bundled and **not minified**, so reviewers can read it directly.

## Store listing tab

**Title**

```
Bowerline – PDF & Web Highlighter
```

**Short description** (130 characters; the manifest `description` is identical)

```
Highlight web pages and PDFs, add notes, export to Obsidian, Notion or Markdown. Private: no account, nothing leaves your browser.
```

**Category:** Productivity → **Workflow & Planning**. Verified on 3 October 2026 against the live store, where the category page is titled "Workflow & Planning" (`chromewebstore.google.com/category/extensions/productivity/workflow`).

**Language:** English (United Kingdom). (Owner: pick "English" if UK English isn't offered.)

**Detailed description**

```
Bowerbirds collect colourful treasures and arrange them in their bower; Bowerline keeps the lines you collect while reading, in colour, in one place.

Bowerline is a PDF highlighter and web highlighter for students, researchers and writers. Highlight text on any web page or PDF in four colours, add notes, and find every highlight again in one searchable library. There is no account to create, and nothing you highlight ever leaves your browser.

HIGHLIGHT ANY WEB PAGE
• Select text and a small toolbar appears: pick yellow, mint, pink or sky, add a note, or copy.
• Your highlights come back every time you return to the page.
• Robust text anchoring finds your highlight again even when the page changes a little, re-renders, or loads its content late (great for Reddit, news sites and other dynamic pages).
• If a passage really is gone, the highlight is kept safe and listed as "Not found on this page". Nothing is ever silently deleted.
• Bowerline never changes the page: highlights are drawn by the browser itself, and the toolbar is isolated from the site.

HIGHLIGHT AND ANNOTATE PDFS
• Open PDFs from the web or from your computer in Bowerline's built-in PDF viewer (powered by pdf.js).
• Highlights are tied to the PDF file itself, not its address: open the same file from your downloads, an email or a website and your highlights are there.
• Notes appear in the margin next to the passage. Page thumbnails show where your highlights are.
• Keyboard shortcuts: H to highlight, N to add a note, + and − to zoom, arrow keys to change page.

ONE SEARCHABLE LIBRARY
• Search all your highlights and notes across web pages and PDFs (case- and accent-insensitive).
• Filter by colour, see results grouped by page, and jump straight back to the passage.
• Give colours a meaning, such as "Yellow: key idea" or "Pink: question".
• Edit notes inline; deleted something by mistake? Undo.

EXPORT TO OBSIDIAN, NOTION OR MARKDOWN, FREE
• Obsidian: Markdown with YAML front matter, callouts and page numbers.
• Notion: paste straight into a page.
• Markdown: clean notes for any app.
• CSV: open in Sheets or Excel.
• Backup file: restore everything later, on any computer.
Export one page, your whole library or the sources you choose.

PRIVATE BY DESIGN
• No account, no sign-up, no subscription.
• No analytics, no tracking, no ads, no servers: your highlights and notes are stored only in this browser.
• Bowerline runs on a page only when you ask (click the icon, press Alt+Shift+H, or right-click). If you like, turn on "Always on" to see your highlights automatically when you revisit a page.
• Back up to a file whenever you want, and delete everything with one button.

FAQ
Is it really free? Yes. Everything described here is free.
Do I need an account? No. There is no Bowerline account or server.
Where are my highlights stored? In your browser's own storage on your computer. Back them up to a file from Settings.
Does it work in Chrome's built-in PDF viewer? Chrome doesn't let extensions change its viewer, so Bowerline opens the PDF in its own viewer with one click.
Does it work on Google Docs? Not yet. Google Docs draws its text on a canvas, so there is no selectable text to highlight.
Does it work inside embedded frames? Not in version 1. Bowerline highlights the main page; text inside iframes isn't supported yet.
Why does "Always on" ask for permission to read all websites? That is Chrome's standard wording for any extension that runs on the pages you visit. Bowerline uses it only to show your saved highlights, and it is completely optional.

Made by Wrenbox: small, private tools for your browser.
```

(Search terms covered naturally: PDF highlighter, web highlighter, highlight, annotate, notes, research, study, students, export, Obsidian, Notion, Markdown, CSV, library. Competitors are not named.)

## Graphic assets

| Slot                          | File                                      |
| ----------------------------- | ----------------------------------------- |
| Store icon (128×128)          | `store-assets/store-icon-128.png`         |
| Small promo tile (440×280)    | `store-assets/promo-small-440x280.png`    |
| Marquee promo tile (1400×560) | `store-assets/promo-marquee-1400x560.png` |

**Screenshots (1280×800), in this order:**

1. `store-assets/screenshot-1-web-highlighting.png`: "Highlight any web page in four colours. Select text, pick a colour, add a note. Your highlights come back every time you return."
2. `store-assets/screenshot-2-pdf-highlighting.png`: "Highlight PDFs, including files on your computer. Highlights stay with the file, even if you move it."
3. `store-assets/screenshot-3-library-search.png`: "Every highlight in one searchable library. Search across web pages and PDFs, filter by colour, and jump straight back to the passage."
4. `store-assets/screenshot-4-export.png`: "Export to Obsidian, Notion or Markdown, for one page or your whole library."
5. `store-assets/screenshot-5-privacy.png`: "Private by design: no account, no tracking. Your highlights never leave your browser."

The owner will re-capture real screenshots before publishing; `npm run screens` captures every screen at 1280×800 into `tests/output/screens/` as a starting point.

## Privacy practices tab

**Single purpose description**

```
Highlight and annotate text on web pages and PDFs, and keep those highlights privately in the user's browser.
```

**Permission justifications** (one per permission)

| Permission                                            | Justification to paste                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                                             | Saves the user's settings (default colour, colour labels, theme, toolbar on/off) in chrome.storage.local on the device. chrome.storage.sync is never used.                                                                                                                                                                                                                                                                              |
| `unlimitedStorage`                                    | The user's highlight library lives in IndexedDB on the device. Without this, a large library (thousands of highlights, long notes) could hit the default quota and new highlights would fail to save. No data leaves the device.                                                                                                                                                                                                        |
| `activeTab`                                           | Bowerline runs on a tab only after the user clicks the toolbar icon, presses the Alt+Shift+H shortcut or chooses the "Highlight with Bowerline" context-menu item. activeTab gives temporary access to that one tab so Bowerline can show and create highlights there, without any standing host permission. It is also used to read a PDF open in that tab when the user asks to open it in Bowerline's viewer.                        |
| `scripting`                                           | Injects Bowerline's content script and its highlight stylesheet into the tab the user activated (chrome.scripting.executeScript / insertCSS). If, and only if, the user turns on the optional "Always on" setting and grants host access, registers the same content script with chrome.scripting.registerContentScripts so saved highlights appear when the user revisits a page; it is unregistered when access is revoked.           |
| `contextMenus`                                        | Adds two right-click items: "Highlight with Bowerline" (highlights the selected text) and "Open in Bowerline PDF viewer" on links to PDFs.                                                                                                                                                                                                                                                                                              |
| `sidePanel`                                           | Shows the Bowerline side panel, where the user searches, reviews, edits and exports highlights for the current page or the whole library.                                                                                                                                                                                                                                                                                               |
| Optional host permissions `https://*/*`, `http://*/*` | Requested only at runtime and only after a user action: (1) when the user turns on "Show my highlights automatically when I revisit a page", so the content script can run on page load and draw saved highlights; (2) when a PDF the user chose can't be fetched because of CORS, Bowerline requests access to that one PDF's origin only (e.g. https://example.org/*). Never required at install; the user can revoke it at any time. |

No other permissions are requested. `tabs`, `downloads`, `webRequest`, `declarativeNetRequest` and required host permissions are deliberately not used: tab information comes from activeTab and from Bowerline's own content scripts, and files are saved with a Blob and `<a download>`.

**Are you using remote code?** **No, I am not using remote code.** All JavaScript, including pdf.js and its worker, is bundled in the package. There is no eval or new Function, and the default extension CSP is unchanged. (`npm run audit:permissions` enforces this.)

**Data usage**

Chrome asks which categories of user data the extension _collects_. Bowerline transmits nothing off the device, but it does store some data locally to do its job. I could not load Chrome's live definitions from this environment (developer.chrome.com was blocked by the network policy), and a search summary of the Chrome Web Store user-data FAQ suggests locally stored data should be disclosed as well. So the answers below are deliberately conservative: they tick every category Bowerline stores, even though it never leaves the device. **Owner: re-read the definitions shown in the dashboard before submitting.** If Chrome defines "collect" as transmitting off the device, untick everything and keep the certifications.

| Category                            | Answer                          | Why                                                                                                                                                                                           |
| ----------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personally identifiable information | No                              |                                                                                                                                                                                               |
| Health information                  | No                              |                                                                                                                                                                                               |
| Financial and payment information   | No                              |                                                                                                                                                                                               |
| Authentication information          | No                              |                                                                                                                                                                                               |
| Personal communications             | No                              |                                                                                                                                                                                               |
| Location                            | No                              |                                                                                                                                                                                               |
| Web history                         | **Yes** (stored on device only) | The URLs and titles of pages the user chose to highlight are saved so highlights reappear on revisit and can be listed in the library. Bowerline does not record browsing history in general. |
| User activity                       | No                              | No clicks, keystrokes, scrolling or mouse movements are logged. Selections are used momentarily to create a highlight.                                                                        |
| Website content                     | **Yes** (stored on device only) | The text the user highlights, short surrounding context used to re-find it, and the user's own notes. PDF file names and fingerprints for PDFs the user highlights.                           |

**Certifications** (tick all three):

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL**

```
https://wrenbox.github.io/wrenbox-extensions/bowerline/privacy
```

Served by GitHub Pages from `/docs/bowerline/privacy.md` in this repository. The policy matches the answers above exactly: what is stored and where (this browser only), that nothing is transmitted, the one PDF request, every permission, how to delete everything, a contact address and the effective date. **Owner: in the repository's GitHub settings, enable Pages from the `main` branch's `/docs` folder, and replace the placeholder contact email in the policy.**

## Distribution tab

- Visibility: Public. Regions: all.
- Pricing: Free. No in-app purchases in v1.

## Developer account notes

- Register the developer account under the publisher name **Wrenbox**.
- Trader status: declare **non-trader** while Bowerline is free and has no paid features. **Switch to trader** (and provide the required business contact details) **before** adding any paid feature, such as the possible future one-time Pro licence.
- Verify the contact email on the account; reviewers may write to it.

## Notes for the reviewer (paste into "Notes for reviewers" if asked)

```
Bowerline stores everything locally (IndexedDB + chrome.storage.local) and makes no network requests except fetching a PDF the user explicitly opens, from that PDF's own URL (viewer/viewer.js, function loadPdf / fetchDirect; and background.js fetchPdfViaTab, which runs fetch(location.href) inside the PDF's own tab). The code is not minified. Host permissions are optional and requested only from an explicit user action. To test: click the toolbar icon on any article, select text, pick a colour; open the side panel; open a PDF from the popup.
```
