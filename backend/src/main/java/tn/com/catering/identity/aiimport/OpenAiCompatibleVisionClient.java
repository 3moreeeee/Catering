package tn.com.catering.identity.aiimport;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Duration;
import java.util.Base64;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Calls an OpenAI-compatible {@code /chat/completions} endpoint with one image.
 *
 * <p>The image is downloaded by the server and sent inline as a data URL rather
 * than as a link, because not every provider or proxy fetches remote images.
 * ImageKit serves a downscaled JPEG for it, which keeps the request to roughly a
 * thousand image tokens whatever the size of the original photograph.
 */
@Component
public class OpenAiCompatibleVisionClient implements ProductVisionClient {

    private static final String MODEL_PREVIEW = "tr=w-1024,h-1024,c-at_max,f-jpg,q-80";

    private final AiImportSettings settings;
    private final ObjectMapper json;
    private final RestClient http;

    public OpenAiCompatibleVisionClient(AiImportSettings settings, ObjectMapper json, RestClient.Builder builder) {
        this.settings = settings;
        this.json = json;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(15));
        factory.setReadTimeout(Duration.ofSeconds(settings.timeoutSeconds()));
        this.http = builder.clone().requestFactory(factory).build();
    }

    @Override
    public String describe(String systemPrompt, String userText, String imageUrl) {
        String dataUrl = "data:image/jpeg;base64," + Base64.getEncoder().encodeToString(download(imageUrl));

        ObjectNode body = json.createObjectNode();
        body.put("model", settings.model());
        body.put("temperature", 0.2);
        body.put("max_tokens", 1500);
        ArrayNode messages = body.putArray("messages");
        messages.addObject().put("role", "system").put("content", systemPrompt);
        ObjectNode user = messages.addObject().put("role", "user");
        ArrayNode content = user.putArray("content");
        content.addObject().put("type", "text").put("text", userText);
        content.addObject().put("type", "image_url").putObject("image_url").put("url", dataUrl);
        return complete(body);
    }

    @Override
    public String ask(String systemPrompt, String userText) {
        ObjectNode body = json.createObjectNode();
        body.put("model", settings.model());
        body.put("temperature", 0);
        body.put("max_tokens", 400);
        ArrayNode messages = body.putArray("messages");
        messages.addObject().put("role", "system").put("content", systemPrompt);
        messages.addObject().put("role", "user").put("content", userText);
        return complete(body);
    }

    private String complete(ObjectNode body) {
        JsonNode response;
        try {
            response = http.post()
                    .uri(settings.baseUrl() + "/chat/completions")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + settings.apiKey())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (HttpStatusCodeException error) {
            int status = error.getStatusCode().value();
            boolean retryable = status == 408 || status == 429 || status >= 500;
            throw new AiCallException("Le modèle a répondu " + status + summary(error.getResponseBodyAsString()),
                    retryable, error);
        } catch (ResourceAccessException error) {
            throw new AiCallException("Le service IA ne répond pas (délai dépassé).", true, error);
        } catch (RestClientException error) {
            throw new AiCallException("Appel au service IA impossible.", true, error);
        }

        String text = messageText(response);
        if (text.isBlank()) {
            throw new AiCallException("Le modèle a renvoyé une réponse vide.", true, null);
        }
        return text;
    }

    private byte[] download(String imageUrl) {
        String url = imageUrl.contains("ik.imagekit.io")
                ? imageUrl + (imageUrl.contains("?") ? "&" : "?") + MODEL_PREVIEW
                : imageUrl;
        try {
            byte[] bytes = http.get().uri(url).retrieve().body(byte[].class);
            if (bytes == null || bytes.length == 0) {
                throw new AiCallException("Image introuvable sur ImageKit.", true, null);
            }
            return bytes;
        } catch (RestClientException error) {
            throw new AiCallException("Téléchargement de l'image impossible.", true, error);
        }
    }

    /** {@code content} is a string for most providers and an array of parts for a few. */
    private static String messageText(JsonNode response) {
        if (response == null) return "";
        JsonNode content = response.path("choices").path(0).path("message").path("content");
        if (content.isTextual()) return content.asText();
        if (content.isArray()) {
            StringBuilder text = new StringBuilder();
            content.forEach(part -> text.append(part.path("text").asText("")));
            return text.toString();
        }
        return "";
    }

    private static String summary(String body) {
        if (body == null || body.isBlank()) return ".";
        String trimmed = body.replaceAll("\\s+", " ").trim();
        return " : " + (trimmed.length() > 200 ? trimmed.substring(0, 200) + "…" : trimmed);
    }
}
