export interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rows: any[]; rowCount?: number | null }>;
}

export const MIGRATIONS: readonly { version: number; name: string; sql: string }[];
export const LATEST_SCHEMA_VERSION: number;
export function runMigrations(client: Queryable, options?: { log?: (message: string) => void }): Promise<number[]>;
export function getSchemaVersion(client: Queryable): Promise<number>;
