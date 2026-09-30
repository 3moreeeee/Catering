package tn.com.catering.identity.services;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import tn.com.catering.identity.DTO.ImageMetricsResponse;

/**
 * Measured object bounds of the catalogue photographs
 * (classpath:catalog/product-image-metrics.json, written by the storefront's
 * scripts/generate-product-image-metrics.mjs).
 *
 * <p>They used to ship inside the storefront bundle for every visitor; served
 * with each image, the browser only receives the measurements of the products
 * it displays. A photograph without a measurement simply gets none.
 */
@Component
public class ProductImageMetrics {

    private static final String RESOURCE = "catalog/product-image-metrics.json";
    private static final Pattern CATALOGUE_PATH = Pattern.compile("/img/products/[^?#]+");
    /** ImageKit encodes UTF-8 bytes of a file name as _C3_A9; the measured paths use %C3%A9. */
    private static final Pattern ENCODED_BYTES = Pattern.compile("(?:_[0-9a-fA-F]{2}){2,}");

    private final Map<String, ImageMetricsResponse> byPath;

    public ProductImageMetrics(ObjectMapper objectMapper) {
        this.byPath = load(objectMapper);
    }

    /** The measurement for a stored image src (relative key or full ImageKit URL), or null. */
    public ImageMetricsResponse of(String src) {
        if (src == null || byPath.isEmpty()) return null;
        return byPath.get(key(src));
    }

    static String key(String src) {
        Matcher path = CATALOGUE_PATH.matcher(src);
        String value = path.find() ? path.group() : src;
        Matcher bytes = ENCODED_BYTES.matcher(value);
        StringBuilder out = new StringBuilder();
        while (bytes.find()) bytes.appendReplacement(out, Matcher.quoteReplacement(bytes.group().replace('_', '%')));
        bytes.appendTail(out);
        return out.toString();
    }

    private static Map<String, ImageMetricsResponse> load(ObjectMapper objectMapper) {
        ClassPathResource resource = new ClassPathResource(RESOURCE);
        if (!resource.exists()) return Map.of();
        try (InputStream in = resource.getInputStream()) {
            return Map.copyOf(objectMapper.readValue(in, new TypeReference<Map<String, ImageMetricsResponse>>() {}));
        } catch (IOException exception) {
            throw new IllegalStateException("Unreadable " + RESOURCE, exception);
        }
    }
}
