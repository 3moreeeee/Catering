/* eslint-disable @typescript-eslint/unbound-method -- Angular's Validators are static, context-free functions. */
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, PLATFORM_ID, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import {
  AdminCreatePersonPayload,
  AdminPersonPayload,
  ClientType,
  Person,
  Role,
} from '../../core/auth/auth.models';

@Component({
  selector: 'fk-users-admin-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ReactiveFormsModule, TranslocoDirective],
  templateUrl: './users-admin.page.html',
})
export class UsersAdminPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly document = inject(DOCUMENT);
  private readonly transloco = inject(TranslocoService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly people = signal<readonly Person[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly editorOpen = signal(false);
  readonly editing = signal<Person | null>(null);
  readonly error = signal('');
  readonly success = signal('');
  readonly selectedRole = signal<Role>('CLIENT');
  readonly selectedType = signal<ClientType>('PHYSIQUE');
  query = '';

  readonly form = this.fb.nonNullable.group({
    role: this.fb.nonNullable.control<Role>('CLIENT', Validators.required),
    clientType: this.fb.nonNullable.control<ClientType>('PHYSIQUE'),
    firstName: ['', Validators.maxLength(100)],
    lastName: ['', Validators.maxLength(100)],
    companyName: ['', Validators.maxLength(180)],
    taxIdentifier: ['', Validators.maxLength(80)],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    phone: ['', Validators.pattern(/^[+0-9][0-9 .()/-]{5,28}$/)],
    password: ['', Validators.maxLength(72)],
    enabled: [true],
  });

  constructor() {
    if (isPlatformBrowser(this.platformId)) void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.people.set(await this.auth.listPeople(this.query));
    } catch (error) {
      this.error.set(AuthService.errorCode(error));
    } finally {
      this.loading.set(false);
    }
  }

  startCreate(): void {
    this.editing.set(null);
    this.selectedRole.set('CLIENT');
    this.selectedType.set('PHYSIQUE');
    this.form.reset({
      role: 'CLIENT',
      clientType: 'PHYSIQUE',
      firstName: '',
      lastName: '',
      companyName: '',
      taxIdentifier: '',
      email: '',
      phone: '',
      password: '',
      enabled: true,
    });
    this.editorOpen.set(true);
    this.error.set('');
  }

  edit(person: Person): void {
    this.editing.set(person);
    this.selectedRole.set(person.role);
    this.selectedType.set(person.clientType ?? 'PHYSIQUE');
    this.form.reset({
      role: person.role,
      clientType: person.clientType ?? 'PHYSIQUE',
      firstName: person.firstName ?? '',
      lastName: person.lastName ?? '',
      companyName: person.companyName ?? '',
      taxIdentifier: person.taxIdentifier ?? '',
      email: person.email,
      phone: person.phone ?? '',
      password: '',
      enabled: person.enabled,
    });
    this.editorOpen.set(true);
    this.error.set('');
  }

  setRole(role: Role): void {
    this.selectedRole.set(role);
    this.form.controls.role.setValue(role);
  }

  setType(type: ClientType): void {
    this.selectedType.set(type);
    this.form.controls.clientType.setValue(type);
  }

  closeEditor(): void {
    this.editorOpen.set(false);
    this.editing.set(null);
  }

  async save(): Promise<void> {
    this.applyValidation();
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.success.set('');
    const value = this.form.getRawValue();
    const base: AdminPersonPayload = {
      role: value.role,
      clientType: value.role === 'CLIENT' ? value.clientType : null,
      firstName:
        value.role === 'ADMIN' || value.clientType === 'PHYSIQUE' ? value.firstName || null : null,
      lastName:
        value.role === 'CLIENT' && value.clientType === 'PHYSIQUE' ? value.lastName || null : null,
      companyName:
        value.role === 'CLIENT' && value.clientType === 'MORALE' ? value.companyName || null : null,
      taxIdentifier:
        value.role === 'CLIENT' && value.clientType === 'MORALE'
          ? value.taxIdentifier || null
          : null,
      email: value.email,
      phone: value.phone || null,
      enabled: value.enabled,
    };
    try {
      const existing = this.editing();
      if (existing) {
        await this.auth.updatePerson(existing.id, base);
      } else {
        await this.auth.createPerson({
          ...base,
          password: value.password,
        } satisfies AdminCreatePersonPayload);
      }
      this.success.set(existing ? 'updated' : 'created');
      this.closeEditor();
      await this.load();
    } catch (error) {
      this.error.set(AuthService.errorCode(error));
    } finally {
      this.saving.set(false);
    }
  }

  async remove(person: Person): Promise<void> {
    const confirmed = this.document.defaultView?.confirm(
      this.transloco.translate('admin.deleteConfirm', { name: this.name(person) }),
    );
    if (!confirmed) return;
    this.error.set('');
    try {
      await this.auth.deletePerson(person.id);
      this.people.update((items) => items.filter((item) => item.id !== person.id));
      this.success.set('deleted');
    } catch (error) {
      this.error.set(AuthService.errorCode(error));
    }
  }

  name(person: Person): string {
    return person.clientType === 'MORALE'
      ? (person.companyName ?? person.email)
      : [person.firstName, person.lastName].filter(Boolean).join(' ') || person.email;
  }

  private applyValidation(): void {
    const creating = this.editing() === null;
    this.form.controls.password.setValidators(
      creating ? [Validators.required, Validators.minLength(10), Validators.maxLength(72)] : [],
    );
    if (this.form.controls.role.value === 'CLIENT') {
      if (this.form.controls.clientType.value === 'PHYSIQUE') {
        this.form.controls.firstName.setValidators([
          Validators.required,
          Validators.maxLength(100),
        ]);
        this.form.controls.lastName.setValidators([Validators.required, Validators.maxLength(100)]);
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
    } else {
      for (const control of [
        this.form.controls.firstName,
        this.form.controls.lastName,
        this.form.controls.companyName,
        this.form.controls.taxIdentifier,
      ])
        control.clearValidators();
    }
    for (const control of [
      this.form.controls.password,
      this.form.controls.firstName,
      this.form.controls.lastName,
      this.form.controls.companyName,
      this.form.controls.taxIdentifier,
    ])
      control.updateValueAndValidity();
  }
}
