import type { Product } from '../models/catalog.model';

export type PhysicalKind =
  | 'volume'
  | 'weight'
  | 'dimensions3d'
  | 'dimensions2d'
  | 'diameter'
  | 'length'
  | 'roll'
  | 'fit'
  | 'unknown';
export type FormatSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type FormatQualifier = 'small' | 'standard' | 'large' | 'plain' | 'fit';

export interface PhysicalFormat {
  readonly kind: PhysicalKind;
  readonly display: string;
  readonly metric: number | null;
  readonly normalized: Readonly<Record<string, number>>;
  readonly source: 'format' | 'title' | 'none';
}

export interface ProductFormatVisual {
  readonly value: string;
  readonly size: FormatSize;
  readonly icon: 'bottle' | 'tray' | 'generic';
  readonly qualifier: FormatQualifier;
  readonly familyKey: string | null;
  readonly imageScale: number;
  readonly imageShift: number;
  readonly normalizedImage: boolean;
}

export interface ImageOccupancy {
  /** Fraction of the source canvas occupied by the detected product object. */
  readonly occupancy: number;
  /** Fraction of canvas width occupied by the same object bounds. */
  readonly width: number;
  /** Bottom edge of the detected object, as a fraction of canvas height. */
  readonly bottom: number;
  /** False when the source background prevents trustworthy object detection. */
  readonly reliable: boolean;
}

export interface ProductFormatAuditRow {
  readonly productId: string;
  readonly reference: string | null;
  readonly name: string;
  readonly division: string;
  readonly subcategory: string | null;
  readonly brand: string | null;
  readonly familyKey: string | null;
  readonly formatType: PhysicalKind;
  readonly rawFormat: string;
  readonly normalized: Readonly<Record<string, number>>;
  readonly comparisonMetric: number | null;
  readonly sizeRank: number | null;
  readonly familyCount: number;
  readonly sizeClass: FormatSize | null;
  readonly confidence: 'medium' | 'low' | 'none';
  readonly source: string;
  readonly warning: string | null;
  readonly imageCorrection: number | null;
}

interface FamilyDefinition {
  readonly key: string;
  readonly category: Product['categoryId'];
  readonly pattern: RegExp;
  readonly kind: PhysicalKind;
  readonly document: string;
  /** Supplier-published canonical metrics. An unlisted value is flagged, never silently corrected. */
  readonly published?: readonly number[];
  readonly icon?: ProductFormatVisual['icon'];
  /** Stock lifestyle photos cannot be measured as isolated objects. */
  readonly imageComparable?: boolean;
  /**
   * Tinned food is sold by net weight in small cans and by volume in catering
   * tins (Emporium sweetcorn: 184 g, 425 g, 3100 ml). Ranking one against the
   * other as grams and millilitres is enough to order the sizes.
   */
  readonly weightOrVolume?: boolean;
}

const packaging = 'Liste des emballages alimentaires 06 2026';
const cups = 'Gobelets PET & PAPIER & EPS 04 2022';
const pastry = 'Consommable Pâtisserie 05 2026';
const verrines = 'Liste des verrines 03 2026';
const picks = 'Piques 06 2025';
const food = 'Liste des prix Agroalimentaire 04 2026';
const monin = 'Liste des Prix Monin 05 2026';
const glasses = 'Liste des prix Verre en polycarbonate 06 2023';

