import { Injectable } from '@angular/core';
import { Product } from '../models/catalog.model';
import {
  buildProductFormatIndex,
  ProductFormatVisual,
  PUBLISHED_FAMILY_RANGES,
} from './product-format-engine';

/**
 * Shared presentation index for grid, list, homepage, and product detail.
 *
 * Each product is ranked within its family's supplier-published sizes and
 * scaled with the photograph measurements the API serves with its image, so a
 * visual depends on the product alone — never on which other products happen
 * to be loaded (a page holds at most 12).
 */
@Injectable({ providedIn: 'root' })
export class ProductFormatService {
  private readonly cache = new WeakMap<Product, ProductFormatVisual | null>();

  visual(product: Product): ProductFormatVisual | null {
    if (!this.cache.has(product)) {
      const visuals = buildProductFormatIndex([product], {}, PUBLISHED_FAMILY_RANGES).visuals;
      this.cache.set(product, visuals.get(product.id) ?? null);
    }
    return this.cache.get(product) ?? null;
  }
}
