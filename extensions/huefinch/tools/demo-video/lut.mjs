/**
 * Writes out/deutan.cube: a 33×33×33 3D LUT of the deuteranopia simulation
 * (Machado et al. 2009, severity 1) built from Huefinch's own maths in
 * src/shared/lut.ts and matrix.ts, for ffmpeg's lut3d. Bundled with esbuild,
 * so the video and the extension can never disagree.
 */
import * as esbuild from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { LUT, ROOT } from './config.mjs';

export async function writeLut() {
  const entry = `
    import { cubeLut } from './src/shared/lut';
    import { simulationMatrix } from './src/shared/matrix';
    export const text = cubeLut(simulationMatrix('deutan', 1), 33, 'Huefinch deuteranopia (Machado et al. 2009)');
  `;
  const out = await esbuild.build({
    stdin: { contents: entry, resolveDir: ROOT, loader: 'ts' },
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'warning',
  });
  const mod = await import(
    `data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`
  );
  mkdirSync(dirname(LUT), { recursive: true });
  writeFileSync(LUT, mod.text);
  return LUT;
}

if (process.argv[1]?.endsWith('lut.mjs')) console.log(await writeLut());
