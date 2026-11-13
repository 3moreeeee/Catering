package tn.com.catering.identity.aiimport;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import tn.com.catering.identity.DTO.MediaUploadResponse;
import tn.com.catering.identity.DTO.ProductFormatRequest;
import tn.com.catering.identity.DTO.ProductImageRequest;
import tn.com.catering.identity.DTO.ProductRequest;
import tn.com.catering.identity.DTO.ProductResponse;
import tn.com.catering.identity.aiimport.ProductImportDtos.ItemResponse;
import tn.com.catering.identity.aiimport.ProductImportDtos.ListResponse;
import tn.com.catering.identity.aiimport.ProductImportDtos.PublishRequest;
import tn.com.catering.identity.aiimport.ProductImportDtos.UpdateRequest;
import tn.com.catering.identity.aiimport.ProductImportItem.Action;
import tn.com.catering.identity.aiimport.ProductImportItem.Status;
import tn.com.catering.identity.common.ApiException;
import tn.com.catering.identity.entities.Product;
import tn.com.catering.identity.entities.ProductImage;
import tn.com.catering.identity.entities.SaleMode;
import tn.com.catering.identity.repositories.ProductRepository;
import tn.com.catering.identity.services.ImageKitUploadService;
import tn.com.catering.identity.services.ProductService;

/**
 * The AI importer's administrator actions: upload, review, publish, retry and
 * discard. The model's work happens in {@link ProductImportWorker}.
 *
 * <p>Publishing goes through {@link ProductService#create}, the same path as the
 * product form, and the request is checked with the same bean-validation rules,
 * so an imported product can never be something the form would have refused.
 */
@Service
public class ProductImportService {

    static final String IMAGE_FOLDER = "/fk-catering/img/products/ai-import";
    private static final int LIST_LIMIT = 500;

    private final ProductImportItemRepository items;
    private final ImageKitUploadService media;
    private final ProductImportWorker worker;
    private final AiImportSettings settings;
    private final ImportTaxonomyLoader catalogue;
    private final ProductService productService;
    private final ProductRepository products;
    private final Validator validator;
    private final PriceListRowRepository priceRows;
    private final PriceListParser priceListParser;

    public ProductImportService(ProductImportItemRepository items, ImageKitUploadService media,
                                ProductImportWorker worker, AiImportSettings settings,
                                ImportTaxonomyLoader catalogue, ProductService productService,
                                ProductRepository products, Validator validator,
                                PriceListRowRepository priceRows, PriceListParser priceListParser) {
        this.priceRows = priceRows;
        this.priceListParser = priceListParser;
        this.items = items;
        this.media = media;
        this.worker = worker;
        this.settings = settings;
        this.catalogue = catalogue;
        this.productService = productService;
        this.products = products;
        this.validator = validator;
    }

    @Transactional(readOnly = true)
    public ListResponse list(String status) {
        Set<Status> wanted = statuses(status);
        Map<String, Long> counts = new LinkedHashMap<>();
        for (Status value : Status.values()) counts.put(value.name(), items.countByStatus(value));
        List<ItemResponse> page = items.findByStatusInOrderByCreatedAtDesc(wanted, PageRequest.of(0, LIST_LIMIT))
                .stream().map(ItemResponse::of).toList();
        return new ListResponse(settings.configured(), settings.configured() ? settings.model() : null, counts, page);
    }

