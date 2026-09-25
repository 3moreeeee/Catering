/* eslint-disable @typescript-eslint/unbound-method -- Angular's Validators are static, context-free functions. */
import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { ClientType, ProfilePayload } from '../../core/auth/auth.models';
import { LocalizedRouter } from '../../core/i18n/localized-router.service';
import { CartService } from '../../core/cart/cart.service';

@Component({
  selector: 'fk-account-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './account.page.html',
  styleUrl: './account.page.scss',
})
export class AccountPage {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly links = inject(LocalizedRouter);
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);
  readonly auth = inject(AuthService);
  readonly cart = inject(CartService);

  readonly tab = signal<'profile' | 'security'>('profile');
  readonly cartUrl = this.links.url('cart');
  readonly isClient = computed(() => this.auth.user()?.role === 'CLIENT');

  /** Two letters for the avatar: first + last name, or the company's first two words. */
  readonly initials = computed(() => {
    const user = this.auth.user();
    if (!user) return '';
    const words =
      user.clientType === 'MORALE' && user.companyName
        ? user.companyName.split(/\s+/)
        : [user.firstName, user.lastName].filter((word): word is string => !!word);
    const letters = words
      .slice(0, 2)
      .map((word) => word.charAt(0))
      .join('');
    return (letters || user.email.charAt(0)).toUpperCase();
  });

  /** "sept. 2026", in the active language, from the account's creation date. */
  readonly memberSince = computed(() => {
    const created = this.auth.user()?.createdAt;
    if (!created) return null;
    const locale = this.transloco.getActiveLang() === 'en' ? 'en-GB' : 'fr-FR';
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
      new Date(created),
    );
  });

  readonly profileState = signal<'idle' | 'saving' | 'success' | 'error'>('idle');
  readonly passwordState = signal<'idle' | 'saving' | 'success' | 'error'>('idle');
  readonly error = signal('');
  readonly selectedType = signal<ClientType>('PHYSIQUE');
  readonly adminUrl = this.links.url('admin/users');

  readonly profileForm = this.fb.nonNullable.group({
    clientType: ['PHYSIQUE' as ClientType, Validators.required],
    firstName: ['', Validators.maxLength(100)],
    lastName: ['', Validators.maxLength(100)],
    companyName: ['', Validators.maxLength(180)],
    taxIdentifier: ['', Validators.maxLength(80)],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    phone: ['', Validators.pattern(/^[+0-9][0-9 .()/-]{5,28}$/)],
  });

  readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(72)]],
    confirmPassword: ['', Validators.required],
  });

  constructor() {
    // Also hydrates a direct SSR visit after the browser restores its cookie session.
    effect(() => {
      const user = this.auth.user();
      if (user?.role !== 'CLIENT') return;
      const type = user.clientType ?? 'PHYSIQUE';
      this.selectedType.set(type);
      this.profileForm.patchValue({
        clientType: type,
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        companyName: user.companyName ?? '',
        taxIdentifier: user.taxIdentifier ?? '',
        email: user.email,
        phone: user.phone ?? '',
      });
    });
  }

  /** Arrow-key navigation between the two tabs, moving focus with the selection. */
  switchTab(tab: 'profile' | 'security'): void {
    this.tab.set(tab);
    this.document.getElementById(`tab-${tab}`)?.focus();
  }

  setType(type: ClientType): void {
    this.selectedType.set(type);
    this.profileForm.controls.clientType.setValue(type);
  }

  async saveProfile(): Promise<void> {
    this.applyConditionalValidation();
    this.profileForm.markAllAsTouched();
    if (this.profileForm.invalid || this.profileState() === 'saving') return;
    this.profileState.set('saving');
    this.error.set('');
    const value = this.profileForm.getRawValue();
    const payload: ProfilePayload = {
      clientType: value.clientType,
      firstName: value.clientType === 'PHYSIQUE' ? value.firstName : null,
      lastName: value.clientType === 'PHYSIQUE' ? value.lastName : null,
      companyName: value.clientType === 'MORALE' ? value.companyName : null,
      taxIdentifier: value.clientType === 'MORALE' ? value.taxIdentifier : null,
      email: value.email,
      phone: value.phone || null,
    };
    try {
      await this.auth.updateProfile(payload);
      this.profileForm.markAsPristine();
      this.profileState.set('success');
    } catch (error) {
      this.error.set(AuthService.errorCode(error));
      this.profileState.set('error');
    }
  }

  async changePassword(): Promise<void> {
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid || this.passwordState() === 'saving') return;
    const value = this.passwordForm.getRawValue();
    if (value.newPassword !== value.confirmPassword) {
      this.error.set('password_mismatch');
      this.passwordState.set('error');
      return;
    }
    this.passwordState.set('saving');
    this.error.set('');
    try {
      await this.auth.changePassword(value.currentPassword, value.newPassword);
      this.passwordForm.reset();
      this.passwordState.set('success');
    } catch (error) {
      this.error.set(AuthService.errorCode(error));
      this.passwordState.set('error');
    }
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl(this.links.url('login'));
  }

  async deleteAccount(): Promise<void> {
    const confirmed = this.document.defaultView?.confirm(
      this.transloco.translate('account.deleteConfirm'),
    );
    if (!confirmed) return;
    try {
      await this.auth.deleteOwnAccount();
      await this.router.navigateByUrl(this.links.url(''));
    } catch (error) {
      this.error.set(AuthService.errorCode(error));
    }
  }

  private applyConditionalValidation(): void {
    if (this.profileForm.controls.clientType.value === 'PHYSIQUE') {
      this.profileForm.controls.firstName.setValidators([
        Validators.required,
        Validators.maxLength(100),
      ]);
      this.profileForm.controls.lastName.setValidators([
        Validators.required,
        Validators.maxLength(100),
      ]);
      this.profileForm.controls.companyName.clearValidators();
      this.profileForm.controls.taxIdentifier.clearValidators();
    } else {
      this.profileForm.controls.firstName.clearValidators();
      this.profileForm.controls.lastName.clearValidators();
      this.profileForm.controls.companyName.setValidators([
        Validators.required,
        Validators.maxLength(180),
      ]);
      this.profileForm.controls.taxIdentifier.setValidators([
        Validators.required,
        Validators.maxLength(80),
      ]);
    }
    for (const control of [
      this.profileForm.controls.firstName,
      this.profileForm.controls.lastName,
      this.profileForm.controls.companyName,
      this.profileForm.controls.taxIdentifier,
    ])
      control.updateValueAndValidity();
  }
}
