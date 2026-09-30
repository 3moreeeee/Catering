package tn.com.catering.identity.services.impl;

import java.math.BigDecimal;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tn.com.catering.identity.DTO.BrandResponse;
import tn.com.catering.identity.DTO.CategoryResponse;
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
import tn.com.catering.identity.entities.SaleMode;
import tn.com.catering.identity.repositories.BrandRepository;
import tn.com.catering.identity.repositories.CategoryRepository;
import tn.com.catering.identity.repositories.ProductRepository;
import tn.com.catering.identity.services.ProductService;

@Service
@Transactional
public class ProductServiceImpl implements ProductService {

    /** One catalogue page of ids at a time; the storefront asks per rendered page. */
    private static final int MAX_PRICE_LOOKUP = 200;
    private static final String DEFAULT_CURRENCY = "TND";
    /** The largest amount a numeric(10,3) price column holds. */
    private static final BigDecimal MAX_PRICE = new BigDecimal("9999999.999");

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
                        product.getStockQuantity(), product.isActive(),
                        product.getSaleMode().name(),
                        product.isPackOnly() ? product.getUnitPrice() : null,
                        product.getPackQuantity(), product.getUnitLabel()))
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
        if (product.isPackOnly() && !samePrice(product.getPrice(), request.price())) {
            // The pack price is derived; editing it here would contradict its
            // unit price. It changes through the unit price or the pack size.
            throw badRequest("pack_price_derived",
                    "Le prix d'un produit vendu par lot se modifie via son prix unitaire.");
        }
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
            // The pack size lives on the primary format; an explicit top-level
            // packQuantity is written there rather than stored a second time.
            Integer packQuantity = index == 0 && request.packQuantity() != null
                    ? request.packQuantity()
                    : format.packQuantity();
            product.addFormat(new ProductFormat(
                    format.id(), packLabel(format.value(), packQuantity), packQuantity,
                    format.sizeBucket(), format.reference(), index));
        }
        if (formats.isEmpty() && request.packQuantity() != null) {
            product.addFormat(new ProductFormat(
                    null, packLabel(null, request.packQuantity()), request.packQuantity(), null, null, 0));
        }

        applyPricing(product, request);
    }

    /**
     * Sets the sale mode and the price.
     *
     * <p>A PACK_ONLY price is never taken from the request: it is always
     * {@code unitPrice × packQuantity}, computed here in BigDecimal, so the pack
     * price the storefront shows, the cart charges and the quote freezes can
     * never disagree with its two factors.
     */
    private static void applyPricing(Product product, ProductRequest request) {
        SaleMode mode = request.saleMode() == null ? SaleMode.UNIT : request.saleMode();
        product.setSaleMode(mode);
        if (mode == SaleMode.PACK_ONLY) {
            if (request.unitPrice() == null) {
                throw badRequest("pack_unit_price_required",
                        "Un produit vendu par lot doit avoir un prix unitaire supérieur à zéro.");
            }
            Integer packQuantity = product.getPackQuantity();
            if (packQuantity == null || packQuantity < 1) {
                throw badRequest("pack_quantity_required",
                        "Un produit vendu par lot doit indiquer le nombre de pièces par lot.");
            }
            BigDecimal packPrice = Product.packPrice(request.unitPrice(), packQuantity);
            if (packPrice.compareTo(MAX_PRICE) > 0) {
                throw badRequest("pack_price_too_large", "Le prix du lot dépasse la valeur maximale autorisée.");
            }
            product.setUnitPrice(request.unitPrice());
            product.setUnitLabel(request.unitLabel() == null ? "piece" : request.unitLabel());
            product.setPrice(packPrice);
            product.setCurrency(DEFAULT_CURRENCY);
            return;
        }
        product.setUnitPrice(null);
        product.setUnitLabel(request.unitLabel());
        product.setPrice(request.price());
        product.setCurrency(request.price() == null
                ? null
                : (request.currency() == null ? DEFAULT_CURRENCY : request.currency()));
    }

    /**
     * Keeps a generated "Pack de N" format label in step with its quantity. A
     * physical format ("70 cl", "114 mm") is left exactly as entered.
     */
    private static String packLabel(String value, Integer packQuantity) {
        if (packQuantity == null) return value;
        if (value == null || value.isBlank() || value.matches("Pack de \\d+")) return "Pack de " + packQuantity;
        return value;
    }

    /** BigDecimal equality ignores scale here: 12.000 and 12 are the same price. */
    private static boolean samePrice(BigDecimal a, BigDecimal b) {
        return a == null ? b == null : b != null && a.compareTo(b) == 0;
    }

    private static ApiException badRequest(String code, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, code, message);
    }
}
