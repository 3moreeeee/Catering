import { ProductImage } from '../models/catalog.model';
import { uniformImageFit } from './product-image-fit';

function image(occupancy: number, width: number, bottom: number, side = 800): ProductImage {
  return {
    src: '/p.webp',
    alt: { fr: 'p', en: 'p' },
    width: side,
    height: side,
    metrics: { occupancy, width, bottom, reliable: true },
  };
}

describe('uniformImageFit', () => {
  it('gives products with different margins the same visual size', () => {
    const large = image(0.42, 0.72, 0.75);
    const small = image(0.13, 0.32, 0.56);

    const filled = (candidate: ProductImage) => {
      const metrics = candidate.metrics!;
      return Math.max(metrics.occupancy, metrics.width) * uniformImageFit(candidate).scale;
    };

    expect(filled(large)).toBeCloseTo(filled(small), 2);
  });

  it('centres the product vertically', () => {
    const fit = uniformImageFit(image(0.4, 0.4, 0.9));
    const centreAfterShift = (0.7 - 0.5) * fit.scale * 100 + fit.shift;

    expect(centreAfterShift).toBeCloseTo(0, 1);
  });

  it('caps the zoom so small sources stay sharp', () => {
    expect(uniformImageFit(image(0.08, 0.08, 0.5)).scale).toBe(3);
  });

  it('leaves unmeasured and non-square photographs untouched', () => {
    const unmeasured = uniformImageFit({
      src: '/p.webp',
      alt: { fr: 'p', en: 'p' },
      width: 800,
      height: 800,
    });
    const nonSquare = uniformImageFit({ ...image(0.4, 0.4, 0.7), height: 1024, width: 1536 });

    expect(unmeasured).toEqual({ scale: 1, shift: 0, measured: false });
    expect(nonSquare).toEqual({ scale: 1, shift: 0, measured: false });
    expect(uniformImageFit(undefined).measured).toBe(false);
  });
});
