package tn.com.catering.identity;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@SpringBootApplication
@EnableJpaAuditing
public class CateringIdentityApplication {

    public static void main(String[] args) {
        SpringApplication.run(CateringIdentityApplication.class, args);
    }
}
