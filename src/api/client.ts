import type { ApiErrorDetail } from "./types";

// Thin fetch wrapper. Base URL is relative (/api/v1) so the Vite dev proxy
// forwards it to the backend; set VITE_API_BASE to an absolute URL when the
// backend is reachable directly.

const BASE = (import.meta.env.VITE_API_BASE || "/api/v1").replace(/\/+$/, "");

const TOKEN_KEY = "dashspend.token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function clearSession() {
  setToken(null);
  try {
    localStorage.removeItem("dashspend.user");
  } catch {
    /* noop */
  }
}

export class ApiError extends Error {
  status: number;
  code: string;
  fieldErrors: Record<string, string> | null;

  constructor(status: number, code: string, message: string, fieldErrors: Record<string, string> | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  json?: unknown;
  form?: URLSearchParams;
  formData?: FormData;
  auth?: boolean;
  blob?: boolean;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", json, form, formData, auth = true, blob = false } = opts;

  const headers: Record<string, string> = {};
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  let body: BodyInit | undefined;
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  } else if (form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = form.toString();
  } else if (formData) {
    body = formData;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body });
  } catch {
    throw new ApiError(0, "network_error", "Could not reach the server. Is the backend running on port 8000?");
  }

  if (res.status === 401) {
    // Token missing, invalid or expired. Clear and bounce to login.
    clearSession();
    if (!window.location.pathname.startsWith("/login")) {
      window.location.assign("/login?reason=session");
    }
    throw new ApiError(401, "unauthorized", "Your session expired. Please sign in again.");
  }

  if (!res.ok) {
    let detail: ApiErrorDetail | null = null;
    try {
      const data = await res.json();
      if (data && data.detail && typeof data.detail === "object") detail = data.detail;
    } catch {
      /* non-JSON error body */
    }
    const code = detail?.code || "error";
    const message = detail?.message || `Request failed (HTTP ${res.status}).`;
    const fieldErrors: Record<string, string> | null = detail?.errors?.length
      ? Object.fromEntries(
          detail.errors.map((e) => {
            const field = e.loc[e.loc.length - 1];
            return [field, e.msg];
          }),
        )
      : null;
    throw new ApiError(res.status, code, message, fieldErrors);
  }

  if (res.status === 204) return undefined as T;
  if (blob) return (await res.blob()) as unknown as T;
  return (await res.json()) as T;
}

export function qs(params: Record<string, string | number | undefined | null>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}
