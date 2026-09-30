// Exports the supplier price-list reconciliation to every place that needs it:
//
//   backend/src/main/resources/seed/catalog-reconciliation.json
//       the batch CatalogReconciliationRunner applies to an existing database
//       (Neon already holds the catalogue, and CatalogSeeder never touches a
//       populated table): additions, corrections, deactivations, repricings;
//   backend/src/main/resources/seed/catalog-seed.json
//       patched in place with the same batch, so a fresh database starts from
//       the reconciled catalogue. Untouched fields stay byte-identical, which
//       keeps the ImageKit URLs the media migration wrote into them;
//   ../catalog-reconciliation.json and ../catalog-reconciliation-report.md
//       the machine-readable and human reports. Old values are read from the
//       committed seed (git HEAD), so every "old → new" is computed, not typed.
//
// Sources: src/app/data/catalog-reconciliation.data.ts (which products exist
// and under which identity) and src/app/data/supplier-price-lists.data.ts
// (what each PDF line says, and the sale terms it gives).
//
// Run:  node scripts/export-catalog-reconciliation.mjs

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from './lib/load-catalog.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.join(ROOT, '..');
const SEED_DIR = path.join(REPO, 'backend', 'src', 'main', 'resources', 'seed');
const SEED_FILE = path.join(SEED_DIR, 'catalog-seed.json');
const BATCH_FILE = path.join(SEED_DIR, 'catalog-reconciliation.json');

const catalog = await loadCatalog(ROOT);
const {
  CATALOG_ADDITIONS: additions,
  CATALOG_CORRECTIONS: corrections,
  CATALOG_REMOVALS: removals,
  CATALOG_RECONCILIATION_BATCH: batchId,
  SALE_TERMS: saleTerms,
  SUPPLIER_LINES: lines,
  UNPRICED_BY_SUPPLIER: unpriced,
} = catalog;

// Fresh records, built by the seed exporter itself so both paths agree.
const scratch = mkdtempSync(path.join(tmpdir(), 'fk-reconcile-'));
const freshFile = path.join(scratch, 'seed.json');
execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'export-backend-seed.mjs'), '--out', freshFile], { stdio: 'ignore' });
const fresh = new Map(JSON.parse(readFileSync(freshFile, 'utf8')).products.map((row) => [row.sourceId, row]));
rmSync(scratch, { recursive: true, force: true });

// What the committed seed, and therefore Neon, holds today.
const committed = JSON.parse(execFileSync('git', ['show', 'HEAD:backend/src/main/resources/seed/catalog-seed.json'], { cwd: REPO, maxBuffer: 64 * 1024 * 1024 }).toString('utf8'));
const before = new Map(committed.products.map((row) => [row.sourceId, row]));

const feed = new Map([...catalog.IMPORTED_PRODUCTS, ...catalog.MONIN_PRODUCTS].map((product) => [product.id, product]));
const need = (map, id, what) => {
  const value = map.get(id);
  if (!value) throw new Error(`${what}: ${id} not found`);
  return value;
};
const addedIds = new Set(additions.map((addition) => addition.id));
const removedIds = new Set(removals.map((removal) => removal.id));

// ---------------------------------------------------------------------------
// Backend batch

const CORRECTED_FIELDS = [
  'nameFr', 'nameEn', 'shortDescriptionFr', 'shortDescriptionEn', 'descriptionFr', 'descriptionEn',
  'seoTitleFr', 'seoTitleEn', 'seoDescriptionFr', 'seoDescriptionEn',
];
const COMMERCIAL_FIELDS = ['price', 'currency', 'saleMode', 'unitPrice', 'unitLabel', 'reference', 'stockQuantity', 'formats'];

const allPriced = [...saleTerms.entries()].filter(([, terms]) => terms.status === 'PRICED');
const existingPriced = allPriced.filter(([id]) => !addedIds.has(id));

