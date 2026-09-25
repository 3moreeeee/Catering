import { Directive, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { LocalizedRouter } from '../../core/i18n/localized-router.service';
import { SeoService } from '../../core/seo/seo.service';

/**
 * Shared plumbing for the two legal pages. Both carry a visible placeholder
 * notice: the final wording must be supplied and reviewed by the company
 * against Tunisian law nº 2004-63 before launch, and a plausible-looking but
 * unreviewed policy would be worse than an obviously provisional one.
 */
@Directive()
export abstract class LegalPageBase {
  protected readonly links = inject(LocalizedRouter);
  protected readonly transloco = inject(TranslocoService);
  private readonly seo = inject(SeoService);

  protected applySeo(titleKey: string, path: string): void {
    queueMicrotask(() => {
      this.seo.apply({
        title: this.transloco.translate(titleKey),
        description: this.transloco.translate('legal.placeholderNotice'),
        path,
        // Provisional text must not be indexed.
        noIndex: true,
      });
    });
  }

  to(path: string): string[] {
    return this.links.path(path);
  }
}
