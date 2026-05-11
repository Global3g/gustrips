/**
 * Tripshistory HTTP client.
 *
 * Thin fetch wrapper that:
 *  - prepends a configurable base URL (NEXT_PUBLIC_TRIPSHISTORY_API_URL)
 *  - attaches the current Firebase ID token as `Authorization: Bearer <token>`
 *  - parses JSON bodies and throws typed errors that mirror the API Error schema
 *
 * No retry logic. No caching. Keep it boring.
 */

import { getClientAuth } from '@/lib/firebase/client';
import type { TripshistoryApiError } from '@/features/tripshistory/types';

/* ─── Config ───────────────────────────────────────── */

const DEFAULT_BASE_URL =
  'http://localhost:5001/gustrips/us-central1/tripshistory';

function getBaseUrl(): string {
  const envUrl =
    typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_TRIPSHISTORY_API_URL
      : undefined;
  return (envUrl && envUrl.trim().length > 0 ? envUrl : DEFAULT_BASE_URL).replace(
    /\/+$/,
    '',
  );
}

/* ─── Errors ───────────────────────────────────────── */

export class TripshistoryError extends Error implements TripshistoryApiError {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    status: number,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'TripshistoryError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/* ─── Auth ─────────────────────────────────────────── */

async function getAuthToken(): Promise<string | null> {
  try {
    const auth = getClientAuth();
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken();
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn('[tripshistory] Could not get Firebase ID token', err);
    }
    return null;
  }
}

/* ─── Core request ─────────────────────────────────── */

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  /** Allow unauthenticated calls. Defaults to false (token required). */
  anonymous?: boolean;
}

function buildUrl(
  path: string,
  query?: RequestOptions['query'],
): string {
  const base = getBaseUrl();
  const cleanedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${base}${cleanedPath}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, query, signal, anonymous = false } = options;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (!anonymous) {
    const token = await getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const url = buildUrl(path, query);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    throw new TripshistoryError(
      'network_error',
      err instanceof Error ? err.message : 'Network error',
      0,
    );
  }

  // 204 No Content — return null-cast value
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');

  let parsedBody: unknown = undefined;
  if (isJson) {
    try {
      parsedBody = await response.json();
    } catch {
      parsedBody = undefined;
    }
  } else if (response.status >= 400) {
    parsedBody = await response.text().catch(() => undefined);
  }

  if (!response.ok) {
    const errBody = (parsedBody ?? {}) as Partial<TripshistoryApiError>;
    throw new TripshistoryError(
      errBody.code || `http_${response.status}`,
      errBody.message ||
        (typeof parsedBody === 'string' && parsedBody.length > 0
          ? parsedBody
          : response.statusText) ||
        'Request failed',
      response.status,
      errBody.details,
    );
  }

  return parsedBody as T;
}

/* ─── Convenience method wrappers ──────────────────── */

export const tripshistoryClient = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),

  post: <T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ) => request<T>(path, { ...options, method: 'POST', body }),

  patch: <T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ) => request<T>(path, { ...options, method: 'PATCH', body }),

  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};

export { getBaseUrl as getTripshistoryBaseUrl };
