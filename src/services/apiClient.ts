import { getAuthToken } from './authService';

export class ApiError extends Error {
  public status: number;
  public code?: string;
  public details?: any;

  constructor(status: number, message: string, code?: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export interface ApiOptions {
  method?: string;
  body?: any;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export async function api<T = any>(path: string, options: ApiOptions = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const url = path.startsWith('/') ? path : `/${path}`;

  const executeRequest = async (forceRefresh: boolean): Promise<Response> => {
    const token = await getAuthToken(forceRefresh);

    const headers: Record<string, string> = {
      ...(options.headers || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let requestBody: any = undefined;
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      requestBody = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }

    return await fetch(url, {
      method,
      headers,
      body: requestBody,
      signal: options.signal,
    });
  };

  // 1. Initial attempt
  let res = await executeRequest(false);

  // 2. On 401 or 403, retry once with force-refreshed token (new role custom claims only appear after token refresh)
  if (res.status === 401 || res.status === 403) {
    const retryRes = await executeRequest(true);
    // If retry is successful or gives a different status, prefer it
    if (retryRes.ok) {
      res = retryRes;
    } else {
      res = retryRes;
    }
  }

  // 3. Parse JSON response
  let json: any = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      json = await res.json();
    } catch {
      // Non-JSON response
    }
  }

  // 4. Handle non-2xx responses
  if (!res.ok) {
    const errorMsg = json?.error || json?.message || `Request failed with status ${res.status}`;
    const code = json?.code;
    const details = json?.details;
    throw new ApiError(res.status, errorMsg, code, details);
  }

  // 5. Unwrap { success, data } envelope if present
  if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
    return json.data as T;
  }

  return json as T;
}
