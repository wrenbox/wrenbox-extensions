# Chrome Web Store listing: Huefinch

Everything needed to fill in the Chrome Web Store Developer Dashboard, field by field. Publisher: **Wrenbox**.

## Package

- Upload `release/huefinch-<version>.zip` (for 1.0.1: `release/huefinch-1.0.1.zip`), built by `npm run verify` or `npm run build && npm run zip`. Once the CI workflow has run on `main`, the same zip is attached to the **Huefinch <version>** GitHub Release. `manifest.json` is at the zip root; there are no source maps, and the same build always produces the same zip, byte for byte.
- Code is bundled and **not minified**, so reviewers can read it directly. The `content/initial/*.js` files are one-line files (see "Notes for reviewers" below).

## Store listing tab

**Title**

```
Huefinch – Color Blind Filter & Color Identifier
```

**Summary** (124 characters; the manifest `description` is identical)

```
Helps color-blind eyes tell colors apart on any website and names any color on screen. Private: nothing leaves your browser.
```

**Category:** Accessibility.

**Language:** English (United States).

**Detailed description**

```
Most birds see more colors than people do, with four kinds of color-sensing cells where we have three; Huefinch lends your eyes a little of that, by adjusting web pages so colors that look alike become easy to tell apart.

Huefinch is a color blind filter for people with red-weak, green-weak or blue-weak color vision (about 1 in 12 men and 1 in 200 women), and a color identifier that names any color on your screen. Designers can use it to see their work the way color-blind people do.

SEE THE DIFFERENCE ON EVERY WEBSITE
• Choose your type once: red-weak (protan), green-weak (deutan) or blue-weak (tritan), and set the strength.
• Huefinch then works automatically on every page you open. No need to switch it on again for each site or tab.
• It recolors everything on the page: text, charts, maps, photos, video and canvas, plus pop-up dialogs, menus and full-screen video.
• Charts with red and green lines, status lights, heat maps, shop color swatches and error messages become easy to tell apart.
• Hold Alt+Shift+X to see a page's original colors for a moment; let go and Huefinch is back.
• Turn it off for one site with a single switch, or everywhere with Alt+Shift+F.

NAME ANY COLOR ON YOUR SCREEN
• Press Alt+Shift+C and click anywhere, even inside a photo.
• Huefinch tells you the color in plain words ("Olive green", "Dark muted red"), the nearest CSS color name, and the hex code, which it copies for you.

FIND MY SETTING
• Not sure which type fits you? Mark which color pairs look alike, and Huefinch suggests a setting.
• Then move one slider until the pairs look clearly different.

FOR DESIGNERS
• Simulate mode shows any page the way red-, green- or blue-weak eyes see it, at the severity you choose, so you can check charts, buttons and forms while you design.

PRIVATE BY DESIGN
• No account, no sign-up, no ads, no tracking.
• Huefinch never reads, stores or sends what is on the pages you visit. It only adds a color filter.
• It makes no network requests at all. Its settings stay in your browser.
• Everything is free.

FAQ
Is this a medical test? No. Huefinch is a comfort setting that adjusts colors on screen. It can't diagnose or treat color vision deficiency; an eye-care professional can tell you about your color vision.
Will it make me see colors like everyone else? No tool can do that. Huefinch shifts colors so that ones you confuse look different from each other.
Does it work on pop-ups and full-screen video? Yes. Dialogs, menus and full-screen content are recolored too, exactly once.
Why does it ask to "read and change all your data on all websites"? That is the browser's standard wording for any extension that works on the pages you visit. Huefinch uses it only to add its color filter, and only if you choose "Turn on for all websites". Without it, Huefinch works on one tab at a time when you click its icon.
Why doesn't it work on some pages? Browsers don't let extensions change their own pages (like settings or the extension store).
Does it slow pages down? The filter is drawn by the browser itself. On very busy pages, such as long, fast scrolling past video, older computers may draw slightly fewer frames.
Do you spell it colour? Huefinch speaks US English in its menus, but it works the same for everyone.

CREDITS
Color simulation: Machado, Oliveira and Fernandes (2009), "A Physiologically-based Model for Simulation of Color Vision Deficiency". Correction: error redistribution ("daltonization") after Fidaner, Lin and Ozguven (2005), "Analysis of Color Blindness".

Made by Wrenbox: small, private tools for your browser.
```

