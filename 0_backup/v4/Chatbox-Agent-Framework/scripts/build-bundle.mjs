import { build } from 'esbuild';
import { rm, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const outfile = 'dist/agent-framework.js';

await rm('dist', { recursive: true, force: true });
await mkdir(dirname(outfile), { recursive: true });

await build({
    entryPoints: ['src/agent-framework.ts'],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: ['es2020'],
    sourcemap: true,
    legalComments: 'none',
});
