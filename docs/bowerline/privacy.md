---
title: Bowerline privacy policy
---

# Bowerline privacy policy

**Effective date:** 9 October 2026

Bowerline – PDF & Web Highlighter ("Bowerline") is an extension for Google Chrome and Microsoft Edge, made by Wrenbox. This policy explains, in plain language, what Bowerline stores, where, and what it never does.

**The short version:** everything you create in Bowerline stays in your own browser, on your own computer. Bowerline has no account, no server and no tracking. Nothing you highlight or write is sent to Wrenbox or to anyone else.

## What Bowerline stores, and where

Bowerline stores the following **only in this browser**, in the extension's own private storage (IndexedDB and `chrome.storage.local`) on your device:

- **Your highlights:** the text you highlighted, its colour, and information that lets Bowerline find the passage again on the page (a short piece of surrounding text and its position).
- **Your notes** on those highlights.
- **The pages and PDFs they belong to:** for web pages, the page's address (URL, with tracking parameters removed) and title; for PDFs, the file name, its address if you opened it from the web, its title, and a fingerprint that pdf.js computes from the file's contents so the same file shows the same highlights wherever you open it from.
- **Your settings:** default colour, colour labels, theme and whether the selection toolbar is shown.
- **One small reminder:** the date you first opened Bowerline's toolbar popup, and whether you have answered its one-time request to rate Bowerline in the store, so it is asked at most once.

Settings use `chrome.storage.local`, not the browser's sync, so they are not copied to your Google or Microsoft account. While a tab is open, Bowerline also keeps a small list of which tab shows which page in temporary session storage; the browser clears it when you close it.

## What Bowerline sends: nothing

Bowerline does **not** transmit any of the data above, or any other data, to Wrenbox or to any third party. There are no analytics, no telemetry, no crash reports, no advertising, no remote fonts and no content delivery networks. Bowerline does not sell or share data, and it does not read pages for any purpose other than showing and creating your highlights.

Wrenbox therefore never receives your data and could not give it to anyone.

If you click **Rate Bowerline** (in the toolbar popup, once, or in Settings → About), the store's page for Bowerline opens in a new tab, just like a link you click. Bowerline sends nothing to it.

## The one network request: opening a PDF you chose

When you ask Bowerline to open a PDF from the web (for example with "Open this PDF in Bowerline" or "Open in Bowerline PDF viewer"), the viewer downloads **that PDF from its own address**, exactly as your browser would when you open the link. Nothing is added to the request and nothing is sent anywhere else. The viewer limits itself to connecting to that PDF's own website. PDFs you open from your computer are read from the file you choose and never uploaded.

## Permissions and why Bowerline needs them

| Permission | What it is used for |
| --- | --- |
| `storage` | Saving your settings in this browser (`chrome.storage.local`). |
| `unlimitedStorage` | Letting your highlight library grow past the default storage quota, so highlights never stop saving. Data still stays on your device. |
| `activeTab` | Running Bowerline on the current tab only when you ask: by clicking its icon, pressing its shortcut or choosing "Highlight with Bowerline". |
| `scripting` | Adding Bowerline's highlighter to that tab, and (only if you turn on "Always on") showing your highlights automatically when you revisit a page. |
| `contextMenus` | The right-click items "Highlight with Bowerline" and "Open in Bowerline PDF viewer". |
| `sidePanel` | The side panel where you search and review your highlights. |
| Optional: access to websites (`https://*/*`, `http://*/*`) | Only requested if you turn on "Show my highlights automatically when I revisit a page", or if you allow Bowerline to open a PDF from one particular website (then only that website is requested). Used solely to show your highlights or open the PDF. You can turn it off at any time. |

## How to delete everything

- **In Bowerline:** open Settings → Your data → **Delete all**, and type DELETE to confirm. This removes every highlight, note and page record from this browser.
- **Or remove the extension:** uninstalling Bowerline from `chrome://extensions` (or `edge://extensions` in Edge) deletes all of its stored data.
- Single highlights can be deleted from the page, the PDF viewer, the side panel or the library.

Before deleting, you can save a backup file (Settings → Your data → **Back up now**). That file is saved wherever you choose on your computer; Bowerline does not keep a copy anywhere else.

## Children

Bowerline does not collect personal information from anyone, including children.

## Changes to this policy

If this policy changes, the new version will be published at this address with a new effective date. Because Bowerline does not collect data, a change can never apply to data collected in the past.

## Contact

Questions about privacy: **[wrenbox.studio@gmail.com](mailto:wrenbox.studio@gmail.com)**

Wrenbox: small, private tools for your browser.