/** Product types are matched before formats: sharing a number never creates a family. */
export const FAMILY_DEFINITIONS: readonly FamilyDefinition[] = [
  {
    key: 'monin.syrup',
    category: 'monin',
    pattern: /^(sirop|concentre lime juice|le mixeur)/,
    kind: 'volume',
    document: monin,
    published: [250, 700, 1000],
    icon: 'bottle',
  },
  {
    key: 'monin.sauce',
    category: 'monin',
    pattern: /^sauce /,
    kind: 'volume',
    document: monin,
    published: [1890],
    icon: 'bottle',
  },
  {
    key: 'monin.fruit-puree',
    category: 'monin',
    pattern: /^(le fruit|puree) /,
    kind: 'volume',
    document: monin,
    published: [1000],
    icon: 'bottle',
  },
  {
    key: 'monin.frappe',
    category: 'monin',
    pattern: /^frappe /,
    kind: 'weight',
    document: monin,
    published: [1360, 2000],
  },
  {
    key: 'packaging.soup-kraft',
    category: 'packaging',
    pattern: /^bol a soupe.*kraft/,
    kind: 'volume',
    document: packaging,
    published: [500, 1000],
    icon: 'tray',
  },
  {
    key: 'packaging.soup-white',
    category: 'packaging',
    pattern: /^bol a soupe.*(blanc|carton blanc)/,
    kind: 'volume',
    document: packaging,
    published: [500, 1100],
    icon: 'tray',
  },
  {
    key: 'packaging.salad-kraft',
    category: 'packaging',
    pattern: /^bol a salade.*kraft/,
    kind: 'volume',
    document: packaging,
    published: [500, 1100],
    icon: 'tray',
  },
  {
    key: 'packaging.salad-white',
    category: 'packaging',
    pattern: /^bol a salade.*blanc/,
    kind: 'volume',
    document: packaging,
    published: [500, 1100],
    icon: 'tray',
  },
  {
    key: 'packaging.fries-tray',
    category: 'packaging',
    pattern: /^barquette pour fritures/,
    kind: 'volume',
    document: packaging,
    published: [220, 400],
    icon: 'tray',
  },
  {
    key: 'packaging.sushi-tray',
    category: 'packaging',
    pattern: /^barquette a sushi/,
    kind: 'dimensions3d',
    document: packaging,
    published: [170 * 122 * 30, 193 * 137 * 30, 224 * 142 * 30],
    icon: 'tray',
  },
  {
    key: 'packaging.sauce-pot',
    category: 'packaging',
    pattern: /^pot a sauce/,
    kind: 'volume',
    document: packaging,
    published: [30, 60],
    icon: 'tray',
  },
  {
    key: 'packaging.pet-cup',
    category: 'packaging',
    pattern: /^gobelet.*pet/,
    kind: 'volume',
    document: cups,
    published: [255, 350, 450],
    icon: 'tray',
    imageComparable: false,
  },
  {
    key: 'packaging.eps-cup',
    category: 'packaging',
    pattern: /^gobelet.*eps/,
    kind: 'volume',
    document: cups,
    published: [200, 350, 450],
    icon: 'tray',
  },
  {
    key: 'packaging.eps-bowl',
    category: 'packaging',
    pattern: /^bol en eps/,
    kind: 'volume',
    document: cups,
    published: [240, 350, 450],
    icon: 'tray',
  },
  {
    key: 'packaging.polycarbonate-glass',
    category: 'packaging',
    pattern: /^(verre|chope)\b.*\bpolycarbonate\b/,
    kind: 'volume',
    document: glasses,
    published: [250, 295, 300, 400, 500],
  },
  {
    key: 'packaging.verrine-cube',
    category: 'packaging',
    pattern: /^verrine cube/,
    kind: 'volume',
    document: verrines,
    published: [50, 100, 150],
  },
  {
    key: 'packaging.verrine-cylinder',
    category: 'packaging',
    pattern: /^verrine cylindre/,
    kind: 'volume',
    document: verrines,
    published: [50, 80],
  },
  {
    key: 'packaging.oval-boat',
    category: 'packaging',
    pattern: /^bateau ovale/,
    kind: 'dimensions2d',
    document: verrines,
    published: [57 * 90, 70 * 120, 80 * 135],
    icon: 'tray',
  },
  {
    key: 'packaging.cornet',
    category: 'packaging',
    pattern: /^cornet/,
    kind: 'length',
    document: verrines,
    published: [130, 150],
  },
  {
    key: 'packaging.doily-round',
    category: 'packaging',
    pattern: /^papier dentelle rond/,
    kind: 'diameter',
    document: pastry,
    published: [114, 140, 165, 190, 216, 240, 265, 285, 305, 320, 360],
  },
  {
    key: 'packaging.doily-rectangle',
    category: 'packaging',
    pattern: /^papier dentelle rectangulaire/,
    kind: 'dimensions2d',
    document: pastry,
    published: [260 * 365, 300 * 395, 360 * 440, 400 * 500],
  },
  {
    key: 'packaging.pick-green-wood',
    category: 'packaging',
    pattern: /^pique en bois vert/,
    kind: 'length',
    document: picks,
    published: [90, 120, 150, 180],
  },
  {
    key: 'packaging.bamboo-skewer',
    category: 'packaging',
    pattern: /^brochette/,
    kind: 'length',
    document: picks,
    published: [200, 250],
  },
  {
    key: 'packaging.piping-bag',
    category: 'packaging',
    pattern: /^poches? a douilles/,
    kind: 'length',
    document: pastry,
    published: [400, 550],
  },
  {
    key: 'packaging.pastry-ribbon',
    category: 'packaging',
    pattern: /^ruban patissier/,
    kind: 'length',
    document: pastry,
    published: [30, 40, 50],
  },
  // Roll widths in mm as printed in the price list: film 25, 30 and 45 cm (the
  // 1500 m rolls as 250/300/450 mm); aluminium 30 and 45 cm.
  {
    key: 'packaging.film-roll',
    category: 'packaging',
    pattern: /^film etirable/,
    kind: 'roll',
    document: 'Film étirable et Rouleau Aluminium 04-2026',
    published: [250, 300, 450],
  },
  {
    key: 'packaging.aluminium-roll',
    category: 'packaging',
    pattern: /^rouleau papier aluminium/,
    kind: 'roll',
    document: 'Film étirable et Rouleau Aluminium 04-2026',
    published: [300, 450],
  },
  {
    key: 'food.mushrooms-emporium',
    category: 'food',
    pattern: /^champignons en tranche.*emporium/,
    kind: 'weight',
    document: food,
    published: [184, 425, 850],
  },
  {
    key: 'food.sweetcorn-emporium',
    category: 'food',
    pattern: /^mais doux emporium/,
    kind: 'weight',
    document: food,
    published: [184, 425, 3100],
    weightOrVolume: true,
  },
  {
    key: 'food.red-beans-emporium',
    category: 'food',
    pattern: /^haricots? rouges?/,
    kind: 'weight',
    document: food,
    published: [184, 400],
  },
  {
    key: 'food.mustard-dijon',
    category: 'food',
    pattern: /^moutarde forte de dijon/,
    kind: 'weight',
    document: food,
    published: [200, 370, 850],
  },
  {
    key: 'food.balsamic-vinegar',
    category: 'food',
    pattern: /^vinaigre balsamique de modena/,
    kind: 'volume',
    document: food,
    published: [250, 500, 3000],
    icon: 'bottle',
  },
  {
    key: 'food.balsamic-cream',
    category: 'food',
    pattern: /^creme avec vinaigre balsamique/,
    kind: 'volume',
    document: food,
    published: [250, 500],
    icon: 'bottle',
  },
];

