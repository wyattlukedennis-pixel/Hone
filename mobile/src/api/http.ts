import { env } from "../env";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

type ApiErrorPayload = {
  error?: string;
  message?: string;
};

type RequestOptions = {
  method?: HttpMethod;
  token?: string;
  body?: unknown;
};

async function parseApiError(response: Response) {
  let payload: ApiErrorPayload | null = null;
  try {
    payload = (await response.json()) as ApiErrorPayload;
  } catch {
    payload = null;
  }
  return payload?.error ?? payload?.message ?? `HTTP_${response.status}`;
}

export async function requestJson<T>(path: string, options: RequestOptions = {}) {
  const candidates = env.apiBaseUrlCandidates.length ? env.apiBaseUrlCandidates : [env.apiBaseUrl];
  const headers: Record<string, string> = {};
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  for (const baseUrl of candidates) {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method: options.method ?? "GET",
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined
      });
    } catch {
      continue;
    }

    if (!response.ok) {
      throw new Error(await parseApiError(response));
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  throw new Error(`Network request failed (${candidates.join(" | ")})`);
}
