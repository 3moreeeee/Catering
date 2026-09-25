package tn.com.catering.identity.services.impl;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tn.com.catering.identity.DTO.CategoryCountResponse;
import tn.com.catering.identity.DTO.DashboardStatsResponse;
import tn.com.catering.identity.DTO.DayCountResponse;
import tn.com.catering.identity.DTO.LocalizedText;
import tn.com.catering.identity.DTO.PageResponse;
import tn.com.catering.identity.DTO.OfferRequest;
import tn.com.catering.identity.DTO.ProductMapper;
import tn.com.catering.identity.DTO.ProductResponse;
import tn.com.catering.identity.DTO.QuoteMapper;
import tn.com.catering.identity.entities.QuoteStatus;
import tn.com.catering.identity.person.PersonRepository;
import tn.com.catering.identity.person.Role;
import tn.com.catering.identity.repositories.ProductRepository;
import tn.com.catering.identity.repositories.QuoteRepository;
import tn.com.catering.identity.services.DashboardService;
import tn.com.catering.identity.common.ApiException;
import org.springframework.http.HttpStatus;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Service
@Transactional(readOnly = true)
public class DashboardServiceImpl implements DashboardService {

    private static final int MAX_PAGE_SIZE = 100;

    /** Trailing window for the activity chart, in days. */
    private static final int ACTIVITY_DAYS = 30;

    private final PersonRepository people;
    private final ProductRepository products;
    private final QuoteRepository quotes;
    private final ProductMapper productMapper;
    private final QuoteMapper quoteMapper;

    public DashboardServiceImpl(PersonRepository people, ProductRepository products, QuoteRepository quotes,
                                ProductMapper productMapper, QuoteMapper quoteMapper) {
        this.people = people;
        this.products = products;
        this.quotes = quotes;
        this.productMapper = productMapper;
        this.quoteMapper = quoteMapper;
    }

    @Override
    public DashboardStatsResponse stats() {
        return new DashboardStatsResponse(
                people.countByRole(Role.CLIENT),
                people.countByRole(Role.ADMIN),
                products.countByActiveTrue(),
                products.countByActiveFalse(),
                products.countByPriceIsNotNull(),
                products.countByPriceIsNullAndActiveTrue(),
                products.countByOfferPriceIsNotNull(),
                quotes.countByStatus(QuoteStatus.SUBMITTED),
                quotes.countByStatus(QuoteStatus.IN_REVIEW),
                quotes.countByStatus(QuoteStatus.ANSWERED),
                quotes.countByStatus(QuoteStatus.CLOSED),
                quotes.findTop5ByOrderByCreatedAtDesc().stream().map(quoteMapper::toResponse).toList(),
                catalogueByCategory(),
                quotesByDay());
    }

    private List<CategoryCountResponse> catalogueByCategory() {
        return products.countActiveByCategory().stream()
                .map(row -> new CategoryCountResponse(
                        row.externalId(),
                        LocalizedText.of(row.nameFr(), row.nameEn()),
                        row.products()))
                .toList();
    }

    /**
     * Quote requests per day over the trailing month.
     *
     * <p>Every day in the window is present, including the empty ones: a chart
     * that skipped silent days would compress the gaps and overstate how steady
     * the demand is.
     */
    private List<DayCountResponse> quotesByDay() {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        LocalDate from = today.minusDays(ACTIVITY_DAYS - 1);
        Map<LocalDate, Long> byDay = quotes
                .findCreatedAtSince(from.atStartOfDay(ZoneOffset.UTC).toInstant())
                .stream()
                .collect(Collectors.groupingBy(
                        instant -> instant.atZone(ZoneOffset.UTC).toLocalDate(),
                        Collectors.counting()));
        return IntStream.range(0, ACTIVITY_DAYS)
                .mapToObj(from::plusDays)
                .map(day -> new DayCountResponse(day, byDay.getOrDefault(day, 0L)))
                .toList();
    }

    @Override
    public PageResponse<ProductResponse> products(String q, String category, String status, String priced,
                                                  int page, int pageSize) {
        Boolean active = switch (status == null ? "" : status) {
            case "active" -> Boolean.TRUE;
            case "inactive" -> Boolean.FALSE;
            default -> null;
        };
        Boolean hasPrice = switch (priced == null ? "" : priced) {
            case "yes" -> Boolean.TRUE;
            case "no" -> Boolean.FALSE;
            default -> null;
        };
        PageRequest pageable = PageRequest.of(
                Math.max(page, 0),
                Math.clamp(pageSize, 1, MAX_PAGE_SIZE),
                Sort.by(Sort.Order.desc("updatedAt")));
        return PageResponse.of(products.findForAdmin(
                        normalizeSearch(q), blankToNull(category), active, hasPrice, pageable)
                .map(productMapper::toResponse));
    }

    @Override
    public PageResponse<ProductResponse> offers(String q, int page, int pageSize) {
        PageRequest pageable = PageRequest.of(Math.max(page, 0), Math.clamp(pageSize, 1, MAX_PAGE_SIZE),
                Sort.by(Sort.Order.desc("updatedAt")));
        return PageResponse.of(products.findOffers(normalizeSearch(q), pageable).map(productMapper::toResponse));
    }

    @Override
    @Transactional(readOnly = false)
    public ProductResponse saveOffer(UUID productId, OfferRequest request) {
        var product = products.findById(productId).orElseThrow(() ->
                new ApiException(HttpStatus.NOT_FOUND, "product_not_found", "Produit introuvable."));
        if (product.getPrice() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "offer_requires_price",
                    "Ajoutez d'abord un prix normal au produit.");
        }
        if (request.offerPrice().compareTo(product.getPrice()) >= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "offer_price_not_lower",
                    "Le prix de l'offre doit être inférieur au prix normal.");
        }
        if (request.startsAt() != null && request.endsAt() != null
                && !request.endsAt().isAfter(request.startsAt())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "offer_dates_invalid",
                    "La date de fin doit être postérieure à la date de début.");
        }
        product.setOfferPrice(request.offerPrice());
        product.setOfferStartsAt(request.startsAt());
        product.setOfferEndsAt(request.endsAt());
        product.setOfferActive(request.active());
        return productMapper.toResponse(product);
    }

    @Override
    @Transactional(readOnly = false)
    public void deleteOffer(UUID productId) {
        var product = products.findById(productId).orElseThrow(() ->
                new ApiException(HttpStatus.NOT_FOUND, "product_not_found", "Produit introuvable."));
        product.setOfferPrice(null);
        product.setOfferStartsAt(null);
        product.setOfferEndsAt(null);
        product.setOfferActive(false);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String normalizeSearch(String value) {
        return value == null ? "" : value.trim();
    }
}