// Neon already holds the additions from a first run of this batch, priced the
// way that run priced them: the Vinto price for the four Vinto listings, none
// for the others. That is the value their repricing compares against.
const crawl = new Map(JSON.parse(readFileSync(path.join(ROOT, 'tmp', 'vinto-import', 'raw-products.json'), 'utf8'))
  .map((record) => [String(record.sourceId), record.private?.price ?? null]));
const crawlPrice = (id) => {
  const listing = String(id).match(/^p-monin-(\d+)$/)?.[1];
  const raw = listing ? crawl.get(listing) : null;
  const match = typeof raw === 'string' ? raw.replace(/\s/g, '').match(/^(\d+)(?:[.,](\d{1,3}))?/) : null;
  return match ? `${match[1]}.${(match[2] ?? '').padEnd(3, '0')}` : null;
};
const expectedPriceOf = (id) => (addedIds.has(id) ? crawlPrice(id) : need(before, id, 'repricing before').price);
const batch = {
  batch: batchId,
  generatedBy: 'frontend/scripts/export-catalog-reconciliation.mjs',
  additions: additions.map((addition) => need(fresh, addition.id, 'addition')),
  corrections: corrections.map((correction) => {
    const row = need(fresh, correction.id, 'correction');
    return {
      sourceId: correction.id,
      expectedNameFr: need(feed, correction.id, 'correction feed').name.fr,
      expectedFormatValue: need(feed, correction.id, 'correction feed').formats[0]?.value ?? null,
      ...Object.fromEntries(CORRECTED_FIELDS.map((field) => [field, row[field]])),
      formats: row.formats,
      imageAlts: row.images.map((image) => ({ altFr: image.altFr, altEn: image.altEn })),
    };
  }),
  deactivations: removals.map((removal) => ({
    sourceId: removal.id,
    expectedNameFr: need(feed, removal.id, 'removal feed').name.fr,
    reason: removal.reason,
  })),
  repricings: allPriced.map(([id]) => {
    const row = need(fresh, id, 'repricing');
    return {
      sourceId: id,
      expectedPrice: expectedPriceOf(id),
      price: row.price, saleMode: row.saleMode, unitPrice: row.unitPrice, unitLabel: row.unitLabel,
      reference: row.reference, formats: row.formats,
    };
  }),
  unavailable: [...saleTerms.entries()]
    .filter(([id, terms]) => !addedIds.has(id) && terms.status === 'UNAVAILABLE')
    .map(([id]) => ({ sourceId: id, expectedStock: need(before, id, 'unavailable before').stockQuantity ?? null })),
  // Each addition's photographs: those matched with certainty from the client
  // folder (catalog-images.data.ts), or none. The runner never replaces a
  // photograph an administrator uploaded.
  imageSets: additions.map((addition) => ({ sourceId: addition.id, images: need(fresh, addition.id, 'image set').images })),
};
writeFileSync(BATCH_FILE, `${JSON.stringify(batch, null, 2)}\n`, 'utf8');

// ---------------------------------------------------------------------------
// Seed patch: start from the committed seed and apply the batch, so fields the
// batch does not own (image URLs, Vinto stock, slugs) stay exactly as they were.

const correctionsById = new Map(batch.corrections.map((correction) => [correction.sourceId, correction]));
const repricedIds = new Set(existingPriced.map(([id]) => id));
const unavailableIds = new Set(batch.unavailable.map((reset) => reset.sourceId));
const seed = { ...committed, generatedAt: committed.generatedAt };
seed.products = committed.products
  .filter((row) => !removedIds.has(row.sourceId) && !addedIds.has(row.sourceId))
  .map((row) => {
    let next = { ...row, saleMode: row.saleMode ?? 'UNIT', unitPrice: row.unitPrice ?? null, unitLabel: row.unitLabel ?? null };
    const correction = correctionsById.get(row.sourceId);
    if (correction) {
      next = {
        ...next,
        ...Object.fromEntries(CORRECTED_FIELDS.map((field) => [field, correction[field]])),
        formats: correction.formats,
        images: row.images.map((image, index) => ({ ...image, ...(correction.imageAlts[index] ?? {}) })),
      };
    }
    const target = fresh.get(row.sourceId);
    if (repricedIds.has(row.sourceId)) {
      for (const field of ['price', 'currency', 'saleMode', 'unitPrice', 'unitLabel', 'reference', 'formats']) next[field] = target[field];
    }
    if (unavailableIds.has(row.sourceId)) next.stockQuantity = 0;
    return next;
  });
