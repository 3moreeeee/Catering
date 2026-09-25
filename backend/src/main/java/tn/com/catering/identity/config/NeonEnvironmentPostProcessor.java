package tn.com.catering.identity.config;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

/** Converts a standard Neon connection URI into Spring JDBC properties. */
public final class NeonEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {

    private static final String[] DIRECT_KEYS = {
        "NEON_DATABASE_URL_DIRECT", "neon_connection_pooling_off", "neon_connection_polling_off"
    };
    private static final String[] POOLED_KEYS = {
        "NEON_DATABASE_URL", "DATABASE_URL", "neon_connection_pooling"
    };

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        if (environment.containsProperty("DB_URL")) return;
        // An explicit spring.datasource.url at this point comes from a test's
        // inlined properties or a -D flag, never from application.yml, which
        // this processor runs before. Honouring it keeps the integration tests
        // on their in-memory H2 database once a .env with Neon credentials
        // exists on the machine.
        if (environment.containsProperty("spring.datasource.url")) return;
        String connection = first(environment, DIRECT_KEYS);
        if (connection == null) connection = first(environment, POOLED_KEYS);
        if (connection == null || connection.isBlank()) return;

        try {
            URI uri = URI.create(unquote(connection.trim()));
            if (!"postgres".equals(uri.getScheme()) && !"postgresql".equals(uri.getScheme())) return;
            String[] credentials = uri.getRawUserInfo() == null ? new String[0] : uri.getRawUserInfo().split(":", 2);
            String query = jdbcQuery(uri.getRawQuery());
            String jdbcUrl = "jdbc:postgresql://" + uri.getHost()
                    + (uri.getPort() < 0 ? "" : ":" + uri.getPort())
                    + uri.getRawPath() + (query.isEmpty() ? "" : "?" + query);

            Map<String, Object> properties = new LinkedHashMap<>();
            properties.put("spring.datasource.url", jdbcUrl);
            properties.put("spring.datasource.driver-class-name", "org.postgresql.Driver");
            if (credentials.length > 0) properties.put("spring.datasource.username", decode(credentials[0]));
            if (credentials.length > 1) properties.put("spring.datasource.password", decode(credentials[1]));
            environment.getPropertySources().addFirst(new MapPropertySource("neonDatabase", properties));
        } catch (IllegalArgumentException ignored) {
            // Spring will surface a normal datasource error. Never log this URI:
            // its user-info contains the database password.
        }
    }

    private static String first(ConfigurableEnvironment environment, String[] keys) {
        for (String key : keys) {
            String value = environment.getProperty(key);
            if (value != null && !value.isBlank()) return value;
        }
        return null;
    }

    private static String jdbcQuery(String rawQuery) {
        if (rawQuery == null || rawQuery.isBlank()) return "sslmode=require";
        String filtered = java.util.Arrays.stream(rawQuery.split("&"))
                .filter(value -> !value.startsWith("channel_binding="))
                .reduce((left, right) -> left + "&" + right)
                .orElse("");
        return filtered.contains("sslmode=") ? filtered
                : filtered + (filtered.isEmpty() ? "" : "&") + "sslmode=require";
    }

    private static String decode(String value) {
        return URLDecoder.decode(value, StandardCharsets.UTF_8);
    }

    private static String unquote(String value) {
        return value.length() >= 2 && ((value.startsWith("\"") && value.endsWith("\""))
                || (value.startsWith("'") && value.endsWith("'")))
                ? value.substring(1, value.length() - 1) : value;
    }

    /** Runs just after {@link DotenvEnvironmentPostProcessor}, whose values it reads. */
    @Override
    public int getOrder() { return Ordered.HIGHEST_PRECEDENCE + 10; }
}
