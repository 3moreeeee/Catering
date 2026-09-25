// =============================================================================
// VINTO CATALOGUE CRAWL
//
// Collects publicly visible product facts from vinto.tn so the Société Ferid
// Khemakhem catalogue can be reconciled against it. It is an audit tool, not an
// importer: nothing it writes reaches the application. Output lands in
// tmp/vinto-import/ and is read by scripts/import-vinto-catalog.mjs, which is
// where the decisions about what may be published are made.
//
// POLITENESS AND PERMISSION
//
//   - robots.txt is fetched first and its Disallow rules are enforced for
//     `User-agent: *`. vinto.tn runs PrestaShop's default file, which forbids
//     cart, account, search and sort-parameter URLs; product and category pages
//     are permitted.
//   - One request at a time, with a delay between them. No concurrency.
//   - Every response is cached on disk, so a re-run costs the site nothing.
//     Delete tmp/vinto-import/cache to force a refetch.
//   - A descriptive User-Agent, so the operator can see who is calling.
//   - No login, no CAPTCHA, no rate-limit evasion, no personal data.
//
// WHAT IS COLLECTED
//
// Objective facts only: name, reference, category path, declared format,
// manufacturer id, and the URL of an image (recorded for the rights review, not
// downloaded). Prices and stock are captured into the private audit dataset
// because they distinguish variants; they are never carried into the catalogue.
//
// Usage:
//   node scripts/crawl-vinto.mjs [--limit N] [--refresh]
// =============================================================================

import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'tmp', 'vinto-import');
const CACHE = path.join(OUT, 'cache');

const ORIGIN = 'https://vinto.tn';
const UA =
  'fk-catering-catalogue-audit/1.0 (internal catalogue reconciliation; +https://catering.com.tn)';
const DELAY_MS = 1500;
const LIMIT = Number(process.argv[find('--limit') + 1]) || Infinity;
const REFRESH = process.argv.includes('--refresh');

function find(flag) {
  return process.argv.indexOf(flag);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// -----------------------------------------------------------------------------
// robots.txt
// -----------------------------------------------------------------------------

/** Disallow patterns for `User-agent: *`, as literal PrestaShop-style globs. */
let disallow = [];

function parseRobots(text) {
  const rules = [];
  let applies = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const [field, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    const key = field.trim().toLowerCase();
    if (key === 'user-agent') {
      applies = value === '*';
    } else if (key === 'disallow' && applies && value) {
      rules.push(value);
    }
  }
  return rules;
}

/** Translates a robots glob into a regular expression anchored at the path. */
function allowed(urlPath) {
  return !disallow.some((rule) => {
    const pattern = rule
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '\\?');
    return new RegExp(`^${pattern}`).test(urlPath) || new RegExp(pattern).test(urlPath);
  });
}

// -----------------------------------------------------------------------------
// Fetching, with a disk cache
// -----------------------------------------------------------------------------

const errors = [];
let fetched = 0;

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function get(url) {
  const { pathname, search } = new URL(url);
  if (!allowed(pathname + search)) {
    errors.push({ url, reason: 'disallowed by robots.txt', at: new Date().toISOString() });
    return null;
  }

  const key = createHash('sha1').update(url).digest('hex').slice(0, 16);
  const file = path.join(CACHE, `${key}.html`);
  if (!REFRESH && (await exists(file))) {
    return { html: await readFile(file, 'utf8'), status: 200, cached: true, url };
  }

  if (fetched > 0) await sleep(DELAY_MS);
  fetched++;

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      redirect: 'follow',
    });
    const html = await response.text();
    if (!response.ok) {
      errors.push({ url, status: response.status, at: new Date().toISOString() });
      return { html, status: response.status, cached: false, url: response.url };
    }
    await writeFile(file, html);
    return { html, status: response.status, cached: false, url: response.url };
  } catch (error) {
    errors.push({ url, reason: String(error).slice(0, 160), at: new Date().toISOString() });
    return null;
  }
}

// -----------------------------------------------------------------------------
// Extraction
// -----------------------------------------------------------------------------

