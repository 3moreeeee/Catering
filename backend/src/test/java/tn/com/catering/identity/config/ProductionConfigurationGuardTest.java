package tn.com.catering.identity.config;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class ProductionConfigurationGuardTest {

    private static final String SECRET = "0123456789abcdef0123456789abcdef-stable";
    private final ProductionConfigurationGuard guard = new ProductionConfigurationGuard();

    private MockEnvironment prod() {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("prod");
        return environment;
    }

    @Test
    void ignoresEveryOtherProfile() {
        MockEnvironment environment = new MockEnvironment()
                .withProperty("spring.datasource.url", "jdbc:h2:file:./data/x");
        assertThatCode(() -> guard.postProcessEnvironment(environment, null)).doesNotThrowAnyException();
    }

    @Test
    void refusesTheH2FallbackInProduction() {
        MockEnvironment environment = prod()
                .withProperty("spring.datasource.url", "jdbc:h2:file:./data/catering-identity")
                .withProperty("app.jwt.secret", SECRET);
        assertThatThrownBy(() -> guard.postProcessEnvironment(environment, null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("NEON_DATABASE_URL");
    }

    @Test
    void refusesAMissingOrWeakSecretInProduction() {
        MockEnvironment missing = prod().withProperty("spring.datasource.url", "jdbc:postgresql://db/app");
        assertThatThrownBy(() -> guard.postProcessEnvironment(missing, null))
                .hasMessageContaining("APP_JWT_SECRET is not set");

        MockEnvironment weak = prod()
                .withProperty("spring.datasource.url", "jdbc:postgresql://db/app")
                .withProperty("app.jwt.secret", "short");
        assertThatThrownBy(() -> guard.postProcessEnvironment(weak, null))
                .hasMessageContaining("at least 32");

        MockEnvironment placeholder = prod()
                .withProperty("spring.datasource.url", "jdbc:postgresql://db/app")
                .withProperty("app.jwt.secret", "replace-with-at-least-32-random-characters");
        assertThatThrownBy(() -> guard.postProcessEnvironment(placeholder, null))
                .hasMessageContaining("placeholder");
    }

    @Test
    void acceptsPostgresWithAStableSecret() {
        MockEnvironment environment = prod()
                .withProperty("spring.datasource.url", "jdbc:postgresql://db/app?sslmode=require")
                .withProperty("app.jwt.secret", SECRET);
        assertThatCode(() -> guard.postProcessEnvironment(environment, null)).doesNotThrowAnyException();
    }

    @Test
    void neverEchoesTheSecret() {
        MockEnvironment environment = prod()
                .withProperty("spring.datasource.url", "jdbc:h2:mem:x")
                .withProperty("app.jwt.secret", "tiny-secret-value");
        assertThatThrownBy(() -> guard.postProcessEnvironment(environment, null))
                .message().doesNotContain("tiny-secret-value");
    }
}
