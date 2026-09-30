import { describe, expect, it } from 'vitest';
import { IMAGEKIT_URL_ENDPOINT, imageKitMediaUrl } from './imagekit.generated';

/**
 * Neon stores a product photograph either as a catalogue key
 * ("/img/products/…"), served from ImageKit, or as a full ImageKit URL
 * (migrated media, admin uploads). Both must come out as one loadable URL.
 */
describe('imageKitMediaUrl', () => {
  it('serves a relative catalogue key from ImageKit', () => {
    expect(imageKitMediaUrl('/img/products/catalogue/monin-sirop-caramel-1l.v2.webp')).toBe(
      `${IMAGEKIT_URL_ENDPOINT}/fk-catering/img/products/catalogue/monin-sirop-caramel-1l.v2.webp`,
    );
  });

  it('leaves a full ImageKit URL exactly as stored, never double-prefixed', () => {
    const hosted =
      'https://ik.imagekit.io/0ygikjead/fk-catering/img/products/admin/bateau-ovale-7-12_svGKBUBDI.jpg';
    expect(imageKitMediaUrl(hosted)).toBe(hosted);
  });

  it('is idempotent: normalising an already normalised key changes nothing', () => {
    const once = imageKitMediaUrl('/img/products/catalogue/paille-en-papier-230mm-x-8mm.v2.webp');
    expect(imageKitMediaUrl(once)).toBe(once);
  });
});
