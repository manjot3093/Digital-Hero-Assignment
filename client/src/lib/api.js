/**
 * Thin fetch wrapper around the Digital Heroes API.
 *
 * The server sets an httpOnly session cookie, so every request sends
 * credentials and no token is ever kept in JavaScript. The wrapper normalises
 * the API's { success, data, message } envelope and turns failures into an
 * ApiError carrying the server's user-facing message, error code and any
 * per-field validation errors.
 */

const BASE = import.meta.env.VITE_API_URL ?? '/api';

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'REQUEST_FAILED', errors = [] } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.errors = errors;
  }

  /** Field name → message, for inline form validation. */
  get fieldErrors() {
    return Object.fromEntries(
      (this.errors ?? [])
        .filter((item) => item && item.field)
        .map((item) => [item.field, item.message])
    );
  }
}

async function request(path, { method = 'GET', body, query, signal, isForm = false } = {}) {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const init = {
    method,
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  };

  if (body !== undefined) {
    if (isForm) {
      init.body = body; // let the browser set the multipart boundary
    } else {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
  }

  let response;
  try {
    response = await fetch(url.pathname + url.search, init);
  } catch (cause) {
    if (cause?.name === 'AbortError') throw cause;
    throw new ApiError('We could not reach the server. Check your connection and try again.', {
      code: 'NETWORK_ERROR',
    });
  }

  if (response.status === 204) return null;

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok || payload?.success === false) {
    throw new ApiError(payload?.message ?? 'Something went wrong. Please try again.', {
      status: response.status,
      code: payload?.code ?? 'REQUEST_FAILED',
      errors: payload?.errors ?? [],
    });
  }

  return payload?.data ?? null;
}

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  del: (path, options) => request(path, { ...options, method: 'DELETE' }),
  upload: (path, formData, options) =>
    request(path, { ...options, method: 'POST', body: formData, isForm: true }),
};

export default api;
