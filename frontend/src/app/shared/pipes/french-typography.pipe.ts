import { Pipe, PipeTransform, inject } from '@angular/core';
import { LocaleService } from '../../core/i18n/locale.service';

const NNBSP = ' '; // narrow no-break space
const NBSP = ' ';

/**
 * Applies French typographic conventions the legacy site ignored:
 *  - narrow no-break space before `; ! ?` and `:`
 *  - guillemets spaced correctly («␣texte␣»)
 *  - non-breaking space inside phone numbers and before units, so "946 ml"
 *    and "+216 71 557 548" never wrap mid-value.
 *
 * Running this as a pipe rather than typing the characters by hand means CMS
 * content gets the same treatment once the catalogue moves to an API.
 */
@Pipe({ name: 'frenchType', standalone: true, pure: false })
export class FrenchTypographyPipe implements PipeTransform {
  private readonly locales = inject(LocaleService);

  transform(value: string | null | undefined): string {
    if (!value) {
      return '';
    }
    // Units and phone groups are non-breaking in both languages.
    let out = value
      .replace(/(\d)\s+(ml|cl|l|L|g|kg|mm|cm|m|plis|ply)\b/g, `$1${NBSP}$2`)
      .replace(/(\+\d{3})\s+(\d{2})\s+(\d{3})\s+(\d{3})/g, `$1${NBSP}$2${NBSP}$3${NBSP}$4`);

    if (this.locales.locale() !== 'fr') {
      return out;
    }

    out = out
      // Collapse any existing space before the punctuation, then insert NNBSP.
      .replace(/\s*([;!?])/g, `${NNBSP}$1`)
      // A colon takes a full no-break space in French, not a narrow one.
      .replace(/\s*:(?=\s|$)/g, `${NBSP}:`)
      .replace(/«\s*/g, `«${NNBSP}`)
      .replace(/\s*»/g, `${NNBSP}»`);

    return out;
  }
}
