package tn.com.catering.identity.common;

import java.time.Duration;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;

/**
 * Cache policy for the public catalogue reads: product list, product detail,
 * prices, categories and brands.
 *
 * <p>These responses are identical for every visitor (the back office reads
 * {@code /api/admin/products} instead), so the CDN in front of the API may share
 * them. A shared copy is fresh for {@link #FRESH}; after that the CDN keeps
 * answering from it for up to {@link #STALE_FALLBACK} while it refreshes in the
 * background. That is what keeps prices on screen when the API host is waking
 * from sleep — a cold start no longer sits between a visitor and the page.
 * Browsers themselves always revalidate ({@code max-age=0}), so a price edited
 * in the back office reaches everyone within {@link #FRESH}.
 *
 * <p>Error responses never carry this policy: they are produced by the
 * exception handler, and Spring Security marks them {@code no-store}.
 */
public final class PublicCatalogueCache {

    static final Duration FRESH = Duration.ofSeconds(60);
    static final Duration STALE_FALLBACK = Duration.ofDays(1);

    private static final CacheControl POLICY = CacheControl.maxAge(Duration.ZERO)
            .cachePublic()
            .sMaxAge(FRESH)
            .staleWhileRevalidate(STALE_FALLBACK);

    private PublicCatalogueCache() {}

    public static <T> ResponseEntity<T> ok(T body) {
        return ResponseEntity.ok().cacheControl(POLICY).body(body);
    }
}
