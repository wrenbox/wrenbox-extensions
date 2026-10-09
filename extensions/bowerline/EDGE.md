# Publishing Bowerline on Microsoft Edge Add-ons

Bowerline runs on Microsoft Edge unchanged: it's the same build as the Chrome one, and the whole end-to-end suite runs in real Edge on every push. In Edge it says "Edge" wherever it would say "Chrome". This page is everything needed to list it on [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons), field by field, checked against Microsoft's [publishing guide](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension) on 9 October 2026.

Publishing on Edge is **free**: there is no registration fee. Review takes **up to seven business days**.

## What you need

| Item                                        | Where                                                                                                                                                             |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extension package                           | `bowerline-<version>-edge.zip` on the latest [Bowerline release](https://github.com/wrenbox/wrenbox-extensions/releases) (for example `bowerline-1.0.2-edge.zip`) |
| Logo (1:1, at least 128×128)                | `store-assets/store-icon-128.png`                                                                                                                                 |
| Small promotional tile (440×280, optional)  | `store-assets/promo-small-440x280.png`                                                                                                                            |
| Large promotional tile (1400×560, optional) | `store-assets/promo-marquee-1400x560.png`                                                                                                                         |
| Screenshots (1280×800, up to 6)             | the five in `store-assets/captured/`, in the same order as on the Chrome Web Store                                                                                |
| Privacy policy                              | `https://wrenbox.github.io/wrenbox-extensions/bowerline/privacy` (covers both browsers)                                                                           |

Edge recommends a 300×300 logo; the 128×128 icon meets its minimum. **Leave the YouTube video out on Edge:** the promo video's end card says "Free on the Chrome Web Store".

## 1. Register (once)

1. Go to [Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/overview) and sign in with a **personal Microsoft account** (Outlook.com, Hotmail or Live; or sign in with GitHub). Work and school accounts can't register.
2. **Account type: Individual.** Verification is quicker than for Company, which needs a registered business and can take weeks. You can't change the type later.
3. **Publisher display name:** `Wrenbox`. This is shown on the store, and the name must be available.
4. **Contact email:** `wrenbox.studio@gmail.com`.
5. Wait for the confirmation email. You can prepare everything below in the meantime.

## 2. Create the extension and upload the package

Partner Center → **Edge** → **Overview** → **Create new extension** → drag in `bowerline-<version>-edge.zip` → **Continue**.

The extension name ("Bowerline – PDF & Web Highlighter") and the short description come from the package and are read-only.

## 3. Availability

- **Visibility:** Public
- **Markets:** all markets (the default)

**Save & Continue.**

## 4. Properties

| Field                  | Value                                           |
| ---------------------- | ----------------------------------------------- |
| Category               | **Productivity**                                |
| Website                | `https://wrenbox.github.io/wrenbox-extensions/` |
| Support contact detail | `wrenbox.studio@gmail.com`                      |
| Mature content         | leave unticked                                  |

**Save & Continue.**

## 5. Privacy

These answers are the same as on the Chrome Web Store, because the extension is identical.

- **Single Purpose Description:**

  ```
  Highlight and annotate text on web pages and PDFs, and keep those highlights privately in the user's browser.
  ```

- **Permission justification:** paste the same text for each permission as in [CHROMEWEBSTORE.md → Permission justifications](CHROMEWEBSTORE.md#privacy-practices-tab) (`storage`, `unlimitedStorage`, `activeTab`, `scripting`, `contextMenus`, `sidePanel`, and the optional `https://*/*` / `http://*/*` host permissions). The text applies to Edge as written.
- **Are you using remote code?** No, I am not using remote code.
- **Data usage:** tick the same categories as on the Chrome Web Store (**Web history** and **Website content**, both stored on the device only), and tick every certification. If Edge's definitions say "collect" means sending data off the device, untick the categories and keep the certifications, just as for Chrome.
- **Privacy Policy URL:** `https://wrenbox.github.io/wrenbox-extensions/bowerline/privacy`

## 6. Store listing (English)

Store listings → English → **Edit details**.

**Description** (3,624 characters; Edge needs 250–10,000). It's the Chrome text with the two answers that name the browser rewritten for Edge. Don't use "Generate with AI"; this text is accurate.

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
Does it work in Edge's built-in PDF viewer? Edge doesn't let extensions change its viewer, so Bowerline opens the PDF in its own viewer with one click.
Does it work on Google Docs? Not yet. Google Docs draws its text on a canvas, so there is no selectable text to highlight.
Does it work inside embedded frames? Not in version 1. Bowerline highlights the main page; text inside iframes isn't supported yet.
Why does "Always on" ask for permission to read all websites? That is Edge's standard wording for any extension that runs on the pages you visit. Bowerline uses it only to show your saved highlights, and it is completely optional.

Made by Wrenbox: small, private tools for your browser.
```

- **Extension logo:** `store-icon-128.png`
- **Small promotional tile:** `promo-small-440x280.png`
- **Large promotional tile:** `promo-marquee-1400x560.png`
- **Screenshots:** `screenshot-1-web-highlighting.png` to `screenshot-5-privacy.png` from `store-assets/captured/`
- **YouTube video URL:** leave empty
- **Search terms** (Edge allows up to 7 terms, 30 characters each, 21 words in total; these are 7 terms and 14 words):

  ```
  pdf highlighter
  web highlighter
  highlight pdf
  annotate pdf
  obsidian export
  notion export
  study notes
  ```

**Save draft**, then **Close**.

## 7. Notes for certification, then publish

Click **Publish**, paste this into **Notes for certification**, then **Publish** again:

```
No account, login or payment is needed. All features are free and work offline; data stays in the browser.

Please test on a normal web page (for example any Wikipedia article). Edge does not allow extensions on edge:// pages or on the Edge Add-ons store, so Bowerline cannot run there.

Web pages: click the Bowerline toolbar icon (or press Alt+Shift+H, or right-click a selection > "Highlight with Bowerline"). Select text, pick a colour in the small toolbar. Click a highlight to add a note, change colour, copy or delete. Reload the page and click the icon again: highlights come back.

PDFs: Edge's built-in PDF viewer cannot be changed by extensions, so Bowerline opens PDFs in its own viewer. Click the icon on a PDF tab and choose "Open this PDF in Bowerline", or choose "Open a PDF from your computer", or click "Try the sample PDF" in the viewer. Select text and press H (or pick a colour).

Library and export: popup > "Open side panel" > Library tab to search all highlights; Export offers Obsidian, Notion, Markdown, CSV and a backup file.

Permissions: no host access at install. Settings > "Show my highlights automatically" asks for optional host access only when the user turns it on.

Network: the only request is fetching a PDF the user opens, from its own URL (viewer/viewer.js loadPdf / fetchDirect; background.js fetchPdfViaTab). The code is not minified.
```

When it passes, the status changes to **In the Store**. Then:

- Copy the listing URL from **Extension overview** and send it to me. I'll add it to the READMEs and the Wrenbox site.
- Nothing else needs changing. Bowerline sees that it was installed from Edge Add-ons and sends its one-time rating request and its Settings → About "Rate Bowerline" link to the Edge listing automatically.

## Updating later

Every GitHub release has both zips. To update on Edge: Partner Center → Bowerline → **Packages** → upload the new `bowerline-<version>-edge.zip` → **Publish**. In **Notes for certification**, list what changed (copy the version's CHANGELOG section).

## Selling Pro on Edge later

Edge Add-ons, like the Chrome Web Store, doesn't take payments for extensions. The Pro plan we discussed (an external payment provider that also handles sales tax, plus a licence key Bowerline checks offline) works the same in both stores. Before charging, update the description and the "Is it really free?" answer in both listings.
