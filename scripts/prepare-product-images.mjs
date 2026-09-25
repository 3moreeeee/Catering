/**
 * Creates transparent WebP derivatives for every product master photograph.
 *
 * The source JPGs remain untouched. Only a light, neutral background connected
 * to the image border is removed, so enclosed white labels and packaging stay
 * intact. Photographs with a deliberate non-white backdrop are simply encoded
 * to WebP without destructive segmentation.
 *
 * Usage: node scripts/prepare-product-images.mjs
 */
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const productDirectories = ['vinto', 'monin'].map((name) =>
  path.join(root, 'public', 'img', 'products', name),
);

// A very pale or transparent product can legitimately occupy only a few
// non-white pixels. In that case an automatic cut-out cannot reliably tell the
// product from the studio canvas. Keep the original pixels and let CSS blend
// the white canvas into the card instead of publishing a damaged silhouette.
const MIN_SAFE_FOREGROUND_COVERAGE = 0.08;
const FORCE_BLEND_PATTERNS = [/coiffe-bouffant/i, /doseur-metal/i];

const isWhite = (r, g, b, floor = 208) =>
  Math.min(r, g, b) >= floor && Math.max(r, g, b) - Math.min(r, g, b) <= 48;

const pixelIsWhite = (data, index, floor) =>
  isWhite(data[index], data[index + 1], data[index + 2], floor);

const hasWhiteCanvas = (data, width, height) => {
  const corners = [0, width - 1, (height - 1) * width, height * width - 1];
  return corners.filter((pixel) => pixelIsWhite(data, pixel * 4, 190)).length >= 2;
};

const removeConnectedWhite = (data, width, height) => {
  const pixels = width * height;
  const mask = new Uint8Array(pixels);
  const queue = new Int32Array(pixels);
  let head = 0;
  let tail = 0;

  const enqueue = (pixel) => {
    if (mask[pixel] || !pixelIsWhite(data, pixel * 4, 208)) return;
    mask[pixel] = 255;
    queue[tail++] = pixel;
  };

  for (let x = 0; x < width; x++) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (head < tail) {
    const pixel = queue[head++];
    const x = pixel % width;
    if (x > 0) enqueue(pixel - 1);
    if (x + 1 < width) enqueue(pixel + 1);
    if (pixel >= width) enqueue(pixel - width);
    if (pixel + width < pixels) enqueue(pixel + width);
  }

  // Feather only the narrow anti-aliased fringe touching the detected canvas.
  // This removes the familiar white halo without reaching enclosed white areas.
  let frontier = queue.slice(0, tail);
  for (let pass = 0; pass < 3; pass++) {
    const next = [];
    for (const pixel of frontier) {
      const x = pixel % width;
      const neighbours = [];
      if (x > 0) neighbours.push(pixel - 1);
      if (x + 1 < width) neighbours.push(pixel + 1);
      if (pixel >= width) neighbours.push(pixel - width);
      if (pixel + width < pixels) neighbours.push(pixel + width);
      for (const neighbour of neighbours) {
        if (mask[neighbour]) continue;
        const offset = neighbour * 4;
        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];
        const minimum = Math.min(r, g, b);
        if (!isWhite(r, g, b, 166)) continue;
        mask[neighbour] = Math.round(((minimum - 166) / 42) * 220) + 24;
        next.push(neighbour);
      }
    }
    frontier = next;
  }

  let transparentPixels = 0;
  for (let pixel = 0; pixel < pixels; pixel++) {
    if (!mask[pixel]) continue;
    data[pixel * 4 + 3] = 255 - mask[pixel];
    if (mask[pixel] === 255) transparentPixels++;
  }
  return transparentPixels;
};

let processed = 0;
let transparent = 0;
let photographic = 0;
let blendProtected = 0;

for (const directory of productDirectories) {
  const files = (await readdir(directory)).filter((file) => /\.jpe?g$/i.test(file));
  for (const file of files) {
    const source = path.join(directory, file);
    // Versioned output invalidates any previously cached, over-aggressive
    // cut-outs in customer browsers and at the CDN edge.
    const target = path.join(directory, file.replace(/\.jpe?g$/i, '.v2.webp'));
    const { data, info } = await sharp(source)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (FORCE_BLEND_PATTERNS.some((pattern) => pattern.test(file))) {
      blendProtected++;
    } else if (hasWhiteCanvas(data, info.width, info.height)) {
      removeConnectedWhite(data, info.width, info.height);
      let foregroundPixels = 0;
      for (let offset = 3; offset < data.length; offset += 4) {
        if (data[offset] > 24) foregroundPixels++;
      }

      if (foregroundPixels / (info.width * info.height) < MIN_SAFE_FOREGROUND_COVERAGE) {
        for (let offset = 3; offset < data.length; offset += 4) data[offset] = 255;
        blendProtected++;
      } else {
        transparent++;
      }
    } else {
      photographic++;
    }

    await sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .webp({ quality: 90, alphaQuality: 100, smartSubsample: true })
      .toFile(target);
    processed++;
  }
}

console.log(`Prepared ${processed} product WebPs.`);
console.log(`Transparent white canvas removed: ${transparent}.`);
console.log(`Pale or fine products protected with lossless visual blending: ${blendProtected}.`);
console.log(`Intentional photographic backgrounds preserved: ${photographic}.`);
