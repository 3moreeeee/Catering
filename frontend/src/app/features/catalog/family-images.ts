import { imageKitMediaUrl } from '../../core/config/imagekit.generated';
import { ProductImage, ProductImageMetrics } from '../../shared/models/catalog.model';

interface FamilyPhoto {
  readonly src: string;
  readonly metrics?: ProductImageMetrics;
}

/** One real catalogue photograph standing for each product family. */
const FAMILY_PHOTOS: Readonly<Record<string, FamilyPhoto>> = {
  syrups: {
    src: 'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/monin/165-concentre-lime-juice-cordial-70cl-monin.v2.webp',
    metrics: { occupancy: 0.7281, width: 0.1781, bottom: 0.8688, reliable: true },
  },
  'trays-containers': {
    src: 'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/vinto/485-barquette-a-sushi-224x142x30mm-les-100-pieces.v2.webp',
    metrics: { occupancy: 0.4188, width: 0.7156, bottom: 0.75, reliable: true },
  },
  picks: {
    src: '/img/products/catalogue/baguette-chinoise-enveloppee-21cm.v2.webp',
    metrics: { occupancy: 0.5938, width: 0.8938, bottom: 0.7969, reliable: true },
  },
  verrines: {
    src: 'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/vinto/124-caissettes-a-patisserie-blanche-n-5-les-250-pieces.v2.webp',
    metrics: { occupancy: 0.2781, width: 0.4031, bottom: 0.6188, reliable: true },
  },
  'films-papers': {
    src: 'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/vinto/108-papier-cuisson-60cm-x-40cm-la-rame-de-500-feuilles.v2.webp',
    metrics: { occupancy: 0.325, width: 0.6188, bottom: 0.675, reliable: true },
  },
  glassware: {
    src: 'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/vinto/74-chope-a-biere-en-polycarbonate-500ml-les-5-pieces.v2.webp',
    metrics: { occupancy: 0.3656, width: 0.2781, bottom: 0.7063, reliable: true },
  },
  'fruit-purees': {
    src: 'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/monin/459-le-fruit-framboise-monin-1l.v2.webp',
    metrics: { occupancy: 0.8344, width: 0.2594, bottom: 0.9375, reliable: true },
  },
  'sauces-dressings': {
    src: 'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/vinto/471-ginger-sauce-for-chicken-295-ml.v2.webp',
    metrics: { occupancy: 0.8094, width: 0.2156, bottom: 0.9563, reliable: true },
  },
  'bar-tools': {
    src: '/img/products/catalogue/monin-bac-de-stockage-a-glacons-6l.v2.webp',
    metrics: { occupancy: 0.35, width: 0.8906, bottom: 0.675, reliable: true },
  },
  straws: {
    src: 'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/vinto/241-paille-bubble-smoothie-200mm-x-12mm-les-200-pieces.v2.webp',
    metrics: { occupancy: 0.5656, width: 0.5656, bottom: 0.7813, reliable: true },
  },
  canned: {
    src: 'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/vinto/21-champignons-en-tranches-emporium-184g.v2.webp',
    metrics: { occupancy: 0.375, width: 0.3344, bottom: 0.675, reliable: true },
  },
  'cutlery-serving': {
    src: 'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/vinto/132-couteau-en-bois-les-100-pieces.v2.webp',
    metrics: { occupancy: 0.6656, width: 0.0875, bottom: 0.8375, reliable: true },
  },
  headwear: {
    src: 'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/vinto/146-coiffe-bouffant-en-non-tisse-les-100-pieces.v2.webp',
    metrics: { occupancy: 0.7281, width: 0.65, bottom: 0.875, reliable: true },
  },
  'frappe-bases': {
    src: 'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/monin/282-frappe-cafe-monin-136kg.v2.webp',
    metrics: { occupancy: 0.575, width: 0.3906, bottom: 0.7906, reliable: true },
  },
  'aprons-sleeves': {
    src: 'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/vinto/156-blouse-en-non-tisse-les-5-pieces.v2.webp',
    metrics: { occupancy: 0.7063, width: 0.3875, bottom: 0.8344, reliable: true },
  },
  gloves: {
    src: 'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/vinto/355-64-gant-nitrile-les-100-pieces.v2.webp',
    metrics: { occupancy: 0.5969, width: 0.5813, bottom: 0.8, reliable: true },
  },
  condiments: {
    src: 'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/vinto/27-moutarde-forte-de-dijon-dijona-200gr.v2.webp',
    metrics: { occupancy: 0.8531, width: 0.6, bottom: 0.9219, reliable: true },
  },
  sauces: {
    src: 'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/monin/175-sauce-caramel-monin-189l.v2.webp',
    metrics: { occupancy: 0.8406, width: 0.3406, bottom: 0.9469, reliable: true },
  },
  footwear: {
    src: 'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/vinto/158-surchaussure-en-non-tisse-bleue-les-100-pieces.v2.webp',
    metrics: { occupancy: 0.7312, width: 0.6531, bottom: 0.8656, reliable: true },
  },
  balsamic: {
    src: 'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/ai-import/vinaigre-balsamique-de-modena-varvello-250ml_3gUS0kAOX.png',
  },
  'kitchen-utensils': {
    src: 'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/ai-import/planche_-_d-couper_E3jinADDn.png',
  },
  'food-packaging': {
    src: 'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/ai-import/bol-salade-kraft_WmdhYqTka.png',
  },
  'pastry-supplies': {
    src: 'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/ai-import/ruban_patisserie_y6jPtqTVA.png',
  },
  masks: {
    src: 'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/vinto/144-masque-de-protection-3-plis-type-1-les-50-pieces.v2.webp',
    metrics: { occupancy: 0.3344, width: 0.3937, bottom: 0.6844, reliable: true },
  },
};

export function familyImage(id: string): ProductImage | null {
  const photo = FAMILY_PHOTOS[id];
  if (!photo) return null;
  return {
    src: imageKitMediaUrl(photo.src),
    alt: { fr: '', en: '' },
    width: 800,
    height: 800,
    ...(photo.metrics ? { metrics: photo.metrics } : {}),
  };
}
