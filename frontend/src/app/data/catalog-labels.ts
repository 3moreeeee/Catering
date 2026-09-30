import { FacetValue } from '../shared/models/catalog.model';
import { LocalizedText } from '../shared/models/localized-text.model';
import { BRANDS } from './brands.data';
import { CATEGORIES } from './categories.data';
import { INDUSTRIES } from './industries.data';

/**
 * Display labels for facet ids. The API counts products per id; the names of
 * divisions, subcategories, brands, sectors and size buckets are the
 * storefront's own reference data (bilingual, fixed by the business).
 */
export type FacetKind = 'categories' | 'subcategories' | 'brands' | 'industries' | 'sizes';

const SIZE_LABELS: Readonly<Record<string, LocalizedText>> = {
  single: { en: 'Single portion (≤ 100 ml/g)', fr: 'Monoportion (≤ 100 ml/g)' },
  small: { en: 'Small (100–500 ml/g)', fr: 'Petit (100–500 ml/g)' },
  medium: { en: 'Medium (500 ml – 1.2 L)', fr: 'Moyen (500 ml – 1,2 L)' },
  large: { en: 'Large (1.2–4 L/kg)', fr: 'Grand (1,2–4 L/kg)' },
  bulk: { en: 'Bulk (> 4 L/kg)', fr: 'Vrac (> 4 L/kg)' },
};

export function facetLabel(kind: FacetKind, id: string): LocalizedText {
  switch (kind) {
    case 'categories':
      return CATEGORIES.find((category) => category.id === id)?.name ?? { en: id, fr: id };
    case 'subcategories': {
      for (const category of CATEGORIES) {
        const sub = category.subcategories.find((s) => s.id === id);
        if (sub) return sub.name;
      }
      return { en: id, fr: id };
    }
    case 'brands': {
      const name = BRANDS.find((brand) => brand.id === id)?.name ?? id;
      return { en: name, fr: name };
    }
    case 'industries':
      return INDUSTRIES.find((industry) => industry.id === id)?.name ?? { en: id, fr: id };
    case 'sizes':
      return SIZE_LABELS[id] ?? { en: id, fr: id };
  }
}

export function labelled(
  kind: FacetKind,
  values: readonly { readonly id: string; readonly count: number }[],
): readonly FacetValue[] {
  return values.map((value) => ({
    id: value.id,
    count: value.count,
    label: facetLabel(kind, value.id),
  }));
}
