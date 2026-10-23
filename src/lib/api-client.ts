import { getSupabaseConfig } from './config';
import type { ApiError } from './api-types';

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    hostCapability?: string;
  } = {},
): Promise<T> {
  const { url, publishableKey } = getSupabaseConfig();
  const headers = new Headers({
    apikey: publishableKey,
    'Content-Type': 'application/json',
  });

  if (options.hostCapability) {
    headers.set('Authorization', `Bearer ${options.hostCapability}`);
  }

  const response = await fetch(`${url}/functions/v1/${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const result: unknown = await response.json().catch(() => {
    throw new ApiRequestError(
      'The server returned an unreadable response.',
      'INVALID_RESPONSE',
      response.status,
    );
  });

  if (!response.ok) {
    const apiError = result as ApiError;
    throw new ApiRequestError(
      apiError.error?.message ?? 'The request could not be completed.',
      apiError.error?.code ?? 'REQUEST_FAILED',
      response.status,
    );
  }

  return result as T;
}
