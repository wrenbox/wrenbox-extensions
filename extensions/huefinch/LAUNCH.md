# Launching Huefinch: YouTube, then the Chrome Web Store

The whole launch, start to finish, with every text ready to paste. Do YouTube first: the store listing asks for the video link. It takes about 15 minutes for YouTube and 30 for the store, then a few days of review.

The texts below are copied from `CHROMEWEBSTORE.md` (the listing reference, with the reasoning behind each answer). If you change one, change both.

## 0. Download the files

| What                              | Where                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Extension zip for Chrome          | `huefinch-1.0.1.zip` on the [Huefinch 1.0.1 release](https://github.com/wrenbox/wrenbox-extensions/releases/tag/huefinch-v1.0.1)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Extension zip for Edge (optional) | `huefinch-1.0.1-edge.zip` on the same release                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Promo video                       | `huefinch-demo-1080p.mp4` on the same release, or [direct link](https://github.com/wrenbox/wrenbox-extensions/raw/main/extensions/huefinch/store-assets/video/huefinch-demo-1080p.mp4)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Subtitles                         | [`huefinch-demo.srt`](https://github.com/wrenbox/wrenbox-extensions/raw/main/extensions/huefinch/store-assets/video/huefinch-demo.srt)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| YouTube thumbnail                 | [`youtube-thumbnail-1280x720.png`](https://github.com/wrenbox/wrenbox-extensions/raw/main/extensions/huefinch/store-assets/youtube-thumbnail-1280x720.png)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Store icon                        | [`store-icon-128.png`](https://github.com/wrenbox/wrenbox-extensions/raw/main/extensions/huefinch/store-assets/store-icon-128.png)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Screenshots 1–5                   | [1](https://github.com/wrenbox/wrenbox-extensions/raw/main/extensions/huefinch/store-assets/captured/screenshot-1-before-after.png) · [2](https://github.com/wrenbox/wrenbox-extensions/raw/main/extensions/huefinch/store-assets/captured/screenshot-2-popup.png) · [3](https://github.com/wrenbox/wrenbox-extensions/raw/main/extensions/huefinch/store-assets/captured/screenshot-3-identify.png) · [4](https://github.com/wrenbox/wrenbox-extensions/raw/main/extensions/huefinch/store-assets/captured/screenshot-4-simulate.png) · [5](https://github.com/wrenbox/wrenbox-extensions/raw/main/extensions/huefinch/store-assets/captured/screenshot-5-settings.png) |
| Small promo tile                  | [`promo-small-440x280.png`](https://github.com/wrenbox/wrenbox-extensions/raw/main/extensions/huefinch/store-assets/promo-small-440x280.png)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Marquee promo tile                | [`promo-marquee-1400x560.png`](https://github.com/wrenbox/wrenbox-extensions/raw/main/extensions/huefinch/store-assets/promo-marquee-1400x560.png)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

## 1. YouTube

1. **One-time: verify the channel.** Custom thumbnails need a verified account. Go to [youtube.com/verify](https://www.youtube.com/verify) and confirm by phone. Use the **Wrenbox** channel.
2. **Upload.** Open [YouTube Studio](https://studio.youtube.com) → **Create** → **Upload videos** → choose `huefinch-demo-1080p.mp4`.
3. **Details page.**
   - **Title** (74 characters; the limit is 100):

     ```
     Huefinch – Color Blind Filter for Chrome: tell colors apart on any website
     ```

   - **Description** (the three hashtags show above the title; leave the store-link line as it is for now):

     ```
     Huefinch adjusts the colors of web pages so color-blind eyes can tell them apart: charts, maps, status lights, photos and more. It's a free Chrome extension by Wrenbox.

     • Choose red-weak, green-weak or blue-weak vision once and set the strength
     • Works automatically on every website, including pop-ups and full-screen video
     • Hold Alt+Shift+X to compare with the original colors
     • Press Alt+Shift+C to name any color on your screen, even inside photos
     • Designers: simulate color-blind vision to check your work

     Private by design: no account, no tracking, and nothing leaves your browser.

     Install Huefinch from the Chrome Web Store:
     [STORE LINK – add once the listing is live]

     Privacy policy: https://wrenbox.github.io/wrenbox-extensions/huefinch/privacy

     Huefinch is not a medical test or treatment. It adjusts colors on screen.

     Made by Wrenbox: small, private tools for your browser.

     #colorblind #accessibility #chromeextension
     ```

   - **Thumbnail:** **Upload file** → `youtube-thumbnail-1280x720.png`.
   - **Playlist:** optional. A "Wrenbox extensions" playlist with the Bowerline video is a nice touch.
   - **Audience:** **No, it's not made for kids**. **Age restriction:** No.
4. **Show more** (bottom of the Details page):
   - **Paid promotion:** leave unticked.
   - **Altered content:** **No**. It's a real screen recording. The "As a green-weak eye sees it" inset is a labelled simulation, not realistic altered footage.
   - **Automatic chapters:** untick. The scenes are shorter than the 10 seconds YouTube needs per chapter.
   - **Tags:**

     ```
     color blind, colorblind, color blindness, color blind filter, daltonize, deuteranopia, protanopia, tritanopia, color identifier, chrome extension, accessibility, Huefinch
     ```

   - **Language:** English. **Caption certification:** "This content has never aired on television in the U.S."
   - **License:** Standard YouTube License. **Allow embedding: ON.** This one matters: without it, the video won't play on the Chrome Web Store page. **Publish to subscriptions feed:** on.
   - **Category:** **Science & Technology**. **Comments:** on.
5. **Video elements.**
   - **Subtitles** → **Add** → language **English** → **Upload file** → **With timing** → `huefinch-demo.srt` → **Done**. These match the on-screen captions to the frame, so they also help search.
   - **End screen:** skip. It would cover the last 20 seconds of the demo; the video already ends on its own end card.
   - **Cards:** skip.
6. **Checks.** Wait for the copyright check. The music is your own licensed track, so it should come back clean. If it shows a claim, don't publish yet: tell me, and I'll re-render with another track.
7. **Visibility:** **Public** → **Publish**. Copy the video link (`https://youtu.be/…`). You need it in step 2.3.

## 2. Chrome Web Store

### 2.1 Before you upload

- [ ] **Trademark check:** search "Huefinch" on [tmsearch.uspto.gov](https://tmsearch.uspto.gov) and [ipindia.gov.in](https://ipindia.gov.in) in classes 9 and 42. If anything live shows up, stop and tell me.
- [ ] **Try the exact zip:** unzip `huefinch-1.0.1.zip` → `chrome://extensions` → **Developer mode** → **Load unpacked** → select the folder. Then run through the checklist in `README.md`.
- [x] **Privacy policy is live:** [wrenbox.github.io/wrenbox-extensions/huefinch/privacy](https://wrenbox.github.io/wrenbox-extensions/huefinch/privacy) (checked 8 October 2026).
- **Item slot:** new publishers can have **two** published items; Huefinch is the second, after Bowerline. Don't submit anything else until more slots are granted. The dashboard shows your limit and offers "request an increase".

### 2.2 Upload

[Developer Dashboard](https://chrome.google.com/webstore/devconsole) → publisher **Wrenbox** → **Add new item** → **Choose file** → `huefinch-1.0.1.zip` → **Upload**.

The name and summary come from the zip's manifest, so they're already filled in (and not editable here):

- Name: `Huefinch – Color Blind Filter & Color Identifier`
- Summary: `Helps color-blind eyes tell colors apart on any website and names any color on screen. Private: nothing leaves your browser.`

### 2.3 Store listing tab

- **Description:**

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

- **Category:** **Accessibility**. **Language:** **English (United States)**.
- **Store icon:** `store-icon-128.png`.
- **Global promo video:** the YouTube link from step 1.7.
- **Screenshots**, in this order:
  1. `screenshot-1-before-after.png`
  2. `screenshot-2-popup.png`
  3. `screenshot-3-identify.png`
  4. `screenshot-4-simulate.png`
  5. `screenshot-5-settings.png`
- **Small promo tile:** `promo-small-440x280.png`. **Marquee promo tile:** `promo-marquee-1400x560.png`.
- **Official URL:** leave as **None** (it only lists sites verified in Google Search Console).
- **Homepage URL:**

  ```
  https://wrenbox.github.io/wrenbox-extensions/
  ```

- **Support URL:**

  ```
  https://github.com/wrenbox/wrenbox-extensions/issues
  ```

- **Mature content:** off.

### 2.4 Privacy tab

- **Single purpose description:**

  ```
  Adjust the colors of web pages so people with color vision deficiency can tell colors apart, and identify colors on screen.
  ```

- **Permission justifications.** The dashboard lists each permission from the manifest with a box; paste the matching text.

  **storage**

  ```
  Saves the user's settings (on/off, Correct or Simulate mode, type of color vision, strength) and the hostnames of sites where the user switched Huefinch off, in chrome.storage.local on the device. chrome.storage.sync is never used, and nothing is sent anywhere.
  ```

  **activeTab**

  ```
  If the user has not turned on automatic mode, Huefinch recolors a tab only after the user clicks the toolbar icon or presses the Alt+Shift+F shortcut. activeTab gives temporary access to that one tab, until it navigates away, without any standing host permission.
  ```

  **scripting**

  ```
  Injects Huefinch's content script, which adds an SVG color filter (feColorMatrix) to the page, into the tab the user activated (chrome.scripting.executeScript). If, and only if, the user chooses "Turn on for all websites" and grants host access, registers the same script with chrome.scripting.registerContentScripts so every page is recolored as it loads; it is unregistered as soon as that access is removed.
  ```

  **Host permissions** (shown as `https://*/*` and `http://*/*`; one box covers both)

  ```
  Requested at runtime only, after the user clicks "Turn on for all websites" (onboarding, popup or settings). Lets the color filter apply automatically at document_start on every page, so colors are corrected before the page is shown, including pop-up dialogs and full-screen video. Huefinch never reads page content: the content script only adds the filter and listens for its own three key combinations. Never required at install; the user can turn it off at any time.
  ```

- **Are you using remote code?** **No, I am not using remote code.**
- **Data usage:** tick **none** of the data types (Huefinch collects nothing). Then tick **every** certification box (don't sell data; no use unrelated to the single purpose; no creditworthiness or lending; and any further one the form shows, such as advertising).
- **Privacy policy URL:**

  ```
  https://wrenbox.github.io/wrenbox-extensions/huefinch/privacy
  ```

### 2.5 Distribution tab

- **Payments:** free of charge. **Visibility:** **Public**. **Regions:** **All regions**.

### 2.6 Test instructions tab

No login is needed, but these notes speed up review:

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

### 2.7 Submit

**Submit for review**. In the confirmation dialog, keep **"Publish automatically after the item passes review"** ticked, or untick it if you want to pick the launch moment yourself. The dashboard will then show a **Publish** button once the item is approved.

Review usually takes a few days. The optional website access gets a closer look, and the permission justifications above are written for exactly that. If it's rejected, paste the whole email to me and I'll fix the cause.

## 3. Once it's live

1. Copy the store link (`https://chromewebstore.google.com/detail/huefinch-…/<id>`).
2. YouTube Studio → the video → **Details** → replace `[STORE LINK – add once the listing is live]` with it → **Save**.
3. Tell me the link. I'll add it to the READMEs and the Wrenbox website.

## Optional: Microsoft Edge Add-ons

This is free and doesn't use a Chrome slot. Register at [Partner Center](https://partner.microsoft.com/dashboard/microsoftedge/overview), then **Create new extension** → upload `huefinch-1.0.1-edge.zip`. Its name is shortened to Edge's 45-character limit: "Huefinch – Color Blind Filter & Identifier".

Use the same description, privacy policy URL, single purpose and screenshots. For the logo, `store-icon-128.png` meets Edge's 128×128 minimum (300×300 is only recommended).