seed.products.push(...batch.additions);
writeFileSync(SEED_FILE, `${JSON.stringify(seed, null, 2)}\n`, 'utf8');
const after = new Map(seed.products.map((row) => [row.sourceId, row]));

// An existing product's images must be byte-identical; an added product may
// carry only the photographs declared for it in catalog-images.data.ts.
for (const [id, row] of after) {
  const old = before.get(id);
  if (old && JSON.stringify(old.images.map((image) => image.src)) !== JSON.stringify(row.images.map((image) => image.src))) {
    throw new Error(`Image changed on ${id}`);
  }
  const declared = catalog.CATALOG_IMAGES[id];
  if (!old && row.images.length !== (declared?.hosted?.length || declared?.sources.length || 0)) throw new Error(`New product ${id} carries undeclared images`);
}

// ---------------------------------------------------------------------------
// Reports

const toMillimes = (value) => (value == null ? null : Math.round(Number(value) * 1000));
const money = (value) => (value == null ? '—' : `${(toMillimes(value) / 1000).toFixed(3).replace('.', ',')}`);
const firstFormat = (row) => row?.formats?.[0] ?? null;

/** The fields a reader cares about, flattened so two records can be compared. */
const facts = (row) => row && ({
  nameFr: row.nameFr, nameEn: row.nameEn,
  price: row.price == null ? null : money(row.price),
  saleMode: row.saleMode ?? 'UNIT',
  unitPrice: row.unitPrice == null ? null : money(row.unitPrice),
  packQuantity: firstFormat(row)?.packQuantity ?? null,
  unitLabel: row.unitLabel ?? null,
  format: firstFormat(row)?.value ?? null,
  reference: row.reference ?? null,
  formatReference: firstFormat(row)?.reference ?? null,
  stockQuantity: row.stockQuantity ?? null,
  active: !removedIds.has(row.sourceId),
});
const diff = (oldRow, newRow) => {
  const a = facts(oldRow) ?? {};
  const b = facts(newRow) ?? {};
  return Object.fromEntries(Object.keys({ ...a, ...b })
    .filter((key) => JSON.stringify(a[key] ?? null) !== JSON.stringify(b[key] ?? null))
    .map((key) => [key, { old: a[key] ?? null, new: b[key] ?? null }]));
};

const lineOf = (key) => lines[key];
const official = (terms) => terms.lines.map((key) => {
  const entry = lineOf(key);
  return {
    key, pdf: entry.pdf, page: entry.page, designation: entry.designation,
    priceHT: entry.price === null ? null : entry.price.replace('.', ','),
    priceCovers: entry.basis === 'piece' ? 'une pièce' : `le lot de ${entry.colisage}`,
    colisage: entry.colisage, vat: entry.vat ?? null, reference: entry.reference ?? null,
    brand: entry.brand ?? null, unavailable: Boolean(entry.unavailable),
  };
});

