import { useCallback, useEffect, useState } from 'react';

interface Entry {
  value: unknown;
  error: Error | null;
  /** When the value or error was recorded. 0 while the first fetch is in flight. */
  at: number;
  promise: Promise<void> | null;
}

const cache = new Map<string, Entry>();

export interface QueryOptions {
  /** How long a result stays fresh. Default 5 minutes. */
  ttlMs?: number;
  enabled?: boolean;
}

export interface QueryResult<T> {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  refresh: () => void;
}

/**
 * The smallest useful async cache: keyed, time-limited, shared between components, deduplicating
 * in-flight requests. Pass a stable `fetcher` (useCallback) or a new one each render is fine as
 * long as the key is stable; a fresh cache entry prevents refetching.
 */
export function useQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: QueryOptions = {},
): QueryResult<T> {
  const ttlMs = options.ttlMs ?? 5 * 60_000;
  const enabled = options.enabled ?? true;
  const [, rerender] = useState(0);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (!key || !enabled) return;
    const existing = cache.get(key);
    if (existing && existing.promise) {
      void existing.promise.then(() => rerender((v) => v + 1));
      return;
    }
    if (existing && Date.now() - existing.at < ttlMs) return;

    const entry: Entry = {
      value: existing?.value,
      error: null,
      at: existing?.at ?? 0,
      promise: null,
    };
    entry.promise = fetcher()
      .then(
        (value) => {
          cache.set(key, { value, error: null, at: Date.now(), promise: null });
        },
        (error: unknown) => {
          cache.set(key, {
            value: existing?.value,
            error: error instanceof Error ? error : new Error(String(error)),
            at: Date.now(),
            promise: null,
          });
        },
      )
      .then(() => rerender((v) => v + 1));
    cache.set(key, entry);
  }, [key, enabled, ttlMs, fetcher, refreshToken]);

  const refresh = useCallback(() => {
    if (key) cache.delete(key);
    setRefreshToken((token) => token + 1);
  }, [key]);

  const entry = key && enabled ? cache.get(key) : undefined;
  return {
    data: entry?.value as T | undefined,
    error: entry?.error ?? null,
    loading:
      Boolean(key && enabled) && (!entry || (entry.promise !== null && entry.value === undefined)),
    refresh,
  };
}

/** Test and debugging hook: forget everything. */
export function clearQueryCache(): void {
  cache.clear();
}
