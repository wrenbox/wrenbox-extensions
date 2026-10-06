export interface Png {
  width: number;
  height: number;
  data: Uint8Array;
}
export function decodePng(buf: Buffer | Uint8Array): Png;
export function encodePng(png: Png): Buffer;
export function grayIcon(png: Png): Png;
