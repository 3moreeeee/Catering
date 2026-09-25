package tn.com.catering.identity.DTO;

import java.util.List;

/**
 * The figures on the back-office overview.
 *
 * <p>Only counts the system actually holds. There is no revenue figure: the site
 * takes no payment, and a sum of quote totals would present requests for an
 * offer as if they were sales.
 */
public record DashboardStatsResponse(
        long clients,
        long administrators,
        long activeProducts,
        long inactiveProducts,
        long pricedProducts,
        long unpricedActiveProducts,
        long configuredOffers,
        long quotesSubmitted,
        long quotesInReview,
        long quotesAnswered,
        long quotesClosed,
        List<QuoteResponse> recentQuotes,
        /** Active products per division, largest first. Drives the catalogue chart. */
        List<CategoryCountResponse> catalogueByCategory,
        /** Quote requests per day over the trailing month, zero-filled. */
        List<DayCountResponse> quotesByDay) {}
