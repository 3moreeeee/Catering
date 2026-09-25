import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { LocalizedRouter } from '../../i18n/localized-router.service';
import { LocaleService } from '../../i18n/locale.service';
import { CATEGORY_REPOSITORY } from '../../../data/repositories/catalog.repository';
import { LocalizedTextPipe } from '../../../shared/pipes/localized-text.pipe';
import { COMPANY } from '../../../data/company.data';

type NewsletterState = 'idle' | 'submitting' | 'success' | 'error';

@Component({
  selector: 'fk-site-footer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoDirective, ReactiveFormsModule, LocalizedTextPipe],
  templateUrl: './site-footer.html',
  styleUrl: './site-footer.scss',
  // The host is a custom element, so the landmark role must be declared
  // explicitly — otherwise there is no contentinfo landmark on any page.
  host: { class: 'on-dark', role: 'contentinfo' },
})
export class SiteFooter {
  private readonly document = inject(DOCUMENT);
  private readonly links = inject(LocalizedRouter);
  private readonly locales = inject(LocaleService);
  private readonly categoryRepo = inject(CATEGORY_REPOSITORY);

  readonly categories = toSignal(this.categoryRepo.all(), { initialValue: [] });
  readonly company = COMPANY;
  readonly alternate = this.locales.alternate;

  /** Computed, never hardcoded — the legacy site froze at "© 2017". */
  readonly year = new Date().getFullYear();

  readonly email = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.email],
  });
  readonly state = signal<NewsletterState>('idle');

  to(path: string): string[] {
    return this.links.path(path);
  }

  switchLocaleUrl(): string {
    return this.links.switchLocaleUrl(this.alternate());
  }

  /**
   * Cancels the browser's own submission before doing anything else.
   *
   * Without this the form navigated away — taking the address with it — so the
   * request never reached the API and nothing the handler below does would have
   * been observable.
   */
  onNewsletterSubmit(event: Event): void {
    event.preventDefault();
    void this.submitNewsletter();
  }

  async submitNewsletter(): Promise<void> {
    this.email.markAsTouched();
    // Guarding on the state as well as validity: without it a double press —
    // or a slow connection and an impatient visitor — sends the address twice.
    if (this.email.invalid || this.state() === 'submitting') {
      return;
    }
    this.state.set('submitting');
    try {
      // Same-origin, so no third-party script and no provider key ships to the
      // browser. The subscription provider is configured on the server — see
      // docs/11-launch-blockers.md §4.2.
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.email.value, locale: this.locales.locale() }),
      });

      // `response.ok` on its own is not a subscription. Before this check any
      // HTTP 200 counted — including the HTML page the Angular renderer
      // returned for an /api route that did not exist — so the field cleared
      // itself and thanked people who had subscribed to nothing.
      const contentType = response.headers.get('content-type') ?? '';
      const body: unknown = contentType.includes('application/json')
        ? await response.json().catch(() => null)
        : null;
      const confirmed =
        response.ok &&
        typeof body === 'object' &&
        body !== null &&
        (body as { ok?: unknown }).ok === true &&
        (body as { subscribed?: unknown }).subscribed === true;

      this.state.set(confirmed ? 'success' : 'error');
      // The address is kept on failure so a retry costs no retyping.
      if (confirmed) {
        this.email.reset();
      }
    } catch {
      this.state.set('error');
    }
  }

  backToTop(): void {
    const view = this.document.defaultView;
    view?.scrollTo({
      top: 0,
      behavior: view.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }
}
