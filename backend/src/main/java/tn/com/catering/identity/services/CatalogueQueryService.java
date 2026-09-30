package tn.com.catering.identity.services;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Tuple;
import jakarta.persistence.criteria.AbstractQuery;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Order;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tn.com.catering.identity.DTO.CatalogQuery;
import tn.com.catering.identity.DTO.CatalogStatsResponse;
import tn.com.catering.identity.DTO.ColorVariantResponse;
import tn.com.catering.identity.DTO.FacetSetResponse;
import tn.com.catering.identity.DTO.FacetValueResponse;
import tn.com.catering.identity.DTO.PageResponse;
import tn.com.catering.identity.DTO.ProductMapper;
import tn.com.catering.identity.DTO.ProductMapper.ColorGroupView;
import tn.com.catering.identity.DTO.ProductResponse;
import tn.com.catering.identity.DTO.SitemapEntryResponse;
import tn.com.catering.identity.common.ApiException;
import tn.com.catering.identity.entities.Product;
import tn.com.catering.identity.entities.ProductFormat;
import tn.com.catering.identity.repositories.ProductRepository;

/**
 * The public catalogue, read straight from the database.
 *
 * <p>Filtering, search, sorting, pagination, facet counts, the homepage
 * selections and related products are all computed by the database; the
 * storefront receives one page (at most {@link CatalogQuery#MAX_PAGE_SIZE}
 * products) or one product, never the catalogue.
 *
 * <p>Queries are built with the Criteria API so they run unchanged on
 * PostgreSQL (Neon) and on the H2 database of the integration tests. A page is
 * read in two steps, ordered ids first and then the products, so collection
 * fetching never interferes with LIMIT/OFFSET; every order ends on the primary
 * key, so consecutive pages neither repeat nor skip a product.
 */
@Service
@Transactional(readOnly = true)
public class CatalogueQueryService {

    /** Lower-case Latin letters with diacritics and their plain forms, position for position. */
    private static final String ACCENTED = "àáâãäåāçèéêëēìíîïīñòóôõöōùúûüūýÿ";
    private static final String PLAIN = "aaaaaaaceeeeeiiiiinoooooouuuuuyy";
    private static final int DEFAULT_RELATED = 4;
    /**
     * How long the colour-line folding is reused. It changes only when an
     * administrator (de)activates one of its few SKUs, and public catalogue
     * responses are edge-cached for 60 s anyway; it saves a database round
     * trip on every request.
     */
    private static final long VISIBILITY_TTL_NANOS = java.util.concurrent.TimeUnit.SECONDS.toNanos(30);

    private final EntityManager entityManager;
    private final ProductRepository products;
    private final ProductMapper mapper;
    private volatile Visibility cachedVisibility;
    private volatile long cachedVisibilityAt;

    public CatalogueQueryService(EntityManager entityManager, ProductRepository products, ProductMapper mapper) {
        this.entityManager = entityManager;
        this.products = products;
        this.mapper = mapper;
    }

    // --- Public reads ----------------------------------------------------------------

    public PageResponse<ProductResponse> search(CatalogQuery query) {
        Visibility visibility = visibility();
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();

        CriteriaQuery<UUID> ids = cb.createQuery(UUID.class);
        Root<Product> product = ids.from(Product.class);
        ids.select(product.get("id"))
                .where(filters(cb, ids, product, query, visibility))
                .orderBy(orders(cb, product, query));
        List<UUID> pageIds = entityManager.createQuery(ids)
                .setFirstResult(query.page() * query.pageSize())
                .setMaxResults(query.pageSize())
                .getResultList();

        CriteriaQuery<Long> count = cb.createQuery(Long.class);
        Root<Product> counted = count.from(Product.class);
        count.select(cb.count(counted)).where(filters(cb, count, counted, query, visibility));
        long total = entityManager.createQuery(count).getSingleResult();

        int totalPages = (int) Math.max(1, (total + query.pageSize() - 1) / query.pageSize());
        return new PageResponse<>(load(pageIds, visibility), total, query.page(), query.pageSize(), totalPages);
    }

