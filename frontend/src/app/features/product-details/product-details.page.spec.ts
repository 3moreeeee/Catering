import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { Subject, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import fr from '../../../../public/i18n/fr.json';
import { PRODUCT_REPOSITORY } from '../../data/repositories/catalog.repository';
import { Product } from '../../shared/models/catalog.model';
import { ProductDetailsPage } from './product-details.page';

function setup() {
  const answer = new Subject<Product | null>();
  const repo = {
    bySlug: () => answer,
    related: () => of([]),
  };
  TestBed.configureTestingModule({
    imports: [
      ProductDetailsPage,
      TranslocoTestingModule.forRoot({ langs: { fr }, translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' } }),
    ],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: PRODUCT_REPOSITORY, useValue: repo },
      {
        provide: ActivatedRoute,
        useValue: { paramMap: of(convertToParamMap({ category: 'monin', slug: 'sirop-de-caramel' })), snapshot: { paramMap: convertToParamMap({ slug: 'sirop-de-caramel' }) } },
      },
    ],
  });
  const fixture = TestBed.createComponent(ProductDetailsPage);
  return { fixture, answer, el: fixture.nativeElement as HTMLElement };
}

describe('ProductDetailsPage while the product is loading', () => {
  it('shows a loading state, not "not found", until the lookup answers', async () => {
    const { fixture, el } = setup();
    await fixture.whenStable();

    expect(el.querySelector('.pdp--loading')).not.toBeNull();
    expect(el.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(el.textContent).not.toContain(fr.notFound.title);
  });

  it('says the product is missing only once the lookup has answered with nothing', async () => {
    const { fixture, answer, el } = setup();
    await fixture.whenStable();

    answer.next(null);
    await fixture.whenStable();

    expect(el.querySelector('.pdp--loading')).toBeNull();
    expect(el.textContent).toContain(fr.notFound.title);
  });
});
