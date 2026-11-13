package tn.com.catering.identity.aiimport;

/** Asks a vision model about one product photograph and returns its raw text answer. */
public interface ProductVisionClient {

    String describe(String systemPrompt, String userText, String imageUrl);

    /** A text-only question to the same model (choosing a price-list row). */
    String ask(String systemPrompt, String userText);

    /** A failed model call. {@code retryable} is true for rate limits, timeouts and server errors. */
    class AiCallException extends RuntimeException {
        private final boolean retryable;

        public AiCallException(String message, boolean retryable, Throwable cause) {
            super(message, cause);
            this.retryable = retryable;
        }

        public boolean retryable() { return retryable; }
    }
}