    public FacetSetResponse facets(CatalogQuery query) {
        Visibility visibility = visibility();
        return new FacetSetResponse(
                facet(query.without("categories"), visibility, product -> product.get("categoryId")),
                facet(query.without("subcategories"), visibility, product -> product.get("subcategoryId")),
                facet(query.without("brands"), visibility, product -> product.get("brandId")),
                facet(query.without("industries"), visibility, product -> product.join("industries")),
                facet(query.without("sizes"), visibility, product -> {
                    Join<Product, ProductFormat> format = product.join("formats");
                    return format.get("sizeBucket");
                }));
    }

    public CatalogStatsResponse stats() {
        Visibility visibility = visibility();
        CatalogQuery all = CatalogQuery.of(null, null, null, null, null, null, null, null, 0, null);
        Map<String, Long> categories = new LinkedHashMap<>();
        for (FacetValueResponse value : facet(all, visibility, product -> product.get("categoryId"))) {
            categories.put(value.id(), value.count());
        }
        Map<String, Long> brands = new LinkedHashMap<>();
        for (FacetValueResponse value : facet(all, visibility, product -> product.get("brandId"))) {
            brands.put(value.id(), value.count());
        }
        long total = categories.values().stream().mapToLong(Long::longValue).sum();
        return new CatalogStatsResponse(total, categories, brands);
    }

    public ProductResponse bySlug(String slug) {
        Product product = products.findBySlug(slug).filter(Product::isActive).orElseThrow(CatalogueQueryService::notFound);
        Visibility visibility = visibility();
        String canonicalId = visibility.canonicalByMember().get(product.getSourceId());
        if (canonicalId != null && !canonicalId.equals(product.getSourceId())) {
            // Another colour of a grouped line: its page is the line's page.
            product = products.findBySourceId(canonicalId).orElse(product);
        }
        return mapper.toResponse(product, visibility.groups().get(product.getSourceId()));
    }

    /**
     * The homepage showcase: curated (featured) products first, then verified
     * ones, optionally within one division.
     */
    public List<ProductResponse> featured(String category, Integer limit) {
        Visibility visibility = visibility();
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<UUID> ids = cb.createQuery(UUID.class);
        Root<Product> product = ids.from(Product.class);
        List<Predicate> where = new ArrayList<>(List.of(visible(cb, product, visibility)));
        if (category != null && !category.isBlank()) where.add(cb.equal(product.get("categoryId"), category.trim()));
        where.add(cb.or(cb.isTrue(product.get("featured")), cb.isFalse(product.get("needsVerification"))));
        ids.select(product.get("id")).where(where.toArray(Predicate[]::new))
                .orderBy(cb.desc(product.get("featured")), cb.asc(normalized(cb, product.get("nameFr"))), cb.asc(product.get("id")));
        return load(entityManager.createQuery(ids).setMaxResults(CatalogQuery.clampPageSize(limit)).getResultList(), visibility);
    }

    /** Products with a configured promotion that has not ended, current ones first. */
    public List<ProductResponse> offers(Integer limit) {
        Visibility visibility = visibility();
        Instant now = Instant.now();
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<UUID> ids = cb.createQuery(UUID.class);
        Root<Product> product = ids.from(Product.class);
        Path<java.math.BigDecimal> price = product.get("price");
        Path<java.math.BigDecimal> offerPrice = product.get("offerPrice");
        Path<Instant> startsAt = product.get("offerStartsAt");
        Path<Instant> endsAt = product.get("offerEndsAt");
        Expression<Integer> upcoming = cb.<Integer>selectCase()
                .when(cb.or(cb.isNull(startsAt), cb.lessThanOrEqualTo(startsAt, now)), 0)
                .otherwise(1);
        ids.select(product.get("id")).where(
                        visible(cb, product, visibility),
                        cb.isTrue(product.get("offerActive")),
                        cb.isNotNull(price), cb.isNotNull(offerPrice),
                        cb.lessThan(offerPrice, price),
                        cb.or(cb.isNull(endsAt), cb.greaterThan(endsAt, now)))
                .orderBy(cb.asc(upcoming), cb.asc(normalized(cb, product.get("nameFr"))), cb.asc(product.get("id")));
        return load(entityManager.createQuery(ids).setMaxResults(CatalogQuery.clampPageSize(limit)).getResultList(), visibility);
    }

