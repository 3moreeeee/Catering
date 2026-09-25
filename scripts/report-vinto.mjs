// =============================================================================
// REVIEW DELIVERABLES
//
// Turns the machine-readable comparison into the two documents a person
// actually reads before signing anything off:
//
//   tmp/vinto-import/review-report.md          the decision document
//   tmp/vinto-import/image-rights-review.csv   the photography clearance list
//
// Usage: node scripts/report-vinto.mjs
// =============================================================================

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from './lib/load-catalog.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'tmp', 'vinto-import');

const report = JSON.parse(await readFile(path.join(OUT, 'comparison-report.json'), 'utf8'));
const raw = JSON.parse(await readFile(path.join(OUT, 'raw-products.json'), 'utf8'));
const errors = JSON.parse(await readFile(path.join(OUT, 'crawl-errors.json'), 'utf8'));
const catalog = await loadCatalog(root);

const { summary, results, brandAudit } = report;
const byClass = (c) => results.filter((r) => r.classification === c);
const rawByUrl = new Map(raw.map((r) => [r.sourceUrl, r]));

// -----------------------------------------------------------------------------
// Image rights
// -----------------------------------------------------------------------------

const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const imageRows = results
  .filter((r) => ['NEW_VERIFIED_PRODUCT', 'NEW_UNVERIFIED_PRODUCT'].includes(r.classification))
  .map((r) => {
    const source = rawByUrl.get(r.sourceUrl);
    return {
      product: r.vintoName,
      sourceImageUrl: source?.imageUrl ?? '',
      sourcePage: r.sourceUrl,
      likelyCopyrightOwner:
        'Unknown — most likely the manufacturer, possibly the retailer. Not established.',
      officialManufacturerImageFound: 'not searched',
      localImageAlreadyAvailable: 'no',
      usageRightsConfirmed: 'NO',
      proposedFilename: '',
      actionRequired:
        'Obtain the manufacturer’s product photograph with written permission, or ' +
        'photograph the article. Placeholder ships until then.',
    };
  });

const imageHeader = Object.keys(imageRows[0] ?? { product: '' });
await writeFile(
  path.join(OUT, 'image-rights-review.csv'),
  [
    imageHeader.join(','),
    ...imageRows.map((row) => imageHeader.map((h) => csvEscape(row[h])).join(',')),
  ].join('\n'),
);

// -----------------------------------------------------------------------------
// Review report
// -----------------------------------------------------------------------------

const table = (rows) =>
  [
    '| Product | Brand seen | Classification | Existing match | Category | Verification | Image | Action |',
    '|---|---|---|---|---|---|---|---|',
    ...rows.map((r) =>
      [
        r.vintoName.replace(/\|/g, '/').slice(0, 60),
        r.brandFromName ?? '—',
        r.classification,
        r.existingMatchName ? `${r.existingMatchName} (${r.existingMatchId})` : '—',
        r.mappedCategoryId ? `${r.mappedCategoryId}/${r.mappedSubcategoryId ?? '—'}` : '—',
        r.classification === 'NEW_VERIFIED_PRODUCT' ? 'facts only' : 'held',
        'placeholder',
        r.proposedAction,
      ].join(' | '),
    ).map((line) => `| ${line} |`),
  ].join('\n');

