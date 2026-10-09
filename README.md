# Wrenbox

The wren is one of the smallest birds with one of the loudest songs: small tools, big impact.

Wrenbox makes small, private, high-quality Chrome extensions. Every Wrenbox extension is named after a bird whose behaviour matches what the tool does, keeps your data in your browser, and has no account, no tracking and no server.

## Extensions

| Extension | What it does | Folder | Status |
| --- | --- | --- | --- |
| **Bowerline – PDF & Web Highlighter** (BOW-er-line) | Highlight and annotate web pages and PDFs, keep the highlights privately in your browser, export to Obsidian, Notion, Markdown or CSV. Bowerbirds collect colourful treasures and arrange them in their bower; Bowerline keeps the lines you collect while reading, in colour, in one place. | [`extensions/bowerline`](extensions/bowerline) | 1.0.2, Chrome and Edge ([releases](https://github.com/wrenbox/wrenbox-extensions/releases)) |
| **Huefinch – Color Blind Filter & Color Identifier** (HUE-finch) | Adjusts the colors of web pages so people with red-, green- or blue-weak color vision can tell them apart, names any color on screen, and lets designers simulate color-blind vision. Most birds see more colors than people do, with four kinds of color-sensing cells where we have three; Huefinch lends your eyes a little of that. | [`extensions/huefinch`](extensions/huefinch) | 1.0.0 ([releases](https://github.com/wrenbox/wrenbox-extensions/releases)) |

## Repository layout

```
/README.md                 this index
/docs/                     GitHub Pages site (privacy policies), served from /docs
/extensions/<name>/        everything for one extension: its own package.json, source,
                           tests, store assets and paperwork
```

Releases are published on the [GitHub Releases page](https://github.com/wrenbox/wrenbox-extensions/releases) by GitHub Actions when an extension's version changes on `main`, one tag per extension version (for example `bowerline-v1.0.0` or `huefinch-v1.0.0`). Built files are never committed. See each extension's README for its release steps.

Each extension is self-contained: it has its own `package.json` and lockfile and never imports from another extension's folder. To work on one, `cd extensions/<name>` and follow its README.

## Principles

- **Private by default.** No analytics, telemetry, error reporting, remote fonts, CDNs or servers. Each extension has an automated audit that fails the build if code could send data anywhere it shouldn't.
- **No remote code.** Everything is bundled; no `eval`.
- **Readable builds.** Bundles are not minified, so store reviewers (and you) can read them.
- **Minimal permissions**, each justified in the extension's `CHROMEWEBSTORE.md`.

Publisher name on every listing: **Wrenbox**.
