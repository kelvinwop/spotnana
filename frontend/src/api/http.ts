import { getDefaultStore } from "jotai";
import { tokenAtom } from "@/atoms/authAtoms";
import { getFrontendEnvironmentConfig } from "@/config/env";

const { apiBaseUrl } = getFrontendEnvironmentConfig();
const store = getDefaultStore();

interface ErrorPayload {
  readonly error?: string;
  readonly message?: string;
  readonly kind?: string;
}

export class HttpError extends Error {
  readonly status: number;
  readonly kind?: string;

  constructor(message: string, status: number, kind?: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.kind = kind;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  auth?: boolean;
}

function createHeaders(options: RequestOptions): Headers {
  const headers = new Headers(options.headers);
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (options.auth) {
    const token = store.get(tokenAtom);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  return headers;
}

function normalizeErrorPayload(body: unknown): ErrorPayload {
  if (typeof body !== "object" || body === null) {
    return {};
  }

  const record = body as Record<string, unknown>;
  return {
    error: typeof record.error === "string" ? record.error : undefined,
    message: typeof record.message === "string" ? record.message : undefined,
    kind: typeof record.kind === "string" ? record.kind : undefined,
  };
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed with status ${String(response.status)}`;
    let kind: string | undefined;
    try {
      const errorBody = normalizeErrorPayload((await response.json()) as unknown);
      const candidate = errorBody.message ?? errorBody.error;
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        message = candidate;
      }
      kind = errorBody.kind;
    } catch {
      // Ignore JSON parsing failures for error responses.
    }
    throw new HttpError(message, response.status, kind);
  }

  return (await response.json()) as T;
}

export async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: createHeaders(options),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  return parseJsonResponse<T>(response);
}

export function isUnauthorizedError(error: unknown): error is HttpError {
  return error instanceof HttpError && error.status === 401;
}
