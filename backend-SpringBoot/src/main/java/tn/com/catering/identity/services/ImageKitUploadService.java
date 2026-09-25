package tn.com.catering.identity.services;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import tn.com.catering.identity.DTO.MediaUploadResponse;

/** Keeps the ImageKit private key server-side while allowing admins to upload product images. */
@Service
public class ImageKitUploadService {

    private static final long MAX_IMAGE_BYTES = 10L * 1024 * 1024;
    private static final Set<String> ALLOWED_TYPES = Set.of(
            "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif");

    private final RestClient restClient;
    private final String privateKey;

    public ImageKitUploadService(
            RestClient.Builder restClient,
            @Value("${IMAGEKIT_PRIVATE_KEY:}") String privateKey) {
        this.restClient = restClient.baseUrl("https://upload.imagekit.io/api/v1").build();
        this.privateKey = privateKey;
    }

    public MediaUploadResponse uploadProductImage(MultipartFile file) {
        validate(file);
        String filename = safeFilename(file.getOriginalFilename());

        // A plain MultiValueMap, not MultipartBodyBuilder: the builder pulls in
        // org.reactivestreams.Publisher, which this servlet application does not
        // ship, so every upload died with NoClassDefFoundError before reaching
        // ImageKit and the product was saved without its image.
        HttpHeaders fileHeaders = new HttpHeaders();
        fileHeaders.setContentType(MediaType.parseMediaType(file.getContentType()));
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        try {
            body.add("file", new HttpEntity<>(new NamedBytes(file.getBytes(), filename), fileHeaders));
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "image_read_failed", exception);
        }
        body.add("fileName", filename);
        body.add("folder", "/fk-catering/img/products/admin");
        body.add("useUniqueFileName", "true");

        MediaUploadResponse uploaded;
        try {
            uploaded = restClient.post()
                    .uri("/files/upload")
                    .header(HttpHeaders.AUTHORIZATION, basicAuth())
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(body)
                    .retrieve()
                    .body(MediaUploadResponse.class);
        } catch (RestClientException exception) {
            // ImageKit refused or was unreachable: report it as the upload
            // failure it is, not as an opaque 500.
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "image_upload_failed", exception);
        }
        if (uploaded == null || uploaded.url() == null || uploaded.url().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "image_upload_failed");
        }
        return uploaded;
    }

    private void validate(MultipartFile file) {
        if (privateKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "imagekit_not_configured");
        }
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "image_required");
        }
        if (file.getSize() > MAX_IMAGE_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "image_too_large");
        }
        if (!ALLOWED_TYPES.contains(file.getContentType())) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "image_type_invalid");
        }
    }

    private String basicAuth() {
        return "Basic " + Base64.getEncoder()
                .encodeToString((privateKey + ":").getBytes(StandardCharsets.UTF_8));
    }

    private static String safeFilename(String original) {
        String candidate = original == null || original.isBlank() ? "product-image" : original;
        return candidate.replaceAll("[^A-Za-z0-9._-]", "-").replaceAll("-+", "-");
    }

    private static final class NamedBytes extends ByteArrayResource {
        private final String filename;

        private NamedBytes(byte[] bytes, String filename) {
            super(bytes);
            this.filename = filename;
        }

        @Override
        public String getFilename() {
            return filename;
        }
    }
}
