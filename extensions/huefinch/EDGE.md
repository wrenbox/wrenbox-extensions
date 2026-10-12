# Publishing Huefinch on Microsoft Edge Add-ons

Huefinch runs on Microsoft Edge unchanged. It's the same build as the Chrome one, and the whole end-to-end suite runs in real Edge on every push. In Edge it says "Edge" wherever it would say "Chrome". This page covers everything needed to list it on [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons), field by field. It follows the same Partner Center flow as Bowerline's [EDGE.md](../bowerline/EDGE.md), which was checked against Microsoft's [publishing guide](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension).

Publishing on Edge is **free**: there is no registration fee, and it doesn't use a Chrome Web Store slot. Review takes **up to seven business days**.

## What you need

| Item                                        | Where                                                                                                                                                          |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extension package                           | `huefinch-<version>-edge.zip` on the latest [Huefinch release](https://github.com/wrenbox/wrenbox-extensions/releases) (for example `huefinch-1.1.0-edge.zip`) |
| Logo (1:1, at least 128×128)                | `store-assets/store-icon-128.png`                                                                                                                              |
| Small promotional tile (440×280, optional)  | `store-assets/promo-small-440x280.png`                                                                                                                         |
| Large promotional tile (1400×560, optional) | `store-assets/promo-marquee-1400x560.png`                                                                                                                      |
| Screenshots (1280×800, up to 6)             | the five in `store-assets/captured/`, in the same order as on the Chrome Web Store                                                                             |
| Privacy policy                              | `https://wrenbox.github.io/wrenbox-extensions/huefinch/privacy` (covers both browsers)                                                                         |

Edge recommends a 300×300 logo, but the 128×128 icon meets its minimum. **Leave the YouTube video out on Edge:** the promo video's end card says "Free on the Chrome Web Store".

The Edge package's name is "Huefinch – Color Blind Filter & Identifier" (42 characters). Edge allows 45, and the Chrome name is 48.

## 1. Register (once)

If you already registered the Wrenbox account for Bowerline, skip to step 2.

1. Go to [Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/overview) and sign in with a **personal Microsoft account** (Outlook.com, Hotmail or Live), or sign in with GitHub. Work and school accounts can't register.
2. **Account type: Individual.** It verifies faster than Company, which needs a registered business. You can't change the type later.
3. **Publisher display name:** `Wrenbox`. **Contact email:** `wrenbox.studio@gmail.com`.
4. Wait for the confirmation email.

## 2. Create the extension and upload the package

Partner Center → **Edge** → **Overview** → **Create new extension** → drag in `huefinch-<version>-edge.zip` → **Continue**.

The name and the short description come from the package and are read-only.

## 3. Availability

- **Visibility:** Public
- **Markets:** all markets (the default)

**Save & Continue.**

## 4. Properties

| Field                  | Value                                           |
| ---------------------- | ----------------------------------------------- |
| Category               | **Accessibility**                               |
| Website                | `https://wrenbox.github.io/wrenbox-extensions/` |
| Support contact detail | `wrenbox.studio@gmail.com`                      |
| Mature content         | leave unticked                                  |

**Save & Continue.**

## 5. Privacy

The answers are the same as on the Chrome Web Store, because the extension is identical.

- **Single Purpose Description:**

  ```
  Adjust the colors of web pages so people with color vision deficiency can tell colors apart, and identify colors on screen.
  ```

- **Permission justification:** for each permission, paste the same text as in [CHROMEWEBSTORE.md → Permission justifications](CHROMEWEBSTORE.md#privacy-practices-tab): `storage`, `activeTab`, `scripting`, and the optional `https://*/*` / `http://*/*` host permissions. The text applies to Edge as written.
- **Are you using remote code?** No, I am not using remote code.
- **Data usage:** tick **no** data category (Huefinch collects nothing), then tick every certification.
- **Privacy Policy URL:** `https://wrenbox.github.io/wrenbox-extensions/huefinch/privacy`

## 6. Store listing (English)

Store listings → English → **Edit details**.

**Description** (3,589 characters; Edge needs 250–10,000). It's the Chrome text, which names no browser in its answers, so it reads correctly on Edge. Don't use "Generate with AI"; this text is accurate.

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

- **Extension logo:** `store-icon-128.png`
- **Small promotional tile:** `promo-small-440x280.png`
- **Large promotional tile:** `promo-marquee-1400x560.png`
- **Screenshots**, in this order: `screenshot-1-before-after.png`, `screenshot-2-popup.png`, `screenshot-3-identify.png`, `screenshot-4-simulate.png`, `screenshot-5-settings.png` (from `store-assets/captured/`)
- **YouTube video URL:** leave empty
- **Search terms.** Edge allows up to 7 terms of up to 30 characters, and 21 words in total. These are 7 terms and 14 words:

  ```
  color blind filter
  colorblind
  color blindness
  deuteranopia
  color identifier
  daltonize
  red green color blind
  ```

**Save draft**, then **Close**.

## 7. Notes for certification, then publish

Click **Publish**, paste this into **Notes for certification**, then click **Publish** again:

```
No account, login or payment is needed. Everything is free and works offline.

Please test on a normal web page with colors (for example a Wikipedia article with a chart or map). Edge does not allow extensions on edge:// pages or on the Edge Add-ons store, so Huefinch cannot run there.

1. On install, a welcome page opens. "Turn on for all websites" asks for optional host access; with it, every page (and content embedded in it) is recolored automatically from the first frame. If declined, click the Huefinch toolbar icon on a page: that tab is recolored until it navigates.
2. Popup: master switch, Correct colors / Simulate, Red-/Green-/Blue-weak, Strength (or Severity) slider, "On for this site". Changes apply live. In Simulate mode a pill at the top of the page says "Simulating green-blind vision".
3. Hold Alt+Shift+X on a page: original colors while held. Alt+Shift+F turns Huefinch on/off.
4. Alt+Shift+C (or popup > "Identify a color", then click the page): the browser's eyedropper opens; click any color. A card names it ("Olive green"), shows the nearest CSS color and copies the hex code.
5. Settings > Find my setting: mark color pairs that look alike; Huefinch suggests a type; a slider tunes the strength.

Network: none. The content script never reads page content; it adds an SVG feColorMatrix filter and a style rule. In frames from another website it does the same, using only the hostname of the page around it. Code is not minified.
```

When it passes, the status changes to **In the Store**. Then:

- Copy the listing URL from **Extension overview** and send it to me. I'll add it to the READMEs and the Wrenbox site.
- Nothing else needs changing. Huefinch sees that it was installed from Edge Add-ons, and sends its one-time rating request and its Settings → About "Rate Huefinch" link to the Edge listing automatically.

## Updating later

Every GitHub release has both zips. To update on Edge: Partner Center → Huefinch → **Packages** → upload the new `huefinch-<version>-edge.zip` → **Publish**. In **Notes for certification**, list what changed (copy the version's CHANGELOG section).
