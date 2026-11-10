import { AppError, errors, isApiFailure, type ApiEnvelope, type ErrorCode } from "@ampm/core";
import type { ZodType } from "zod";

export interface ApiClientOptions {
  readonly baseUrl: string;
  /** The current access token, or null when signed out. */
  readonly getAccessToken?: (() => Promise<string | null> | string | null) | undefined;
  readonly fetch?: typeof fetch | undefined;
}

export interface RequestOptions<T> {
  readonly method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | undefined;
  readonly body?: unknown;
  /** The response schema from @ampm/core; the data is parsed through it, never trusted raw. */
  readonly schema: ZodType<T>;
  readonly signal?: AbortSignal | undefined;
}

export interface UploadOptions<T> {
  /** The raw bytes to send (a File/Blob on web, or an ArrayBuffer/Uint8Array). */
  readonly body: BodyInit;
  /** The content type to send them as; for the media upload path this is `application/octet-stream`. */
  readonly contentType: string;
  /** The response schema; the upload still returns the API's `{ data }` envelope. */
  readonly schema: ZodType<T>;
  readonly signal?: AbortSignal | undefined;
}

export interface ApiClient {
  request<T>(path: string, options: RequestOptions<T>): Promise<T>;
  get<T>(path: string, schema: ZodType<T>, signal?: AbortSignal): Promise<T>;
  /**
   * POST raw bytes at a chosen content type (the media byte-upload path, AC-20), keeping the Bearer auth
   * and the `{ data }` envelope response. Unlike {@link request} it does not JSON-encode the body.
   */
  upload<T>(path: string, options: UploadOptions<T>): Promise<T>;
}

/**
 * The one way the apps talk to the API (api.md): the envelope is unwrapped, failures become
 * `AppError` with the API's code, a network failure becomes `network_error`, and every success is
 * validated against the shared schema.
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const doFetch = options.fetch ?? fetch;
  const base = options.baseUrl.replace(/\/+$/, "");

  async function authHeaders(extra: Record<string, string>): Promise<Record<string, string>> {
    const token = options.getAccessToken ? await options.getAccessToken() : null;
    const headers: Record<string, string> = { accept: "application/json", ...extra };
    if (token) headers["authorization"] = `Bearer ${token}`;
    return headers;
  }

  /** Fetch, unwrap the envelope, map a failure to AppError, and validate the data against the schema. */
  async function run<T>(path: string, init: RequestInit, schema: ZodType<T>): Promise<T> {
    let response: Response;
    try {
      response = await doFetch(`${base}${path}`, init);
    } catch {
      throw errors.network();
    }
    const envelope = (await response.json().catch(() => null)) as ApiEnvelope<unknown> | null;
    if (!response.ok || envelope === null || isApiFailure(envelope)) {
      const failure = envelope && isApiFailure(envelope) ? envelope.error : null;
      const code: ErrorCode =
        failure?.code ?? (response.status >= 500 ? "internal" : "validation_failed");
      throw new AppError(
        code,
        failure?.message ?? `Request failed (${response.status})`,
        failure?.details,
      );
    }
    return schema.parse(envelope.data);
  }

  async function request<T>(
    path: string,
    { method = "GET", body, schema, signal }: RequestOptions<T>,
  ): Promise<T> {
    const headers = await authHeaders(
      body === undefined ? {} : { "content-type": "application/json" },
    );
    return run(
      path,
      {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        ...(signal ? { signal } : {}),
      },
      schema,
    );
  }

  async function upload<T>(
    path: string,
    { body, contentType, schema, signal }: UploadOptions<T>,
  ): Promise<T> {
    const headers = await authHeaders({ "content-type": contentType });
    return run(path, { method: "POST", headers, body, ...(signal ? { signal } : {}) }, schema);
  }

  return {
    request,
    get: (path, schema, signal) => request(path, { schema, signal }),
    upload,
  };
}
