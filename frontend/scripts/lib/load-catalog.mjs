// Loads the TypeScript catalogue data into a Node script.
//
// The catalogue is authored as TypeScript modules with typed literals, so it
// cannot simply be imported. esbuild is already a dependency of the Angular
// build, so it is used here to bundle the data modules into a temporary ESM
// file that Node can import. This keeps the audit scripts reading the *real*
// catalogue rather than a hand-maintained copy of it, which is the only way a
// reconciliation report can be trusted.

import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function loadCatalog(root) {
  const dir = await mkdtemp(path.join(tmpdir(), 'fk-catalog-'));
  const outfile = path.join(dir, 'catalog.mjs');

  await build({
    entryPoints: [path.join(root, 'scripts', 'lib', 'catalog-entry.ts')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile,
    logLevel: 'silent',
  });

  try {
    return await import(pathToFileURL(outfile).href);
  } finally {
    // The import is resolved by now; the temporary bundle is no longer needed.
    setTimeout(() => void rm(dir, { recursive: true, force: true }), 0);
  }
}
