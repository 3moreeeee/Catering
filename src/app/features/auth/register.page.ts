/* eslint-disable @typescript-eslint/unbound-method -- Angular's Validators are static, context-free functions. */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { ClientType, RegisterPayload } from '../../core/auth/auth.models';
import { LocalizedRouter } from '../../core/i18n/localized-router.service';

@Component({
  selector: 'fk-register-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './register.page.html',
})
export class RegisterPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly links = inject(LocalizedRouter);

  readonly submitting = signal(false);
  readonly error = signal('');
  readonly loginUrl = this.links.url('login');
  readonly form = this.fb.nonNullable.group({
    clientType: ['PHYSIQUE' as ClientType, Validators.required],
    firstName: ['', [Validators.maxLength(100)]],
    lastName: ['', [Validators.maxLength(100)]],
    companyName: ['', [Validators.maxLength(180)]],
    taxIdentifier: ['', [Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    phone: ['', [Validators.pattern(/^[+0-9][0-9 .()/-]{5,28}$/)]],
    password: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(72)]],
    confirmPassword: ['', Validators.required],
    consent: [false, Validators.requiredTrue],
  });
  readonly selectedType = signal<ClientType>('PHYSIQUE');
  readonly isCompany = computed(() => this.selectedType() === 'MORALE');

  setType(type: ClientType): void {
    this.selectedType.set(type);
    this.form.controls.clientType.setValue(type);
  }

  async submit(): Promise<void> {
    this.applyConditionalValidation();
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) return;
    if (this.form.controls.password.value !== this.form.controls.confirmPassword.value) {
      this.error.set('password_mismatch');
      return;
    }
    this.submitting.set(true);
    this.error.set('');
    const value = this.form.getRawValue();
    const payload: RegisterPayload = {
      clientType: value.clientType,
      firstName: value.clientType === 'PHYSIQUE' ? value.firstName : null,
      lastName: value.clientType === 'PHYSIQUE' ? value.lastName : null,
      companyName: value.clientType === 'MORALE' ? value.companyName : null,
      taxIdentifier: value.clientType === 'MORALE' ? value.taxIdentifier : null,
      email: value.email,
      phone: value.phone || null,
      password: value.password,
    };
    try {
      await this.auth.register(payload);
      await this.router.navigateByUrl(this.links.url('account'));
    } catch (error) {
      this.error.set(AuthService.errorCode(error));
    } finally {
      this.submitting.set(false);
    }
  }

  private applyConditionalValidation(): void {
    const required = [Validators.required, Validators.maxLength(100)];
    if (this.form.controls.clientType.value === 'PHYSIQUE') {
      this.form.controls.firstName.setValidators(required);
      this.form.controls.lastName.setValidators(required);
      this.form.controls.companyName.clearValidators();
      this.form.controls.taxIdentifier.clearValidators();
    } else {
      this.form.controls.firstName.clearValidators();
      this.form.controls.lastName.clearValidators();
      this.form.controls.companyName.setValidators([
        Validators.required,
        Validators.maxLength(180),
      ]);
      this.form.controls.taxIdentifier.setValidators([
        Validators.required,
        Validators.maxLength(80),
      ]);
    }
    for (const control of [
      this.form.controls.firstName,
      this.form.controls.lastName,
      this.form.controls.companyName,
      this.form.controls.taxIdentifier,
    ])
      control.updateValueAndValidity();
  }
}