const records = [];
for (const [id, row] of after) {
  const terms = saleTerms.get(id);
  const fields = diff(before.get(id), row);
  const action = addedIds.has(id) ? 'ADD' : Object.keys(fields).length ? 'UPDATE' : 'KEEP';
  records.push({
    action, productId: id, productName: row.nameFr, category: row.categoryId,
    sourcePdf: terms ? official(terms).map((entry) => entry.pdf).filter((v, i, all) => all.indexOf(v) === i).join(' + ') : null,
    page: terms ? official(terms)[0].page : null,
    officialDesignation: terms ? official(terms).map((entry) => entry.designation).join(' + ') : null,
    official: terms ? official(terms) : [],
    saleTerms: terms ? {
      status: terms.status, saleMode: terms.saleMode,
      unitPrice: terms.unitMillimes == null ? null : money(terms.unitMillimes / 1000),
      salePackQuantity: terms.packQuantity, supplierCartonQuantity: terms.supplierColisage,
      price: terms.priceMillimes == null ? null : money(terms.priceMillimes / 1000),
      unit: terms.unit, vat: terms.vat, note: terms.note,
    } : null,
    fields,
    imageStatus: !addedIds.has(id) ? 'UNCHANGED' : catalog.CATALOG_IMAGES[id] ? 'MATCHED' : 'REQUIRED',
  });
}
for (const removal of removals) {
  records.push({
    action: removal.action === 'MERGE' ? 'MERGE' : 'DELETE', productId: removal.id,
    productName: need(before, removal.id, 'removal').nameFr, category: need(before, removal.id, 'removal').categoryId,
    sourcePdf: removal.sourcePdf, officialDesignation: removal.sourceDesignation, reason: removal.reason,
    fields: { active: { old: true, new: false } }, imageStatus: 'UNCHANGED',
  });
}

const PRICE_INTERPRETATION = [
  ['Liste des prix Agroalimentaire 04 2026', 'PV (HT) d’une boîte / bouteille / pot ; colisage = carton ; TVA 19 % imprimée'],
  ['Liste des Prix Monin 05 2026', 'PV Unitaire (HT) d’une bouteille, boîte ou sac ; colisage = carton (6, 4 ou 5 ; 1 pour les accessoires)'],
  ['Liste des emballages alimentaires 06 2026', 'Prix unitaire (HT) d’une pièce ; « Nombre de pièces par carton » ; TVA 19 % imprimée'],
  ['Gobelets PET & PAPIER & EPS 04 2022', 'PRIX (HT) d’une pièce ; gobelets et couvercles sont des lignes séparées'],
  ['Liste des Couverts jetables 08 2022', 'PRIX UNITAIRE (HT) d’une pièce ; carton de 1000 à 3000'],
  ['Liste des prix Verre en polycarbonate 06 2023', 'Prix HT d’un verre ; référence P/PCG… imprimée ; colisage 24 à 80'],
  ['Liste des produits asiatiques 06 2026', 'PV UNITAIRE (HT) d’une pièce ; TVA 19 % imprimée'],
  ['Consommables hygiène 06-2026 TC', 'PV H.T d’une pièce ; colisage ; « Rupture provisoire » sans prix pour 4 lignes'],
  ['Film étirable et Rouleau Aluminium 04-2026', 'Prix Unitaire (HT) d’un rouleau / d’une boîte ; colisage en boîtes'],
  ['Consommable Pâtisserie 05 2026', 'PRIX (HT) du colisage entier (ex. dentelle Ø114 : 17,000 les 1000 ; papier cuisson : la rame de 500)'],
  ['Liste des pailles 08 2024', 'Prix (HT) du colisage entier (ex. paille simple : 23,000 les 1000)'],
  ['Piques 06 2025', 'Prix HT du colisage entier (« Colisage en pièce » : 100 ou 1000)'],
  ['Liste des verrines 03 2026', 'Mixte : verrines et accessoires au prix de la pièce ; bateaux ovales et cornets au prix des 100'],
];

