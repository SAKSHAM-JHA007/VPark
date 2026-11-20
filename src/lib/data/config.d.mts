type Env = Record<string, string | undefined>;

export type DataBackend =
  | { kind: 'postgres'; connectionString: string; ssl?: { rejectUnauthorized: boolean }; poolMax: number; error?: never }
  | { kind: 'json'; error?: never }
  | { kind: null; error: string };

export function resolveDataBackend(env?: Env): DataBackend;
