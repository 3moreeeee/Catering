import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LocalizedRouter } from '../../../core/i18n/localized-router.service';
import { CatalogStats } from '../../../core/catalog/catalog-stats.service';
import { CATEGORY_REPOSITORY } from '../../../data/repositories/catalog.repository';
import { LocalizedTextPipe } from '../../../shared/pipes/localized-text.pipe';
import { CinematicMedia } from '../../../shared/components/cinematic-media/cinematic-media';

/** Static, product-led commercial hero with no video dependency. */
@Component({
  selector: 'fk-hero-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoDirective, LocalizedTextPipe, CinematicMedia],
  templateUrl: './hero-section.html',
  styleUrl: './hero-section.scss',
})
export class HeroSection {
  private readonly links = inject(LocalizedRouter);
  private readonly categoryRepo = inject(CATEGORY_REPOSITORY);

  readonly categories = toSignal(this.categoryRepo.all(), { initialValue: [] });
  readonly referenceCount = inject(CatalogStats).total;

  to(path: string): string[] {
    return this.links.path(path);
  }
}
