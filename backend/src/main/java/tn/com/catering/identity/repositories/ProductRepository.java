package tn.com.catering.identity.repositories;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import tn.com.catering.identity.DTO.CategoryCountRow;
import tn.com.catering.identity.entities.Product;

public interface ProductRepository extends JpaRepository<Product, UUID> {

    Optional<Product> findBySlug(String slug);

    Optional<Product> findBySourceId(String sourceId);

    boolean existsBySlug(String slug);

    boolean existsBySourceId(String sourceId);

    /**
     * The single catalogue-visibility query.
     *
     * <p>Every filter is optional and neutralised by passing null, which keeps
     * one query rather than a Specification tree for what is a flat facet set.
     * Only active products are ever visible; deactivated ones remain reachable
     * by id for the admin and by past quotes.
     */
    @Query("""
            select p from Product p
            where p.active = true
              and (:category is null or p.categoryId = :category)
              and (:subcategory is null or p.subcategoryId = :subcategory)
              and (:brand is null or p.brandId = :brand)
              and (:featured is null or p.featured = :featured)
              and (:search = ''
                   or lower(p.nameFr) like lower(concat('%', :search, '%'))
                   or lower(p.nameEn) like lower(concat('%', :search, '%'))
                   or lower(p.supplierReference) like lower(concat('%', :search, '%')))
            """)
    Page<Product> findVisible(
            @Param("search") String search,
            @Param("category") String category,
            @Param("subcategory") String subcategory,
            @Param("brand") String brand,
            @Param("featured") Boolean featured,
            Pageable pageable);

    List<Product> findBySourceIdIn(Collection<String> sourceIds);

    /**
     * The back-office listing. Unlike {@link #findVisible} it includes
     * deactivated products, because the administrator must be able to find a
     * product in order to reactivate it. {@code active} null means both.
     */
    @Query("""
            select p from Product p
            where (:active is null or p.active = :active)
              and (:category is null or p.categoryId = :category)
              and (:priced is null
                   or (:priced = true and p.price is not null)
                   or (:priced = false and p.price is null))
              and (:search = ''
                   or lower(p.nameFr) like lower(concat('%', :search, '%'))
                   or lower(p.nameEn) like lower(concat('%', :search, '%'))
                   or lower(p.slug) like lower(concat('%', :search, '%'))
                   or lower(p.sourceId) like lower(concat('%', :search, '%'))
                   or lower(p.supplierReference) like lower(concat('%', :search, '%')))
            """)
    Page<Product> findForAdmin(
            @Param("search") String search,
            @Param("category") String category,
            @Param("active") Boolean active,
            @Param("priced") Boolean priced,
            Pageable pageable);

    @Query("""
            select p from Product p
            where p.offerPrice is not null
              and (:search = ''
                   or lower(p.nameFr) like lower(concat('%', :search, '%'))
                   or lower(p.slug) like lower(concat('%', :search, '%'))
                   or lower(p.sourceId) like lower(concat('%', :search, '%')))
            """)
    Page<Product> findOffers(@Param("search") String search, Pageable pageable);

    long countByActiveTrue();

    long countByActiveFalse();

    long countByPriceIsNotNull();

    long countByPriceIsNullAndActiveTrue();

    long countByOfferPriceIsNotNull();

    /**
     * Active products per division, largest first.
     *
     * <p>An ad-hoc join on {@code externalId} rather than a mapped association,
     * because a product holds the division's stable external id rather than a
     * foreign key; see the note on {@link tn.com.catering.identity.entities.Product}.
     */
    @Query("""
            select new tn.com.catering.identity.DTO.CategoryCountRow(
                       c.externalId, c.nameFr, c.nameEn, count(p))
            from Product p
            join Category c on c.externalId = p.categoryId
            where p.active = true
            group by c.externalId, c.nameFr, c.nameEn
            order by count(p) desc
            """)
    List<CategoryCountRow> countActiveByCategory();
}
