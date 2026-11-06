import { useCallback, useEffect, useRef, useState } from 'react';
import { useLive } from './live';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public issues?: { path: (string | number)[]; message: string }[]) {
    super(message);
  }
}

/** JSON API call. Every non-GET request carries the anti-CSRF header the server requires. */
export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = opts.method ?? 'GET';
  const headers: Record<string, string> = {};
  if (method !== 'GET') headers['x-candy-request'] = '1';
  let body: string | undefined;
  if (opts.body !== undefined) { headers['content-type'] = 'application/json'; body = JSON.stringify(opts.body); }
  let r: Response;
  try {
    r = await fetch(path, { method, headers, body, credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, 'network', 'network');
  }
  const text = await r.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!r.ok) {
    if (r.status === 401 && path !== '/api/auth/login') window.dispatchEvent(new CustomEvent('candy:unauthenticated'));
    throw new ApiError(r.status, data?.error ?? 'error', data?.message ?? r.statusText, data?.issues);
  }
  return data as T;
}

/**
 * Loads `path` and quietly reloads whenever a live event arrives, so every screen
 * reflects stored state without manual refresh. Pass null to skip.
 */
export function useApi<T = any>(path: string | null) {
  const { tick } = useLive();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!!path);
  const seq = useRef(0);

  const load = useCallback(async (quiet = false) => {
    if (!path) return;
    const mine = ++seq.current;
    if (!quiet) setLoading(true);
    try {
      const d = await api<T>(path);
      if (mine === seq.current) { setData(d); setError(null); }
    } catch (e) {
      if (mine === seq.current) setError(e as ApiError);
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => { setData(null); void load(false); }, [load]);
  useEffect(() => { if (tick > 0) void load(true); }, [tick, load]);

  return { data, error, loading, reload: () => load(true) };
}

/** Wraps an action with busy/error state for buttons and forms. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true); setError(null);
    try { return await fn(); } catch (e) { setError(e as ApiError); return undefined; } finally { setBusy(false); }
  }, []);
  return { busy, error, run, clear: () => setError(null) };
}
