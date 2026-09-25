import { Pipe, PipeTransform, inject } from '@angular/core';
import { LocaleService } from '../../core/i18n/locale.service';
import { LocalizedText } from '../models/localized-text.model';

/**
 * Resolves a catalogue `LocalizedText` against the active locale.
 *
 * Impure because the locale can change without the input reference changing —
 * the alternative (recreating every product object on language switch) would be
 * far more expensive than this comparison.
 */
@Pipe({ name: 'localized', standalone: true, pure: false })
export class LocalizedTextPipe implements PipeTransform {
  private readonly locales = inject(LocaleService);

  transform(value: LocalizedText | null | undefined): string {
    return value ? this.locales.text(value) : '';
  }
}
