---
title: Huefinch privacy policy
---

# Huefinch privacy policy

**Effective date:** 12 October 2026

Huefinch – Color Blind Filter & Color Identifier ("Huefinch") is an extension for Google Chrome and Microsoft Edge, made by Wrenbox. This policy explains, in plain language, what Huefinch stores, where, and what it never does.

**The short version:** Huefinch changes how colors look on the pages you visit, and nothing else. It never reads, stores or sends what is on those pages. It makes no network requests at all. Its settings stay in your browser.

## What Huefinch stores, and where

Huefinch stores only the following, **in this browser**, in the extension's own storage (`chrome.storage.local`) on your device:

- **Your settings:** whether Huefinch is on, Correct or Simulate mode, your type of color vision (red-, green- or blue-weak) and the strength or severity.
- **The list of sites where you switched Huefinch off:** just the hostname of each one (for example `photos.example.com`), nothing else about the page or your visit.
- **One small reminder:** the date you first opened Huefinch's toolbar popup, how many times you have opened it, and whether you have answered its one-time request to rate Huefinch in the store, so it is asked at most once.

Settings are not copied to your Google or Microsoft account: Huefinch does not use the browser's sync.

If you click **Rate Huefinch** (in the toolbar popup, once, or in Settings → About), the store's page for Huefinch opens in a new tab, just like a link you click. Huefinch sends nothing to it.

When you use "Identify a color", the color you pick is shown on screen and its hex code (for example `#6B7A2E`) is copied to your clipboard so you can paste it. Huefinch does not keep it.

## What Huefinch never does

- It **never reads page content.** It doesn't read the text, images, video or forms on a page. It adds a color filter over the page, which the browser applies while drawing it.
- It **never records where you go.** The only part of a page's address it uses is the hostname, to check whether you switched Huefinch off for that site. Inside content embedded in a page from another website (an iframe, such as a video or a map), Huefinch adds its filter too, and the only address it uses there is the hostname of the page around it, for the same check. It doesn't store addresses, titles or browsing history.
- It **makes no network requests.** No analytics, telemetry, crash reports, advertising, remote fonts or content delivery networks. Every build is checked automatically for any way to contact a server.
- It **never sells or shares data.** There is none to share: Wrenbox has no server and never receives anything from Huefinch.

## Permissions and why Huefinch needs them

| Permission | What it is used for |
| --- | --- |
| `storage` | Saving your settings and your list of switched-off sites in this browser. |
| `activeTab` | Recoloring the tab you're looking at when you click Huefinch's icon or press its shortcut, if you haven't turned on automatic mode. The access ends when you leave that page. |
| `scripting` | Adding Huefinch's color filter to pages: the tab you clicked, or (in automatic mode) every page as it opens. |
| Optional: access to websites (`https://*/*`, `http://*/*`) | Only if you choose "Turn on for all websites". It lets Huefinch recolor every page automatically, including pop-up dialogs and full-screen video. Your browser describes this access as "read and change all your data on all websites", because recoloring a page needs the same permission as reading it; Huefinch uses it only to add its filter. You can turn it off at any time in Huefinch's settings or on your browser's extensions page. |

Huefinch's keyboard shortcuts (Alt+Shift+F, Alt+Shift+X, Alt+Shift+C) don't need extra permissions. On pages where Huefinch is on, it notices only those key combinations; it doesn't record anything you type.

## How to delete everything

Remove the extension: open your browser's extensions page (`chrome://extensions` in Chrome, `edge://extensions` in Edge) and click **Remove** under Huefinch. This deletes all of its settings from your browser. Nothing exists anywhere else to delete.

To forget a single site, open Huefinch's **Settings → Websites** and remove it from the list.

## Children

Huefinch does not collect personal information from anyone, including children.

## Changes to this policy

If this policy changes, the new version will be published at this address with a new effective date. Because Huefinch does not collect data, a change can never apply to data collected in the past.

## Contact

Questions about privacy: **[wrenbox.studio@gmail.com](mailto:wrenbox.studio@gmail.com)**

Made by Wrenbox: small, private tools for your browser.
