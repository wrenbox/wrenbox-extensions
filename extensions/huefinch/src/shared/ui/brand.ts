/** Wrenbox and Huefinch words used on several pages. */

export const STUDIO_LINE = 'Made by Wrenbox: small, private tools for your browser.';
export const PRIVACY_URL = 'https://wrenbox.github.io/wrenbox-extensions/huefinch/privacy';
export const STORY =
  'Most birds see more colors than people do, with four kinds of color-sensing cells where we have three. Huefinch lends your eyes a little of that, by adjusting web pages so colors that look alike become easy to tell apart.';
export const NOT_MEDICAL =
  'Huefinch is a comfort setting, not a medical test. It can’t diagnose color vision deficiency; an eye-care professional can.';

/** The three-color Wrenbox accent bar. */
export function brandBar(): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'brand-bar';
  bar.setAttribute('aria-hidden', 'true');
  bar.append(
    document.createElement('span'),
    document.createElement('span'),
    document.createElement('span'),
  );
  return bar;
}
