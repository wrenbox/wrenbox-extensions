import type { Color, Settings } from './types';

export interface ColorInfo {
  name: string;
  /** Highlight fill on light surfaces (web pages, PDFs, light theme). */
  light: string;
  /** Highlight fill for the dark theme of Bowerline's own pages. */
  dark: string;
  /** Opaque swatch colour for chips, bars and dots. */
  solid: string;
}

export const COLOR_INFO: Record<Color, ColorInfo> = {
  yellow: {
    name: 'Yellow',
    light: 'rgba(255,225,77,.78)',
    dark: 'rgba(255,214,51,.34)',
    solid: '#FFD84A',
  },
  mint: {
    name: 'Mint',
    light: 'rgba(142,240,198,.85)',
    dark: 'rgba(84,214,160,.34)',
    solid: '#7FE7BC',
  },
  pink: {
    name: 'Pink',
    light: 'rgba(255,169,216,.85)',
    dark: 'rgba(255,128,196,.34)',
    solid: '#FF9FD2',
  },
  sky: {
    name: 'Sky',
    light: 'rgba(156,220,255,.9)',
    dark: 'rgba(102,190,255,.36)',
    solid: '#8FD3FF',
  },
};

/** "Yellow" or, with a user label, "Yellow: key idea". Never colour alone. */
export function colorLabel(color: Color, labels?: Partial<Settings['labels']>): string {
  const name = COLOR_INFO[color].name;
  const label = labels?.[color]?.trim();
  return label ? `${name}: ${label}` : name;
}
