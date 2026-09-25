/**
 * Emits sitemap.xml from the prerendered route list.
 *
 * Run after `ng build` — it walks the build output rather than a hand-kept list,
 * so the sitemap cannot drift out of sync with what was actually generated.
 * The legacy site had no sitemap at all (docs/01-audit.md, finding A5).
 *
 *   node scripts/generate-sitemap.mjs
 */
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const browserDir = join(root, 'dist', 'fk-catering', 'browser');
const ORIGIN = 'https://www.catering.com.tn';
const LOCALES = ['fr', 'en'];

/** Recursively collects every prerendered index.html. */
function collect(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collect(full, found);
    } else if (entry === 'index.html') {
      found.push(dirname(full));
    }
  }
  return found;
}

let dirs;
try {
  dirs = collect(browserDir);
} catch {
  console.error('No build output found. Run `ng build` first.');
  process.exit(1);
}

/** `dist/.../browser/fr/products/food` → `fr/products/food` */
const toRoute = (dir) => relative(browserDir, dir).split(sep).join('/');

const routes = dirs
  .map(toRoute)
  .filter((route) => route !== '' && LOCALES.includes(route.split('/')[0]))
  // 404 and the provisional legal pages are noindex; keep them out.
  .filter((route) => !/\/(404|privacy|terms)$/.test(route))
  .sort();

/** Groups a route with its counterpart in the other locale for hreflang. */
const pathWithoutLocale = (route) => route.split('/').slice(1).join('/');

const priorityFor = (path) => {
  if (path === '') return '1.0';
  if (path === 'products') return '0.9';
  if (/^products\/[^/]+$/.test(path)) return '0.8';
  if (['about', 'contact', 'brands', 'industries'].includes(path)) return '0.7';
  return '0.6';
};

const changefreqFor = (path) =>
  path === '' || path.startsWith('products') ? 'weekly' : 'monthly';

const lastmod = new Date().toISOString().split('T')[0];

const urls = routes
  .map((route) => {
    const path = pathWithoutLocale(route);
    const alternates = LOCALES.map(
      (locale) =>
        `    <xhtml:link rel="alternate" hreflang="${locale}" href="${ORIGIN}/${locale}${path ? `/${path}` : ''}"/>`,
    ).join('\n');

    return `  <url>
    <loc>${ORIGIN}/${route}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreqFor(path)}</changefreq>
    <priority>${priorityFor(path)}</priority>
${alternates}
    <xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}/fr${path ? `/${path}` : ''}"/>
  </url>`;
  })
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;

writeFileSync(join(browserDir, 'sitemap.xml'), xml, 'utf8');
console.log(`Wrote sitemap.xml with ${routes.length} URLs.`);
