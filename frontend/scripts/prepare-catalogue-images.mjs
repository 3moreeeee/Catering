// Turns the client's photographs of new products into catalogue images.
//
// The matches themselves are declared, with their reason, in
// src/app/data/catalog-images.data.ts. This script:
//   1. lists every image in the client folder and, for each product without a
//      photograph, looks for a file whose name equals the product name (after
//      harmless normalisation: case, accents, spacing, punctuation, extension),
//      so an exact match can never be missed;
//   2. validates every declared source (exists, non-empty, decodable image);
//   3. writes an 800 × 800 master JPG per photograph under
//      public/img/products/catalogue/, the input of prepare-product-images.mjs,
//      which then produces the .v2.webp the site serves, as for every product;
//   4. writes ../product-image-reconciliation.json.
//
// Run:  node scripts/prepare-catalogue-images.mjs

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { loadCatalog } from './lib/load-catalog.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.join(ROOT, '..');
const SOURCE_DIR = path.join(REPO, 'imformations_about_products_provided_by_the_client');
const OUT_DIR = path.join(ROOT, 'public', 'img', 'products', 'catalogue');
const IMAGE = /\.(png|jpe?g|webp|avif)$/i;

const catalog = await loadCatalog(ROOT);
const matches = catalog.CATALOG_IMAGES;
const rejections = catalog.CATALOG_IMAGE_REJECTIONS;

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : IMAGE.test(entry.name) ? [full] : [];
});
const files = walk(SOURCE_DIR);
// Some file names reached disk with UTF-8 accents read as code page 437
// ("Frappé" → "Frapp├⌐"); they are compared after repair.
const CP437 = { '├⌐': 'é', '├á': 'à', '├º': 'ç', '├¬': 'ê', '├»': 'ï', '├ó': 'â', '├┤': 'ô', '├╣': 'ù', '├¿': 'è', '├«': 'î' };
const repair = (text) => Object.entries(CP437).reduce((value, [bad, good]) => value.split(bad).join(good), text);
const normalise = (text) => repair(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(IMAGE, '').replace(/[^a-z0-9]+/g, ' ').trim();
const byName = new Map(files.map((file) => [normalise(path.basename(file)), file]));
const relative = (file) => path.relative(SOURCE_DIR, file).split(path.sep).join('/');

// Products without a photograph in the feeds: the additions.
const withoutImage = catalog.CATALOG_ADDITIONS;
const matched = [];
const unresolved = [];

mkdirSync(OUT_DIR, { recursive: true });
for (const addition of withoutImage) {
  const exact = byName.get(normalise(addition.name.fr));
  const declared = matches[addition.id];
  if (exact && !declared) throw new Error(`Exact file-name match not declared for ${addition.id}: ${relative(exact)}`);
  if (!declared) {
    unresolved.push({ productId: addition.id, productName: addition.name.fr, reason: rejections[addition.id] ?? 'Aucun fichier au nom de ce produit et de ce format' });
    continue;
  }
  // Photographs the owner already uploaded to ImageKit are kept as they are.
  if (declared.hosted?.length) {
    matched.push({ productId: addition.id, productName: addition.name.fr, matchType: declared.matchType, reason: declared.reason,
      images: declared.hosted.map((image) => ({ sourceImage: null, finalImage: image.src, width: image.width, height: image.height })) });
    continue;
  }
  const finals = [];
  for (const [index, source] of declared.sources.entries()) {
    const file = path.join(SOURCE_DIR, source);
    if (!existsSync(file) || statSync(file).size === 0) throw new Error(`Missing or empty source for ${addition.id}: ${source}`);
    const meta = await sharp(file).metadata();
    if (!meta.width || !meta.height) throw new Error(`Unreadable image for ${addition.id}: ${source}`);
    const base = `${declared.file}${index ? `-${index + 1}` : ''}`;
    // Same framing as the migrated gallery: white canvas, product centred.
    const flat = await sharp(file).flatten({ background: '#ffffff' }).toBuffer();
    const trimmed = await sharp(flat).trim({ background: '#ffffff', threshold: 18 }).toBuffer().catch(() => flat);
    await sharp(trimmed).resize(704, 704, { fit: 'inside' })
      .extend({ top: 48, bottom: 48, left: 48, right: 48, background: '#ffffff' })
      .resize(800, 800, { fit: 'contain', background: '#ffffff' })
      .jpeg({ quality: 92, mozjpeg: true })
      .toFile(path.join(OUT_DIR, `${base}.jpg`));
    finals.push({ sourceImage: source, finalImage: `/img/products/catalogue/${base}.v2.webp`, width: meta.width, height: meta.height, format: meta.format });
  }
  matched.push({ productId: addition.id, productName: addition.name.fr, matchType: declared.matchType, reason: declared.reason, images: finals });
}

execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'prepare-product-images.mjs'), 'catalogue'], { stdio: 'inherit' });

const report = {
  source: 'imformations_about_products_provided_by_the_client/',
  sourceImages: files.length,
  productsChecked: catalog.PRODUCTS.length,
  productsWithoutImage: withoutImage.length,
  matched,
  unresolved,
};
writeFileSync(path.join(REPO, 'product-image-reconciliation.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Source images: ${files.length}. Without image: ${withoutImage.length}. Matched: ${matched.length}. Unresolved: ${unresolved.length}.`);
