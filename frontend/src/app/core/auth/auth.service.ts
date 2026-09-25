import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AdminCreatePersonPayload,
  AdminPersonPayload,
  ApiErrorBody,
  Person,
  ProfilePayload,
  RegisterPayload,
} from './auth.models';
import { IDENTITY_API_URL } from './identity-api.token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(IDENTITY_API_URL);
  private readonly platformId = inject(PLATFORM_ID);
  private loadPromise: Promise<Person | null> | null = null;

  readonly user = signal<Person | null>(null);
  readonly loaded = signal(false);
  readonly authenticated = computed(() => this.user() !== null);
  readonly isAdmin = computed(() => this.user()?.role === 'ADMIN');
  readonly displayName = computed(() => {
    const user = this.user();
    if (!user) return '';
    return user.clientType === 'MORALE'
      ? (user.companyName ?? user.email)
      : [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
  });

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      queueMicrotask(() => void this.ensureLoaded());
    }
  }

  ensureLoaded(): Promise<Person | null> {
    if (!isPlatformBrowser(this.platformId)) return Promise.resolve(null);
    if (this.loaded()) return Promise.resolve(this.user());
    this.loadPromise ??= this.refresh();
    return this.loadPromise;
  }

  async refresh(): Promise<Person | null> {
    try {
      const person = await firstValueFrom(
        this.http.get<Person>(`${this.apiUrl}/auth/me`, { withCredentials: true }),
      );
      this.user.set(person);
      return person;
    } catch {
      this.user.set(null);
      return null;
    } finally {
      this.loaded.set(true);
      this.loadPromise = null;
    }
  }

  async login(email: string, password: string): Promise<Person> {
    const person = await firstValueFrom(
      this.http.post<Person>(
        `${this.apiUrl}/auth/login`,
        { email, password },
        { withCredentials: true },
      ),
    );
    this.user.set(person);
    this.loaded.set(true);
    return person;
  }

  async register(payload: RegisterPayload): Promise<Person> {
    const person = await firstValueFrom(
      this.http.post<Person>(`${this.apiUrl}/auth/register`, payload, { withCredentials: true }),
    );
    this.user.set(person);
    this.loaded.set(true);
    return person;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post<void>(`${this.apiUrl}/auth/logout`, {}, { withCredentials: true }),
      );
    } finally {
      this.user.set(null);
      this.loaded.set(true);
    }
  }

  async updateProfile(payload: ProfilePayload): Promise<Person> {
    const person = await firstValueFrom(
      this.http.put<Person>(`${this.apiUrl}/persons/me`, payload, { withCredentials: true }),
    );
    this.user.set(person);
    return person;
  }

  changePassword(currentPassword: string, newPassword: string): Promise<void> {
    return firstValueFrom(
      this.http.put<void>(
        `${this.apiUrl}/persons/me/password`,
        { currentPassword, newPassword },
        { withCredentials: true },
      ),
    );
  }

  async deleteOwnAccount(): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(`${this.apiUrl}/persons/me`, { withCredentials: true }),
    );
    this.user.set(null);
  }

  listPeople(query = ''): Promise<readonly Person[]> {
    return firstValueFrom(
      this.http.get<readonly Person[]>(`${this.apiUrl}/persons`, {
        params: query ? { q: query } : {},
        withCredentials: true,
      }),
    );
  }

  createPerson(payload: AdminCreatePersonPayload): Promise<Person> {
    return firstValueFrom(
      this.http.post<Person>(`${this.apiUrl}/persons`, payload, { withCredentials: true }),
    );
  }

  updatePerson(id: string, payload: AdminPersonPayload): Promise<Person> {
    return firstValueFrom(
      this.http.put<Person>(`${this.apiUrl}/persons/${id}`, payload, { withCredentials: true }),
    );
  }

  deletePerson(id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.apiUrl}/persons/${id}`, { withCredentials: true }),
    );
  }

  static errorCode(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) return 'unknown';
    const body = error.error as ApiErrorBody | null;
    return body?.code ?? (error.status === 0 ? 'offline' : 'unknown');
  }
}