(Search terms covered naturally: color blind, color blindness, colorblind, color blind filter, deuteranopia/deutan, protan, tritan, red-green, daltonize/daltonization, color identifier, color picker, color name, hex, accessibility, designers, simulate. "Colour" appears once for UK searches. Competitors are not named. No medical claims: the listing says what Huefinch does on screen, and that it is not a test or treatment.)

## Graphic assets

| Slot                                    | File                                          |
| --------------------------------------- | --------------------------------------------- |
| Store icon (128×128)                    | `store-assets/store-icon-128.png`             |
| Small promo tile (440×280)              | `store-assets/promo-small-440x280.png`        |
| Marquee promo tile (1400×560)           | `store-assets/promo-marquee-1400x560.png`     |
| YouTube thumbnail (for the promo video) | `store-assets/youtube-thumbnail-1280x720.png` |

**Screenshots (1280×800), in this order:** before/after, popup, identify, simulate, settings.

Use the captured set in `store-assets/captured/`: real captures of the built extension, framed like the designed mockups (`npm run screens` regenerates them after a UI change). The designed mockups in `store-assets/` remain the visual reference; `REVIEW.md` §3 lists the differences.

1. `store-assets/captured/screenshot-1-before-after.png`: "Tell red and green apart again. How a green-weak eye sees the same chart, without and with Huefinch."
2. `store-assets/captured/screenshot-2-popup.png`: "Works on every website, automatically. Choose your type of color vision once."
3. `store-assets/captured/screenshot-3-identify.png`: "Name any color on your screen: press Alt+Shift+C and click."
4. `store-assets/captured/screenshot-4-simulate.png`: "Check designs the way color-blind people see them."
5. `store-assets/captured/screenshot-5-settings.png`: "Set it once. Private by design: no account, no tracking, nothing sent anywhere."

## Privacy practices tab

**Single purpose description**

```
Adjust the colors of web pages so people with color vision deficiency can tell colors apart, and identify colors on screen.
```

**Permission justifications** (one per permission)

| Permission                                            | Justification to paste                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                                             | Saves the user's settings (on/off, Correct or Simulate mode, type of color vision, strength) and the hostnames of sites where the user switched Huefinch off, in chrome.storage.local on the device. chrome.storage.sync is never used, and nothing is sent anywhere.                                                                                                                                                                                                                 |
| `activeTab`                                           | If the user has not turned on automatic mode, Huefinch recolors a tab only after the user clicks the toolbar icon or presses the Alt+Shift+F shortcut. activeTab gives temporary access to that one tab, until it navigates away, without any standing host permission.                                                                                                                                                                                                               |
| `scripting`                                           | Injects Huefinch's content script, which adds an SVG color filter (feColorMatrix) to the page, into the tab the user activated (chrome.scripting.executeScript). If, and only if, the user chooses "Turn on for all websites" and grants host access, registers the same script with chrome.scripting.registerContentScripts so every page is recolored as it loads; it is unregistered as soon as that access is removed.                                                            |
| Optional host permissions `https://*/*`, `http://*/*` | Requested at runtime only, after the user clicks "Turn on for all websites" (onboarding, popup or settings). Lets the color filter apply automatically at document_start on every page, so colors are corrected before the page is shown, including pop-up dialogs and full-screen video. Huefinch never reads page content: the content script only adds the filter and listens for its own three key combinations. Never required at install; the user can turn it off at any time. |

No other permissions are requested. `tabs`, `clipboardWrite`, `webRequest`, `declarativeNetRequest` and required host permissions are deliberately not used. The color identifier uses the browser's own EyeDropper (which needs a user gesture and shows its own picker) and copies the hex code with the standard Clipboard API.

**Are you using remote code?** **No, I am not using remote code.** All JavaScript is in the package. There is no eval or new Function, the default extension CSP is unchanged, and Huefinch makes no network requests at all (`npm run audit:network` and `npm run audit:permissions` enforce this on every build).

