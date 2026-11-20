export interface SessionRecord {
  id: string;
  tokenHash: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
  userAgent?: string;
}

type MaybePromise<T> = T | Promise<T>;

/**
 * Pluggable, possibly asynchronous session store. Revocation deletes records;
 * `touch` must never recreate a record that no longer exists.
 */
export interface SessionStore {
  insert(record: SessionRecord, ttlMs: number): MaybePromise<unknown>;
  findByTokenHash(tokenHash: string): MaybePromise<SessionRecord | undefined>;
  touch(tokenHash: string, lastSeenAtIso: string, ttlMs: number): MaybePromise<boolean>;
  remove(tokenHash: string): MaybePromise<unknown>;
  removeAllForUser(userId: string): MaybePromise<number>;
  prune?(nowIso: string, idleCutoffIso: string): MaybePromise<unknown>;
}

export interface SessionOptions {
  absoluteTtlMs: number;
  idleTimeoutMs: number;
  touchIntervalMs: number;
}

export interface SessionManager {
  createSession(params: { userId: string; userAgent?: string }): Promise<{ token: string; record: SessionRecord }>;
  validateSession(token: string | undefined | null): Promise<SessionRecord | null>;
  revokeSession(token: string | undefined | null): Promise<boolean>;
  revokeAllForUser(userId: string): Promise<number>;
  rotateSession(
    previousToken: string | undefined | null,
    params: { userId: string; userAgent?: string }
  ): Promise<{ token: string; record: SessionRecord }>;
  readonly config: Readonly<SessionOptions>;
}

type Env = Record<string, string | undefined>;

export const SESSION_TOKEN_VERSION: 'v1';
export const MIN_SESSION_SECRET_LENGTH: number;
export const LEGACY_SESSION_COOKIE_NAME: string;
export const SESSION_DEFAULTS: Readonly<SessionOptions>;
export function getSessionCookieName(env?: Env): string;
export function resolveSessionSecret(
  env?: Env
): { secret: string; source: 'env' | 'ephemeral'; error?: never } | { secret: null; error: string; source?: never };
export function generateSessionToken(): string;
export function isWellFormedSessionToken(token: unknown): token is string;
export function hashSessionToken(token: string, secret: string): string;
export function createSessionManager(params: {
  store: SessionStore;
  secret: string;
  now?: () => number;
  options?: Partial<SessionOptions>;
  logger?: Pick<Console, 'error'>;
}): SessionManager;
export function createMemorySessionStore(options?: { now?: () => number }): SessionStore & {
  records: Map<string, { record: SessionRecord; expiresAtMs: number }>;
};
