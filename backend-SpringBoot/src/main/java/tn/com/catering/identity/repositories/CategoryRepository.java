package tn.com.catering.identity.repositories;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import tn.com.catering.identity.entities.Category;

public interface CategoryRepository extends JpaRepository<Category, UUID> {
    Optional<Category> findByExternalId(String externalId);
    Optional<Category> findBySlug(String slug);
    List<Category> findByParentExternalIdIsNullOrderByNameFrAsc();
    List<Category> findByParentExternalIdOrderByNameFrAsc(String parentExternalId);
}