**Data usage**

The brief asks for "none collected". Huefinch transmits nothing off the device and stores only its settings and a list of hostnames the user switched off, locally. Tick **no** data category:

| Category                            | Answer                                                                                                                                               |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personally identifiable information | No                                                                                                                                                   |
| Health information                  | No                                                                                                                                                   |
| Financial and payment information   | No                                                                                                                                                   |
| Authentication information          | No                                                                                                                                                   |
| Personal communications             | No                                                                                                                                                   |
| Location                            | No                                                                                                                                                   |
| Web history                         | No (Huefinch keeps no record of visited pages; the only hostnames it stores are sites the user explicitly switched off, as a setting, on the device) |
| User activity                       | No (no clicks, keystrokes or mouse movements are logged; the content script only reacts to its own key combinations)                                 |
| Website content                     | No (page text, images and video are never read; the color picked with the identifier is shown and copied to the clipboard only)                      |

**Certifications** (tick all three):

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Verify the current form wording before submitting (owner).** I could not load the live dashboard or developer.chrome.com from the build environment (blocked by its network policy). The categories and certification sentences above are the ones recorded for Bowerline's submission on 3 October 2026. A web search on 6 October 2026 turned up third-party summaries consistent with them; one also lists a certification about not using data for advertising unrelated to the item, and some mention updated privacy policies enforced from 1 August 2026. If the dashboard shows an extra certification or different wording, tick it on the same basis: nothing is collected, nothing is transmitted, nothing is used for advertising.

**Privacy policy URL**

```
https://wrenbox.github.io/wrenbox-extensions/huefinch/privacy
```

Served by GitHub Pages from `/docs/huefinch/privacy.md` in this repository (Pages is enabled from `main`, folder `/docs`). It matches the answers above: what is stored (settings and switched-off hostnames, in this browser only), that page content is never read, stored or sent, that no network requests are made, every permission, how to delete everything, a contact address and the effective date.

## Distribution tab

- Visibility: Public. Regions: all.
- Pricing: Free. No in-app purchases, no upgrade prompts.

## Test instructions tab (optional; text to paste)

```
No account, login or payment is needed. Everything is free and works offline.

Please test on a normal web page with colors (for example a Wikipedia article with a chart or map). Chrome doesn't allow extensions on chrome:// pages or the Chrome Web Store.

1. On install, a welcome page opens. "Turn on for all websites" asks for optional host access; with it, every page is recolored automatically from the first frame. If declined, click the Huefinch toolbar icon on a page: that tab is recolored until it navigates.
2. Popup: master switch, Correct colors / Simulate, Red-/Green-/Blue-weak, Strength (or Severity) slider, "On for this site". Changes apply live. In Simulate mode a pill at the top of the page says "Simulating green-blind vision".
3. Hold Alt+Shift+X on a page: original colors while held. Alt+Shift+F turns Huefinch on/off.
4. Alt+Shift+C (or popup > "Identify a color", then click the page): the browser's eyedropper opens; click any color. A card names it ("Olive green"), shows the nearest CSS color and copies the hex code.
5. Settings > Find my setting: mark color pairs that look alike; Huefinch suggests a type; a slider tunes the strength.

Network: none. The content script never reads page content; it adds an SVG feColorMatrix filter and a style rule. Code is not minified.
```

## Notes for reviewers (and for us)

- **`content/initial/*.js`:** 27 one-line files such as `content/initial/type-deutan.js`, each setting one value (`mode`, `type` or `amount`). The service worker registers three of them before `content/content.js` so the content script knows the user's setting synchronously and the very first frame of a page is already recolored (an asynchronous storage read loses the race on fast pages). They contain no logic.
- **Why `optional_host_permissions` and not `activeTab` alone:** the main complaint about existing tools is having to switch them on again on every page. Automatic mode needs host access; it stays optional.

## Developer account notes

- Publisher name: **Wrenbox** (same account as Bowerline). Huefinch uses the account's **second** item slot.
- Trader status: **non-trader** (free, no paid features).
