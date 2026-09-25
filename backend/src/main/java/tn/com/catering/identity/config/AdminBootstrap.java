package tn.com.catering.identity.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import tn.com.catering.identity.person.PersonRepository;
import tn.com.catering.identity.person.PersonService;
import tn.com.catering.identity.person.Role;
import tn.com.catering.identity.person.dto.AdminCreatePersonRequest;

@Component
public class AdminBootstrap implements ApplicationRunner {
    private static final Logger LOGGER = LoggerFactory.getLogger(AdminBootstrap.class);
    private final PersonRepository repository;
    private final PersonService people;
    private final String email;
    private final String password;

    public AdminBootstrap(
            PersonRepository repository,
            PersonService people,
            @Value("${app.admin.email:}") String email,
            @Value("${app.admin.password:}") String password) {
        this.repository = repository;
        this.people = people;
        this.email = email;
        this.password = password;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (email == null || email.isBlank() || password == null || password.isBlank()) {
            LOGGER.warn("No bootstrap administrator configured. Set APP_ADMIN_EMAIL and APP_ADMIN_PASSWORD before first use.");
            return;
        }
        if (repository.findByEmailIgnoreCase(email.trim()).isPresent()) return;
        people.createByAdmin(new AdminCreatePersonRequest(
                Role.ADMIN, null, "Administrator", null, null, null,
                email, password, null, true));
        LOGGER.info("Bootstrap administrator account created.");
    }
}