    /**
     * Neighbours of a product, scored in the database: same subcategory 5,
     * same brand 3, same division 2, plus one per shared industry.
     */
    public List<ProductResponse> related(String slug, Integer limit) {
        ProductResponse base = bySlug(slug);
        Visibility visibility = visibility();
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<UUID> ids = cb.createQuery(UUID.class);
        Root<Product> product = ids.from(Product.class);

        Expression<Long> score = cb.<Long>selectCase()
                .when(cb.equal(product.get("categoryId"), base.categoryId()), 2L).otherwise(0L);
        if (base.subcategoryId() != null) {
            score = cb.sum(score, cb.<Long>selectCase()
                    .when(cb.equal(product.get("subcategoryId"), base.subcategoryId()), 5L).otherwise(0L));
        }
        if (base.brandId() != null) {
            score = cb.sum(score, cb.<Long>selectCase()
                    .when(cb.equal(product.get("brandId"), base.brandId()), 3L).otherwise(0L));
        }
        if (!base.industries().isEmpty()) {
            Subquery<Long> shared = ids.subquery(Long.class);
            Root<Product> same = shared.from(Product.class);
            Join<Product, String> industry = same.join("industries");
            shared.select(cb.count(industry))
                    .where(cb.equal(same.get("id"), product.get("id")), industry.in(base.industries()));
            score = cb.sum(score, shared);
        }
        ids.select(product.get("id")).where(
                        visible(cb, product, visibility),
                        cb.notEqual(product.get("id"), base.id()),
                        cb.greaterThan(score, 0L))
                .orderBy(cb.desc(score), cb.asc(normalized(cb, product.get("nameFr"))), cb.asc(product.get("id")));
        int size = limit == null ? DEFAULT_RELATED : CatalogQuery.clampPageSize(limit);
        return load(entityManager.createQuery(ids).setMaxResults(size).getResultList(), visibility);
    }

    /** Every public product URL: slugs only, for the sitemap. */
    public List<SitemapEntryResponse> sitemap() {
        Visibility visibility = visibility();
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<Tuple> rows = cb.createTupleQuery();
        Root<Product> product = rows.from(Product.class);
        rows.multiselect(product.get("slug"), product.get("categoryId"), product.get("updatedAt"))
                .where(visible(cb, product, visibility))
                .orderBy(cb.asc(product.get("categoryId")), cb.asc(product.get("slug")));
        return entityManager.createQuery(rows).getResultList().stream()
                .map(row -> new SitemapEntryResponse(row.get(0, String.class), row.get(1, String.class), row.get(2, Instant.class)))
                .toList();
    }

    // --- Query building --------------------------------------------------------------

    private Predicate[] filters(CriteriaBuilder cb, AbstractQuery<?> query, Root<Product> product,
                                CatalogQuery catalog, Visibility visibility) {
        List<Predicate> where = new ArrayList<>();
        where.add(visible(cb, product, visibility));
        if (!catalog.categories().isEmpty()) where.add(product.get("categoryId").in(catalog.categories()));
        if (!catalog.subcategories().isEmpty()) where.add(product.get("subcategoryId").in(catalog.subcategories()));
        if (!catalog.brands().isEmpty()) where.add(product.get("brandId").in(catalog.brands()));
        if (!catalog.industries().isEmpty()) {
            Subquery<UUID> tagged = query.subquery(UUID.class);
            Root<Product> other = tagged.from(Product.class);
            Join<Product, String> industry = other.join("industries");
            tagged.select(other.get("id")).where(industry.in(catalog.industries()));
            where.add(product.get("id").in(tagged));
        }
        if (!catalog.sizes().isEmpty()) {
            Subquery<UUID> sized = query.subquery(UUID.class);
            Root<ProductFormat> format = sized.from(ProductFormat.class);
            sized.select(format.get("product").get("id")).where(format.get("sizeBucket").in(catalog.sizes()));
            where.add(product.get("id").in(sized));
        }
        if (!catalog.terms().isEmpty()) {
            List<Predicate> perTerm = catalog.terms().stream()
                    .map(term -> matches(cb, query, product, term))
                    .toList();
            where.add(catalog.anyTerm() ? cb.or(perTerm.toArray(Predicate[]::new)) : cb.and(perTerm.toArray(Predicate[]::new)));
        }
        return where.toArray(Predicate[]::new);
    }

