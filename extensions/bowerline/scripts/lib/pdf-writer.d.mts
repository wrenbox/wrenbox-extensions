export interface PdfBlock {
  text: string;
  size?: number;
  bold?: boolean;
  gap?: number;
}
export function wrap(text: string, width: number): string[];
export function makePdf(opts: { title: string; pages: PdfBlock[][]; seed?: string }): Buffer;
