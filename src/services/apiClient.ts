import { getAuthToken } from './authService';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

/** Authenticated JSON call to the FieldOps API. Unwraps the `{ success, data }` envelope. */
export async function api<T>(path: string, { method = 'GET', body, signal }: RequestOptions = {}): Promise<T> {
  const send = async (forceRefresh: boolean) => {
    const token = await getAuthToken(forceRefresh);
    return fetch(path, {
      method,
      signal,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res = await send(false);
  // A role granted after sign-in only appears in a refreshed token.
  if (res.status === 401 || res.status === 403) res = await send(true);

  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new ApiError(res.status, json?.error || `Request failed (${res.status})`, json?.code, json?.details);
  }
  return json.data as T;
}
