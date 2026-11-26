import {
  AppError,
  errors,
  isApiFailure,
  MAX_RETRY_AFTER_SECONDS,
  type ApiEnvelope,
  type ErrorCode,
} from "@ampm/core";
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
  /**
   * Send no Bearer token: for the sign-in calls, which act as nobody yet. A held token is stale by then,
   * and on the test box `/_api/auth/dev-login*` sits behind the site's Basic-Auth, where an explicit
   * Bearer header replaces the browser's password: Apache logs each try as a failed login and fail2ban
   * bans the IP after five.
   *
   *   api.request("/auth/dev-login", { method: "POST", body, schema: devLoginResponse, anonymous: true })
   */
  readonly anonymous?: boolean | undefined;
  /**
   * Send this Bearer instead of the session's: activation presents a provider access token that is not
   * yet the app's session, since the invitee has no linked account until activation succeeds. Ignored on
   * an `anonymous` request.
   *
   *   api.request("/auth/activate", { method: "POST", body, schema: activateResponse, accessToken })
   */
  readonly accessToken?: string | undefined;
  /**
   * Ask the browser to finish the request even if the page goes meanwhile (fetch's `keepalive`): a save
   * made as the page is hidden or closed. The browser takes at most 64 KiB of such bodies at once, so the
   * caller sends it only for a body that fits.
   *
   *   api.request(path, { method: "PUT", body, schema, accessToken, keepalive: true })
   */
  readonly keepalive?: boolean | undefined;
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
  /**
   * Resolve a signed media URL — or a minted document link (`/documents/links/…`, D-132) — to an absolute
   * one against the API base. The API signs media downloads as a root-relative `/media/blob?…` (feature
   * 9.3); where the API is reached under a prefix — the test box serves
   * it at `/_api` — an `<Image>` must load it from the API base, not the app's own origin, or the browser
   * fetches the SPA shell instead of the picture. A relative URL (starts with `/`) is prefixed with the base;
   * an absolute URL (an S3/CDN link, feature 6.4) and an empty value pass through unchanged.
   */
  mediaUrl(url: string | null | undefined): string | null;
}

const DELAY_SECONDS = /^\d+$/;

/** The words of a failure whose answer had no envelope to read: the client can only name the status. */
const unwordedFailureMessage = (status: number): string => `Request failed (${status})`;
const UNWORDED_FAILURE = /^Request failed \(\d{3}\)$/;

/**
 * Whether a failure is one the API never worded: its answer had no envelope to read (a proxy's or a
 * gateway's own page, such as Plesk's HTML 403), so the error carries only the status, never words for a
 * person. A page words such a failure itself.
 *
 * @example
 * if (isUnwordedFailure(error)) showNotice(COPY.errors.unexpected);
 */
export function isUnwordedFailure(error: { readonly message: string }): boolean {
  return UNWORDED_FAILURE.test(error.message);
}

/**
 * A `Retry-After` header as whole seconds from `now` (RFC 9110 §10.2.3): delay-seconds as they stand, an
 * HTTP date as the seconds until it (0 once it is past), either cut to a day (`MAX_RETRY_AFTER_SECONDS`) so
 * a page never counts down longer. Undefined without the header or when it reads as neither. The API sends
 * delay-seconds (D-189 §3); a proxy in front of it may send a date.
 *
 * @example
 * retryAfterSecondsOf("30"); // 30
 * retryAfterSecondsOf(null); // undefined
 */
export function retryAfterSecondsOf(
  header: string | null,
  now: number = Date.now(),
): number | undefined {
  const value = header?.trim() ?? "";
  const atMostADay = (seconds: number): number => Math.min(seconds, MAX_RETRY_AFTER_SECONDS);
  if (DELAY_SECONDS.test(value)) return atMostADay(Number.parseInt(value, 10));
  // A bare number that is not delay-seconds ("-5", "1.5") is malformed, never a date.
  if (value === "" || /^[\d.+-]+$/.test(value)) return undefined;
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : atMostADay(Math.max(0, Math.ceil((at - now) / 1000)));
}

/**
 * The one way the apps talk to the API (api.md): the envelope is unwrapped, failures become
 * `AppError` with the API's code (and the seconds of its `Retry-After`, when it sends one, as
 * `retryAfterSeconds`), a network failure becomes `network_error`, and every success is validated
 * against the shared schema.
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const doFetch = options.fetch ?? fetch;
  const base = options.baseUrl.replace(/\/+$/, "");

  async function authHeaders(
    extra: Record<string, string>,
    anonymous = false,
    accessToken?: string,
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = { accept: "application/json", ...extra };
    if (anonymous) return headers;
    const token = accessToken ?? (options.getAccessToken ? await options.getAccessToken() : null);
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
        failure?.message ?? unwordedFailureMessage(response.status),
        failure?.details,
        undefined,
        retryAfterSecondsOf(response.headers.get("retry-after")),
      );
    }
    return schema.parse(envelope.data);
  }

  async function request<T>(
    path: string,
    {
      method = "GET",
      body,
      schema,
      signal,
      anonymous = false,
      accessToken,
      keepalive,
    }: RequestOptions<T>,
  ): Promise<T> {
    const headers = await authHeaders(
      body === undefined ? {} : { "content-type": "application/json" },
      anonymous,
      accessToken,
    );
    return run(
      path,
      {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        ...(signal ? { signal } : {}),
        ...(keepalive ? { keepalive: true } : {}),
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

  function mediaUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    // Root-relative (`/media/blob…`) resolves against the API base; an absolute URL — including a
    // protocol-relative `//host/…` (an S3/CDN link, feature 6.4) — is already loadable and passes through.
    return url.startsWith("/") && !url.startsWith("//") ? `${base}${url}` : url;
  }

  return {
    request,
    get: (path, schema, signal) => request(path, { schema, signal }),
    upload,
    mediaUrl,
  };
}
