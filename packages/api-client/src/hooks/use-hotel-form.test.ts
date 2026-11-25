import type * as ReactQuery from "@tanstack/react-query";
import { QueryClient } from "@tanstack/react-query";
import {
  HOTEL_FORM_NOTICE_VERSION,
  hotelFormSessionRefusalOf,
  isAppError,
  type HotelFormMe,
} from "@ampm/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "../client";
import {
  HOTEL_FORM_ME_QUERY_KEY,
  hotelFormCalls,
  hotelFormMeQueryOptions,
  useOpenHotelForm,
  useRequestHotelFormCode,
  useSignOutOfHotelForm,
  useUpdateHotelFormMe,
  useVerifyHotelFormCode,
} from "./use-hotel-form";

/* The hotel form's six routes (D-189 §4, §5): who is sent as the caller, and what is read back. */

interface Sent {
  readonly url: string;
  readonly method: string | undefined;
  readonly headers: Record<string, string>;
  readonly body: unknown;
}

/** What the API answers next, and every request the client made. */
const wire = vi.hoisted(() => ({
  sent: [] as Sent[],
  status: 200,
  answer: null as unknown,
  headers: {} as Record<string, string>,
}));

/** The options each hook handed to React Query, and the cache they write to. */
const hooks = vi.hoisted(() => ({
  options: [] as { mutationFn: (variables: never) => Promise<unknown>; onSuccess?: unknown }[],
}));
const cache = new QueryClient();

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactQuery>()),
  useMutation: (options: (typeof hooks.options)[number]) => {
    hooks.options.push(options);
    return options;
  },
  useQueryClient: () => cache,
}));

const fakeFetch: typeof fetch = async (input, init) => {
  wire.sent.push({
    url: String(input),
    method: init?.method,
    headers: { ...(init?.headers as Record<string, string>) },
    body: typeof init?.body === "string" ? JSON.parse(init.body) : init?.body,
  });
  const envelope = wire.status < 400 ? { data: wire.answer } : wire.answer;
  return new Response(JSON.stringify(envelope), {
    status: wire.status,
    headers: { "content-type": "application/json", ...wire.headers },
  });
};

/** The client the site builds, beside a staff session it must never send. */
const api = createApiClient({
  baseUrl: "https://api.example.test/_api",
  getAccessToken: () => "staff-session-token",
  fetch: fakeFetch,
});

vi.mock("../provider", () => ({ useApiClient: () => api }));

const SESSION = `hfs_${"A".repeat(43)}`;
const CHALLENGE = "0192f3a0-7d3e-7b1a-9c2f-123456789abc";
const ME: HotelFormMe = {
  person: { fullName: "Asha Rao", designation: "General Manager" },
  request: {
    displayLabel: "Seasonal refresh",
    staffNote: null,
    status: "open",
    expiresAt: "2026-12-25T10:00:00.000Z",
  },
};

function answer(data: unknown, status = 200, headers: Record<string, string> = {}): void {
  wire.answer = data;
  wire.status = status;
  wire.headers = headers;
}

const calls = hotelFormCalls(api);

beforeEach(() => {
  wire.sent.length = 0;
  hooks.options.length = 0;
  cache.clear();
  answer(null);
});

describe("the identity routes, before any session", () => {
  it("opens the link anonymously, the secret in the POST body only", async () => {
    answer({ state: "ready", expiresAt: "2026-12-25T10:00:00.000Z", helpContact: null });
    await expect(calls.open({ token: "hfl_secret" })).resolves.toMatchObject({ state: "ready" });
    expect(wire.sent).toEqual([
      expect.objectContaining({
        url: "https://api.example.test/_api/hotel-form/open",
        method: "POST",
        body: { token: "hfl_secret" },
      }),
    ]);
    expect(wire.sent[0]?.headers["authorization"]).toBeUndefined();
  });

  it("asks for a code and enters it anonymously", async () => {
    answer({
      challengeId: CHALLENGE,
      maskedMobile: "+91 ••••• •1234",
      expiresAt: "2026-11-25T10:05:00.000Z",
      resendAfter: "2026-11-25T10:00:30.000Z",
      delivery: "screen",
      code: "482917",
    });
    const claim = {
      token: "hfl_secret",
      fullName: "Asha Rao",
      designation: "General Manager",
      mobile: "+917000001234",
      noticeVersion: HOTEL_FORM_NOTICE_VERSION,
      botToken: "dev-bot-check",
    };
    await expect(calls.requestCode(claim)).resolves.toMatchObject({ code: "482917" });
    answer({ ...ME, sessionToken: SESSION });
    await calls.verify({ token: "hfl_secret", challengeId: CHALLENGE, oneTimeCode: "482917" });
    expect(wire.sent.map((sent) => [sent.method, sent.url.split("/_api")[1]])).toEqual([
      ["POST", "/hotel-form/codes"],
      ["POST", "/hotel-form/codes/verify"],
    ]);
    expect(wire.sent.every((sent) => sent.headers["authorization"] === undefined)).toBe(true);
  });

  it("refuses an answer that carries more than the contract, such as a code by SMS", async () => {
    answer({ state: "ready", expiresAt: null, helpContact: null, hotelName: "Not for the form" });
    await expect(calls.open({ token: "hfl_secret" })).rejects.toThrow();
    answer({
      challengeId: CHALLENGE,
      maskedMobile: "+91 ••••• •1234",
      expiresAt: "2026-11-25T10:05:00.000Z",
      resendAfter: "2026-11-25T10:00:30.000Z",
      delivery: "sms",
      code: "482917",
    });
    await expect(
      calls.requestCode({
        token: "t",
        fullName: "A",
        designation: "General Manager",
        mobile: "+917000001234",
        noticeVersion: HOTEL_FORM_NOTICE_VERSION,
      }),
    ).rejects.toThrow();
  });

  it("hands a 429's Retry-After to the page as seconds", async () => {
    answer({ error: { code: "rate_limited", message: "Please wait a few seconds." } }, 429, {
      "retry-after": "27",
    });
    const error = await calls.open({ token: "hfl_secret" }).catch((caught: unknown) => caught);
    expect(isAppError(error) && error.retryAfterSeconds).toBe(27);
  });
});

