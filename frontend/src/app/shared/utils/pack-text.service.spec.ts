import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService, TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import en from '../../../../public/i18n/en.json';
import fr from '../../../../public/i18n/fr.json';
import { PackText, packTermsOf } from './pack-text.service';

const bonnet = { unitPrice: 0.12, packQuantity: 100, unitLabel: 'piece' };

function packText(lang: 'fr' | 'en'): PackText {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [
      TranslocoTestingModule.forRoot({
        langs: { fr, en },
        preloadLangs: true,
        translocoConfig: { defaultLang: lang, availableLangs: ['fr', 'en'] },
      }),
    ],
    providers: [provideZonelessChangeDetection()],
  });
  TestBed.inject(TranslocoService).setActiveLang(lang);
  return TestBed.inject(PackText);
}

describe('PackText', () => {
  it('words a pack in French', () => {
    const pack = packText('fr');
    expect(pack.perUnit(bonnet)).toBe('0,120 TND / pièce');
    expect(pack.soldBy(bonnet)).toBe('Vendu par lot de 100 pièces');
    expect(pack.packPrice(bonnet)).toBe('12,000 TND');
    expect(pack.calculation(bonnet)).toBe('0,120 TND × 100');
    expect(pack.packsEqual(1, bonnet)).toBe('1 lot = 100 pièces');
    expect(pack.packsEqual(2, bonnet)).toBe('2 lots = 200 pièces');
    expect(pack.pieces(6, 'bouteille')).toBe('6 bouteilles');
    expect(pack.price(null)).toBe('Prix sur demande');
  });

  it('words a pack in English', () => {
    const pack = packText('en');
    expect(pack.perUnit(bonnet)).toBe('0.120 TND / piece');
    expect(pack.soldBy(bonnet)).toBe('Sold in packs of 100 pieces');
    expect(pack.packPrice(bonnet)).toBe('12.000 TND');
    expect(pack.packsEqual(5, bonnet)).toBe('5 packs = 500 pieces');
    expect(pack.pieces(1, 'can')).toBe('1 can');
  });

  it('treats only PACK_ONLY terms as a pack', () => {
    expect(
      packTermsOf({
        saleMode: 'PACK_ONLY',
        unitPrice: 0.12,
        packQuantity: 100,
        unitLabel: 'piece',
      }),
    ).toEqual(bonnet);
    // A unit product whose price already covers its lot of 250 is never multiplied again.
    expect(packTermsOf({ saleMode: 'UNIT', unitPrice: null, packQuantity: 250 })).toBeNull();
    expect(packTermsOf({ saleMode: 'PACK_ONLY', unitPrice: null, packQuantity: 100 })).toBeNull();
  });
});
