package tn.com.catering.identity.person;

import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tn.com.catering.identity.common.ApiException;
import tn.com.catering.identity.person.dto.AdminCreatePersonRequest;
import tn.com.catering.identity.person.dto.AdminUpdatePersonRequest;
import tn.com.catering.identity.person.dto.ChangePasswordRequest;
import tn.com.catering.identity.person.dto.PersonResponse;
import tn.com.catering.identity.person.dto.RegisterRequest;
import tn.com.catering.identity.person.dto.UpdateProfileRequest;

@Service
@Transactional
public class PersonService {
    private final PersonRepository repository;
    private final PasswordEncoder passwordEncoder;

    public PersonService(PersonRepository repository, PasswordEncoder passwordEncoder) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
    }

    public Person register(RegisterRequest request) {
        ensureEmailAvailable(request.email(), null);
        Person person = new Person(normalizeEmail(request.email()), passwordEncoder.encode(request.password()), Role.CLIENT);
        person.setClientType(request.clientType());
        person.setFirstName(clean(request.firstName()));
        person.setLastName(clean(request.lastName()));
        person.setCompanyName(clean(request.companyName()));
        person.setTaxIdentifier(clean(request.taxIdentifier()));
        person.setPhone(clean(request.phone()));
        normalizeAndValidate(person);
        return repository.save(person);
    }

    public Person createByAdmin(AdminCreatePersonRequest request) {
        ensureEmailAvailable(request.email(), null);
        Person person = new Person(normalizeEmail(request.email()), passwordEncoder.encode(request.password()), request.role());
        person.setClientType(request.clientType());
        person.setFirstName(clean(request.firstName()));
        person.setLastName(clean(request.lastName()));
        person.setCompanyName(clean(request.companyName()));
        person.setTaxIdentifier(clean(request.taxIdentifier()));
        person.setPhone(clean(request.phone()));
        person.setEnabled(request.enabled());
        normalizeAndValidate(person);
        return repository.save(person);
    }

    @Transactional(readOnly = true)
    public Person byId(UUID id) {
        return repository.findById(id).orElseThrow(() ->
                new ApiException(HttpStatus.NOT_FOUND, "person_not_found", "Person not found."));
    }

    @Transactional(readOnly = true)
    public Person byEmail(String email) {
        return repository.findByEmailIgnoreCase(normalizeEmail(email)).orElseThrow(() ->
                new ApiException(HttpStatus.UNAUTHORIZED, "invalid_credentials", "Invalid email or password."));
    }

    @Transactional(readOnly = true)
    public List<PersonResponse> list(String query) {
        String term = clean(query);
        List<Person> people = term == null || term.isBlank()
                ? repository.findAll().stream().sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt())).limit(100).toList()
                : repository.findTop100ByEmailContainingIgnoreCaseOrFirstNameContainingIgnoreCaseOrLastNameContainingIgnoreCaseOrCompanyNameContainingIgnoreCaseOrderByCreatedAtDesc(
                        term, term, term, term);
        return people.stream().map(PersonResponse::from).toList();
    }

    public Person updateSelf(UUID id, UpdateProfileRequest request) {
        Person person = byId(id);
        ensureEmailAvailable(request.email(), id);
        person.setEmail(normalizeEmail(request.email()));
        person.setClientType(request.clientType());
        person.setFirstName(clean(request.firstName()));
        person.setLastName(clean(request.lastName()));
        person.setCompanyName(clean(request.companyName()));
        person.setTaxIdentifier(clean(request.taxIdentifier()));
        person.setPhone(clean(request.phone()));
        normalizeAndValidate(person);
        return repository.save(person);
    }

    public Person updateByAdmin(UUID actorId, UUID id, AdminUpdatePersonRequest request) {
        Person person = byId(id);
        if (actorId.equals(id) && (!request.enabled() || request.role() != Role.ADMIN)) {
            throw new ApiException(HttpStatus.CONFLICT, "cannot_demote_self", "You cannot disable or demote your own administrator account.");
        }
        ensureEmailAvailable(request.email(), id);
        person.setEmail(normalizeEmail(request.email()));
        person.setRole(request.role());
        person.setClientType(request.clientType());
        person.setFirstName(clean(request.firstName()));
        person.setLastName(clean(request.lastName()));
        person.setCompanyName(clean(request.companyName()));
        person.setTaxIdentifier(clean(request.taxIdentifier()));
        person.setPhone(clean(request.phone()));
        person.setEnabled(request.enabled());
        normalizeAndValidate(person);
        return repository.save(person);
    }

    public void changePassword(UUID id, ChangePasswordRequest request) {
        Person person = byId(id);
        if (!passwordEncoder.matches(request.currentPassword(), person.getPasswordHash())) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "wrong_password", "The current password is incorrect.");
        }
        if (passwordEncoder.matches(request.newPassword(), person.getPasswordHash())) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "password_unchanged", "Choose a different password.");
        }
        person.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        repository.save(person);
    }

    public void deleteByAdmin(UUID actorId, UUID id) {
        if (actorId.equals(id)) {
            throw new ApiException(HttpStatus.CONFLICT, "cannot_delete_self", "You cannot delete your own administrator account.");
        }
        Person target = byId(id);
        if (target.getRole() == Role.ADMIN && target.isEnabled()
                && repository.countByRoleAndEnabledTrue(Role.ADMIN) <= 1) {
            throw new ApiException(HttpStatus.CONFLICT, "last_admin", "The final enabled administrator cannot be deleted.");
        }
        repository.delete(target);
    }

    public void deleteSelf(UUID id) {
        Person person = byId(id);
        if (person.getRole() == Role.ADMIN) {
            throw new ApiException(HttpStatus.CONFLICT, "admin_self_delete_forbidden", "Administrators must be removed by another administrator.");
        }
        repository.delete(person);
    }

    private void ensureEmailAvailable(String email, UUID currentId) {
        repository.findByEmailIgnoreCase(normalizeEmail(email)).ifPresent(existing -> {
            if (currentId == null || !existing.getId().equals(currentId)) {
                throw new ApiException(HttpStatus.CONFLICT, "email_exists", "An account already uses this email address.");
            }
        });
    }

    private void normalizeAndValidate(Person person) {
        if (person.getRole() == Role.ADMIN) {
            person.setClientType(null);
            person.setCompanyName(null);
            person.setTaxIdentifier(null);
            if (person.getFirstName() == null) person.setFirstName("Administrator");
            return;
        }
        if (person.getClientType() == null) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "client_type_required", "A client type is required.");
        }
        if (person.getClientType() == ClientType.PHYSIQUE) {
            require(person.getFirstName(), "first_name_required", "First name is required for an individual client.");
            require(person.getLastName(), "last_name_required", "Last name is required for an individual client.");
            person.setCompanyName(null);
            person.setTaxIdentifier(null);
        } else {
            require(person.getCompanyName(), "company_name_required", "Company name is required for a business client.");
            require(person.getTaxIdentifier(), "tax_identifier_required", "Tax identifier is required for a business client.");
            person.setFirstName(null);
            person.setLastName(null);
        }
    }

    private static void require(String value, String code, String message) {
        if (value == null || value.isBlank()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, code, message);
        }
    }

    private static String normalizeEmail(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private static String clean(String value) {
        if (value == null) return null;
        String cleaned = value.trim().replaceAll("\\s{2,}", " ");
        return cleaned.isBlank() ? null : cleaned;
    }
}
