import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { afterEach, describe, expect, it } from 'vitest';
import { PRODUCTS } from '../../../data/products.data';
import { ProductCard } from './product-card';

/**
 * The live price arrives after the card has rendered, from an API that may be
 * slow to wake. The card must show it on its own: no click, no navigation, no
 * manual change detection — the application is zoneless, so only signals
 * schedule a render.
 */
describe('ProductCard live price', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('shows a placeholder, then the price once a delayed response lands', async () => {
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
  });
});
