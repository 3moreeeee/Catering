package tn.com.catering.identity.aiimport;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Settings for the AI product importer, read from the environment (or
 * backend/.env through DotenvEnvironmentPostProcessor).
 *
 * <p>The provider is any OpenAI-compatible chat-completions endpoint, so
 * switching provider is a change of {@code AI_BASE_URL}, {@code AI_API_KEY} and
 * {@code AI_MODEL} only. The key never leaves the server.
 */
@Component
public class AiImportSettings {

    private final String baseUrl;
    private final String apiKey;
    private final String model;
    private final int concurrency;
    private final int requestsPerMinute;
    private final String backgroundRemoval;
    private final int timeoutSeconds;

    public AiImportSettings(
            @Value("${app.ai.base-url:}") String baseUrl,
            @Value("${app.ai.api-key:}") String apiKey,
            @Value("${app.ai.model:}") String model,
            @Value("${app.ai.concurrency:2}") int concurrency,
            @Value("${app.ai.requests-per-minute:10}") int requestsPerMinute,
            @Value("${app.ai.background-removal:e-bgremove}") String backgroundRemoval,
            @Value("${app.ai.timeout-seconds:90}") int timeoutSeconds) {
        this.baseUrl = stripTrailingSlash(baseUrl == null ? "" : baseUrl.trim());
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model == null ? "" : model.trim();
        this.concurrency = Math.max(1, Math.min(concurrency, 8));
        this.requestsPerMinute = Math.max(1, requestsPerMinute);
        this.backgroundRemoval = backgroundRemoval == null ? "" : backgroundRemoval.trim();
        this.timeoutSeconds = Math.max(10, timeoutSeconds);
    }

    public boolean configured() {
        return !baseUrl.isEmpty() && !apiKey.isEmpty() && !model.isEmpty();
    }

    public String baseUrl() { return baseUrl; }
    public String apiKey() { return apiKey; }
    public String model() { return model; }
    public int concurrency() { return concurrency; }
    public int requestsPerMinute() { return requestsPerMinute; }
    /** ImageKit transformation applied to the stored image, e.g. "e-bgremove"; empty or "none" disables it. */
    public String backgroundRemoval() { return "none".equalsIgnoreCase(backgroundRemoval) ? "" : backgroundRemoval; }
    public int timeoutSeconds() { return timeoutSeconds; }

    private static String stripTrailingSlash(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
