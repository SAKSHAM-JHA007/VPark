import type { User } from '@/types';

type Env = Record<string, string | undefined>;

export type PublicUser = Omit<User, 'passwordHash' | 'firebaseUid'>;

export function parseFirebaseUidAllowlist(raw: unknown): Set<string>;
export function getAdminUidAllowlist(env?: Env): Set<string>;
export function isAllowlistedAdminUid(uid: unknown, allowlist: Set<string>): boolean;
export function hasEffectiveAdminAccess(user: Pick<User, 'firebaseUid'> | null | undefined, allowlist: Set<string>): boolean;
export function toEffectiveUser(user: User, allowlist: Set<string>): User;
export function toEffectiveUser(user: User | null | undefined, allowlist: Set<string>): User | null;
export function toPublicUser(user: User): PublicUser;
export function toPublicUser(user: User | null | undefined): PublicUser | null;
