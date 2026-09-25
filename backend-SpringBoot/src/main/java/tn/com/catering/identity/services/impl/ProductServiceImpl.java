package tn.com.catering.identity.services.impl;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tn.com.catering.identity.DTO.BrandResponse;
import tn.com.catering.identity.DTO.CategoryResponse;
import tn.com.catering.identity.DTO.PageResponse;
import tn.com.catering.identity.DTO.ProductFormatRequest;
import tn.com.catering.identity.DTO.ProductImageRequest;
import tn.com.catering.identity.DTO.ProductMapper;
import tn.com.catering.identity.DTO.ProductPricePoint;
import tn.com.catering.identity.DTO.ProductPriceRequest;
import tn.com.catering.identity.DTO.ProductRequest;
import tn.com.catering.identity.DTO.ProductResponse;
import tn.com.catering.identity.common.ApiException;
import tn.com.catering.identity.entities.Category;
import tn.com.catering.identity.entities.Product;
import tn.com.catering.identity.entities.ProductFormat;
import tn.com.catering.identity.entities.ProductImage;
import tn.com.catering.identity.repositories.BrandRepository;
import tn.com.catering.identity.repositories.CategoryRepository;
import tn.com.catering.identity.repositories.ProductRepository;
import tn.com.catering.identity.services.ProductService;

@Service
@Transactional
public class ProductServiceImpl implements ProductService {

    /** Guards against a client asking for the whole catalogue in one response. */
    private static final int MAX_PAGE_SIZE = 100;
    /** One catalogue page of ids at a time; the storefront asks per rendered page. */
    private static final int MAX_PRICE_LOOKUP = 200;
    private static final String DEFAULT_CURRENCY = "TND";

    private final ProductRepository products;
    private final CategoryRepository categories;
    private final BrandRepository brands;
    private final ProductMapper mapper;