const decode = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&eacute;/g, 'é')
    .replace(/&egrave;/g, 'è')
    .replace(/&agrave;/g, 'à')
    .replace(/&ccedil;/g, 'ç')
    .replace(/&ocirc;/g, 'ô')
    .replace(/&#\d+;/g, ' ');

const text = (s) => decode(String(s ?? '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

function meta(html, property) {
  const m =
    html.match(new RegExp(`property="${property}"\\s+content="([^"]*)"`, 'i')) ??
    html.match(new RegExp(`name="${property}"\\s+content="([^"]*)"`, 'i'));
  return m ? decode(m[1]) : null;
}

/** PrestaShop embeds the whole product record in a `data-product` attribute. */
function productJson(html) {
  const m = html.match(/data-product="([^"]+)"/);
  if (!m) return null;
  try {
    return JSON.parse(decode(m[1]));
  } catch {
    return null;
  }
}

function breadcrumb(html) {
  const block = html.match(/itemListElement[\s\S]{0,4000}/);
  if (!block) return [];
  return [...block[0].matchAll(/<span itemprop="name">([^<]*)<\/span>/g)].map((m) => text(m[1]));
}

// -----------------------------------------------------------------------------
// Crawl
// -----------------------------------------------------------------------------

const PRODUCT_URL = /^https:\/\/vinto\.tn\/[^"']*\/\d+-[^"'/]+\.html$/;
const CATEGORY_URL = /^https:\/\/vinto\.tn\/\d+-[^"'/?]*$/;
const BRAND_URL = /^https:\/\/vinto\.tn\/brand\/\d+-[^"'/?]*$/;

function links(html, pattern) {
  return [
    ...new Set(
      [...html.matchAll(/href="(https:\/\/vinto\.tn\/[^"]+)"/g)]
        .map((m) => decode(m[1]).replace(/#.*$/, ''))
        .filter((u) => pattern.test(u)),
    ),
  ];
}

/** Manufacturer badges live on category cards even when product JSON omits them. */
function listingManufacturers(html) {
  const listings = [];
  const cards = html.match(/<article class="[^"]*product-miniature[\s\S]*?<\/article>/g) ?? [];
  for (const card of cards) {
    const url = card.match(
      /<a href="(https:\/\/vinto\.tn\/[^"#]+\/\d+-[^"#]+\.html)" class="thumbnail product-thumbnail"/,
    )?.[1];
    const manufacturer = card.match(
      /class="manufacturer"[^>]*>\s*<a[^>]*>([^<]+)<\/a>\s*<\/div>/i,
    )?.[1];
    const manufacturerId = card.match(/id_manufacturer=(\d+)/i)?.[1];
    if (url && manufacturer) {
      listings.push({
        url: decode(url),
        manufacturerName: text(manufacturer),
        manufacturerId: manufacturerId ?? '0',
      });
    }
  }
  return listings;
}

await mkdir(CACHE, { recursive: true });

console.log('reading robots.txt…');
const robots = await fetch(`${ORIGIN}/robots.txt`, { headers: { 'User-Agent': UA } }).then((r) =>
  r.text(),
);
disallow = parseRobots(robots);
console.log(`  ${disallow.length} Disallow rules for *`);
await writeFile(path.join(OUT, 'robots.txt'), robots);

console.log('discovering categories…');
const home = await get(`${ORIGIN}/`);
if (!home) throw new Error('homepage unreachable');
const categories = links(home.html, CATEGORY_URL);
console.log(`  ${categories.length} category URLs`);

// The manufacturer is authoritative on the dedicated brand listing even when
// PrestaShop leaves both the product JSON and some category-card badges empty.
const brandByProductId = new Map();
const brandLinks = [
  ...home.html.matchAll(
    /<a href="(https:\/\/vinto\.tn\/brand\/(\d+)-[^"]+)"[^>]*>\s*<img[^>]*alt="([^"]+)"/g,
  ),
].map((match) => ({ url: decode(match[1]), id: match[2], name: text(match[3]) }));

console.log(`discovering products for ${brandLinks.length} brands…`);
for (const brand of brandLinks) {
  if (!BRAND_URL.test(brand.url)) continue;
  const first = await get(brand.url);
  if (!first) continue;
  const pages = [first.html];
  const pagination = [
    ...new Set(
      [...first.html.matchAll(/href="(https:\/\/vinto\.tn\/brand\/[^"?]+\?page=\d+)"/g)].map(
        (match) => decode(match[1]),
      ),
    ),
  ];
  for (const pageUrl of pagination) {
    const page = await get(pageUrl);
    if (page) pages.push(page.html);
  }
  for (const html of pages) {
    for (const productUrl of links(html, PRODUCT_URL)) {
      const sourceId = productUrl.match(/\/(\d+)-[^/]+\.html$/)?.[1];
      if (sourceId) brandByProductId.set(sourceId, { id: brand.id, name: brand.name });
    }
  }
  console.log(`  ${brand.name}: ${[...brandByProductId.values()].filter((b) => b.id === brand.id).length}`);
}

const productUrls = new Set();
const listingBrandByUrl = new Map();
for (const category of categories) {
  const page = await get(category);
  if (!page) continue;
  for (const url of links(page.html, PRODUCT_URL)) productUrls.add(url);
  for (const listing of listingManufacturers(page.html)) {
    listingBrandByUrl.set(listing.url, listing);
  }

  // Current PrestaShop pages use ?page=N; older category templates used ?p=N.
  // Support both so catalogue reconciliation never silently drops later pages.
  const pages = [
    ...new Set(
      [...page.html.matchAll(/href="(https:\/\/vinto\.tn\/[^"]*\?(?:p|page)=\d+)"/g)].map((m) =>
        decode(m[1]),
      ),
    ),
  ];
  for (const next of pages) {
    const extra = await get(next);
    if (extra) {
      for (const url of links(extra.html, PRODUCT_URL)) productUrls.add(url);
      for (const listing of listingManufacturers(extra.html)) {
        listingBrandByUrl.set(listing.url, listing);
      }
    }
  }
  process.stdout.write(`\r  ${productUrls.size} product URLs found`);
}
console.log('');

const all = [...productUrls].sort().slice(0, LIMIT);
console.log(`fetching ${all.length} product pages…`);

const products = [];
const brands = new Map();

for (const [index, url] of all.entries()) {
  const page = await get(url);
  if (!page || page.status !== 200) continue;

  const data = productJson(page.html) ?? {};
  const listing = listingBrandByUrl.get(url);
  const crumbs = breadcrumb(page.html);
  const name = text(data.name ?? meta(page.html, 'og:title') ?? '');
  if (!name) continue;
  const sourceId = String(data.id ?? data.id_product ?? url.match(/\/(\d+)-/)?.[1] ?? '');
  const listedBrand = brandByProductId.get(sourceId);

  const record = {
    sourceUrl: page.url,
    canonical: meta(page.html, 'og:url') ?? page.url,
    sourceId,
    name,
    reference: text(data.reference ?? ''),
    // Breadcrumb is [Accueil, Division, Family, Product] on this shop.
    breadcrumb: crumbs,
    category: crumbs.length > 2 ? crumbs[1] : null,
    family: crumbs.length > 3 ? crumbs[2] : null,
    manufacturerId: String(listedBrand?.id || data.id_manufacturer || listing?.manufacturerId || '0'),
    manufacturerName: text(
      listedBrand?.name ||
        (String(data.id_manufacturer ?? '0') !== '0' ? data.manufacturer_name : '') ||
        (listing?.manufacturerId !== '0' ? listing?.manufacturerName : ''),
    ),
    // Kept for variant identification only. Never published — see the header.
    private: {
      price: data.price ?? null,
      quantity: data.quantity ?? null,
      available: data.available_now ?? null,
    },
    descriptionSource: text(data.description_short ?? meta(page.html, 'description') ?? ''),
    imageUrl: meta(page.html, 'og:image'),
    imageCount: (data.images ?? []).length || null,
    httpStatus: page.status,
    collectedAt: new Date().toISOString(),
    extractionConfidence: data.reference ? 'high' : data.id ? 'medium' : 'low',
    provenance: {
      name: data.name ? 'data-product.name' : 'og:title',
      reference: data.reference ? 'data-product.reference' : null,
      category: crumbs.length ? 'breadcrumb' : null,
      description: data.description_short ? 'data-product.description_short' : 'meta description',
    },
  };

  products.push(record);

  const brandName = record.manufacturerName;
  if (brandName) {
    const key = brandName.toLowerCase();
    if (!brands.has(key)) {
      brands.set(key, { name: brandName, manufacturerId: record.manufacturerId, products: [] });
    }
    brands.get(key).products.push(record.name);
  }

  if ((index + 1) % 10 === 0) process.stdout.write(`\r  ${index + 1}/${all.length}`);
}
console.log(`\r  ${products.length} products extracted`);

await writeFile(path.join(OUT, 'raw-products.json'), JSON.stringify(products, null, 2));
await writeFile(
  path.join(OUT, 'raw-brands.json'),
  JSON.stringify([...brands.values()].sort((a, b) => a.name.localeCompare(b.name)), null, 2),
);
await writeFile(path.join(OUT, 'crawl-errors.json'), JSON.stringify(errors, null, 2));
await writeFile(path.join(OUT, 'source-urls.txt'), all.join('\n'));

console.log(
  `\ndone — ${products.length} products, ${brands.size} manufacturer names, ` +
    `${errors.length} errors, ${fetched} network requests`,
);
