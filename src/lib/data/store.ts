import type { CollectionName, CollectionTypes } from './collections.mjs';

export type { CollectionName, CollectionTypes };

/** A value or range accepted by `find` / `deleteWhere` for an indexed field. */
export type FilterValue =
  | string
  | null
  | readonly string[]
  | { lte?: string; lt?: string; gte?: string; gt?: string };

/** Filters may only use the indexed fields declared in collections.mjs. */
export type Filter = Record<string, FilterValue>;

export interface ReadOptions {
  /** Take a row lock (SELECT … FOR UPDATE) held until the transaction ends. */
  forUpdate?: boolean;
}

/**
 * Operations available inside one transaction. Everything a transaction reads is a
 * private copy: changes only take effect through put()/delete(), and are committed
 * atomically when the transaction callback resolves (or discarded if it throws).
 */
export interface Tx {
  get<K extends CollectionName>(kind: K, key: string, opts?: ReadOptions): Promise<CollectionTypes[K] | undefined>;
  find<K extends CollectionName>(kind: K, where: Filter, opts?: ReadOptions): Promise<CollectionTypes[K][]>;
  all<K extends CollectionName>(kind: K): Promise<CollectionTypes[K][]>;
  put<K extends CollectionName>(kind: K, entity: CollectionTypes[K]): Promise<void>;
  delete<K extends CollectionName>(kind: K, key: string): Promise<boolean>;
  deleteWhere<K extends CollectionName>(kind: K, where: Filter): Promise<number>;
  /** Transaction-scoped mutual exclusion on an arbitrary key (PostgreSQL advisory lock). */
  lock(key: string): Promise<void>;
}

export interface DataStore {
  readonly kind: 'postgres' | 'json';
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/**
 * The data store is not usable: configuration missing or invalid, database
 * unreachable, or schema not migrated. Requests must fail closed (HTTP 503).
 */
export class DataStoreUnavailableError extends Error {
  readonly reason: string;
  constructor(reason: string, options?: { cause?: unknown }) {
    super(`Data store unavailable: ${reason}`);
    this.name = 'DataStoreUnavailableError';
    this.reason = reason;
    if (options && 'cause' in options) (this as { cause?: unknown }).cause = options.cause;
  }
}

export function isDataStoreUnavailable(err: unknown): err is DataStoreUnavailableError {
  return err instanceof Error && err.name === 'DataStoreUnavailableError';
}

/** Shared filter semantics for the JSON store (mirrors the SQL the Postgres store emits). */
export function matchesFilter(
  entity: Record<string, unknown>,
  where: Filter,
  normalize: (field: string, value: unknown) => string | null
): boolean {
  for (const [field, cond] of Object.entries(where)) {
    const actual = normalize(field, entity[field]);
    if (cond === null) {
      if (actual !== null) return false;
    } else if (typeof cond === 'string') {
      if (actual !== normalize(field, cond)) return false;
    } else if (Array.isArray(cond)) {
      if (actual === null || !cond.map((c) => normalize(field, c)).includes(actual)) return false;
    } else {
      if (actual === null) return false;
      const range = cond as { lte?: string; lt?: string; gte?: string; gt?: string };
      const a = Date.parse(actual);
      if (range.lte !== undefined && !(a <= Date.parse(range.lte))) return false;
      if (range.lt !== undefined && !(a < Date.parse(range.lt))) return false;
      if (range.gte !== undefined && !(a >= Date.parse(range.gte))) return false;
      if (range.gt !== undefined && !(a > Date.parse(range.gt))) return false;
    }
  }
  return true;
}
