import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { CatalogStats } from '../../catalog/catalog-stats.service';
import { LocalizedRouter } from '../../i18n/localized-router.service';
import { LocalizedTextPipe } from '../../../shared/pipes/localized-text.pipe';
import { Category } from '../../../shared/models/catalog.model';

/**
 * Desktop products mega menu.
 *
 * Everything inside is real markup — headings, links and text. Nothing is
 * revealed by hover alone, and the whole panel is reachable by keyboard in
 * document order. Escape closes it (handled by the header host listener).
 */
@Component({
  selector: 'fk-mega-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoDirective, LocalizedTextPipe],
  templateUrl: './mega-menu.html',
  styleUrl: './mega-menu.scss',
})
export class MegaMenu {
  readonly categories = input.required<readonly Category[]>();
  /** Null while unknown; the number is then left out rather than showing a wrong one. */
  readonly productCount = input.required<number | null>();
  readonly dismiss = output<void>();

  private readonly links = inject(LocalizedRouter);
  readonly stats = inject(CatalogStats);

  to(path: string): string[] {
    return this.links.path(path);
  }
}
