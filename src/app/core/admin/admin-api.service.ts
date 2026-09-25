import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { IDENTITY_API_URL } from '../auth/identity-api.token';
import { Quote, QuoteStatus } from '../cart/cart.models';
import { LocalizedText } from '../../shared/models/localized-text.model';

/**
 * Wire types for the back office.
 *
 * `AdminProduct` is the API's own shape, not the storefront `Product`: the back
 * office edits the database record (UUID, sourceId, active flag, price), which
 * the bundled storefront model deliberately does not carry.
 */
export interface AdminProductImage {
  readonly src: string;
  readonly alt: LocalizedText | null;
  readonly width: number | null;
  readonly height: number | null;
}

export interface AdminProductFormat {
  readonly id: string | null;
  readonly value: string;
  readonly packQuantity: number | null;
  readonly sizeBucket: string | null;
  readonly reference: string | null;
}

export interface AdminProduct {
  readonly id: string;
  readonly sourceId: string;
  readonly slug: string;
  readonly name: LocalizedText;
  readonly shortDescription: LocalizedText | null;
  readonly description: LocalizedText | null;
  readonly categoryId: string;
  readonly subcategoryId: string | null;
  readonly brandId: string | null;
  readonly industries: readonly string[];
  readonly price: number | null;
  readonly currency: string | null;
  readonly offerPrice: number | null;
  readonly offerStartsAt: string | null;
  readonly offerEndsAt: string | null;
  readonly offerActive: boolean;
  readonly offerCurrentlyActive: boolean;
  readonly stockQuantity: number | null;
  readonly reference: string | null;
  readonly technicalSheetUrl: string | null;
  readonly featured: boolean;
  readonly active: boolean;
  readonly needsVerification: boolean;
  readonly seoTitle: LocalizedText | null;
  readonly seoDescription: LocalizedText | null;
  readonly images: readonly AdminProductImage[];
  readonly formats: readonly AdminProductFormat[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Mirrors the backend ProductRequest record field for field. */
export interface ProductPayload {
  readonly sourceId: string;
  readonly slug: string;
  readonly nameFr: string;
  readonly nameEn: string | null;
  readonly shortDescriptionFr: string | null;
  readonly shortDescriptionEn: string | null;
  readonly descriptionFr: string | null;
  readonly descriptionEn: string | null;
  readonly categoryId: string;
  readonly subcategoryId: string | null;
  readonly brandId: string | null;
  readonly industries: readonly string[];
  readonly price: number | null;
  readonly currency: string | null;
  readonly stockQuantity: number | null;
  readonly reference: string | null;
  readonly technicalSheetUrl: string | null;
  readonly featured: boolean;
  readonly needsVerification: boolean;
  readonly seoTitleFr: string | null;
  readonly seoTitleEn: string | null;
  readonly seoDescriptionFr: string | null;
  readonly seoDescriptionEn: string | null;
  readonly images: readonly {
    src: string;
    altFr: string;
    altEn: string | null;
    width: number | null;
    height: number | null;
  }[];
  readonly formats: readonly {
    id: string | null;
    value: string;
    packQuantity: number | null;
    sizeBucket: string | null;
    reference: string | null;
  }[];
}

export interface AdminCategory {
  readonly id: string;
  readonly externalId: string;
  readonly slug: string;
  readonly name: LocalizedText;
  readonly subcategories: readonly AdminCategory[];
}

export interface AdminBrand {
  readonly id: string;
  readonly externalId: string;
  readonly name: string;
}

/** Active products in one division, for the catalogue chart. */
export interface CategoryCount {
  readonly categoryId: string;
  readonly name: LocalizedText;
  readonly products: number;
}

/** One day of quote activity. Silent days are present with a zero. */
export interface DayCount {
  readonly day: string;
  readonly quotes: number;
}

export interface DashboardStats {
  readonly clients: number;
  readonly administrators: number;
  readonly activeProducts: number;
  readonly inactiveProducts: number;
  readonly pricedProducts: number;
  readonly unpricedActiveProducts: number;
  readonly configuredOffers: number;
  readonly quotesSubmitted: number;
  readonly quotesInReview: number;
  readonly quotesAnswered: number;
  readonly quotesClosed: number;
  readonly recentQuotes: readonly Quote[];
  readonly catalogueByCategory: readonly CategoryCount[];
  readonly quotesByDay: readonly DayCount[];
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

export interface AdminProductQuery {
  readonly q?: string;
  readonly category?: string;
  readonly status?: '' | 'active' | 'inactive';
  readonly priced?: '' | 'yes' | 'no';
  readonly page?: number;
  readonly pageSize?: number;
}

export interface OfferPayload {
  readonly offerPrice: number;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
  readonly active: boolean;
}

export interface UploadedMedia {
  readonly url: string;
  readonly width: number | null;
  readonly height: number | null;
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(IDENTITY_API_URL);
  private readonly options = { withCredentials: true } as const;

  stats(): Promise<DashboardStats> {
    return firstValueFrom(
      this.http.get<DashboardStats>(`${this.apiUrl}/admin/stats`, this.options),
    );
  }

  products(query: AdminProductQuery): Promise<Page<AdminProduct>> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '')
        params = params.set(key, String(value));
    }
    return firstValueFrom(
      this.http.get<Page<AdminProduct>>(`${this.apiUrl}/admin/products`, {
        ...this.options,
        params,
      }),
    );
  }

