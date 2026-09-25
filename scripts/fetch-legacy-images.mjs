/**
 * Downloads the recoverable product photographs referenced by the 150-record
 * master catalogue into public/img/products/<category>/, using exactly the
 * filenames referenced by src/app/data/products.data.ts.
 *
 *   node scripts/fetch-legacy-images.mjs
 *
 * NOTE: catering.com.tn presents a certificate issued for cluster120.hosting.ovh.net,
 * so TLS verification is disabled FOR THIS SCRIPT ONLY. That is acceptable for a
 * one-off migration pull of public images from a known host; it is not
 * acceptable anywhere in the application. Fixing the certificate is a blocking
 * launch item — see docs/01-audit.md finding A1.
 *
 * The recovered images are low-resolution and inconsistently lit. They are a
 * migration stopgap; the client should supply proper product photography
 * (cut-out on white, consistent crop) per docs/03-creative-direction.md §3.6.
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataFile = join(root, 'src', 'app', 'data', 'products.data.ts');

const LEGACY_BASE = 'https://www.catering.com.tn/wp-content/gallery';
const CATEGORY_DIR = {
  food: 'agro-alimentaire',
  packaging: 'emballage',
  hygiene: 'hygiene',
};

// Extract (categoryId, local src) pairs straight from the generated data file,
// so this script can never drift from what the app actually requests.
const source = readFileSync(dataFile, 'utf8');
const entries = [...source.matchAll(/src: '\/img\/products\/(food|packaging|hygiene)\/([^']+)'/g)].map(
  ([, category, file]) => ({ category, file }),
);

console.log(`Found ${entries.length} product images to fetch.`);

// The local filenames were normalised (lowercased, punctuation stripped), so we
// need the ORIGINAL gallery filenames. Recover them from the legacy listing.
const legacyIndex = new Map();
for (const category of Object.keys(CATEGORY_DIR)) {
  const listUrl = `https://www.catering.com.tn/${
    category === 'food' ? 'agro-alimentaire' : category === 'packaging' ? 'produits-emballage' : 'hygiene'
  }/`;
  try {
    const html = await fetchText(listUrl);
    for (const [, href] of html.matchAll(/rel="group"\s+href="([^"]+)"/g)) {
      const original = href.split('/').pop();
      const normalised = decodeURIComponent(original)
        .replace(/[^A-Za-z0-9._-]/g, '-')
        .toLowerCase();
      legacyIndex.set(`${category}/${normalised}`, original);
    }
  } catch (error) {
    console.error(`  ! could not list ${category}: ${error.message}`);
  }
}

let ok = 0;
let failed = 0;

for (const { category, file } of entries) {
  const target = join(root, 'public', 'img', 'products', category, file);
  if (existsSync(target)) {
    ok++;
    continue;
  }

  const original = legacyIndex.get(`${category}/${file}`);
  if (!original) {
    console.warn(`  ? no legacy source for ${category}/${file}`);
    failed++;
    continue;
  }

  // Accented filenames appear percent-encoded in the listing, but the server
  // also serves them under the raw UTF-8 name. Try both spellings.
  const candidates = [original, encodeURIComponent(decodeURIComponent(original)), decodeURIComponent(original)];
  let saved = false;

  for (const candidate of new Set(candidates)) {
    const url = `${LEGACY_BASE}/${CATEGORY_DIR[category]}/${candidate}`;
    try {
      const buffer = await fetchBuffer(url);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, buffer);
      saved = true;
      break;
    } catch {
      // try the next spelling
    }
  }

  if (saved) {
    ok++;
  } else {
    console.error(`  x ${category}/${file} — not retrievable under any filename spelling`);
    failed++;
  }
}

console.log(`\nDone. ${ok} fetched or already present, ${failed} failed.`);
if (failed > 0) {
  console.log('Missing images fall back to public/img/products/placeholder.svg.');
}

// --- helpers -----------------------------------------------------------------

async function withInsecureTls(fn) {
  const previous = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  try {
    return await fn();
  } finally {
    if (previous === undefined) {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = previous;
    }
  }
}

function fetchText(url) {
  return withInsecureTls(async () => {
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  });
}

function fetchBuffer(url) {
  return withInsecureTls(async () => {
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  });
}
