import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
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
  readonly productCount = input.required<number>();
  readonly dismiss = output<void>();

  private readonly links = inject(LocalizedRouter);

  to(path: string): string[] {
    return this.links.path(path);
  }
}
