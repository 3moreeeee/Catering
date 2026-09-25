package tn.com.catering.identity.person;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PersonRepository extends JpaRepository<Person, UUID> {
    Optional<Person> findByEmailIgnoreCase(String email);
    boolean existsByEmailIgnoreCase(String email);
    long countByRoleAndEnabledTrue(Role role);
    long countByRole(Role role);
    List<Person> findTop100ByEmailContainingIgnoreCaseOrFirstNameContainingIgnoreCaseOrLastNameContainingIgnoreCaseOrCompanyNameContainingIgnoreCaseOrderByCreatedAtDesc(
            String email, String firstName, String lastName, String companyName);
}
