/**
 * Naming colors for people who can't rely on seeing them: a plain-English
 * description built from HSL ("Olive green", "Dark muted red"), plus the
 * nearest CSS named color by CIEDE2000 distance ("Close to: dark olive green").
 */
import { toLinear, type Vec3 } from './matrix';

export interface Hsl {
  /** Hue in degrees, 0–360. */
  h: number;
  /** Saturation, 0–1. */
  s: number;
  /** Lightness, 0–1. */
  l: number;
}

/** "#6b7a2e", "#6B7A2E" or "6b7a2e" (also the 3-digit form) → [107, 122, 46]. */
export function parseHex(hex: string): Vec3 | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** A hex color, or the rgb()/rgba() form some browsers report. */
export function parseColor(value: string): Vec3 | null {
  const hex = parseHex(value);
  if (hex) return hex;
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(value.trim());
  if (!m) return null;
  return [m[1]!, m[2]!, m[3]!].map((v) => Math.min(255, Math.round(Number(v)))) as Vec3;
}

export function toHex(rgb: Vec3): string {
  return `#${rgb
    .map((c) =>
      Math.max(0, Math.min(255, Math.round(c)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`.toUpperCase();
}

export function rgbToHsl([r8, g8, b8]: Vec3): Hsl {
  const r = r8 / 255;
  const g = g8 / 255;
  const b = b8 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

// ---------------------------------------------------------------------------
// Descriptive names

type HueName =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'lime green'
  | 'green'
  | 'teal'
  | 'cyan'
  | 'blue'
  | 'violet'
  | 'purple'
  | 'magenta'
  | 'pink';

/** Hue families by angle. Boundaries follow common usage rather than equal slices. */
const HUES: Array<[number, HueName]> = [
  [11, 'red'],
  [40, 'orange'],
  [64, 'yellow'],
  [85, 'lime green'],
  [158, 'green'],
  [182, 'teal'],
  [198, 'cyan'],
  [248, 'blue'],
  [268, 'violet'],
  [292, 'purple'],
  [322, 'magenta'],
  [345, 'pink'],
  [361, 'red'],
];

function hueFamily(h: number): HueName {
  for (const [end, name] of HUES) if (h < end) return name;
  return 'red';
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * A short, plain description of a color, e.g. "Olive green", "Dark muted red",
 * "Light gray", "Bright blue", "Pale pink".
 *
 * Built in three steps:
 *  1. Near-neutral colors are named by lightness alone (black, grays, white).
 *  2. A hue family is chosen, with everyday names for regions people name
 *     differently: dark orange is brown, dark yellow is olive, light red is pink,
 *     dark blue is navy.
 *  3. Modifiers for lightness (very dark, dark, light, pale) and saturation
 *     (grayish, muted, bright) are added in front.
 */
export function describeColor(rgb: Vec3): string {
  const { h, s, l } = rgbToHsl(rgb);
  const chroma = (Math.max(...rgb) - Math.min(...rgb)) / 255;

  // 1. Neutrals.
  if (chroma < 0.06 || s < 0.08 || l < 0.05 || l > 0.97) {
    if (l < 0.11) return 'Black';
    if (l < 0.3) return 'Dark gray';
    if (l < 0.6) return 'Gray';
    if (l < 0.84) return 'Light gray';
    if (l < 0.94) return 'Very light gray';
    return 'White';
  }

  // 2. Hue family, with everyday names.
  let hue: string = hueFamily(h);
  /** True when the everyday name already says "dark" or "light". */
  let impliesDark = false;
  let impliesLight = false;
  if ((hue === 'orange' || (hue === 'red' && h >= 4 && h < 11)) && l < 0.42 && s < 0.9) {
    hue = 'brown';
    impliesDark = true;
  } else if (hue === 'orange' && h >= 18 && l >= 0.42 && l < 0.82 && s < 0.5) {
    hue = 'tan';
  } else if ((hue === 'orange' || hue === 'yellow') && h >= 28 && l >= 0.82 && s < 0.75) {
    hue = 'beige';
    impliesLight = true;
  } else if ((h < 20 || h >= 355) && l >= 0.6 && l < 0.8 && s >= 0.6) {
    hue = 'coral';
    impliesLight = true;
  } else if (hue === 'yellow' && l < 0.4) {
    hue = 'olive';
    impliesDark = true;
  } else if (hue === 'lime green' && l < 0.42) {
    hue = 'olive green';
    impliesDark = true;
  } else if (hue === 'teal') {
    if (l >= 0.4) hue = h < 178 ? 'turquoise' : 'cyan';
  } else if (hue === 'cyan') {
    if (l < 0.32) hue = 'teal';
    else if (l >= 0.65 && s < 0.9) hue = 'blue';
  } else if (hue === 'red' && l >= 0.7) {
    hue = 'pink';
    impliesLight = true;
  } else if (hue === 'magenta' && l >= 0.7) {
    hue = h < 312 ? 'lilac' : 'pink';
    impliesLight = true;
  } else if (hue === 'magenta' && l < 0.36) {
    hue = 'purple';
  } else if (hue === 'pink' && l >= 0.7) {
    impliesLight = true;
  } else if (hue === 'pink' && l < 0.45) {
    hue = l < 0.3 ? 'red' : 'magenta'; // dark pinks read as crimson or raspberry
  } else if (hue === 'blue' && l < 0.28 && l >= 0.12) {
    hue = 'navy blue';
    impliesDark = true;
  } else if ((hue === 'violet' || hue === 'purple') && l >= 0.72) {
    hue = 'lavender';
    impliesLight = true;
  }

  // 3. Modifiers. HSL lightness calls saturated greens and yellows "dark" and
  // saturated blues "light", so "dark" uses the mean of HSL lightness and CIE L*.
  const shade = (l + rgbToLab(rgb)[0] / 100) / 2;
  const words: string[] = [];
  if (shade < 0.15) words.push('very dark');
  else if (shade < 0.36 && (!impliesDark || (hue === 'brown' && shade < 0.22))) words.push('dark');
  else if (l >= 0.88 && hue !== 'beige') words.push('pale');
  else if (l >= 0.7 && !impliesLight) words.push('light');

  if (s < 0.2) words.push('grayish');
  else if (s < 0.38 && l < 0.85) words.push('muted');
  else if (s >= 0.8 && l >= 0.4 && l <= 0.62) words.push('bright');

  words.push(hue);
  return cap(words.join(' '));
}

// ---------------------------------------------------------------------------
// CIE Lab and CIEDE2000

export type Lab = [number, number, number];

/** sRGB (0–255) → CIE L*a*b* (D65). */
export function rgbToLab(rgb: Vec3): Lab {
  const [r, g, b] = rgb.map((c) => toLinear(c / 255)) as Vec3;
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 / 116) * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIEDE2000 color difference (Sharma, Wu & Dalal 2005). */
export function deltaE2000([L1, a1, b1]: Lab, [L2, a2, b2]: Lab): number {
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const hp = (b: number, a: number) => {
    if (a === 0 && b === 0) return 0;
    const h = Math.atan2(b, a) / rad;
    return h < 0 ? h + 360 : h;
  };
  const h1p = hp(b1, a1p);
  const h2p = hp(b2, a2p);
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
  const Lbp = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) hbp = (h1p + h2p) / 2;
    else hbp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
  }
  const T =
    1 -
    0.17 * Math.cos((hbp - 30) * rad) +
    0.24 * Math.cos(2 * hbp * rad) +
    0.32 * Math.cos((3 * hbp + 6) * rad) -
    0.2 * Math.cos((4 * hbp - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt(
    (dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh),
  );
}

// ---------------------------------------------------------------------------
// CSS named colors

/**
 * The CSS named colors, written as words so they can be read aloud
 * ("dark olive green" is the keyword darkolivegreen). Synonyms (aqua/cyan,
 * fuchsia/magenta, grey/gray) are listed once, with the spelling US readers expect.
 */
const CSS_COLORS: Array<[string, string]> = [
  ['alice blue', 'f0f8ff'],
  ['antique white', 'faebd7'],
  ['aquamarine', '7fffd4'],
  ['azure', 'f0ffff'],
  ['beige', 'f5f5dc'],
  ['bisque', 'ffe4c4'],
  ['black', '000000'],
  ['blanched almond', 'ffebcd'],
  ['blue', '0000ff'],
  ['blue violet', '8a2be2'],
  ['brown', 'a52a2a'],
  ['burly wood', 'deb887'],
  ['cadet blue', '5f9ea0'],
  ['chartreuse', '7fff00'],
  ['chocolate', 'd2691e'],
  ['coral', 'ff7f50'],
  ['cornflower blue', '6495ed'],
  ['cornsilk', 'fff8dc'],
  ['crimson', 'dc143c'],
  ['cyan', '00ffff'],
  ['dark blue', '00008b'],
  ['dark cyan', '008b8b'],
  ['dark goldenrod', 'b8860b'],
  ['dark gray', 'a9a9a9'],
  ['dark green', '006400'],
  ['dark khaki', 'bdb76b'],
  ['dark magenta', '8b008b'],
  ['dark olive green', '556b2f'],
  ['dark orange', 'ff8c00'],
  ['dark orchid', '9932cc'],
  ['dark red', '8b0000'],
  ['dark salmon', 'e9967a'],
  ['dark sea green', '8fbc8f'],
  ['dark slate blue', '483d8b'],
  ['dark slate gray', '2f4f4f'],
  ['dark turquoise', '00ced1'],
  ['dark violet', '9400d3'],
  ['deep pink', 'ff1493'],
  ['deep sky blue', '00bfff'],
  ['dim gray', '696969'],
  ['dodger blue', '1e90ff'],
  ['firebrick', 'b22222'],
  ['floral white', 'fffaf0'],
  ['forest green', '228b22'],
  ['gainsboro', 'dcdcdc'],
  ['ghost white', 'f8f8ff'],
  ['gold', 'ffd700'],
  ['goldenrod', 'daa520'],
  ['gray', '808080'],
  ['green', '008000'],
  ['green yellow', 'adff2f'],
  ['honeydew', 'f0fff0'],
  ['hot pink', 'ff69b4'],
  ['indian red', 'cd5c5c'],
  ['indigo', '4b0082'],
  ['ivory', 'fffff0'],
  ['khaki', 'f0e68c'],
  ['lavender', 'e6e6fa'],
  ['lavender blush', 'fff0f5'],
  ['lawn green', '7cfc00'],
  ['lemon chiffon', 'fffacd'],
  ['light blue', 'add8e6'],
  ['light coral', 'f08080'],
  ['light cyan', 'e0ffff'],
  ['light goldenrod yellow', 'fafad2'],
  ['light gray', 'd3d3d3'],
  ['light green', '90ee90'],
  ['light pink', 'ffb6c1'],
  ['light salmon', 'ffa07a'],
  ['light sea green', '20b2aa'],
  ['light sky blue', '87cefa'],
  ['light slate gray', '778899'],
  ['light steel blue', 'b0c4de'],
  ['light yellow', 'ffffe0'],
  ['lime', '00ff00'],
  ['lime green', '32cd32'],
  ['linen', 'faf0e6'],
  ['magenta', 'ff00ff'],
  ['maroon', '800000'],
  ['medium aquamarine', '66cdaa'],
  ['medium blue', '0000cd'],
  ['medium orchid', 'ba55d3'],
  ['medium purple', '9370db'],
  ['medium sea green', '3cb371'],
  ['medium slate blue', '7b68ee'],
  ['medium spring green', '00fa9a'],
  ['medium turquoise', '48d1cc'],
  ['medium violet red', 'c71585'],
  ['midnight blue', '191970'],
  ['mint cream', 'f5fffa'],
  ['misty rose', 'ffe4e1'],
  ['moccasin', 'ffe4b5'],
  ['navajo white', 'ffdead'],
  ['navy', '000080'],
  ['old lace', 'fdf5e6'],
  ['olive', '808000'],
  ['olive drab', '6b8e23'],
  ['orange', 'ffa500'],
  ['orange red', 'ff4500'],
  ['orchid', 'da70d6'],
  ['pale goldenrod', 'eee8aa'],
  ['pale green', '98fb98'],
  ['pale turquoise', 'afeeee'],
  ['pale violet red', 'db7093'],
  ['papaya whip', 'ffefd5'],
  ['peach puff', 'ffdab9'],
  ['peru', 'cd853f'],
  ['pink', 'ffc0cb'],
  ['plum', 'dda0dd'],
  ['powder blue', 'b0e0e6'],
  ['purple', '800080'],
  ['rebecca purple', '663399'],
  ['red', 'ff0000'],
  ['rosy brown', 'bc8f8f'],
  ['royal blue', '4169e1'],
  ['saddle brown', '8b4513'],
  ['salmon', 'fa8072'],
  ['sandy brown', 'f4a460'],
  ['sea green', '2e8b57'],
  ['seashell', 'fff5ee'],
  ['sienna', 'a0522d'],
  ['silver', 'c0c0c0'],
  ['sky blue', '87ceeb'],
  ['slate blue', '6a5acd'],
  ['slate gray', '708090'],
  ['snow', 'fffafa'],
  ['spring green', '00ff7f'],
  ['steel blue', '4682b4'],
  ['tan', 'd2b48c'],
  ['teal', '008080'],
  ['thistle', 'd8bfd8'],
  ['tomato', 'ff6347'],
  ['turquoise', '40e0d0'],
  ['violet', 'ee82ee'],
  ['wheat', 'f5deb3'],
  ['white', 'ffffff'],
  ['white smoke', 'f5f5f5'],
  ['yellow', 'ffff00'],
  ['yellow green', '9acd32'],
];

const CSS_LAB: Array<{ name: string; keyword: string; hex: string; lab: Lab }> = CSS_COLORS.map(
  ([name, hex]) => ({
    name,
    keyword: name.replace(/ /g, ''),
    hex: `#${hex.toUpperCase()}`,
    lab: rgbToLab(parseHex(hex)!),
  }),
);

export const CSS_COLOR_COUNT = CSS_COLORS.length;

/** The CSS named color closest to `rgb` (CIEDE2000). */
export function nearestCssColor(rgb: Vec3): {
  name: string;
  keyword: string;
  hex: string;
  distance: number;
} {
  const lab = rgbToLab(rgb);
  let best = CSS_LAB[0]!;
  let bestD = Infinity;
  for (const c of CSS_LAB) {
    const d = deltaE2000(lab, c.lab);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return { name: best.name, keyword: best.keyword, hex: best.hex, distance: bestD };
}

/** Everything the identify card shows for one picked color. */
export interface ColorReport {
  hex: string;
  name: string;
  closeTo: string;
  cssKeyword: string;
}

export function identifyColor(value: string): ColorReport | null {
  const rgb = parseColor(value);
  if (!rgb) return null;
  const near = nearestCssColor(rgb);
  return {
    hex: toHex(rgb),
    name: describeColor(rgb),
    closeTo: near.name,
    cssKeyword: near.keyword,
  };
}

/** WCAG 2 relative luminance and contrast ratio. */
export function luminance(rgb: Vec3): number {
  const [r, g, b] = rgb.map((c) => toLinear(c / 255)) as Vec3;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: Vec3, b: Vec3): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
