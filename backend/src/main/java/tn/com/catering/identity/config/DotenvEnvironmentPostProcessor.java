package tn.com.catering.identity.config;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

/**
 * Reads a {@code .env} file next to the application and exposes its entries as
 * Spring properties.
 *
 * <p>Spring Boot has no built-in support for {@code .env}: without this, the
 * Neon credentials an operator writes there are silently ignored and the
 * application quietly falls back to the local H2 file, which looks like a
 * working start-up but serves an empty catalogue. Loading the file explicitly
 * is what makes {@code .env} the single place secrets live in development.
 *
 * <p>The file is added with {@code addLast}, so a real environment variable or
 * a {@code -D} flag always wins. That keeps production, where the platform
 * injects real environment variables and no {@code .env} exists, unaffected.
 *
 * <p>Runs ahead of {@link NeonEnvironmentPostProcessor}, which needs
 * {@code NEON_DATABASE_URL*} to be visible by the time it builds the JDBC URL.
 */
public final class DotenvEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {

    /** Checked in order; the working directory differs between an IDE run and `mvnw` from the module. */
    private static final List<String> CANDIDATES = List.of(".env", "backend/.env", "../.env");

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        for (String candidate : CANDIDATES) {
            Path path = Path.of(candidate);
            if (!Files.isRegularFile(path)) continue;
            Map<String, Object> values = parse(path);
            if (!values.isEmpty()) {
                environment.getPropertySources().addLast(new MapPropertySource("dotenv", values));
            }
            return;
        }
    }

    private static Map<String, Object> parse(Path path) {
        Map<String, Object> values = new LinkedHashMap<>();
        List<String> lines;
        try {
            lines = Files.readAllLines(path, StandardCharsets.UTF_8);
        } catch (IOException unreadable) {
            // A missing or unreadable .env is not an error: the platform may
            // supply the same names as real environment variables. Never log the
            // contents, which are secrets.
            return values;
        }
        for (String raw : lines) {
            String line = raw.strip();
            if (line.isEmpty() || line.startsWith("#")) continue;
            if (line.startsWith("export ")) line = line.substring(7).strip();
            int separator = line.indexOf('=');
            if (separator <= 0) continue;
            String key = line.substring(0, separator).strip();
            if (key.isEmpty()) continue;
            values.put(key, unquote(line.substring(separator + 1).strip()));
        }
        return values;
    }

    /**
     * Strips one matching pair of surrounding quotes.
     *
     * <p>Neon's own Connect dialog hands out a quoted URI, and the quotes are
     * not part of the password or host.
     */
    private static String unquote(String value) {
        if (value.length() >= 2
                && ((value.startsWith("\"") && value.endsWith("\""))
                        || (value.startsWith("'") && value.endsWith("'")))) {
            return value.substring(1, value.length() - 1);
        }
        return value;
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }
}