  product(id: string): Promise<AdminProduct> {
    return firstValueFrom(
      this.http.get<AdminProduct>(`${this.apiUrl}/products/id/${id}`, this.options),
    );
  }

  createProduct(payload: ProductPayload): Promise<AdminProduct> {
    return firstValueFrom(
      this.http.post<AdminProduct>(`${this.apiUrl}/products`, payload, this.options),
    );
  }

  updateProduct(id: string, payload: ProductPayload): Promise<AdminProduct> {
    return firstValueFrom(
      this.http.put<AdminProduct>(`${this.apiUrl}/products/${id}`, payload, this.options),
    );
  }

  /** A null price returns the reference to "prix sur demande". */
  updatePrice(
    id: string,
    price: number | null,
    stockQuantity?: number | null,
  ): Promise<AdminProduct> {
    return firstValueFrom(
      this.http.patch<AdminProduct>(
        `${this.apiUrl}/products/${id}/price`,
        { price, currency: price === null ? null : 'TND', stockQuantity: stockQuantity ?? null },
        this.options,
      ),
    );
  }

  deactivateProduct(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.apiUrl}/products/${id}`, this.options));
  }

  reactivateProduct(id: string): Promise<AdminProduct> {
    return firstValueFrom(
      this.http.post<AdminProduct>(`${this.apiUrl}/products/${id}/reactivate`, {}, this.options),
    );
  }

  offers(q = '', page = 0, pageSize = 25): Promise<Page<AdminProduct>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (q) params = params.set('q', q);
    return firstValueFrom(
      this.http.get<Page<AdminProduct>>(`${this.apiUrl}/admin/offers`, { ...this.options, params }),
    );
  }

  saveOffer(productId: string, payload: OfferPayload): Promise<AdminProduct> {
    return firstValueFrom(
      this.http.put<AdminProduct>(
        `${this.apiUrl}/admin/offers/${productId}`,
        payload,
        this.options,
      ),
    );
  }

  deleteOffer(productId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.apiUrl}/admin/offers/${productId}`, this.options),
    );
  }

  uploadProductImage(file: File): Promise<UploadedMedia> {
    const body = new FormData();
    body.append('file', file, file.name);
    return firstValueFrom(
      this.http.put<UploadedMedia>(`${this.apiUrl}/admin/media/product-image`, body, this.options),
    );
  }

  categories(): Promise<readonly AdminCategory[]> {
    return firstValueFrom(this.http.get<AdminCategory[]>(`${this.apiUrl}/categories`));
  }

  brands(): Promise<readonly AdminBrand[]> {
    return firstValueFrom(this.http.get<AdminBrand[]>(`${this.apiUrl}/brands`));
  }

  quotes(status: QuoteStatus | '', page = 0, pageSize = 25): Promise<Page<Quote>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (status) params = params.set('status', status);
    return firstValueFrom(
      this.http.get<Page<Quote>>(`${this.apiUrl}/quotes`, { ...this.options, params }),
    );
  }

  updateQuoteStatus(id: string, status: QuoteStatus, adminNote: string | null): Promise<Quote> {
    return firstValueFrom(
      this.http.patch<Quote>(
        `${this.apiUrl}/quotes/${id}/status`,
        { status, adminNote },
        this.options,
      ),
    );
  }

  /** Best-effort extraction of the API's machine-readable error code. */
  static errorCode(error: unknown): string {
    const body = (error as { error?: { code?: string } })?.error;
    return body?.code ?? 'unknown';
  }
}