    /** The storefront's haystack: names, short descriptions, taxonomy ids, reference and formats. */
    private Predicate matches(CriteriaBuilder cb, AbstractQuery<?> query, Root<Product> product, String term) {
        String pattern = "%" + escapeLike(term) + "%";
        Subquery<UUID> formats = query.subquery(UUID.class);
        Root<ProductFormat> format = formats.from(ProductFormat.class);
        formats.select(format.get("product").get("id"))
                .where(cb.like(normalized(cb, format.get("formatValue")), pattern, '\\'));
        return cb.or(
                cb.like(normalized(cb, product.get("nameFr")), pattern, '\\'),
                cb.like(normalized(cb, product.get("nameEn")), pattern, '\\'),
                cb.like(normalized(cb, product.get("shortDescriptionFr")), pattern, '\\'),
                cb.like(normalized(cb, product.get("shortDescriptionEn")), pattern, '\\'),
                cb.like(normalized(cb, product.get("categoryId")), pattern, '\\'),
                cb.like(normalized(cb, product.get("subcategoryId")), pattern, '\\'),
                cb.like(normalized(cb, product.get("brandId")), pattern, '\\'),
                cb.like(normalized(cb, product.get("supplierReference")), pattern, '\\'),
                product.get("id").in(formats));
    }

    private List<Order> orders(CriteriaBuilder cb, Root<Product> product, CatalogQuery query) {
        Expression<String> nameFr = normalized(cb, product.get("nameFr"));
        Expression<String> name = normalized(cb, cb.coalesce(product.get("nameEn"), product.<String>get("nameFr")));
        Order byId = cb.asc(product.get("id"));
        return switch (query.sort()) {
            case "name-asc" -> List.of(cb.asc(name), byId);
            case "name-desc" -> List.of(cb.desc(name), byId);
            case "category" -> List.of(cb.asc(product.get("categoryId")),
                    cb.asc(cb.coalesce(product.<String>get("subcategoryId"), "")), cb.asc(name), byId);
            // A search ranks its matches, so the closest ones open the first page;
            // browsing without one leads with the curated products.
            default -> query.terms().isEmpty()
                    ? List.of(cb.desc(product.get("featured")), cb.asc(nameFr), byId)
                    : List.of(cb.desc(relevance(cb, product, query.terms())),
                            cb.desc(product.get("featured")), cb.asc(nameFr), byId);
        };
    }

    /**
     * Search ranking, per term: a whole word of the name counts 10, part of the
     * name 7, elsewhere in the haystack 2. "Pique P" thus ranks "Pique P 13cm"
     * above "Pique perle", although both contain "p".
     */
    private Expression<Long> relevance(CriteriaBuilder cb, Root<Product> product, List<String> terms) {
        Expression<String> names = cb.concat(cb.concat(normalized(cb, product.get("nameFr")), " "),
                cb.concat(cb.concat(normalized(cb, product.get("nameEn")), " "), normalized(cb, product.get("slug"))));
        Expression<String> words = cb.concat(cb.concat(" ", names), " ");
        Expression<Long> score = cb.literal(0L);
        for (String term : terms) {
            String pattern = "%" + escapeLike(term) + "%";
            String word = "% " + escapeLike(term) + " %";
            Expression<String> haystack = cb.concat(cb.concat(names, " "), cb.concat(cb.concat(
                    normalized(cb, product.get("shortDescriptionFr")), " "),
                    cb.concat(cb.concat(normalized(cb, product.get("shortDescriptionEn")), " "),
                            cb.concat(cb.concat(normalized(cb, product.get("subcategoryId")), " "),
                                    normalized(cb, product.get("brandId"))))));
            score = cb.sum(score, cb.<Long>selectCase()
                    .when(cb.like(words, word, '\\'), 10L)
                    .when(cb.like(names, pattern, '\\'), 7L)
                    .when(cb.like(haystack, pattern, '\\'), 2L)
                    .otherwise(0L));
        }
        return score;
    }

