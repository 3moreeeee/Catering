export type Role = 'ADMIN' | 'CLIENT';
export type ClientType = 'PHYSIQUE' | 'MORALE';

export interface Person {
  readonly id: string;
  readonly email: string;
  readonly role: Role;
  readonly clientType: ClientType | null;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly companyName: string | null;
  readonly taxIdentifier: string | null;
  readonly phone: string | null;
  readonly enabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProfilePayload {
  readonly clientType: ClientType;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly companyName: string | null;
  readonly taxIdentifier: string | null;
  readonly email: string;
  readonly phone: string | null;
}

export interface RegisterPayload extends ProfilePayload {
  readonly password: string;
}

export interface AdminPersonPayload {
  readonly role: Role;
  readonly clientType: ClientType | null;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly companyName: string | null;
  readonly taxIdentifier: string | null;
  readonly email: string;
  readonly phone: string | null;
  readonly enabled: boolean;
}

export interface AdminCreatePersonPayload extends AdminPersonPayload {
  readonly password: string;
}

export interface ApiErrorBody {
  readonly code?: string;
  readonly message?: string;
  readonly fields?: Readonly<Record<string, string>>;
}
