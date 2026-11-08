import { ProductImage } from '../models/catalog.model';

export interface ProductImageFit {
  /** Zoom applied to the photograph inside its square frame. */
  readonly scale: number;
  /** Vertical correction, in percent of the frame, that centres the product. */
  readonly shift: number;
  /** True when the measurements were usable and the transform applies. */
  readonly measured: boolean;
}

/** Share of the frame the product's longest side fills, on every card and page. */
const TARGET_FILL = 0.76;
const MIN_SCALE = 0.6;
/** Beyond this an 800px source visibly softens at card size. */
const MAX_SCALE = 3;

const UNMEASURED: ProductImageFit = { scale: 1, shift: 0, measured: false };

/**
 * Frames every product at the same visual size, whatever margin its photograph
 * has. Uses the object bounds the API measures for square catalogue photographs;
 * anything else is simply contained in the frame.
 */
export function uniformImageFit(image: ProductImage | undefined): ProductImageFit {
  const metrics = image?.metrics;
  if (
    !image ||
    !metrics?.reliable ||
    image.width !== image.height ||
    metrics.occupancy <= 0.03 ||
    metrics.width <= 0.03
  ) {
    return UNMEASURED;
  }

  const longestSide = Math.max(metrics.occupancy, metrics.width);
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, TARGET_FILL / longestSide));
  const centre = metrics.bottom - metrics.occupancy / 2;
  return { scale: round(scale), shift: round((0.5 - centre) * scale * 100), measured: true };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
