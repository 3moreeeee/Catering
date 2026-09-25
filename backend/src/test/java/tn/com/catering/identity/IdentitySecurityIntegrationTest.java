package tn.com.catering.identity;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:identity-test;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "app.jwt.secret=test-only-secret-that-is-longer-than-thirty-two-characters",
        "app.admin.email=admin@fk.test",
        "app.admin.password=AdminPassword123!"
})
@AutoConfigureMockMvc
class IdentitySecurityIntegrationTest {
    @Autowired
    MockMvc mvc;

    @Test
    void registrationCreatesOnlyAClientAndIssuesAHardenedCookie() throws Exception {
        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "clientType":"MORALE",
                                  "companyName":"Carthage Pro",
                                  "taxIdentifier":"TN-1234567",
                                  "email":"company@fk.test",
                                  "password":"StrongPassword123!",
                                  "phone":"+216 71 000 000"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("CLIENT"))
                .andExpect(jsonPath("$.clientType").value("MORALE"))
                .andExpect(cookie().httpOnly("FK_SESSION", true))
                .andExpect(cookie().path("FK_SESSION", "/api"));
    }

    @Test
    void publicRegistrationCannotInjectAnAdministratorRole() throws Exception {
        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "role":"ADMIN",
                                  "clientType":"PHYSIQUE",
                                  "firstName":"Injected",
                                  "lastName":"Admin",
                                  "email":"injected@fk.test",
                                  "password":"StrongPassword123!"
                                }
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void clientIsForbiddenFromAdminCrudWhileAdminCanCreateUsers() throws Exception {
        Cookie clientCookie = registerClient("client@fk.test");
        mvc.perform(get("/api/persons").cookie(clientCookie))
                .andExpect(status().isForbidden());

        Cookie adminCookie = login("admin@fk.test", "AdminPassword123!");
        mvc.perform(post("/api/persons")
                        .cookie(adminCookie)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "role":"CLIENT",
                                  "clientType":"PHYSIQUE",
                                  "firstName":"Amine",
                                  "lastName":"Ben Salah",
                                  "email":"amine@fk.test",
                                  "password":"StrongPassword123!",
                                  "enabled":true
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("CLIENT"))
                .andExpect(jsonPath("$.email").value("amine@fk.test"));
    }

    private Cookie registerClient(String email) throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "clientType":"PHYSIQUE",
                                  "firstName":"Test",
                                  "lastName":"Client",
                                  "email":"%s",
                                  "password":"StrongPassword123!"
                                }
                                """.formatted(email)))
                .andExpect(status().isCreated())
                .andReturn();
        return result.getResponse().getCookie("FK_SESSION");
    }

    private Cookie login(String email, String password) throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"%s"}
                                """.formatted(email, password)))
                .andExpect(status().isOk())
                .andReturn();
        return result.getResponse().getCookie("FK_SESSION");
    }
}
