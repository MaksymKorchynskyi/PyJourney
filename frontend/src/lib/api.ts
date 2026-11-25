import { auth } from "./auth";
import { messages } from "./i18n";

const BASE_URL = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/$/, "");

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  json?: unknown;
  form?: Record<string, string>;
  signal?: AbortSignal;
};

type ValidationIssue = { loc?: (string | number)[]; msg?: string };

function describe(detail: unknown, fallback: string) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((issue: ValidationIssue) => {
        const field = issue.loc?.at(-1);
        return field ? `${String(field).replace(/_/g, " ")}: ${issue.msg}` : issue.msg;
      })
      .filter(Boolean)
      .join("\n");
  }
  return fallback;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers({ Accept: "application/json" });
  let body: BodyInit | undefined;

  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.json);
  } else if (options.form) {
    body = new URLSearchParams(options.form);
  }

  const token = auth.token;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body,
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, messages().api.unreachable);
  }

  if (response.status === 204) return undefined as T;

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = (payload as { detail?: unknown } | null)?.detail;
    throw new ApiError(response.status, describe(detail, `Request failed (${response.status})`));
  }

  return payload as T;
}