const SOURCE_CONFLICTS = [
  { type: 'SOURCE_CONFLICT', subject: 'Vinaigre balsamique Varvello 3L', detail: 'Liste Agroalimentaire p.2 : colonne marque « VERVELLO » sur cette seule ligne, « VARVELLO » partout ailleurs et dans la désignation. Marque Varvello conservée.' },
  { type: 'SOURCE_CONFLICT', subject: 'Verre en polycarbonate 300ml fond jaune (P/PCG12-J)', detail: 'Prix imprimé « 4,29 » (deux décimales) quand les quatre autres 300 ml sont à « 4,290 ». Lu 4,290.' },
  { type: 'SOURCE_CONFLICT', subject: 'Verre en polycarbonate 300ml fond violet', detail: 'Référence Vinto « P/PCG-12-M », référence PDF « P/PCG12-M ». La référence PDF est publiée.' },
  { type: 'SOURCE_CONFLICT', subject: 'Pique en bois vert 18cm (p-vinto-228)', detail: 'Site : « Pique en bois vert 18cm » ; Piques 06 2025 : « Pics en bois 18cm » (103,000 les 1000, sans « vert »). Identité non établie : prix actuel conservé.' },
  { type: 'SOURCE_CONFLICT', subject: 'Blouses visiteurs jetables en polyéthylène (p-vinto-445)', detail: 'Site : « Blouses visiteurs » ; liste hygiène : « Tablier visiteur en Polyéthylène » (1,450 HT, colisage 100). Identité non établie : prix actuel conservé.' },
  { type: 'SOURCE_CONFLICT', subject: 'Pics en Bois 9cm', detail: 'Piques 06 2025 p.2 imprime « Pics en Bois 9cm » (69,000 / 1000) en plus de « Pics en bois vert 9cm » (69,000 / 1000, p.1). Probable doublon de ligne ; seul « vert » est rattaché.' },
  { type: 'CROSS_CHECK_OK', subject: 'Sauces Thaï Pride ×6', detail: 'Identiques dans Agroalimentaire 04 2026 et Produits asiatiques 06 2026 (prix, contenance, colisage, TVA).' },
  { type: 'CROSS_CHECK_OK', subject: 'Barquettes à sushi ×3, pots à sauce ×2', detail: 'Identiques dans Emballages alimentaires 06 2026 et Produits asiatiques 06 2026 ; un seul produit chacun.' },
  { type: 'CROSS_CHECK_OK', subject: 'Brochettes bamboo 20/25cm, baguette chinoise', detail: 'Asiatiques : 0,028 / 0,034 / 0,100 la pièce ; Piques : 28,000 / 34,000 les 1000 et 10,000 les 100. Cohérents ; prix de la pièce utilisé.' },
];

const WARNINGS = [
  `Décision du 2026-09-29 : tout le catalogue est tarifé depuis les listes fournisseurs (prix HT). Les montants sont les prix HT fournisseur ; l’affichage montre le montant et la devise seuls (« 12,000 TND »), sans mention « HT » (demande du 2026-09-29). ${existingPriced.length} produits existants et ${allPriced.length - existingPriced.length} ajouts sont tarifés ; la TVA (19 %) n’est imprimée que par les listes Agro, Emballages et Asiatiques et n’est pas stockée (le modèle n’a pas de champ TVA).`,
  'Lot de vente : un produit qui se vendait déjà par lot sur le site (« LES 250 PIÈCES ») garde ce lot, au prix pièce PDF × lot. Un produit vendu à l’unité (MONIN, agro, films…) et chaque ajout se vendent désormais par le colisage PDF (ex. sirop 70 cl par 6 bouteilles, conserve 184 g par 24), conformément à l’exemple MONIN du brief. C’est un changement visible pour le client.',
  'Colisage fournisseur ≠ lot de vente : le colisage PDF est conservé dans ce rapport (supplierCartonQuantity) ; le modèle n’a qu’un champ de lot (packQuantity sur le format principal), qui porte le lot de vente.',
  'Gobelets et verrine cube 150 : le site vend gobelet + couvercle ensemble ; prix pièce = prix PDF du gobelet + prix PDF du couvercle. Pour les PET 12/16 oz le type de couvercle (avec/sans trou) n’est pas établi, mais les deux couvercles valent 0,095 : le prix n’en dépend pas.',
  'Prix de lot non divisibles au millime (paille papier 57,700 / 1050, paille noire petit modèle 11,000 / 900, cure-dents 2,000 / 300) : vendus comme ce lot, au prix du lot, sans prix pièce inventé.',
  'Offres promotionnelles : une offre existante dont le prix n’est plus inférieur au nouveau prix cesse de s’afficher (règle existante). Voir la vérification Neon.',
  'Aucun champ matière, couleur, dimensions structurées ou TVA n’existe dans le modèle : ces informations restent dans la désignation, le format et la description, et sont listées ici. Le moteur de formats lit les dimensions depuis le format et le nom.',
  'ÉTAT DE NEON (lecture seule, 2026-09-29) : la structure de ce lot (71 ajouts, 28 corrections, 23 désactivations) est déjà en production depuis 15:24 : un serveur local `spring-boot:run` connecté à Neon via backend/.env a chargé le code non commité de target/classes. Ce serveur a été arrêté. Au prochain déploiement, le runner saute la structure et applique seulement : 5 corrections de format, 286 prix (0 conflit), 1 stock à 0 (gants nitrile), et retire les photos jamais téléversées (/img/products/catalogue/…) de 24 nouveaux produits.',
  'Photos ajoutées par le propriétaire dans l’admin sur 7 nouveaux produits (ImageKit img/products/admin/) : conservées, jamais modifiées par le runner.',
  'Produit du même lot vendu différemment : « Verre en polycarbonate 250ml - transparent » (ajout) se vend par le colisage PDF de 50, ses variantes de couleur existantes gardent le lot de 5 du site.',
];

