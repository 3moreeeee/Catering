package tn.com.catering.identity.repositories;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import tn.com.catering.identity.entities.Brand;

public interface BrandRepository extends JpaRepository<Brand, UUID> {
    Optional<Brand> findByExternalId(String externalId);
    List<Brand> findAllByOrderByNameAsc();
}