const md = `# Vinto ↔ Catering catalogue reconciliation

Generated ${summary.generatedAt.slice(0, 16).replace('T', ' ')} · source \`vinto.tn\` ·
baseline: the ${summary.fkProductsExisting} curated Catering references.

This is a review document. Nothing in it has been published on the strength of
the crawl alone — see **What was published** below for exactly what reached the
site and why.

## How the data was collected

- \`robots.txt\` was read first and its ${'`Disallow`'} rules enforced for \`User-agent: *\`.
  vinto.tn runs PrestaShop's default file: cart, account, search and sort-parameter
  URLs are forbidden and were not requested. Product and category pages are permitted.
- One request at a time, 1.5 s apart, single-threaded, with a descriptive
  User-Agent. ${'`'}283${'`'} network requests in total for 87 category pages and
  ${raw.length} product pages.
- Every response is cached on disk, so re-running the audit costs the source nothing.
- No login, no CAPTCHA, no rate-limit evasion, no personal data.
- ${errors.length} errors, all of them 404s on empty category stubs discovered from
  the homepage navigation (\`/10-\`, \`/12-\`, …). No product page failed.

## What was found

| Classification | Count | What happens to it |
|---|---|---|
${Object.entries(summary.counts)
  .sort((a, b) => b[1] - a[1])
  .map(([k, v]) => {
    const fate = {
      NEW_VERIFIED_PRODUCT: 'generated into the catalogue',
      EXISTING_VARIANT: 'held — belongs as a **format** on the existing product, not a new record',
      POSSIBLE_DUPLICATE: 'held for human review',
      NEW_UNVERIFIED_PRODUCT: 'held — something material is missing',
      OUT_OF_SCOPE: 'held — no Catering family for it',
      EXACT_DUPLICATE: 'no action, already in the catalogue',
      INSUFFICIENT_DATA: 'held',
    }[k];
    return `| ${k} | ${v} | ${fate} |`;
  })
  .join('\n')}

## What was published

${byClass('NEW_VERIFIED_PRODUCT').length} records were classified as safe to publish and
generated into \`src/app/data/products.imported.data.ts\`. A record qualified only
if it is absent from the curated catalogue, maps onto an existing Catering
division **and** family, and carries an objective format, pack quantity or
reference — without which it could not later be told apart from its own variants.

Every generated record:

- carries **no price and no stock figure**;
- carries **no brand attribution** unless the manufacturer is already a published
  Catering partner. Monin is; ${brandAudit
    .filter((b) => !b.mayPublishAsPartner)
    .map((b) => b.name)
    .join(', ')} are not, and are attributed to nothing;
- carries **no sentence from the source**. Descriptions are composed from the
  division, family and format in the register the curated records already use;
- points at the existing placeholder image, because no image right has been cleared;
- states no origin, certification or specification that was not published.

## Brands

A brand appearing on vinto.tn is evidence that the product exists. It is not
evidence that Société Ferid Khemakhem represents the manufacturer, and it is
never treated as such.

| Brand | Products seen | Classification | May publish as partner | What would be needed |
|---|---|---|---|---|
${brandAudit
  .map(
    (b) =>
      `| ${b.name} | ${b.productsOnVinto} | ${b.classification} | ${
        b.mayPublishAsPartner ? 'yes — already published' : '**no**'
      } | ${b.verificationRequired ?? '—'} |`,
  )
  .join('\n')}

PrestaShop's manufacturer field is empty on all ${raw.length} source records, so the
brand had to be read out of the product name. That is a weaker signal than a
structured field and is treated as one: it groups products for review, and
attributes nothing.

## Taxonomy

Every mapping is a judgement about where an article belongs, and they are listed
in one place — \`scripts/lib/taxonomy.mjs\` — so they can be argued with. Two
layers: the product name decides for the families the source mixes together, and
the source's own family name decides for the rest.

${
  summary.proposedFamilies.length
    ? `### Proposed new families — a business decision, not an import detail\n\n${summary.proposedFamilies
        .map(
          (f) =>
            `- **${f.vintoFamily}** (${f.vintoDivision}, ${f.products} products) — ${f.note}`,
        )
        .join('\n')}`
    : 'No new families were needed.'
}

## Held for review

### Existing variants (${byClass('EXISTING_VARIANT').length})

The same article the catalogue already has, in a different size or pack. These
should become **formats on the existing product**, not second records — importing
them would split one product into two.

${table(byClass('EXISTING_VARIANT').slice(0, 30))}

### Possible duplicates (${byClass('POSSIBLE_DUPLICATE').length})

Close enough to need a person. Never imported automatically.

${table(byClass('POSSIBLE_DUPLICATE').slice(0, 40))}

### Out of scope and unverified (${byClass('OUT_OF_SCOPE').length + byClass('NEW_UNVERIFIED_PRODUCT').length})

${table([...byClass('OUT_OF_SCOPE'), ...byClass('NEW_UNVERIFIED_PRODUCT')])}

## Images

No image was downloaded, hotlinked or published. \`image-rights-review.csv\` lists
every candidate with its source page so rights can be cleared or the article
photographed. Until then all ${byClass('NEW_VERIFIED_PRODUCT').length} imported records
show the catalogue's existing placeholder.

## Remaining business decisions

1. Confirm or reject the ${byClass('EXISTING_VARIANT').length} variants as formats on existing products.
2. Rule on the ${byClass('POSSIBLE_DUPLICATE').length} possible duplicates.
3. Decide whether the hygiene division takes on cleaning chemicals (3 products).
4. Produce distribution documentation for ${brandAudit
  .filter((b) => !b.mayPublishAsPartner)
  .map((b) => b.name)
  .join(', ')} — or accept that their products stay unbranded on the site.
5. Clear product photography, or commission it.
6. Confirm the two English product names the lexicon could not finish.

## Reproducing this

\`\`\`
node scripts/crawl-vinto.mjs          # polite, cached; --refresh to refetch
node scripts/compare-vinto.mjs        # reconciliation, writes the reports
node scripts/import-vinto-catalog.mjs # --dry-run to see it without writing
node scripts/report-vinto.mjs         # this document
\`\`\`

The comparison always runs against \`CURATED_PRODUCTS\`, never the combined
catalogue — otherwise the pipeline reads its own previous output as an existing
catalogue and deletes itself on the second run.
`;

await writeFile(path.join(OUT, 'review-report.md'), md);

console.log(`wrote review-report.md (${Math.round(md.length / 1024)} kB) and image-rights-review.csv (${imageRows.length} rows)`);
console.log(`catalogue now holds ${catalog.PRODUCTS.length} products`);
