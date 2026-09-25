/**
 * Generates the placeholder asset set so the site renders end-to-end before
 * the client supplies real photography and logos.
 *
 * Every file produced here is DESIGN-SYSTEM CORRECT but explicitly provisional.
 * Replace them with real assets before launch — see docs/07-content-migration.md.
 *
 *   node scripts/generate-assets.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');

const write = (relativePath, contents) => {
  const target = join(pub, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents, 'utf8');
};

// --- Brand marks -------------------------------------------------------------
// Wordmark set in the display face, using the system's own colours.

const wordmark = (fg, accent) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 44" role="img" aria-label="Société Ferid Khemakhem">
  <rect x="0" y="8" width="4" height="28" rx="2" fill="${accent}"/>
  <text x="16" y="24" font-family="Sora, system-ui, sans-serif" font-size="17" font-weight="700" letter-spacing="-0.5" fill="${fg}">CATERING</text>
  <text x="16" y="37" font-family="Inter, system-ui, sans-serif" font-size="8" letter-spacing="1.6" fill="${fg}" opacity="0.66">SOCIÉTÉ FERID KHEMAKHEM</text>
</svg>`;

write('img/logo.svg', wordmark('#141613', '#A85D33'));
write('img/logo-light.svg', wordmark('#FBF9F5', '#C67A4A'));

// --- Partner brand logos -----------------------------------------------------
// NEEDS_VERIFICATION: these are neutral typographic stand-ins, NOT the
// brands' real trademarks. Using a real logo requires the brand owner's
// permission, so we deliberately do not fabricate one.

for (const [slug, label] of [
  ['monin', 'MONIN'],
  ['martellato', 'MARTELLATO'],
  ['plastport', 'PLASTPORT'],
]) {
  write(
    `img/brands/${slug}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 44" role="img" aria-label="${label}">
  <text x="80" y="28" text-anchor="middle" font-family="Sora, system-ui, sans-serif" font-size="16" font-weight="600" letter-spacing="1.4" fill="#3D423B">${label}</text>
</svg>`,
  );
}

// --- Product image fallback --------------------------------------------------

write(
  'img/products/placeholder.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" role="img" aria-label="Product image not available">
  <rect width="400" height="400" fill="#F4F0E8"/>
  <rect x="120" y="120" width="160" height="160" rx="4" fill="none" stroke="#DFE0DB" stroke-width="2"/>
  <path d="M150 235l30-34 24 27 20-22 26 29" fill="none" stroke="#A8AEA3" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="176" cy="168" r="10" fill="none" stroke="#A8AEA3" stroke-width="2.5"/>
</svg>`,
);

// --- Editorial / category / hero / map placeholders --------------------------
// Flat SVG in the brand palette. Deliberately abstract: a fake photograph would
// be worse than an obvious placeholder.

const plate = (w, h, bg, accent, label) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">
  <rect width="${w}" height="${h}" fill="${bg}"/>
  <circle cx="${w * 0.7}" cy="${h * 0.34}" r="${Math.min(w, h) * 0.26}" fill="${accent}" opacity="0.2"/>
  <circle cx="${w * 0.32}" cy="${h * 0.7}" r="${Math.min(w, h) * 0.18}" fill="${accent}" opacity="0.3"/>
  <rect x="0" y="${h - 34}" width="${w}" height="34" fill="#141613" opacity="0.72"/>
  <text x="14" y="${h - 13}" font-family="Inter, system-ui, sans-serif" font-size="12" letter-spacing="1.2" fill="#FBF9F5">PLACEHOLDER — ${label.toUpperCase()}</text>
</svg>`;

// NOTE: the category / company / hero / map / OG imagery is NOT generated here.
// Those are real rasters produced by `scripts/generate-placeholder-art.mjs`,
// because a <picture> whose <source> 404s does not fall back, and because
// social scrapers cannot render SVG. This file owns only the vector marks.

// --- robots.txt --------------------------------------------------------------
// The legacy site returned 404 for this. See docs/01-audit.md finding A5.

write(
  'robots.txt',
  `User-agent: *
Allow: /

# Filtered catalogue permutations are canonicalised to the unfiltered list;
# keep them out of the index.
Disallow: /*?q=
Disallow: /*?sub=
Disallow: /*?brand=
Disallow: /*?industry=
Disallow: /*?size=
Disallow: /*?page=

Sitemap: https://www.catering.com.tn/sitemap.xml
`,
);

console.log('Generated placeholder assets and robots.txt in public/.');
console.log('NEEDS_VERIFICATION: replace every file under public/img/ with real assets before launch.');
