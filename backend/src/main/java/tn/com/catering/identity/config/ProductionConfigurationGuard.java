package tn.com.catering.identity.config;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.Profiles;

/**
 * Refuses to start the {@code prod} profile with configuration that would only
 * fail later, and silently.
 *
 * <p>Outside production the application is forgiving on purpose: with no
 * database configured it falls back to a local H2 file, and with no
 * {@code APP_JWT_SECRET} it generates a random one. On a host with an ephemeral
 * filesystem such as Render, the first would lose every account and devis on the
 * next deploy, and the second would sign everybody out on every restart. Both
 * would look healthy at start-up. So in production they are start-up errors.
 *
 * <p>Runs after every other post-processor, once the profile-specific
 * configuration and the Neon URL translation have been applied, and before any
 * bean — including the DataSource — is created. Messages name the missing
 * variable and never echo a value.
 */
public final class ProductionConfigurationGuard implements EnvironmentPostProcessor, Ordered {

    static final String PROFILE = "prod";
    private static final int MIN_SECRET_BYTES = 32;

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        if (!environment.acceptsProfiles(Profiles.of(PROFILE))) return;

        List<String> problems = new ArrayList<>();

        String url = environment.getProperty("spring.datasource.url", "");
        if (!url.startsWith("jdbc:postgresql:")) {
            problems.add("No PostgreSQL database is configured. Set NEON_DATABASE_URL (or DATABASE_URL, "
                    + "or DB_URL with DB_USERNAME and DB_PASSWORD). The local H2 fallback is disabled in production.");
        }

        String secret = environment.getProperty("app.jwt.secret", "");
        if (secret.isBlank()) {
            problems.add("APP_JWT_SECRET is not set. Production needs a stable secret, or every restart "
                    + "invalidates every session.");
        } else if (secret.getBytes(StandardCharsets.UTF_8).length < MIN_SECRET_BYTES) {
            problems.add("APP_JWT_SECRET must contain at least " + MIN_SECRET_BYTES + " characters.");
        } else if (secret.startsWith("replace-with")) {
            problems.add("APP_JWT_SECRET still holds the placeholder from .env.example.");
        }

        if (!problems.isEmpty()) {
            throw new IllegalStateException("Production configuration is incomplete:\n - "
                    + String.join("\n - ", problems));
        }
    }

    @Override
    public int getOrder() {
        return Ordered.LOWEST_PRECEDENCE;
    }
}