const canonical = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
const numeric = (text: string): number => Number(text.replace(',', '.'));
const mm = (value: string, unit: string): number =>
  numeric(value) * (unit.toLowerCase() === 'cm' ? 10 : 1);
const round = (value: number): number => Math.round(value * 1000) / 1000;

/** Extract one physical measurement without treating carton count or lid compatibility as object size. */
export function parsePhysicalFormat(text: string, productName = ''): PhysicalFormat {
  const source: PhysicalFormat['source'] = text ? 'format' : 'none';
  const display = text.trim();
  const name = canonical(productName);
  const input = canonical(text);
  const result = (
    kind: PhysicalKind,
    metric: number | null,
    normalized: Record<string, number> = {},
    matched = display,
  ): PhysicalFormat => {
    const originalOffset = text.toLowerCase().indexOf(matched.toLowerCase());
    const originalValue =
      originalOffset < 0 ? matched : text.slice(originalOffset, originalOffset + matched.length);
    return {
      kind,
      display: originalValue.trim(),
      metric: metric === null ? null : round(metric),
      normalized,
      source,
    };
  };

  if (!input) return result('unknown', null);
  if (/^(couvercle|lid)\b/.test(name) && /\d+\s*(?:\/|ou|or)\s*\d+/.test(input))
    return result('unknown', null);
  if (
    /\b(?:gants?|surchaussure|sur chaussure|overshoes?)\b/.test(name) &&
    /\b(?:xs|s|m|l|xl)\b(?:\s*[/,]\s*\b(?:xs|s|m|l|xl)\b)*/i.test(input)
  )
    return result('fit', null);

  if (/\b(film etirable|rouleau papier aluminium)\b/.test(name)) {
    const roll = input.match(/\b(\d+(?:[.,]\d+)?)\s*(mm|cm)\b.{0,24}?\b(\d+(?:[.,]\d+)?)\s*m\b/);
    if (roll) {
      const widthMm = mm(roll[1]!, roll[2]!);
      const lengthM = numeric(roll[3]!);
      return result('roll', widthMm, { widthMm, lengthM }, roll[0]);
    }
  }

  const three = input.match(
    /\b(\d+(?:[.,]\d+)?)\s*(mm|cm)?\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm)?\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm)\b/,
  );
  if (three) {
    const unit = three[6]!;
    const widthMm = mm(three[1]!, three[2] ?? unit);
    const depthMm = mm(three[3]!, three[4] ?? unit);
    const heightMm = mm(three[5]!, unit);
    return result(
      'dimensions3d',
      widthMm * depthMm * heightMm,
      { widthMm, depthMm, heightMm },
      three[0],
    );
  }

  const two = input.match(/\b(\d+(?:[.,]\d+)?)\s*(mm|cm)?\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm)\b/);
  if (two) {
    const unit = two[4]!;
    const widthMm = mm(two[1]!, two[2] ?? unit);
    const depthMm = mm(two[3]!, unit);
    return result('dimensions2d', widthMm * depthMm, { widthMm, depthMm }, two[0]);
  }

  const volume = input.match(/\b(\d+(?:[.,]\d+)?)\s*(ml|cl|cc|l)\b/);
  if (volume) {
    const unit = volume[2]!;
    const volumeMl = numeric(volume[1]!) * (unit === 'l' ? 1000 : unit === 'cl' ? 10 : 1);
    return result('volume', volumeMl, { volumeMl }, volume[0]);
  }
  const weight = input.match(/\b(\d+(?:[.,]\d+)?)\s*(kg|gr|g)\b/);
  if (weight) {
    const weightG = numeric(weight[1]!) * (weight[2] === 'kg' ? 1000 : 1);
    return result('weight', weightG, { weightG }, weight[0]);
  }
  const single = input.match(/\b(\d+(?:[.,]\d+)?)\s*(mm|cm)\b/);
  if (single) {
    const lengthMm = mm(single[1]!, single[2]!);
    return result(
      /\b(diam|dentelle rond)\b/.test(name) ? 'diameter' : 'length',
      lengthMm,
      { lengthMm },
      single[0],
    );
  }
  return result('unknown', null);
}

