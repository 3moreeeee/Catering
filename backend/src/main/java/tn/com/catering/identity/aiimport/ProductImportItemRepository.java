package tn.com.catering.identity.aiimport;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductImportItemRepository extends JpaRepository<ProductImportItem, UUID> {

    Optional<ProductImportItem> findFirstByStatusOrderByCreatedAtAsc(ProductImportItem.Status status);

    List<ProductImportItem> findByStatusInOrderByCreatedAtDesc(Collection<ProductImportItem.Status> statuses, Pageable page);

    long countByStatus(ProductImportItem.Status status);

    /** After a restart, work that was in flight is queued again rather than left stuck. */
    @Modifying
    @Query("update ProductImportItem i set i.status = :queued where i.status = :processing")
    int requeue(@Param("processing") ProductImportItem.Status processing,
                @Param("queued") ProductImportItem.Status queued);
}
