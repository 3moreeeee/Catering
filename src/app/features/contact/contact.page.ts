import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { LocalizedRouter } from '../../core/i18n/localized-router.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { SeoService } from '../../core/seo/seo.service';
import { StructuredDataService } from '../../core/seo/structured-data.service';
import { LocalizedTextPipe } from '../../shared/pipes/localized-text.pipe';
import { SITE_CONFIG } from '../../core/config/site.config';
import { COMPANY } from '../../data/company.data';
import { CATEGORIES } from '../../data/categories.data';
import { INDUSTRIES } from '../../data/industries.data';
import { PRODUCTS } from '../../data/products.data';
import { GoogleMapCard } from '../../shared/components/google-map-card/google-map-card';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

/** Why a submission did not succeed. */
type FailureKind = 'failed' | 'unavailable';

/** The only response shape this form will accept as a delivered enquiry. */
interface EnquiryResponse {
  ok: boolean;
  reference: string;
  code?: string;
}

/** Carries the reason a submission failed out of the try block. */
class SubmissionError extends Error {
  constructor(readonly kind: FailureKind) {
    super(kind);
  }
}

const DEPARTMENTS = ['sales', 'logistics', 'accounts', 'general'] as const;

/**
 * Contact page — the site's primary conversion surface.
 *
 * Behaviour that matters:
 *  - `?product=slug` pre-attaches the product a buyer was looking at, so the
 *    enquiry arrives with context instead of "I'm interested in one of your
 *    products";
 *  - validation messages are inline, specific, and tied to the field with
 *    `aria-describedby`; placeholders are never the only label;
 *  - **entries survive a failed submit** — the form is not reset on error,
 *    which is the single most common way contact forms lose leads.
 */
@Component({
  selector: 'fk-contact-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoDirective, ReactiveFormsModule, LocalizedTextPipe, GoogleMapCard],
  templateUrl: './contact.page.html',
  styleUrl: './contact.page.scss',
})
export class ContactPage {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly links = inject(LocalizedRouter);
  private readonly locales = inject(LocaleService);
  private readonly transloco = inject(TranslocoService);
  private readonly seo = inject(SeoService);
  private readonly jsonLd = inject(StructuredDataService);
  private readonly config = inject(SITE_CONFIG);

  readonly company = COMPANY;
  readonly categories = CATEGORIES;
  readonly industries = INDUSTRIES;
  readonly departments = DEPARTMENTS;

  readonly state = signal<FormState>('idle');
  readonly reference = signal('');
  /**
   * Why the last attempt failed. `unavailable` means the enquiry channel is
   * not reachable or not yet configured, which is a different message from a
   * rejected submission: the visitor is pointed at the phone number instead.
   */
  readonly failure = signal<FailureKind>('failed');

  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  /** The product a buyer arrived from, if any. */
  readonly contextProduct = computed(() => {
    const slug = this.params().get('product');
    return slug ? (PRODUCTS.find((p) => p.slug === slug) ?? null) : null;
  });

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    company: ['', [Validators.required, Validators.maxLength(160)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(160)]],
    phone: ['', [Validators.pattern(/^[+\d][\d\s().-]{5,24}$/)]],
    jobTitle: ['', [Validators.maxLength(120)]],
    industry: [''],
    category: [''],
    department: ['sales'],
    subject: ['', [Validators.maxLength(200)]],
    message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(4000)]],
    consent: [false, [Validators.requiredTrue]],
  });

  /** Fields that failed validation, for the error summary at the top. */
  readonly invalidFields = signal<string[]>([]);

  constructor() {
    queueMicrotask(() => {
      const product = this.contextProduct();
      if (product) {
        this.form.patchValue({
          category: product.categoryId,
          subject: this.locales.text(product.name),
        });
      }

      this.seo.apply({
        title: this.transloco.translate('contact.title'),
        description: this.transloco.translate('contact.lead'),
        path: 'contact',
      });

      const graph = [
        this.jsonLd.organization(),
        this.jsonLd.breadcrumbs([
          { name: this.transloco.translate('nav.home'), path: this.links.url('') },
          { name: this.transloco.translate('contact.title'), path: this.links.url('contact') },
        ]),
      ];
      const local = this.jsonLd.localBusiness();
      this.jsonLd.set(local ? [...graph, local] : graph);
    });
  }

  hasError(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field];
    return control.touched && control.invalid;
  }

  errorFor(field: keyof typeof this.form.controls): string {
    const control = this.form.controls[field];
    const label = this.transloco.translate(`contact.form.${field}`);

    if (control.hasError('required')) {
      return this.transloco.translate('contact.validation.required', { field: label });
    }
    if (control.hasError('requiredTrue')) {
      return this.transloco.translate('contact.validation.consent');
    }
    if (control.hasError('email')) {
      return this.transloco.translate('contact.validation.email');
    }
    if (control.hasError('minlength')) {
      return this.transloco.translate('contact.validation.minlength', {
        field: label,
        min: control.getError('minlength').requiredLength,
      });
    }
    if (control.hasError('maxlength')) {
      return this.transloco.translate('contact.validation.maxlength', {
        field: label,
        max: control.getError('maxlength').requiredLength,
      });
    }
    if (control.hasError('pattern')) {
      return this.transloco.translate('contact.validation.phone');
    }
    return '';
  }

  async submit(): Promise<void> {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.invalidFields.set(
        Object.keys(this.form.controls).filter((key) => this.form.get(key)?.invalid ?? false),
      );
      return;
    }

    this.invalidFields.set([]);
    this.state.set('submitting');
    this.failure.set('failed');

    try {
      const response = await fetch(this.config.contactEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...this.form.getRawValue(),
          productSlug: this.contextProduct()?.slug ?? null,
          website: '',
          locale: this.locales.locale(),
          // NEEDS_VERIFICATION: spam-protection token. The site key is empty
          // until the owner provisions one; the server rejects submissions when
          // verification is configured but the token is missing.
          captchaToken: null,
        }),
      });

      // Four things have to be true before this form is allowed to say the
      // enquiry was received, and every one of them was previously missing.
      //
      // The old code trusted `response.ok` alone and, when the body would not
      // parse, MADE UP a reference from the clock. Because no /api/contact
      // route existed at all, every submission fell through to the Angular
      // renderer, came back 200 text/html, and the visitor was thanked — with a
      // reference number to quote — for a message that had gone nowhere. A
      // buyer who believes they have been in touch does not follow up.
      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        // An HTML page here means the request was never handled by the API.
        throw new SubmissionError('unavailable');
      }

      const body = (await response.json()) as Partial<EnquiryResponse> | null;

      if (!response.ok || body?.ok !== true) {
        throw new SubmissionError(
          body?.code === 'not_configured' ? 'unavailable' : 'failed',
        );
      }

      if (typeof body.reference !== 'string' || body.reference.length === 0) {
        // Delivered but unacknowledged. Treated as a failure rather than shown
        // without a reference, because the reference is what the company will
        // ask for on the phone.
        throw new SubmissionError('failed');
      }

      this.reference.set(body.reference);
      this.state.set('success');
      this.form.reset({ department: 'sales', consent: false });
    } catch (error) {
      // Deliberately do NOT reset the form: the user's typing is preserved so a
      // transient failure does not cost them the message they just wrote.
      this.failure.set(error instanceof SubmissionError ? error.kind : 'failed');
      this.state.set('error');
    }
  }

  reset(): void {
    this.state.set('idle');
  }

  to(path: string): string[] {
    return this.links.path(path);
  }
}
