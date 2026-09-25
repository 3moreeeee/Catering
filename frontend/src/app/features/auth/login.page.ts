/* eslint-disable @typescript-eslint/unbound-method -- Angular's Validators are static, context-free functions. */
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { LocalizedRouter } from '../../core/i18n/localized-router.service';
import { LocaleService } from '../../core/i18n/locale.service';

@Component({
  selector: 'fk-login-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './login.page.html',
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly links = inject(LocalizedRouter);
  private readonly locales = inject(LocaleService);

  /**
   * The page the visitor was on before opening the login page, captured while
   * the navigation to /login is still in flight. Null on a direct visit, and
   * ignored when it is another auth page (login ↔ register back-and-forth).
   */
  private readonly previousUrl = (() => {
    const url = this.router.currentNavigation()?.previousNavigation?.finalUrl;
    if (!url) return null;
    const serialized = this.router.serializeUrl(url);
    return /\/(login|register)(?:[/?#]|$)/.test(serialized) ? null : serialized;
  })();

  readonly submitting = signal(false);
  readonly error = signal('');
  readonly registerUrl = this.links.url('register');
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.maxLength(72)]],
  });

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    this.error.set('');
    try {
      await this.auth.login(this.form.controls.email.value, this.form.controls.password.value);
      const requested = this.route.snapshot.queryParamMap.get('returnUrl');
      const localeRoot = `/${this.locales.locale()}`;
      const safeReturn =
        requested === localeRoot || requested?.startsWith(`${localeRoot}/`) ? requested : null;
      // Back to where the visitor was (guarded page, then previous page),
      // otherwise the home page.
      await this.router.navigateByUrl(safeReturn ?? this.previousUrl ?? this.links.url(''));
    } catch (error) {
      this.error.set(AuthService.errorCode(error));
    } finally {
      this.submitting.set(false);
    }
  }
}