function bestFormat(product: Product): PhysicalFormat {
  const raw = product.formats.map((format) => format.value).join(' · ');
  const name = product.name.fr || product.name.en;
  const structured = parsePhysicalFormat(raw, name);
  const title = parsePhysicalFormat(name, name);
  const priority: Record<PhysicalKind, number> = {
    dimensions3d: 7,
    roll: 6,
    dimensions2d: 5,
    volume: 4,
    weight: 4,
    diameter: 3,
    length: 2,
    fit: 1,
    unknown: 0,
  };
  if (priority[title.kind] > priority[structured.kind]) return { ...title, source: 'title' };
  return structured;
}

function familyOf(product: Product): FamilyDefinition | null {
  const name = canonical(product.name.fr || product.name.en);
  if (/^(couvercle|lid)\b/.test(name)) return null;
  return (
    FAMILY_DEFINITIONS.find(
      (family) => family.category === product.categoryId && family.pattern.test(name),
    ) ?? null
  );
}

function assetKey(src: string): string {
  const match = src.match(/\/img\/products\/[^?#]+/);
  const path = match ? match[0] : src;
  // The live ImageKit API encodes UTF-8 filename bytes as _C3_A9 while the
  // checked-in files use %C3%A9. Both refer to the same measured photograph.
  return path.replace(/(?:_[0-9a-f]{2}){2,}/gi, (bytes) => bytes.replaceAll('_', '%'));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function linearMetric(kind: PhysicalKind, metric: number): number {
  if (kind === 'volume' || kind === 'dimensions3d' || kind === 'weight') return Math.cbrt(metric);
  if (kind === 'dimensions2d') return Math.sqrt(metric);
  return metric;
}

/**
 * Supplier-published sizes per family, the range a product is ranked within
 * when the whole catalogue is not at hand (a storefront page holds at most 12
 * products). Families without a published list are absent.
 */
export const PUBLISHED_FAMILY_RANGES: ReadonlyMap<string, readonly number[]> = new Map(
  FAMILY_DEFINITIONS.filter((family) => family.published?.length).map((family) => [
    family.key,
    [...new Set(family.published)].sort((a, b) => a - b),
  ]),
);

/**
 * One pass over a set of products. Without `familyRanges` each family is
 * ranked within the sizes present in `products` (the audit's view of the whole
 * catalogue); with it, a listed family is ranked within that fixed range, so a
 * product's visual does not depend on which other products share its page.
 */
export function buildProductFormatIndex(
  products: readonly Product[],
  imageOccupancy: Readonly<Record<string, ImageOccupancy>> = {},
  familyRanges?: ReadonlyMap<string, readonly number[]>,
): {
  readonly visuals: ReadonlyMap<string, ProductFormatVisual>;
  readonly rows: readonly ProductFormatAuditRow[];
} {
  const candidates = products.map((product) => {
    const family = familyOf(product);
    const format = bestFormat(product);
    const published = family?.published;
    const matchingKind =
      !!family &&
      (family.kind === format.kind ||
        (!!family.weightOrVolume && (format.kind === 'weight' || format.kind === 'volume')));
    const publishedMatch =
      !published ||
      (format.metric !== null &&
        published.some((value) => Math.abs(value - format.metric!) < 0.01));
    const warning =
      family && format.metric === null
        ? 'Missing physical format'
        : family && !matchingKind
          ? `Expected ${family.kind}, found ${format.kind}`
          : family && !publishedMatch
            ? `Current format is not listed in ${family.document}`
            : null;
    return {
      product,
      family,
      format,
      warning,
      eligible: !!family && matchingKind && publishedMatch && format.metric !== null,
    };
  });
  const metricsByFamily = new Map<string, number[]>();
  for (const item of candidates) {
    if (!item.eligible || !item.family || item.format.metric === null) continue;
    const values = metricsByFamily.get(item.family.key) ?? [];
    if (!values.includes(item.format.metric)) values.push(item.format.metric);
    metricsByFamily.set(item.family.key, values);
  }
  for (const values of metricsByFamily.values()) values.sort((a, b) => a - b);
  for (const [key, range] of familyRanges ?? []) metricsByFamily.set(key, [...range]);

  const visuals = new Map<string, ProductFormatVisual>();
  const rows: ProductFormatAuditRow[] = [];
  for (const item of candidates) {
    const { product, family, format, warning } = item;
    const values = item.eligible && family ? (metricsByFamily.get(family.key) ?? []) : [];
    const comparable = values.length > 1 && format.metric !== null;
    const rank = comparable ? values.indexOf(format.metric) + 1 : null;
    const min = values[0] ?? 0;
    const max = values.at(-1) ?? min;
    const normalizedRank = comparable
      ? (linearMetric(format.kind, format.metric) - linearMetric(format.kind, min)) /
        (linearMetric(format.kind, max) - linearMetric(format.kind, min))
      : 0;
    const qualifier: FormatQualifier =
      format.kind === 'fit'
        ? 'fit'
        : !comparable
          ? 'plain'
          : normalizedRank <= 0.15
            ? 'small'
            : normalizedRank >= 0.85
              ? 'large'
              : 'standard';
    const size: FormatSize = !comparable
      ? 'md'
      : normalizedRank < 0.15
        ? 'xs'
        : normalizedRank < 0.35
          ? 'sm'
          : normalizedRank < 0.65
            ? 'md'
            : normalizedRank < 0.85
              ? 'lg'
              : 'xl';
    const source = family ? `${format.source}; ${family.document}` : format.source;
    // Measurements served with the image by the API, or the audit table.
    const image =
      product.images[0]?.metrics ?? imageOccupancy[assetKey(product.images[0]?.src ?? '')];
    let imageScale = 1;
    let imageShift = 0;
    let correction: number | null = null;
    let normalizedImage = false;
    if (comparable && family?.imageComparable !== false) {
      const target = 0.57 + 0.29 * normalizedRank;
      if (image?.reliable && image.occupancy > 0.07 && image.width > 0.07) {
        // Normalize against the larger image extent: wide trays and round doilies
        // must fit horizontally while bottles use their visible height.
        imageScale = round(clamp(target / Math.max(image.occupancy, image.width), 0.35, 3.2));
        imageShift = round(clamp((imageScale * (1 - image.bottom) - 0.08) * 100, -25, 120));
        correction = round(0.72 / image.occupancy);
        normalizedImage = true;
      } else {
        imageScale = round(0.69 + 0.31 * normalizedRank);
      }
    }
    if (format.kind !== 'unknown') {
      visuals.set(product.id, {
        value: format.display || product.formats[0]?.value || '',
        size,
        icon: family?.icon ?? 'generic',
        qualifier,
        familyKey: family?.key ?? null,
        imageScale,
        imageShift,
        normalizedImage,
      });
    }
    rows.push({
      productId: product.id,
      reference: product.formats[0]?.reference ?? null,
      name: product.name.fr,
      division: product.categoryId,
      subcategory: product.subcategoryId ?? null,
      brand: product.brandId ?? null,
      familyKey: family?.key ?? null,
      formatType: format.kind,
      rawFormat: product.formats.map((entry) => entry.value).join(' · '),
      normalized: format.normalized,
      comparisonMetric: format.metric,
      sizeRank: rank,
      familyCount: values.length,
      sizeClass: comparable ? size : null,
      confidence: item.eligible ? 'medium' : family || format.metric !== null ? 'low' : 'none',
      source,
      warning,
      imageCorrection: correction,
    });
  }
  return { visuals, rows };
}
