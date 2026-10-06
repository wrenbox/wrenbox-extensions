import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodePng, encodePng, grayIcon } from '../../scripts/lib/png.mjs';
import { simulationLabel } from '../../src/shared/labels';

describe('simulate pill wording', () => {
  it('says "blind" at full severity and "weak" with the percentage below it', () => {
    expect(simulationLabel('deutan', 100)).toBe('Simulating green-blind vision');
    expect(simulationLabel('protan', 100)).toBe('Simulating red-blind vision');
    expect(simulationLabel('tritan', 60)).toBe('Simulating blue-weak vision (60%)');
  });
});

describe('grey toolbar icon (made at build time)', () => {
  const icon = decodePng(readFileSync(join(import.meta.dirname, '../../public/icons/icon-32.png')));

  it('round-trips through the PNG writer', () => {
    const again = decodePng(encodePng(icon));
    expect(again.width).toBe(32);
    expect(Buffer.from(again.data).equals(Buffer.from(icon.data))).toBe(true);
  });

  it('has no color left and keeps transparency', () => {
    const gray = grayIcon(icon);
    for (let i = 0; i < gray.data.length; i += 4) {
      expect(gray.data[i]).toBe(gray.data[i + 1]);
      expect(gray.data[i]).toBe(gray.data[i + 2]);
      expect(gray.data[i + 3]).toBe(icon.data[i + 3]);
    }
  });
});
