import { Product } from '../models/catalog.model';

export type FormatSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface ProductFormatVisual {
  readonly value: string;
  readonly size: FormatSize;
  readonly icon: 'bottle' | 'tray' | 'generic';
  readonly qualifier: 'small' | 'standard' | 'large';
}

type ParsedFormat =
  | { readonly kind: 'volume'; readonly ml: number; readonly value: string }
  | {
      readonly kind: 'dimensions';
      readonly width: number;
      readonly depth: number;
      readonly height: number;
      readonly value: string;
    };

/** Read only the physical product size; pack counts are deliberately excluded. */
export function parseProductFormat(text: string): ParsedFormat | null {
  const dimensions = text.match(/\b(\d{2,4})\s*[x×]\s*(\d{2,4})\s*[x×]\s*(\d{1,4})\s*mm\b/i);
  if (dimensions) {
    const [, width, depth, height] = dimensions;
    return {
      kind: 'dimensions',
      width: Number(width),
      depth: Number(depth),
      height: Number(height),
      value: `${width}×${depth} mm`,
    };
  }

  const volume = text.match(/\b(\d+(?:[.,]\d+)?)\s*(ml|cl|l)\b/i);
  if (!volume) return null;
  const amount = Number(volume[1]!.replace(',', '.'));
  const unit = volume[2]!.toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return {
    kind: 'volume',
    ml: amount * (unit === 'l' ? 1000 : unit === 'cl' ? 10 : 1),
    value: `${String(amount).replace('.', ',')} ${unit === 'l' ? 'L' : unit}`,
  };
}

/** Resolve a comparison only within a known, comparable product family. */
export function productFormatVisual(product: Product): ProductFormatVisual | null {
  const name = `${product.name.fr} ${product.name.en}`;
  const structured = product.formats
    .map((format) => parseProductFormat(format.value))
    .find(Boolean);
  // Some supplier formats contain only the tray height ("30 mm"); a complete
  // footprint in the name is more useful than that partial structured value.
  const format = structured ?? parseProductFormat(name);
  if (!format) return null;

  if (
    product.categoryId === 'monin' &&
    format.kind === 'volume' &&
    ['syrups', 'sauces', 'fruit-purees'].includes(product.subcategoryId ?? '')
  ) {
    const ml = format.ml;
    const size: FormatSize =
      ml <= 300 ? 'xs' : ml <= 550 ? 'sm' : ml < 900 ? 'md' : ml < 1400 ? 'lg' : 'xl';
    return {
      value: format.value,
      size,
      icon: 'bottle',
      qualifier: size === 'xs' || size === 'sm' ? 'small' : size === 'xl' ? 'large' : 'standard',
    };
  }

  if (product.categoryId === 'packaging' && /barquette|tray/i.test(name)) {
    if (format.kind === 'volume' && /friture|fries|fried food/i.test(name)) {
      const size = format.ml <= 250 ? 'sm' : format.ml >= 350 ? 'lg' : 'md';
      return {
        value: format.value,
        size,
        icon: 'tray',
        qualifier: size === 'sm' ? 'small' : size === 'lg' ? 'large' : 'standard',
      };
    }
    if (format.kind === 'dimensions' && /sushi/i.test(name)) {
      const area = format.width * format.depth;
      const size = area <= 22000 ? 'sm' : area >= 25000 ? 'lg' : 'md';
      return {
        value: format.value,
        size,
        icon: 'tray',
        qualifier: size === 'sm' ? 'small' : size === 'lg' ? 'large' : 'standard',
      };
    }
  }

  // A format can be stated accurately without claiming that an unrelated
  // product is small or large relative to this family.
  return {
    value: format.value,
    size: 'md',
    icon: 'generic',
    qualifier: 'standard',
  };
}
