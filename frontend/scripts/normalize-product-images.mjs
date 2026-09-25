/**
 * Normalises every migrated product photograph to an identical presentation.
 *
 *   node scripts/normalize-product-images.mjs
 *
 * The legacy gallery's biggest visual failure is that every photo has a
 * different background, scale and aspect ratio — some are cut-outs on white,
 * some sit on a blue studio backdrop, some are ambience shots. On a catalogue
 * grid that reads as disorder, and CSS `object-fit` can only centre them, not
 * make them consistent.
 *
 * For each image this:
 *   1. trims the uniform border (removes the blue/grey studio backdrop),
 *   2. fits the product into a square at a fixed occupancy,
 *   3. flattens onto pure white,
 *   4. re-encodes as an optimised JPEG.
 *
 * Originals are preserved in public/img/products/_original/ so the operation is
 * repeatable and reversible.
 *
 * This is a migration stopgap. It cannot invent detail the source lacks — see
 * docs/03-creative-direction.md §3.6 for the shooting spec the client should
 * follow when reshooting.
 */
import sharp from 'sharp';
import { readdirSync, mkdirSync, existsSync, copyFileSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const productsDir = join(root, 'public', 'img', 'products');
const backupDir = join(productsDir, '_original');

/** Output square edge, in pixels. Cards render at ~253 CSS px, so 2x covers retina. */
const SIZE = 700;
/** Padding inside the square, so no product touches the frame edge. */
const PAD = 44;

const CATEGORIES = ['food', 'packaging', 'hygiene'];

let processed = 0;
let skipped = 0;
let failed = 0;

for (const category of CATEGORIES) {
  const dir = join(productsDir, category);
  if (!existsSync(dir)) continue;

  const backupCategoryDir = join(backupDir, category);
  mkdirSync(backupCategoryDir, { recursive: true });

  for (const file of readdirSync(dir)) {
    if (!/\.(jpe?g|png)$/i.test(file)) continue;

    const source = join(dir, file);
    const backup = join(backupCategoryDir, file);

    // Keep a pristine copy the first time we touch a file, and always work
    // FROM the backup so re-running never compounds the trim.
    if (!existsSync(backup)) {
      copyFileSync(source, backup);
    }

    try {
      const target = source.replace(new RegExp(`${extname(file)}$`), '.jpg');

      const buffer = await sharp(backup)
        // Remove a uniform border of any colour — this is what strips the blue
        // studio backdrop and the excess white on cut-outs alike.
        .trim({ threshold: 18 })
        .resize(SIZE - PAD * 2, SIZE - PAD * 2, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 },
          withoutEnlargement: false,
        })
        .extend({
          top: PAD,
          bottom: PAD,
          left: PAD,
          right: PAD,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .jpeg({ quality: 82, mozjpeg: true, chromaSubsampling: '4:4:4' })
        .toBuffer();

      await sharp(buffer).toFile(target);
      processed++;
    } catch (error) {
      // A trim can fail when an image is entirely uniform; leave it untouched.
      console.warn(`  ! ${category}/${file}: ${error.message}`);
      failed++;
    }
  }
}

// Report the payload saving — the migrated originals were ~67 MB of
// unoptimised 2012-era JPEGs.
const totalBytes = (dir) => {
  let total = 0;
  const walk = (d) => {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        if (entry !== '_original') walk(full);
      } else total += stat.size;
    }
  };
  walk(dir);
  return total;
};

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1) + ' MB';

console.log(`\nNormalised ${processed} product images to ${SIZE}x${SIZE} on white.`);
if (skipped) console.log(`Skipped ${skipped}.`);
if (failed) console.log(`Failed ${failed} (left untouched).`);
console.log(`Originals preserved in public/img/products/_original/ (${mb(totalBytes(backupDir))}).`);
console.log(`Served payload now ${mb(totalBytes(productsDir))}.`);