describe("the session routes", () => {
  it("send the form session as the Bearer, never the staff session", async () => {
    answer(ME);
    await calls.me(SESSION);
    await calls.updateMe({ sessionToken: SESSION, change: { designation: "Director of Sales" } });
    answer({ ok: true });
    await calls.signOut({ sessionToken: SESSION });
    expect(wire.sent.map((sent) => [sent.method, sent.url.split("/_api")[1]])).toEqual([
      ["GET", "/hotel-form/me"],
      ["PATCH", "/hotel-form/me"],
      ["POST", "/hotel-form/sign-out"],
    ]);
    expect(wire.sent.map((sent) => sent.headers["authorization"])).toEqual([
      `Bearer ${SESSION}`,
      `Bearer ${SESSION}`,
      `Bearer ${SESSION}`,
    ]);
    expect(wire.sent[1]?.body).toEqual({ designation: "Director of Sales" });
  });

  it("refuse a sign-out answer with anything but its one field", async () => {
    answer({ ok: true, sessionsLeft: 2 });
    await expect(calls.signOut({ sessionToken: SESSION })).rejects.toThrow();
  });

  it("raise a session refusal the page can read the reason of", async () => {
    answer(
      {
        error: {
          code: "unauthenticated",
          message: "Your session timed out. Enter a new code to continue.",
          details: [{ path: "reason", message: "session_expired" }],
        },
      },
      401,
    );
    const error = await calls.me(SESSION).catch((caught: unknown) => caught);
    expect(isAppError(error) && hotelFormSessionRefusalOf(error)).toBe("session_expired");
  });

  it("read `me` only while there is a session, keyed apart from the staff `me`", async () => {
    expect(hotelFormMeQueryOptions(api, null).enabled).toBe(false);
    const options = hotelFormMeQueryOptions(api, SESSION);
    expect(options.queryKey).toEqual(HOTEL_FORM_ME_QUERY_KEY);
    expect(options.queryKey).not.toEqual(["me"]);
    answer(ME);
    await expect(new QueryClient().fetchQuery(options)).resolves.toEqual(ME);
    expect(wire.sent[0]?.headers["authorization"]).toBe(`Bearer ${SESSION}`);
  });
});

describe("the hooks", () => {
  it("call the routes, keeping the session token out of the query cache", async () => {
    useOpenHotelForm();
    useRequestHotelFormCode();
    useVerifyHotelFormCode();
    useUpdateHotelFormMe();
    useSignOutOfHotelForm();
    expect(hooks.options).toHaveLength(5);
    const verify = hooks.options[2];
    answer({ ...ME, sessionToken: SESSION });
    const verified = await verify?.mutationFn({
      token: "hfl_secret",
      challengeId: CHALLENGE,
      oneTimeCode: "482917",
    } as never);
    expect(verified).toMatchObject({ sessionToken: SESSION });
    (verify?.onSuccess as (data: unknown) => void)(verified);
    expect(cache.getQueryData(HOTEL_FORM_ME_QUERY_KEY)).toEqual(ME);
  });

  it("keep the saved details as `me`, and forget `me` once signed out", async () => {
    useUpdateHotelFormMe();
    useSignOutOfHotelForm();
    const [update, signOut] = hooks.options;
    const changed = { ...ME, person: { ...ME.person, designation: "Director of Sales" } };
    (update?.onSuccess as (data: unknown) => void)(changed);
    expect(cache.getQueryData(HOTEL_FORM_ME_QUERY_KEY)).toEqual(changed);
    const settled = (signOut as unknown as { onSettled: () => void }).onSettled;
    settled();
    expect(cache.getQueryData(HOTEL_FORM_ME_QUERY_KEY)).toBeUndefined();
  });
});