    private List<FacetValueResponse> facet(CatalogQuery query, Visibility visibility,
                                           Function<Root<Product>, Expression<String>> keyOf) {
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<Tuple> rows = cb.createTupleQuery();
        Root<Product> product = rows.from(Product.class);
        Expression<String> key = keyOf.apply(product);
        List<Predicate> where = new ArrayList<>(List.of(filters(cb, rows, product, query, visibility)));
        where.add(cb.isNotNull(key));
        rows.multiselect(key, cb.countDistinct(product.get("id")))
                .where(where.toArray(Predicate[]::new))
                .groupBy(key);
        return entityManager.createQuery(rows).getResultList().stream()
                .map(row -> new FacetValueResponse(row.get(0, String.class), row.get(1, Long.class)))
                .sorted(Comparator.comparingLong(FacetValueResponse::count).reversed()
                        .thenComparing(FacetValueResponse::id))
                .toList();
    }

    private static Predicate visible(CriteriaBuilder cb, Root<Product> product, Visibility visibility) {
        Predicate active = cb.isTrue(product.get("active"));
        return visibility.hidden().isEmpty()
                ? active
                : cb.and(active, cb.not(product.get("sourceId").in(visibility.hidden())));
    }

    /** lower(), accents folded, null as empty: the database side of {@link CatalogQuery#normalize}. */
    private static Expression<String> normalized(CriteriaBuilder cb, Expression<String> value) {
        return cb.function("translate", String.class,
                cb.lower(cb.coalesce(value, "")), cb.literal(ACCENTED), cb.literal(PLAIN));
    }

    private static String escapeLike(String term) {
        return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    // --- Loading and colour lines --------------------------------------------------------

    /** Loads products by id, keeping the order the ids were ranked in. */
    private List<ProductResponse> load(List<UUID> ids, Visibility visibility) {
        if (ids.isEmpty()) return List.of();
        Map<UUID, Product> byId = new HashMap<>();
        for (Product product : products.findAllById(ids)) byId.put(product.getId(), product);
        return ids.stream()
                .map(byId::get)
                .filter(java.util.Objects::nonNull)
                .map(product -> mapper.toResponse(product, visibility.groups().get(product.getSourceId())))
                .toList();
    }

    /**
     * Which colour SKUs are folded into their line. A line is folded only when
     * at least two of its colours are active, as the storefront used to do.
     */
    private Visibility visibility() {
        Visibility cached = cachedVisibility;
        if (cached != null && System.nanoTime() - cachedVisibilityAt < VISIBILITY_TTL_NANOS) return cached;
        Visibility fresh = loadVisibility();
        cachedVisibility = fresh;
        cachedVisibilityAt = System.nanoTime();
        return fresh;
    }

    private Visibility loadVisibility() {
        Map<String, Product> members = new HashMap<>();
        for (Product product : products.findBySourceIdIn(ColorVariantGroups.memberIds())) {
            if (product.isActive()) members.put(product.getSourceId(), product);
        }
        Set<String> hidden = new HashSet<>();
        Map<String, ColorGroupView> groups = new HashMap<>();
        Map<String, String> canonicalByMember = new HashMap<>();
        for (ColorVariantGroups.Group group : ColorVariantGroups.GROUPS) {
            List<ColorVariantGroups.Member> active = group.members().stream()
                    .filter(member -> members.containsKey(member.sourceId()))
                    .toList();
            if (active.size() < 2) continue;
            String canonical = members.containsKey(group.canonicalId()) ? group.canonicalId() : active.getFirst().sourceId();
            List<ColorVariantResponse> variants = active.stream()
                    .map(member -> new ColorVariantResponse(member.sourceId(),
                            members.get(member.sourceId()).getSlug(), member.label(), member.swatch()))
                    .toList();
            groups.put(canonical, new ColorGroupView(group.name(), variants));
            for (ColorVariantGroups.Member member : active) {
                canonicalByMember.put(member.sourceId(), canonical);
                if (!member.sourceId().equals(canonical)) hidden.add(member.sourceId());
            }
        }
        return new Visibility(Set.copyOf(hidden), Map.copyOf(groups), Map.copyOf(canonicalByMember));
    }

    private record Visibility(Set<String> hidden, Map<String, ColorGroupView> groups,
                              Map<String, String> canonicalByMember) {}

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "product_not_found", "Produit introuvable.");
    }
}
