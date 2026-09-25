/**
 * Generates the designed placeholder imagery as real rasters.
 *
 *   node scripts/generate-placeholder-art.mjs
 *
 * These are still placeholders — they are line-art compositions in the brand
 * palette, not photographs, and they say so. But they are composed to the same
 * constraints the real photography must satisfy, so dropping a real photo in
 * later changes nothing about the layout:
 *
 *   · category plates keep the lower third clear for the white overlay text
 *   · the company plate keeps the lower-right clear for the "1985" badge
 *   · every file is emitted at the exact dimensions the templates declare
 *
 * Output is JPEG/PNG, not SVG, because social scrapers cannot render SVG and
 * because these need to behave exactly like the photographs that replace them.
 */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');

const C = {
  ivory: '#FBF9F5',
  ivory100: '#F4F0E8',
  ivory200: '#E8E2D6',
  stone: '#DFE0DB',
  forest900: '#0F2019',
  forest700: '#1D4030',
  forest300: '#8FB6A2',
  copper: '#A85D33',
  copper400: '#C67A4A',
  teal: '#2F6B70',
  green: '#2A5942',
  ink: '#141613',
};

async function emit(relativePath, svg, { png = false } = {}) {
  const target = join(pub, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  const pipeline = sharp(Buffer.from(svg));
  await (png
    ? pipeline.png({ compressionLevel: 9 }).toFile(target)
    : pipeline.jpeg({ quality: 86, mozjpeg: true }).toFile(target));
  console.log('  ✓', relativePath);
}

/** SVG is XML: a bare & is a parse error, not a character. */
const xml = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Small caps caption strip, so a placeholder is never mistaken for final art. */
const caption = (w, h, text, light) => `
  <rect x="0" y="${h - 30}" width="${w}" height="30" fill="${light ? C.ink : '#000000'}" opacity="0.62"/>
  <text x="16" y="${h - 10}" font-family="Inter, Segoe UI, sans-serif" font-size="11"
        letter-spacing="1.4" fill="${C.ivory}" opacity="0.9">PLACEHOLDER — ${xml(text)}</text>`;

// --- Category plates ---------------------------------------------------------
// Dark ground, product silhouettes in the UPPER TWO THIRDS. The lower third is
// deliberately empty: the panel's white title, description and CTA sit there
// over a scrim, and any detail underneath would fight them.

const bottle = (x, y, s, fill, op) => `
  <path d="M${x - 13 * s} ${y} q0 ${-9 * s} ${5 * s} ${-13 * s} l0 ${-11 * s} q0 ${-3 * s} ${3 * s} ${-3 * s}
           l${10 * s} 0 q${3 * s} 0 ${3 * s} ${3 * s} l0 ${11 * s} q${5 * s} ${4 * s} ${5 * s} ${13 * s}
           l0 ${34 * s} q0 ${5 * s} ${-5 * s} ${5 * s} l${-16 * s} 0 q${-5 * s} 0 ${-5 * s} ${-5 * s} z"
        fill="${fill}" opacity="${op}"/>`;

const jar = (x, y, s, fill, op) => `
  <rect x="${x - 15 * s}" y="${y - 4 * s}" width="${30 * s}" height="${38 * s}" rx="${4 * s}" fill="${fill}" opacity="${op}"/>
  <rect x="${x - 17 * s}" y="${y - 12 * s}" width="${34 * s}" height="${9 * s}" rx="${2 * s}" fill="${fill}" opacity="${op * 1.25}"/>`;

const verrine = (x, y, s, fill, op) => `
  <path d="M${x - 15 * s} ${y} l${4 * s} ${34 * s} q${1 * s} ${4 * s} ${5 * s} ${4 * s} l${12 * s} 0
           q${4 * s} 0 ${5 * s} ${-4 * s} l${4 * s} ${-34 * s} z" fill="${fill}" opacity="${op}"/>`;

const pick = (x, y, s, fill, op) => `
  <rect x="${x - 1.2 * s}" y="${y}" width="${2.4 * s}" height="${40 * s}" rx="${1.2 * s}" fill="${fill}" opacity="${op}"/>
  <circle cx="${x}" cy="${y - 5 * s}" r="${6 * s}" fill="${fill}" opacity="${op * 1.3}"/>`;

const glove = (x, y, s, fill, op) => `
  <path d="M${x - 14 * s} ${y + 40 * s} l0 ${-22 * s} q0 ${-6 * s} ${5 * s} ${-6 * s} l0 ${-13 * s}
           q0 ${-4 * s} ${4 * s} ${-4 * s} q${4 * s} 0 ${4 * s} ${4 * s} l0 ${11 * s} l${2 * s} 0 l0 ${-16 * s}
           q0 ${-4 * s} ${4 * s} ${-4 * s} q${4 * s} 0 ${4 * s} ${4 * s} l0 ${16 * s} l${2 * s} 0 l0 ${-11 * s}
           q0 ${-4 * s} ${4 * s} ${-4 * s} q${4 * s} 0 ${4 * s} ${4 * s} l0 ${41 * s} z"
        fill="${fill}" opacity="${op}"/>`;

const roll = (x, y, s, fill, op) => `
  <rect x="${x - 13 * s}" y="${y}" width="${26 * s}" height="${40 * s}" rx="${3 * s}" fill="${fill}" opacity="${op}"/>
  <ellipse cx="${x}" cy="${y}" rx="${13 * s}" ry="${5 * s}" fill="${fill}" opacity="${op * 1.4}"/>
  <ellipse cx="${x}" cy="${y}" rx="${4 * s}" ry="${1.8 * s}" fill="${C.forest900}" opacity="0.8"/>`;

const categoryPlate = (bg, accent, art, label) => `
<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1250" viewBox="0 0 1000 1250">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${bg}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${C.forest900}" stop-opacity="1"/>
    </linearGradient>
    <radialGradient id="glow" cx="62%" cy="30%" r="55%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1000" height="1250" fill="url(#g)"/>
  <rect width="1000" height="1250" fill="url(#glow)"/>
  <!-- Objects live in the upper two thirds only; the lower third carries text. -->
  <g transform="translate(0,120)">${art}</g>
  <!-- Contact shadow line, grounding the objects. -->
  <rect x="140" y="700" width="720" height="1.5" fill="${accent}" opacity="0.28"/>
  ${caption(1000, 1250, label)}
</svg>`;

// --- Company / warehouse plate ----------------------------------------------
// Light ground, racking and pallets. The lower-right quadrant is kept clear
// because the "FONDÉE EN 1985" badge overlaps there.

const warehouse = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500" viewBox="0 0 1200 1500">
  <rect width="1200" height="1500" fill="${C.ivory100}"/>
  <rect y="1080" width="1200" height="420" fill="${C.ivory200}" opacity="0.55"/>

  <!-- Racking bays -->
  <g stroke="${C.forest700}" stroke-width="7" fill="none" opacity="0.32">
    <path d="M110 250 V1080 M470 250 V1080 M830 250 V1080"/>
    <path d="M110 250 H830 M110 530 H830 M110 810 H830 M110 1080 H830"/>
  </g>

  <!-- Stacked cartons -->
  <g fill="${C.copper}" opacity="0.30">
    <rect x="140" y="330" width="140" height="180" rx="5"/>
    <rect x="300" y="370" width="140" height="140" rx="5"/>
    <rect x="500" y="310" width="150" height="200" rx="5"/>
    <rect x="670" y="380" width="140" height="130" rx="5"/>
  </g>
  <g fill="${C.teal}" opacity="0.26">
    <rect x="140" y="620" width="150" height="180" rx="5"/>
    <rect x="310" y="660" width="130" height="140" rx="5"/>
    <rect x="500" y="640" width="160" height="160" rx="5"/>
    <rect x="680" y="600" width="130" height="200" rx="5"/>
  </g>
  <g fill="${C.green}" opacity="0.24">
    <rect x="150" y="900" width="160" height="170" rx="5"/>
    <rect x="330" y="930" width="140" height="140" rx="5"/>
    <rect x="520" y="880" width="150" height="190" rx="5"/>
  </g>

  <!-- Pallet in the foreground, left of the badge zone -->
  <g fill="${C.forest700}" opacity="0.34">
    <rect x="120" y="1180" width="330" height="18" rx="4"/>
    <rect x="120" y="1226" width="330" height="18" rx="4"/>
    <rect x="130" y="1198" width="22" height="28"/>
    <rect x="274" y="1198" width="22" height="28"/>
    <rect x="418" y="1198" width="22" height="28"/>
  </g>
  <rect x="150" y="1050" width="270" height="130" rx="6" fill="${C.copper}" opacity="0.22"/>

  <!-- lower-right kept empty for the FONDÉE EN 1985 badge -->
  ${caption(1200, 1500, 'WAREHOUSE', true)}
</svg>`;

// --- Hero poster -------------------------------------------------------------
// Mirrors the 3D scene so the swap from poster to canvas is not a jump cut.

const heroPoster = `
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900" viewBox="0 0 900 900">
  <defs>
    <radialGradient id="a" cx="70%" cy="36%" r="52%">
      <stop offset="0%" stop-color="${C.copper}" stop-opacity="0.20"/>
      <stop offset="100%" stop-color="${C.copper}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="b" cx="24%" cy="74%" r="46%">
      <stop offset="0%" stop-color="${C.teal}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${C.teal}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="900" height="900" fill="${C.forest900}"/>
  <rect width="900" height="900" fill="url(#a)"/>
  <rect width="900" height="900" fill="url(#b)"/>

  <!-- the still brass ring at the centre -->
  <ellipse cx="450" cy="450" rx="118" ry="40" fill="none" stroke="#C9A227" stroke-width="7" opacity="0.85"/>

  <!-- the three forms, equally weighted, as in HeroOrbitScene -->
  ${bottle(742, 404, 1.85, '#E0AB63', 0.9)}
  ${verrine(158, 408, 2.2, '#EDF3F2', 0.85)}
  <rect x="392" y="392" width="116" height="116" rx="6" fill="#F6F3EC" opacity="0.8"/>
</svg>`;

// --- Static map --------------------------------------------------------------

const map = `
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="720" viewBox="0 0 960 720">
  <rect width="960" height="720" fill="${C.ivory100}"/>
  <g stroke="${C.stone}" stroke-width="16" opacity="0.9">
    <path d="M0 190 H960 M0 430 H960 M240 0 V720 M640 0 V720"/>
  </g>
  <g stroke="${C.stone}" stroke-width="7" opacity="0.65">
    <path d="M0 300 H960 M0 570 H960 M420 0 V720 M820 0 V720 M110 0 V720"/>
  </g>
  <!-- industrial blocks -->
  <g fill="${C.forest700}" opacity="0.12">
    <rect x="270" y="220" width="130" height="90" rx="4"/>
    <rect x="450" y="220" width="170" height="90" rx="4"/>
    <rect x="270" y="330" width="150" height="80" rx="4"/>
    <rect x="670" y="200" width="130" height="110" rx="4"/>
    <rect x="450" y="460" width="170" height="90" rx="4"/>
  </g>
  <!-- pin -->
  <g transform="translate(480,300)">
    <path d="M0 42 C0 42 26 14 26 -6 A26 26 0 1 0 -26 -6 C-26 14 0 42 0 42 Z" fill="${C.copper}"/>
    <circle cy="-6" r="9.5" fill="${C.ivory}"/>
  </g>
  ${caption(960, 720, 'LOCATION MAP', true)}
</svg>`;

// --- Open Graph card ---------------------------------------------------------
// PNG, 1200x630 exactly — the size every social scraper expects.

const og = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="og" cx="76%" cy="30%" r="60%">
      <stop offset="0%" stop-color="${C.copper}" stop-opacity="0.26"/>
      <stop offset="100%" stop-color="${C.copper}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="${C.forest900}"/>
  <rect width="1200" height="630" fill="url(#og)"/>
  <rect x="72" y="150" width="5" height="54" rx="2.5" fill="${C.copper400}"/>
  <text x="98" y="182" font-family="Sora, Segoe UI, sans-serif" font-size="34" font-weight="700"
        letter-spacing="-0.5" fill="${C.ivory}">CATERING</text>
  <text x="98" y="212" font-family="Inter, Segoe UI, sans-serif" font-size="15"
        letter-spacing="2.6" fill="${C.forest300}">SOCIÉTÉ FERID KHEMAKHEM</text>

  <text x="72" y="352" font-family="Sora, Segoe UI, sans-serif" font-size="60" font-weight="600"
        letter-spacing="-1.6" fill="${C.ivory}">Des produits professionnels.</text>
  <text x="72" y="424" font-family="Sora, Segoe UI, sans-serif" font-size="60" font-weight="600"
        letter-spacing="-1.6" fill="${C.ivory}">Des partenariats durables.</text>

  <rect x="72" y="480" width="64" height="2" fill="${C.copper400}"/>
  <text x="72" y="528" font-family="Inter, Segoe UI, sans-serif" font-size="21" fill="${C.forest300}">
    Agro-alimentaire · Emballage · Hygiène — Tunisie, depuis 1985
  </text>

  ${bottle(1010, 250, 2.0, '#E0AB63', 0.55)}
  ${verrine(1118, 300, 1.7, '#EDF3F2', 0.4)}
</svg>`;

// --- run ---------------------------------------------------------------------

console.log('Generating placeholder artwork…');

await emit(
  'img/categories/food.jpg',
  categoryPlate(
    '#1A1410',
    C.copper,
    `${bottle(330, 330, 3.4, C.copper400, 0.5)}
     ${jar(560, 400, 3.2, C.copper400, 0.34)}
     ${bottle(760, 380, 2.6, C.copper400, 0.24)}`,
    'FOOD & BEVERAGE',
  ),
);

await emit(
  'img/categories/packaging.jpg',
  categoryPlate(
    '#101C1D',
    C.teal,
    `${verrine(320, 330, 4.0, '#7FB3B6', 0.42)}
     ${verrine(540, 380, 3.2, '#7FB3B6', 0.28)}
     ${pick(700, 300, 3.6, '#7FB3B6', 0.34)}
     ${pick(790, 330, 3.0, '#7FB3B6', 0.22)}`,
    'PACKAGING',
  ),
);

await emit(
  'img/categories/hygiene.jpg',
  categoryPlate(
    '#101A14',
    C.green,
    `${glove(330, 300, 4.2, C.forest300, 0.38)}
     ${roll(600, 360, 4.0, C.forest300, 0.3)}
     ${roll(780, 400, 3.2, C.forest300, 0.2)}`,
    'HYGIENE',
  ),
);

await emit('img/company/warehouse.jpg', warehouse);
await emit('img/hero/hero-poster.jpg', heroPoster);
await emit('img/map/static-map.jpg', map);
await emit('img/og/default.png', og, { png: true });

console.log('\nDone. These remain placeholders — replace with real photography.');
console.log('Composition constraints are documented in docs/07-content-migration.md.');