    public ProductServiceImpl(ProductRepository products, CategoryRepository categories,
                              BrandRepository brands, ProductMapper mapper) {
        this.products = products;
        this.categories = categories;
        this.brands = brands;
        this.mapper = mapper;
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ProductResponse> search(String q, String category, String subcategory,
                                                String brand, Boolean featured, String sort,
                                                int page, int pageSize) {
        Pageable pageable = PageRequest.of(
                Math.max(page, 0),
                Math.clamp(pageSize, 1, MAX_PAGE_SIZE),
                sortOf(sort));
        Page<Product> found = products.findVisible(
                normalizeSearch(q), blankToNull(category), blankToNull(subcategory),
                blankToNull(brand), featured, pageable);
        return PageResponse.of(found.map(mapper::toResponse));
    }

    @Override
    @Transactional(readOnly = true)
    public ProductResponse bySlug(String slug) {
        Product product = products.findBySlug(slug).orElseThrow(ProductServiceImpl::notFound);
        // A deactivated product is not part of the catalogue any more. It stays
        // reachable by id for administrators, but the public slug route hides it.
        if (!product.isActive()) throw notFound();
        return mapper.toResponse(product);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductPricePoint> prices(List<String> sourceIds) {
        if (sourceIds == null || sourceIds.isEmpty()) return List.of();
        if (sourceIds.size() > MAX_PRICE_LOOKUP) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "too_many_ids",
                    "Trop de références demandées en une seule fois.");
        }
        return products.findBySourceIdIn(sourceIds).stream()
                .map(product -> new ProductPricePoint(
                        product.getSourceId(), product.getId(), product.getSlug(),
                        product.effectivePrice(), product.getPrice(), product.hasCurrentOffer(), product.getCurrency(),
                        product.getStockQuantity(), product.isActive()))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public ProductResponse byId(UUID id) {
        return mapper.toResponse(require(id));
    }

    @Override
    public ProductResponse create(ProductRequest request) {
        if (products.existsBySourceId(request.sourceId())) {
            throw new ApiException(HttpStatus.CONFLICT, "product_source_id_exists",
                    "Un produit utilise déjà cette référence interne.");
        }
        if (products.existsBySlug(request.slug())) {
            throw new ApiException(HttpStatus.CONFLICT, "product_slug_exists",
                    "Un produit utilise déjà ce slug.");
        }
        Product product = new Product(request.sourceId(), request.slug(), request.nameFr(), request.categoryId());
        apply(product, request);
        return mapper.toResponse(products.save(product));
    }

    @Override
    public ProductResponse update(UUID id, ProductRequest request) {
        Product product = require(id);
        products.findBySourceId(request.sourceId())
                .filter(other -> !other.getId().equals(id))
                .ifPresent(other -> {
                    throw new ApiException(HttpStatus.CONFLICT, "product_source_id_exists",
                            "Un autre produit utilise déjà cette référence interne.");
                });
        products.findBySlug(request.slug())
                .filter(other -> !other.getId().equals(id))
                .ifPresent(other -> {
                    throw new ApiException(HttpStatus.CONFLICT, "product_slug_exists",
                            "Un autre produit utilise déjà ce slug.");
                });
        product.setSourceId(request.sourceId());
        product.setSlug(request.slug());
        product.setNameFr(request.nameFr());
        product.setCategoryId(request.categoryId());
        apply(product, request);
        return mapper.toResponse(product);
    }

    @Override
    public ProductResponse updatePrice(UUID id, ProductPriceRequest request) {
        Product product = require(id);
        // A null price is a deliberate "prix sur demande", so the currency is
        // cleared with it rather than left dangling on a product with no price.
        product.setPrice(request.price());
        product.setCurrency(request.price() == null
                ? null
                : (request.currency() == null ? DEFAULT_CURRENCY : request.currency()));
        if (request.stockQuantity() != null) product.setStockQuantity(request.stockQuantity());
        return mapper.toResponse(product);
    }

    @Override
    public void deactivate(UUID id) {
        require(id).setActive(false);
    }

    @Override
    public ProductResponse reactivate(UUID id) {
        Product product = require(id);
        product.setActive(true);
        return mapper.toResponse(product);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CategoryResponse> categories() {
        List<Category> all = categories.findAll();
        Map<String, List<Category>> children = all.stream()
                .filter(category -> category.getParentExternalId() != null)
                .collect(Collectors.groupingBy(Category::getParentExternalId));
        return all.stream()
                .filter(category -> category.getParentExternalId() == null)
                .sorted((a, b) -> a.getNameFr().compareToIgnoreCase(b.getNameFr()))
                .map(parent -> mapper.toResponse(parent, children
                        .getOrDefault(parent.getExternalId(), List.of()).stream()
                        .sorted((a, b) -> a.getNameFr().compareToIgnoreCase(b.getNameFr()))
                        .map(child -> mapper.toResponse(child, List.of()))
                        .toList()))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<BrandResponse> brands() {
        return brands.findAllByOrderByNameAsc().stream().map(mapper::toResponse).toList();
    }

    // -------------------------------------------------------------------------

    private Product require(UUID id) {
        return products.findById(id).orElseThrow(ProductServiceImpl::notFound);
    }

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "product_not_found", "Produit introuvable.");
    }

    /**
     * Copies the mutable fields of a request onto a product.
     *
     * <p>Images and formats are replaced wholesale rather than diffed: they are
     * small ordered lists edited as a unit in the admin form, and orphanRemoval
     * makes the replacement clean up the rows the request dropped.
     */
    private void apply(Product product, ProductRequest request) {
        product.setNameEn(request.nameEn());
        product.setShortDescriptionFr(request.shortDescriptionFr());
        product.setShortDescriptionEn(request.shortDescriptionEn());
        product.setDescriptionFr(request.descriptionFr());
        product.setDescriptionEn(request.descriptionEn());
        product.setSubcategoryId(request.subcategoryId());
        product.setBrandId(request.brandId());
        product.setIndustries(new LinkedHashSet<>(
                request.industries() == null ? List.of() : request.industries()));
        product.setPrice(request.price());
        product.setCurrency(request.price() == null
                ? null
                : (request.currency() == null ? DEFAULT_CURRENCY : request.currency()));
        product.setStockQuantity(request.stockQuantity());
        product.setSupplierReference(request.reference());
        product.setTechnicalSheetUrl(request.technicalSheetUrl());
        product.setFeatured(request.featured());
        product.setNeedsVerification(request.needsVerification());
        product.setSeoTitleFr(request.seoTitleFr());
        product.setSeoTitleEn(request.seoTitleEn());
        product.setSeoDescriptionFr(request.seoDescriptionFr());
        product.setSeoDescriptionEn(request.seoDescriptionEn());

        product.clearImages();
        List<ProductImageRequest> images = request.images() == null ? List.of() : request.images();
        for (int index = 0; index < images.size(); index++) {
            ProductImageRequest image = images.get(index);
            product.addImage(new ProductImage(
                    image.src(), image.altFr(), image.altEn(), image.width(), image.height(), index));
        }

        product.clearFormats();
        List<ProductFormatRequest> formats = request.formats() == null ? List.of() : request.formats();
        for (int index = 0; index < formats.size(); index++) {
            ProductFormatRequest format = formats.get(index);
            product.addFormat(new ProductFormat(
                    format.id(), format.value(), format.packQuantity(),
                    format.sizeBucket(), format.reference(), index));
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    /** PostgreSQL needs a typed string value in the JPQL lower/concat predicate. */
    private static String normalizeSearch(String value) {
        return value == null ? "" : value.trim();
    }

    /**
     * Whitelisted sorts only. The value reaches JPA as a property name, so an
     * arbitrary string would let a caller order by any mapped field.
     */
    private static Sort sortOf(String sort) {
        List<Sort.Order> orders = new ArrayList<>();
        switch (sort == null ? "" : sort) {
            case "name-desc" -> orders.add(Sort.Order.desc("nameFr").ignoreCase());
            case "price-asc" -> orders.add(Sort.Order.asc("price").nullsLast());
            case "price-desc" -> orders.add(Sort.Order.desc("price").nullsLast());
            case "category" -> {
                orders.add(Sort.Order.asc("categoryId"));
                orders.add(Sort.Order.asc("nameFr").ignoreCase());
            }
            case "newest" -> orders.add(Sort.Order.desc("createdAt"));
            default -> orders.add(Sort.Order.asc("nameFr").ignoreCase());
        }
        return Sort.by(orders);
    }
}
