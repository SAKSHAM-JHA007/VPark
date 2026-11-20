import type { SessionStore } from './session.mjs';

type Env = Record<string, string | undefined>;

export interface RedisRestConfig {
  url: string;
  token: string;
  keyPrefix: string;
}

export function getRedisRestConfig(env?: Env): { config: RedisRestConfig | null; error?: never } | { config?: never; error: string };

export type SessionBackend =
  | { kind: 'redis'; config: RedisRestConfig; error?: never }
  | { kind: 'database'; config?: never; error?: never }
  | { kind: null; error: string; config?: never };

export function resolveSessionBackend(env?: Env): SessionBackend;

export function createRedisRestSessionStore(options: {
  url: string;
  token: string;
  keyPrefix?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  userIndexTtlMs?: number;
}): SessionStore & { kind: 'redis' };
