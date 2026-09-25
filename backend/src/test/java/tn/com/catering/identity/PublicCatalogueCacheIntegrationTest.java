package tn.com.catering.identity;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

/**
 * The CDN may share the public catalogue reads, and nothing else. Spring
 * Security stamps every response {@code no-store} unless the handler set its
 * own policy, so this checks the policy survives the filter chain, and that a
 * personal response is never made shareable.
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:cache-test;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.jwt.secret=test-only-secret-that-is-longer-than-thirty-two-characters",
        "app.catalog.seed-on-startup=false"
})
@AutoConfigureMockMvc
class PublicCatalogueCacheIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Test
    void publicCatalogueReadsAreShareableByTheCdn() throws Exception {
        for (String path : new String[] {"/api/products", "/api/products/prices?sourceIds=x", "/api/categories", "/api/brands"}) {
            mvc.perform(get(path))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Cache-Control", containsString("public")))
                    .andExpect(header().string("Cache-Control", containsString("s-maxage=60")))
                    .andExpect(header().string("Cache-Control", containsString("stale-while-revalidate=86400")));
        }
    }

    @Test
    void errorsAndPersonalResponsesAreNeverShared() throws Exception {
        mvc.perform(get("/api/products/no-such-product"))
                .andExpect(status().isNotFound())
                .andExpect(header().string("Cache-Control", not(containsString("public"))));
        mvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("Cache-Control", containsString("no-store")));
    }
}
