import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { afterEach, describe, expect, it } from 'vitest';
import { PRODUCTS } from '../../../data/products.data';
import { ProductCard } from './product-card';
import { ProductFormatService } from '../../utils/product-format.service';
import { SHOW_PRICES } from '../../../core/config/catalogue-display';

/**
 * The live price arrives after the card has rendered, from an API that may be
 * slow to wake. The card must show it on its own: no click, no navigation, no
 * manual change detection — the application is zoneless, so only signals
 * schedule a render.
 */
describe('ProductCard live price', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it.skipIf(!SHOW_PRICES)(
    'shows a placeholder, then the price once a delayed response lands',
    async () => {
      TestBed.configureTestingModule({
        imports: [
          ProductCard,
          TranslocoTestingModule.forRoot({
            langs: { fr: {} },
            translocoConfig: { defaultLang: 'fr' },
          }),
        ],
        providers: [
          provideZonelessChangeDetection(),
          provideRouter([]),
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: ProductFormatService, useValue: { visual: () => null } },
        ],
      });
      const product = PRODUCTS[0]!;
      const fixture = TestBed.createComponent(ProductCard);
      fixture.componentRef.setInput('product', product);
      await fixture.whenStable();

      const http = TestBed.inject(HttpTestingController);
      // The card also learns whether the visitor is signed in; an anonymous one.
      http
        .match((r) => r.url.endsWith('/auth/me'))
        .forEach((r) => r.flush(null, { status: 401, statusText: 'Unauthorized' }));

      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('.card__price--pending')).not.toBeNull();

      const request = http.expectOne((r) => r.url.endsWith('/products/prices'));
      expect(request.request.params.get('sourceIds')).toContain(product.id);

      // A slow backend: the answer comes later, from outside Angular.
      await new Promise((resolve) => setTimeout(resolve, 50));
      request.flush([
        {
          sourceId: product.id,
          id: 'x',
          slug: product.slug,
          price: 12.5,
          originalPrice: 12.5,
          offerActive: false,
          currency: 'TND',
          stockQuantity: null,
          active: true,
        },
      ]);
      // Let the response's promise chain settle, then wait for the render it
      // scheduled. Nothing here touches the component or change detection.
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();

      expect(element.querySelector('.card__price--pending')).toBeNull();
      expect(element.querySelector('.card__price strong')?.textContent).toContain('12');
    },
  );

  // The owner publishes no prices: the card shows the product's defining figure
  // (here its pack) where the price stood, never an amount.
  it.skipIf(SHOW_PRICES)(
    'shows the defining figure and no amount when prices are hidden',
    async () => {
      TestBed.configureTestingModule({
        imports: [
          ProductCard,
          TranslocoTestingModule.forRoot({
            langs: { fr: {} },
            translocoConfig: { defaultLang: 'fr' },
          }),
        ],
        providers: [
          provideZonelessChangeDetection(),
          provideRouter([]),
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: ProductFormatService, useValue: { visual: () => null } },
        ],
      });
      const product = PRODUCTS[0]!;
      const fixture = TestBed.createComponent(ProductCard);
      fixture.componentRef.setInput('product', product);
      await fixture.whenStable();

      const http = TestBed.inject(HttpTestingController);
      http
        .match((r) => r.url.endsWith('/auth/me'))
        .forEach((r) => r.flush(null, { status: 401, statusText: 'Unauthorized' }));

      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('.card__spec-pending')).not.toBeNull();

      http
        .expectOne((r) => r.url.endsWith('/products/prices'))
        .flush([
          {
            sourceId: product.id,
            id: 'x',
            slug: product.slug,
            price: 12.5,
            originalPrice: 12.5,
            offerActive: false,
            currency: 'TND',
            stockQuantity: null,
            active: true,
            saleMode: 'PACK_ONLY',
            unitPrice: 0.125,
            packQuantity: 100,
            unitLabel: 'piece',
          },
        ]);
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();

      expect(element.querySelector('.card__spec-pending')).toBeNull();
      expect(element.querySelector('.card__spec-value')?.textContent).toContain('100');
      expect(element.querySelector('.card__price')).toBeNull();
      expect(element.textContent).not.toContain('12,500');
      expect(element.textContent).not.toContain('TND');
    },
  );
});
