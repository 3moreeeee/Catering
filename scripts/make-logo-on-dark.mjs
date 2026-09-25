// =============================================================================
// HEADER LOGO ASSETS
//
// Two problems, one script.
//
// **Contrast.** The supplied logo is a single flat PNG: a coloured spherical
// mark followed by "FERID KHEMAKHEM / Catering" set in a dark neutral grey.
// That grey is correct on the ivory bar and close to invisible on the forest
// hero, where the header is transparent — the company's name effectively
// disappeared from the first screen of its own website. A CSS filter cannot fix
// it, because anything strong enough to lift the wordmark also flattens the
// blue, orange and green of the mark, which is the part of the identity that
// must not change. So a second asset is produced instead, in which a pixel is
// recoloured only if it is **neutral** (red, green and blue within a small
// tolerance of each other) and **dark**. That is the wordmark and nothing else;
// every saturated pixel is copied through untouched, as is the alpha channel,
// so the letterforms keep their antialiasing and the mark keeps its gradients.
//
// **Weight.** The source is 2143x480 and 852 kB, and the header draws it 50px
// tall — about 223px wide. It was being fetched at high priority on every page
// on the site, mobile included, to paint a quarter of a megapixel into a strip
// the size of a postage stamp. Both variants are therefore emitted at 700px
// wide, which covers a 3x display, as a palette PNG — 832 kB becomes 18 kB.
//
// Usage: node scripts/make-logo-on-dark.mjs
// =============================================================================

import sharp from 'sharp';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMG = path.join(root, 'public', 'img');
const SOURCE = path.join(IMG, 'logo-transparent.png');

/** The ivory the rest of the dark header's type is set in. */
const INK = { r: 0xfb, g: 0xf9, b: 0xf5 };
/** How far apart the channels may be and still count as neutral. */
const NEUTRAL_TOLERANCE = 26;
/** Above this luminance a neutral pixel is a highlight in the mark, not type. */
const DARK_CEILING = 190;
/** Widest the header ever draws the lockup (223px), times three for density. */
const DELIVERY_WIDTH = 700;

async function kb(file) {
  return Math.round((await stat(file)).size / 1024);
}

/** Lifts the neutral, dark wordmark pixels to ivory and leaves the mark alone. */
async function liftWordmark() {
  const { data, info } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let recoloured = 0;

  for (let i = 0; i < data.length; i += info.channels) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a === 0) continue;

    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (spread > NEUTRAL_TOLERANCE || luminance > DARK_CEILING) continue;

    // The pixel's own darkness is the blend weight, so antialiased edges stay
    // smooth instead of turning into a hard ivory mask.
    const t = 1 - luminance / DARK_CEILING;
    data[i] = Math.round(r + (INK.r - r) * t);
    data[i + 1] = Math.round(g + (INK.g - g) * t);
    data[i + 2] = Math.round(b + (INK.b - b) * t);
    recoloured++;
  }

  console.log(`lifted ${recoloured.toLocaleString()} neutral pixels to ivory`);
  return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
}

/** Emits the delivery pair for one variant. */
async function emit(image, name) {
  // No WebP: a palette PNG of a two-colour wordmark and a small gradient mark
  // came out smaller than the WebP of the same thing, so there is no second
  // format worth negotiating and no <picture> element to write.
  const png = path.join(IMG, `${name}.png`);
  await image
    .resize({ width: DELIVERY_WIDTH, withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true })
    .toFile(png);
  console.log(`  ${name}.png ${await kb(png)} kB`);
}

console.log(`source ${await kb(SOURCE)} kB`);
await emit(await liftWordmark(), 'logo-on-dark');
await emit(sharp(SOURCE), 'logo-on-light');
