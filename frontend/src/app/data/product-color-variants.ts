import { Product, ProductColorVariant } from '../shared/models/catalog.model';
import { LocalizedText } from '../shared/models/localized-text.model';

interface ColorGroup {
  /** The SKU whose page, photo and price represent the group. */
  readonly canonicalId: string;
  readonly members: readonly {
    readonly id: string;
    readonly label: LocalizedText;
    readonly swatch: string;
  }[];
  /** The supplier's single designation for the line. */
  readonly name: LocalizedText;
}

/**
 * Supplier lines sold in several colours. Each colour keeps its own Vinto SKU
 * (own reference, photo and price), but the supplier price list names the line
 * once, so the catalogue shows it once with a colour choice.
 */
const COLOR_GROUPS: readonly ColorGroup[] = [
  {
    canonicalId: 'p-vinto-348',
    name: {
      fr: 'Verrine goutte 11ml transparente / noire- LES 50 PIÈCES',
      en: 'Drop verrine 11 ml clear / black, pack of 50 pieces',
    },
    members: [
      { id: 'p-vinto-348', label: { fr: 'Transparente', en: 'Clear' }, swatch: '#e3ebef' },
      { id: 'p-vinto-183', label: { fr: 'Noire', en: 'Black' }, swatch: '#1f1f1f' },
    ],
  },
  {
    canonicalId: 'p-vinto-151',
    name: {
      fr: 'Calot rayé rouge-bleu en papier- LES 100 PIÈCES',
      en: 'Striped paper cap red / blue, pack of 100 pieces',
    },
    members: [
      { id: 'p-vinto-151', label: { fr: 'Rayure rouge', en: 'Red stripe' }, swatch: '#c62828' },
      { id: 'p-vinto-349', label: { fr: 'Rayure bleue', en: 'Blue stripe' }, swatch: '#1e4fa3' },
    ],
  },
];

/** Collapse each colour group into one presentation product. SKU IDs remain orderable. */
export function groupColorVariants(products: readonly Product[]): readonly Product[] {
  return COLOR_GROUPS.reduce((catalog, group) => groupOne(catalog, group), products);
}

function groupOne(products: readonly Product[], group: ColorGroup): readonly Product[] {
  const byId = new Map(products.map((product) => [product.id, product]));
  const found = group.members
    .map((member) => {
      const product = byId.get(member.id);
      return product ? { product, member } : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  if (found.length < 2) return products;

  const canonical = byId.get(group.canonicalId) ?? found[0]!.product;
  const variants: readonly ProductColorVariant[] = found.map(({ product, member }) => ({
    id: product.id,
    slug: product.slug,
    label: member.label,
    swatch: member.swatch,
  }));
  const ids = new Set(found.map(({ product }) => product.id));
  let inserted = false;
  return products.flatMap((product) => {
    if (!ids.has(product.id)) return [product];
    if (inserted) return [];
    inserted = true;
    return [
      {
        ...canonical,
        name: group.name,
        colorVariants: variants,
        seo: { ...canonical.seo, title: group.name },
      },
    ];
  });
}