const incompleteTerms = [...saleTerms.entries()].filter(([, terms]) => terms.status !== 'PRICED');
const noPhysicalFormat = seed.products.filter((row) => {
  const value = firstFormat(row)?.value;
  return !value || /^Pack de \d+$/.test(value);
});
const report = {
  batch: batchId,
  generated: 'frontend/scripts/export-catalog-reconciliation.mjs',
  counts: {
    before: committed.products.length,
    after: { records: seed.products.length, active: seed.products.length },
    added: records.filter((r) => r.action === 'ADD').length,
    updated: records.filter((r) => r.action === 'UPDATE').length,
    kept: records.filter((r) => r.action === 'KEEP').length,
    deleted: records.filter((r) => r.action === 'DELETE').length,
    merged: records.filter((r) => r.action === 'MERGE').length,
    repriced: existingPriced.length,
    packOnly: seed.products.filter((row) => row.saleMode === 'PACK_ONLY').length,
  },
  priceInterpretation: Object.fromEntries(PRICE_INTERPRETATION),
  records,
  sourceConflicts: SOURCE_CONFLICTS,
  sourceIncomplete: [
    ...incompleteTerms.map(([id, terms]) => ({ productId: id, productName: after.get(id)?.nameFr, status: terms.status, detail: terms.note })),
    ...Object.entries(unpriced).map(([id, detail]) => ({ productId: id, productName: after.get(id)?.nameFr, status: 'UNMAPPED', detail })),
    ...noPhysicalFormat.map((row) => ({ productId: row.sourceId, productName: row.nameFr, status: 'NO_PHYSICAL_FORMAT', detail: 'La liste ne publie ni contenance ni dimension pour cette ligne' })),
  ],
  imageRequired: additions.filter((addition) => !catalog.CATALOG_IMAGES[addition.id]).map((addition) => ({ productId: addition.id, productName: addition.name.fr })),
  warnings: WARNINGS,
};
writeFileSync(path.join(REPO, 'catalog-reconciliation.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

const cell = (value) => String(value ?? '—').replaceAll('|', '\\|').replaceAll('\n', ' ');
const row = (...values) => `| ${values.map(cell).join(' | ')} |`;
const fieldText = (fields) => Object.entries(fields).map(([key, { old, new: next }]) => `${key}: ${old ?? '—'} → ${next ?? '—'}`).join(' ; ');
const officialText = (record) => (record.official ?? []).map((entry) =>
  `${entry.designation} — ${entry.priceHT === null ? 'sans prix (rupture provisoire)' : `${entry.priceHT} HT pour ${entry.priceCovers}`}, colisage ${entry.colisage}${entry.vat ? `, TVA ${entry.vat} %` : ''}${entry.reference ? `, réf. ${entry.reference}` : ''} (p.${entry.page})`).join(' + ');
const actionRows = (action) => records.filter((record) => record.action === action).map((record) => row(
  action, `${record.productName} (${record.productId})`, record.sourcePdf,
  record.official ? officialText(record) : record.officialDesignation,
  record.fields ? fieldText(record.fields) : '—',
  record.imageStatus === 'REQUIRED' ? 'REQUIRED — NOT ADDED' : record.imageStatus === 'MATCHED' ? 'MATCHED (photo client)' : 'UNCHANGED',
)).join('\n');

const md = `# Réconciliation du catalogue avec les listes fournisseurs

Lot \`${batchId}\`. Généré par \`frontend/scripts/export-catalog-reconciliation.mjs\` ; ne pas modifier à la main.
Sources : les 13 PDF de \`imformations_about_products_provided_by_the_client/visuelsproduits (1)/\`.
Valeurs « ancien » : seed validé (git HEAD), c’est-à-dire le catalogue d’avant ce lot. Neon a déjà reçu la structure du lot (voir « Avertissements ») ; les prix y sont encore les anciens.

**Images :** ${additions.length - report.imageRequired.length} produits ajoutés reçoivent la photo client correspondant exactement à leur nom et format (voir product-image-reconciliation.json) ; ${report.imageRequired.length} n’en ont pas (placeholder existant) ;
les images des produits existants sont vérifiées identiques par le script.

## Totaux

| Avant | Après | Ajoutés | Mis à jour | Inchangés | Supprimés (désactivés) | Fusionnés | Repricés | Vendus par lot |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${row(report.counts.before, report.counts.after.records, report.counts.added, report.counts.updated, report.counts.kept, report.counts.deleted, report.counts.merged, report.counts.repriced, report.counts.packOnly)}

## Interprétation des prix par liste

| Liste | Ce que couvre le prix |
|---|---|
${PRICE_INTERPRETATION.map(([pdf, meaning]) => row(pdf, meaning)).join('\n')}

## Actions

| Action | Product | Source PDF | Official data | Fields updated | Image status |
|---|---|---|---|---|---|
${['ADD', 'UPDATE', 'MERGE', 'DELETE'].map(actionRows).filter(Boolean).join('\n')}

KEEP : ${report.counts.kept} fiches déjà conformes, laissées intactes (liste dans \`catalog-reconciliation.json\`).

## SOURCE_CONFLICT et vérifications croisées

| Type | Sujet | Détail |
|---|---|---|
${SOURCE_CONFLICTS.map((entry) => row(entry.type, entry.subject, entry.detail)).join('\n')}

## SOURCE_INCOMPLETE

| Produit | Statut | Détail |
|---|---|---|
${report.sourceIncomplete.map((entry) => row(`${entry.productName} (${entry.productId})`, entry.status, entry.detail)).join('\n')}

## IMAGE_REQUIRED

${report.imageRequired.map((entry) => `- ${entry.productName} (\`${entry.productId}\`)`).join('\n')}

## Avertissements

${WARNINGS.map((warning) => `- ${warning}`).join('\n')}

## Application en base

- Base neuve : \`CatalogSeeder\` charge \`catalog-seed.json\`, déjà réconcilié (il refuse une ligne PACK_ONLY dont le prix ≠ prix unitaire × lot).
- Base existante (Neon) : \`CatalogReconciliationRunner\` applique \`catalog-reconciliation.json\` au démarrage, en une transaction, une seule fois
  (ignoré dès que tous les ajouts existent). Correction/désactivation seulement si le nom est encore l’ancien ; repricing seulement si le prix est
  encore l’ancien : une fiche modifiée entre-temps par un administrateur est laissée intacte et signalée dans le journal. Aucune suppression physique.
`;
writeFileSync(path.join(REPO, 'catalog-reconciliation-report.md'), md, 'utf8');

console.log(`Batch ${batchId}: ${batch.additions.length} additions, ${batch.corrections.length} corrections, ${batch.deactivations.length} deactivations, ${batch.repricings.length} repricings, ${batch.unavailable.length} unavailable.`);
console.log(`Seed patched: ${seed.products.length} products. Report: ${JSON.stringify(report.counts)}`);
