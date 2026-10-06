# Uploading Huefinch to the Chrome Web Store

This uses your **second** item slot (Bowerline is the first). New accounts get two slots by default, so don't submit anything else until more slots are granted.

## Before you start
1. **Trademark check:** search "Huefinch" on tmsearch.uspto.gov and ipindia.gov.in (Class 9 and Class 42). If anything live shows up in those classes, stop and tell me.
2. **Test it yourself:** `chrome://extensions` → Developer mode → Load unpacked → `extensions/huefinch/dist`. Go through the checklist in `extensions/huefinch/README.md`.
3. **Real screenshots:** the images in `store-assets/` were designed before the code. If the built extension looks noticeably different, re-capture them at 1280×800 (DevTools → device toolbar → 1280×800 → Ctrl+Shift+P → "Capture screenshot"). Store images must show the real product.
4. **Privacy page live:** push the repo and check `https://wrenbox.github.io/<repo-name>/huefinch/privacy` opens.
5. **Video:** follow `YOUTUBE_UPLOAD.md` and keep the link ready. This step is optional; it can be added after launch.

## In the developer dashboard
1. **Items → New item** → upload `extensions/huefinch/release/huefinch-<version>.zip`.
2. **Store listing tab:**
   - **Description:** paste the detailed description from `extensions/huefinch/CHROMEWEBSTORE.md`.
   - **Category:** Accessibility. **Language:** English.
   - **Store icon:** `store-assets/store-icon-128.png`
   - **Screenshots, in this order:**
     1. `screenshot-1-before-after.png`
     2. `screenshot-2-popup.png`
     3. `screenshot-3-identify.png`
     4. `screenshot-4-simulate.png`
     5. `screenshot-5-settings.png`
   - **Small promo tile:** `store-assets/promo-small-440x280.png`
   - **Marquee promo tile:** `store-assets/promo-marquee-1400x560.png`
   - **Global promo video:** the YouTube link, if ready.
   - **Homepage URL:** your GitHub Pages site, or leave empty.
   - **Support URL:** the repo's Issues page, or `mailto:wrenbox.studio@gmail.com`.
3. **Privacy tab:**
   - **Single purpose:** copy from `CHROMEWEBSTORE.md`.
   - **Permission justifications:** copy each one from `CHROMEWEBSTORE.md` (storage, activeTab, scripting, host permissions).
   - **Remote code:** No.
   - **Data usage:** tick nothing collected, then tick the three certification boxes.
   - **Privacy policy URL:** the GitHub Pages link from step 4 above.
4. **Distribution tab:** Free, Public, all regions.
5. **Submit for review.**

## While it's in review
- Expect a few days, possibly longer. Huefinch asks for website access (as an optional permission), which gets a closer look.
- If it's rejected, paste the full rejection email here and I'll fix the cause.

## Optional: Microsoft Edge
Register at Microsoft Partner Center (Edge Add-ons), then upload `release/huefinch-<version>-edge.zip` with the same images and text. This doesn't use a Chrome slot.
