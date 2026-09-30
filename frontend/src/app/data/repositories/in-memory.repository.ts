import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Brand, Category, Industry, SIZE_BUCKETS } from '../../shared/models/catalog.model';
import { CATEGORIES } from '../categories.data';
import { BRANDS } from '../brands.data';
import { INDUSTRIES } from '../industries.data';
import { BrandRepository, CategoryRepository, IndustryRepository } from './catalog.repository';

/**
 * Reference data fixed by the business — divisions, brands, sectors — served
 * from the bundle. Products are not: they come from the database
 * (ApiProductRepository).
 */

/** Accent- and case-insensitive normalisation, so "cafe" matches "café". */
export function normalize(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Exposed for the filter UI so it can render buckets with zero results as disabled. */
export const ALL_SIZE_BUCKETS = SIZE_BUCKETS;

@Injectable({ providedIn: 'root' })
export class InMemoryCategoryRepository implements CategoryRepository {
  all(): Observable<readonly Category[]> {
    return of(CATEGORIES);
  }
  bySlug(slug: string): Observable<Category | null> {
    return of(CATEGORIES.find((c) => c.slug === slug) ?? null);
  }
}

@Injectable({ providedIn: 'root' })
export class InMemoryBrandRepository implements BrandRepository {
  all(): Observable<readonly Brand[]> {
    return of(BRANDS);
  }
  bySlug(slug: string): Observable<Brand | null> {
    return of(BRANDS.find((b) => b.slug === slug) ?? null);
  }
}

@Injectable({ providedIn: 'root' })
export class InMemoryIndustryRepository implements IndustryRepository {
  all(): Observable<readonly Industry[]> {
    return of(INDUSTRIES);
  }
  bySlug(slug: string): Observable<Industry | null> {
    return of(INDUSTRIES.find((i) => i.slug === slug) ?? null);
  }
}