    /** Uploads each photograph to ImageKit and queues it. The model runs after the response. */
    public List<ItemResponse> enqueue(List<MultipartFile> files) {
        if (!settings.configured()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "ai_not_configured",
                    "Le service IA n'est pas configuré (AI_BASE_URL, AI_API_KEY, AI_MODEL).");
        }
        if (files == null || files.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "image_required", "Ajoutez au moins une image.");
        }
        List<ItemResponse> queued = files.stream().map(file -> {
            MediaUploadResponse uploaded = media.uploadProductImage(file, IMAGE_FOLDER);
            String filename = repairFilename(file.getOriginalFilename() == null ? "image" : file.getOriginalFilename());
            ProductImportItem item = new ProductImportItem(
                    filename.length() > 255 ? filename.substring(0, 255) : filename,
                    uploaded.url(), displayUrl(uploaded.url()), uploaded.width(), uploaded.height());
            return ItemResponse.of(items.save(item));
        }).toList();
        worker.wake();
        return queued;
    }

    @Transactional
    public ItemResponse update(UUID id, UpdateRequest request) {
        ProductImportItem item = require(id);
        requireStatus(item, Status.READY, Status.FAILED);
        if (request.action() == Action.REPLACE_IMAGE) {
            if (request.matchedProductId() == null || !products.existsById(request.matchedProductId())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "import_match_required",
                        "Choisissez le produit dont l'image doit être remplacée.");
            }
            item.setMatchedProductId(request.matchedProductId());
            item.setMatchedProductName(catalogue.productName(request.matchedProductId()));
        }
        ImportTaxonomy taxonomy = catalogue.taxonomy();
        if (!taxonomy.isDivision(request.categoryId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "import_category_invalid", "Division inconnue.");
        }
        item.setAction(request.action());
        item.setNameFr(request.nameFr().trim());
        item.setNameEn(blank(request.nameEn()));
        item.setShortDescriptionFr(blank(request.shortDescriptionFr()));
        item.setShortDescriptionEn(blank(request.shortDescriptionEn()));
        item.setDescriptionFr(blank(request.descriptionFr()));
        item.setDescriptionEn(blank(request.descriptionEn()));
        item.setCategoryId(request.categoryId());
        item.setSubcategoryId(taxonomy.isSubcategoryOf(request.subcategoryId(), request.categoryId())
                ? request.subcategoryId() : null);
        item.setBrandId(request.brandId() != null && taxonomy.brandIds().contains(request.brandId())
                ? request.brandId() : null);
        item.setIndustries(request.industries() == null ? "" : String.join(",", request.industries().stream()
                .filter(ImportTaxonomy.INDUSTRIES::contains).distinct().toList()));
        item.setFormatValue(blank(request.formatValue()));
        item.setPackQuantity(request.packQuantity());
        item.setUnitLabel(blank(request.unitLabel()));
        // A corrected FAILED item becomes reviewable; nothing is left for the model to do.
        if (item.getStatus() == Status.FAILED) {
            item.setStatus(Status.READY);
            item.setError(null);
        }
        return ItemResponse.of(item);
    }

    @Transactional
    public ItemResponse publish(UUID id, PublishRequest request) {
        ProductImportItem item = require(id);
        requireStatus(item, Status.READY);
        if (item.getAction() == Action.REPLACE_IMAGE) {
            Product product = products.findById(item.getMatchedProductId()).orElseThrow(() ->
                    new ApiException(HttpStatus.NOT_FOUND, "product_not_found", "Ce produit n'existe plus."));
            product.clearImages();
            product.addImage(new ProductImage(item.getDisplayUrl(), product.getNameFr(), product.getNameEn(),
                    item.getImageWidth(), item.getImageHeight(), 0));
            applyPrice(product, item, request);
            item.setPublishedProductId(product.getId());
        } else {
            ProductResponse created = productService.create(validated(productRequest(item, request)));
            item.setPublishedProductId(created.id());
        }
        item.setStatus(Status.PUBLISHED);
        return ItemResponse.of(item);
    }

    @Transactional
    public ItemResponse retry(UUID id) {
        ProductImportItem item = require(id);
        requireStatus(item, Status.FAILED, Status.READY);
        item.setStatus(Status.QUEUED);
        item.setAttempts(0);
        item.setError(null);
        wakeAfterCommit();
        return ItemResponse.of(item);
    }

    @Transactional
    public void discard(UUID id) {
        ProductImportItem item = require(id);
        if (item.getStatus() == Status.PUBLISHED) {
            throw new ApiException(HttpStatus.CONFLICT, "import_already_published",
                    "Cette fiche est déjà publiée : modifiez le produit depuis l'onglet Produits.");
        }
        item.setStatus(Status.DISCARDED);
    }

    /** Loaded price lists, one line each. */
    @Transactional(readOnly = true)
    public List<ProductImportDtos.PriceListResponse> priceLists() {
        return priceRows.summary().stream()
                .map(row -> new ProductImportDtos.PriceListResponse((String) row[0], (String) row[1],
                        ((Number) row[2]).longValue(), (java.time.Instant) row[3]))
                .toList();
    }

    /**
     * Reads price-list PDFs and stores their rows. A list replaces the earlier
     * edition of the same name ("Liste des Couverts jetables 08 2022" is
     * replaced by "… 03 2027"), so uploading a new edition updates the prices
     * the importer proposes.
     */
    @Transactional
    public List<ProductImportDtos.PriceListResponse> uploadPriceLists(List<MultipartFile> files) {
        if (files == null || files.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "pdf_required", "Ajoutez au moins une liste de prix en PDF.");
        }
        for (MultipartFile file : files) {
            String filename = file.getOriginalFilename() == null ? "liste.pdf" : repairFilename(file.getOriginalFilename());
            if (!filename.toLowerCase().endsWith(".pdf")) {
                throw new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "pdf_required",
                        "« " + filename + " » n'est pas un PDF.");
            }
            PriceListParser.ParsedList list;
            try (java.io.InputStream in = file.getInputStream()) {
                list = priceListParser.parse(in, filename);
            } catch (java.io.IOException unreadable) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "pdf_unreadable", "PDF illisible : " + filename);
            }
            if (list.rows().isEmpty()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "pdf_no_price",
                        "Aucune ligne de prix trouvée dans « " + filename + " ».");
            }
            priceRows.deleteByListName(list.listName());
            int position = 0;
            for (PriceListParser.ParsedRow row : list.rows()) {
                priceRows.save(new PriceListRow(list.listName(), filename, row.page(), position++, row.section(),
                        cut(row.name(), 500), row.unitPrice(), row.priceText(), cut(row.packaging(), 255),
                        row.cartonQuantity()));
            }
        }
        priceRows.flush();
        return priceLists();
    }

    @Transactional
    public void deletePriceList(String listName) {
        priceRows.deleteByListName(listName);
    }

    // -------------------------------------------------------------------------

    /**
     * Applies the confirmed price to an existing product whose photograph is
     * being replaced. Nothing is sent when the reviewer keeps the current
     * price, and a product keeps its own lot size.
     */
    private void applyPrice(Product product, ProductImportItem item, PublishRequest request) {
        SaleMode mode = request.saleMode();
        if (mode == SaleMode.PACK_ONLY && request.unitPrice() != null) {
            Integer lot = product.getPackQuantity() != null ? product.getPackQuantity() : item.getPackQuantity();
            if (lot == null || lot < 1) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "pack_quantity_required",
                        "Indiquez le nombre de pièces par lot.");
            }
            if (product.getFormats().isEmpty()) {
                product.addFormat(new tn.com.catering.identity.entities.ProductFormat(
                        null, "Pack de " + lot, lot, null, null, 0));
            }
            product.setSaleMode(SaleMode.PACK_ONLY);
            product.setUnitPrice(request.unitPrice());
            if (product.getUnitLabel() == null) {
                product.setUnitLabel(item.getUnitLabel() == null ? "piece" : item.getUnitLabel());
            }
            product.setPrice(Product.packPrice(request.unitPrice(), product.getPackQuantity()));
            product.setCurrency("TND");
        } else if (mode == SaleMode.UNIT && request.price() != null) {
            product.setSaleMode(SaleMode.UNIT);
            product.setUnitPrice(null);
            product.setPrice(request.price());
            product.setCurrency("TND");
        }
    }

    private static String cut(String value, int max) {
        return value == null ? null : value.length() > max ? value.substring(0, max) : value;
    }

    private ProductRequest productRequest(ProductImportItem item, PublishRequest price) {
        SaleMode mode = price.saleMode() == null ? SaleMode.UNIT : price.saleMode();
        if (mode == SaleMode.UNIT && price.price() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "import_price_required",
                    "Saisissez le prix avant de publier.");
        }
        if (mode == SaleMode.PACK_ONLY && price.unitPrice() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "pack_unit_price_required",
                    "Un produit vendu par lot doit avoir un prix unitaire.");
        }
        String slug = uniqueSlug(slugify(item.getNameFr()));
        String sourceId = "p-ai-" + item.getId().toString().replace("-", "").substring(0, 12);
        List<String> industries = item.getIndustries() == null || item.getIndustries().isBlank()
                ? List.of() : List.of(item.getIndustries().split(","));
        List<ProductFormatRequest> formats = item.getFormatValue() == null
                ? List.of()
                : List.of(new ProductFormatRequest(null, item.getFormatValue(), item.getPackQuantity(), null, null));
        return new ProductRequest(
                sourceId, slug, item.getNameFr(), item.getNameEn(),
                item.getShortDescriptionFr(), item.getShortDescriptionEn(),
                item.getDescriptionFr(), item.getDescriptionEn(),
                item.getCategoryId(), item.getSubcategoryId(), item.getBrandId(), industries,
                mode == SaleMode.UNIT ? price.price() : null,
                mode == SaleMode.UNIT ? "TND" : null,
                null, null, null, false, false,
                null, null, item.getShortDescriptionFr(), item.getShortDescriptionEn(),
                List.of(new ProductImageRequest(item.getDisplayUrl(), item.getNameFr(), item.getNameEn(),
                        item.getImageWidth(), item.getImageHeight())),
                formats,
                mode,
                mode == SaleMode.PACK_ONLY ? price.unitPrice() : null,
                item.getPackQuantity(),
                item.getUnitLabel());
    }

    private ProductRequest validated(ProductRequest request) {
        Set<ConstraintViolation<ProductRequest>> violations = validator.validate(request);
        if (!violations.isEmpty()) {
            ConstraintViolation<ProductRequest> first = violations.iterator().next();
            throw new ApiException(HttpStatus.BAD_REQUEST, "import_invalid",
                    first.getPropertyPath() + " : " + first.getMessage());
        }
        return request;
    }

    private String uniqueSlug(String base) {
        String root = base.isEmpty() ? "produit" : base.length() > 180 ? base.substring(0, 180) : base;
        String slug = root;
        for (int suffix = 2; products.existsBySlug(slug); suffix++) slug = root + "-" + suffix;
        return slug;
    }

    /**
     * Repairs a file name whose UTF-8 bytes were decoded as DOS code page 437,
     * which is what a zip made on one system and opened on another often does:
     * "Frapp├⌐ caf├⌐" becomes "Frappé café" again. The file name is the client's
     * product title, so it is worth getting right before the model reads it.
     * Names that are not of that form are returned unchanged.
     */
    static String repairFilename(String name) {
        if (name == null || (name.indexOf('├') < 0 && name.indexOf('┬') < 0)) return name;
        Charset dos = Charset.forName("IBM437");
        if (!dos.newEncoder().canEncode(name)) return name;
        try {
            return StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(name.getBytes(dos)))
                    .toString();
        } catch (CharacterCodingException notMojibake) {
            return name;
        }
    }

    static String slugify(String value) {
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase()
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-+|-+$)", "");
    }

    /** The stored image: the ImageKit original with the background-removal transformation, when enabled. */
    String displayUrl(String url) {
        String transformation = settings.backgroundRemoval();
        if (transformation.isEmpty() || !url.contains("ik.imagekit.io")) return url;
        return url + (url.contains("?") ? "&" : "?") + "tr=" + transformation;
    }

    private ProductImportItem require(UUID id) {
        return items.findById(id).orElseThrow(() ->
                new ApiException(HttpStatus.NOT_FOUND, "import_not_found", "Élément d'import introuvable."));
    }

    private static void requireStatus(ProductImportItem item, Status... allowed) {
        if (!EnumSet.of(allowed[0], allowed).contains(item.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "import_wrong_status",
                    "Action impossible pour un élément " + item.getStatus().name() + ".");
        }
    }

    private static Set<Status> statuses(String status) {
        if (status == null || status.isBlank() || status.equals("ACTIVE")) {
            return EnumSet.of(Status.QUEUED, Status.PROCESSING, Status.READY, Status.FAILED);
        }
        if (status.equals("ALL")) return EnumSet.allOf(Status.class);
        try {
            return EnumSet.of(Status.valueOf(status));
        } catch (IllegalArgumentException unknown) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "import_status_invalid", "Statut inconnu.");
        }
    }

    private static String blank(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private void wakeAfterCommit() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    worker.wake();
                }
            });
        } else {
            worker.wake();
        }
    }
}
