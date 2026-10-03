/** Line icons (24×24, 1.8 stroke), built as SVG elements. */
import { svg } from './dom';

const PATHS: Record<string, string[]> = {
  note: [
    'M5 4h14a1 1 0 0 1 1 1v10l-5 5H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z',
    'M15 20v-5h5',
    'M8 9h8M8 13h5',
  ],
  copy: ['M9 9h10v11H9z', 'M5 15V4h10'],
  trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13'],
  gear: [
    'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
    'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z',
  ],
  external: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
  download: ['M12 4v11', 'M7 10l5 5 5-5', 'M5 20h14'],
  upload: ['M12 20V9', 'M7 14l5-5 5 5', 'M5 4h14'],
  close: ['M6 6l12 12M18 6 6 18'],
  panel: ['M4 5h16v14H4z', 'M14 5v14'],
  file: ['M6 3h8l5 5v13H6z', 'M14 3v5h5'],
  highlight: ['M4 20h7', 'M14.5 4.5l5 5L10 19H5v-5Z'],
  search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z', 'M20 20l-4-4'],
  library: ['M5 4h4v16H5z', 'M11 4h4v16h-4z', 'M17 5l3 .8-3.6 14.2-3-.8'],
  keyboard: ['M3 6h18v12H3z', 'M7 10h.01M11 10h.01M15 10h.01M7 14h10'],
  info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 11v6', 'M12 7.5v.01'],
  shield: ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6Z', 'M9 12l2 2 4-4'],
  palette: [
    'M12 21a9 9 0 1 1 9-9c0 2-1.5 3-3 3h-2a2 2 0 0 0-1 3.7c.6.4.5 2.3-3 2.3Z',
    'M7.5 11h.01M10 7h.01M14.5 7h.01',
  ],
  minus: ['M5 12h14'],
  plus: ['M12 5v14M5 12h14'],
  chevronLeft: ['M15 6l-6 6 6 6'],
  chevronRight: ['M9 6l6 6-6 6'],
};

export type IconName = keyof typeof PATHS;

export function icon(name: IconName, size = 16): SVGElement {
  return svg(
    'svg',
    {
      viewBox: '0 0 24 24',
      width: size,
      height: size,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 1.8,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
    },
    ...(PATHS[name] ?? []).map((d) => svg('path', { d })),
  );
}
