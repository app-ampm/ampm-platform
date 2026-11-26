// @vitest-environment jsdom
import { act } from "react";
import {
  ApiProvider,
  createQueryClient,
  useRequestHotelFormCorrection,
  useWithdrawHotelFormConsent,
} from "@ampm/api-client";
import { hotelFormSessionError } from "@ampm/core";
import { mount, type Mounted } from "@ampm/web-forms/testing";
import type { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DRAFT } from "./draft.test-fixtures";
import { ME, ON_SCREEN } from "./screen.test-utils";
import { useHotelFormFlow, type HotelFormFlow } from "./use-hotel-form-flow";

/*
 * Nothing personal stays in the form's query client once the person leaves (D-190 §5, review fix C3):
 * after sign-out, and after "Remove my details". The flow runs for real against a fake API; what is checked is everything the
 * query client holds: every query's data, and every call's variables and answer. Synthetic people only.
 */

const SECRET = `hfl_${"q".repeat(43)}`;
const SESSION = `hfs_${"w".repeat(43)}`;
const NAME = "Synthetic Asha Rao";
const MOBILE = "+91 70000 04321";
const MESSAGE = "Synthetic correction: the lawn seats 900, not 600.";

/** The person as the API answers them, under the claim's name. */
const VERIFIED = { ...ME, person: { ...ME.person, fullName: NAME } };
/** The draft, naming the person among the people helping. */
const NAMED_DRAFT = {
  ...DRAFT,
  contributors: [{ fullName: NAME, designation: "General Manager", isYou: true }],
};

/** What the fake API answers each route with; sign-out answers 401 once every consent is withdrawn. */
const api = { signOutStatus: 200 };

function answerOf(method: string, path: string): { status: number; body: unknown } {
  const ok = (data: unknown) => ({ status: 200, body: { data } });
  if (path === "/hotel-form/open")
    return ok({ state: "ready", expiresAt: DRAFT.request.expiresAt, helpContact: null });
  if (path === "/hotel-form/codes") return ok(ON_SCREEN);
  if (path === "/hotel-form/codes/verify") return ok({ ...VERIFIED, sessionToken: SESSION });
  if (path === "/hotel-form/me") return ok(VERIFIED);
  if (path === "/hotel-form/draft") return ok(NAMED_DRAFT);
  if (path === "/hotel-form/corrections") return ok({ ok: true });
  if (path === "/hotel-form/consent-withdrawal")
    return ok({ withdrawn: ["privacy_notice", "display_authorisation"], removalRequested: true });
  if (path === "/hotel-form/sign-out" && api.signOutStatus === 200) return ok({ ok: true });
  const ended = hotelFormSessionError("session_ended");
  const error = { code: ended.code, message: ended.message, details: ended.details };
  return { status: method === "POST" ? 401 : 404, body: { error } };
}

const fakeFetch: typeof fetch = async (input, init) => {
  const path = new URL(String(input)).pathname;
  const { status, body } = answerOf(init?.method ?? "GET", path);
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
};

/** What the page holds of the flow, and the status page's two calls, on every render. */
let page: {
  flow: HotelFormFlow;
  correction: ReturnType<typeof useRequestHotelFormCorrection>;
  withdrawal: ReturnType<typeof useWithdrawHotelFormConsent>;
} | null = null;

function Harness() {
  page = {
    flow: useHotelFormFlow(),
    correction: useRequestHotelFormCorrection(),
    withdrawal: useWithdrawHotelFormConsent(),
  };
  return null;
}

let mounted: Mounted | null = null;
let client: QueryClient;

beforeEach(() => {
  api.signOutStatus = 200;
  window.sessionStorage.clear();
  window.history.replaceState(null, "", `/hotel-form#k=${SECRET}`);
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  page = null;
});

/** Lets the fake API answer and the page take each answer in. */
async function settle(): Promise<void> {
  for (let turn = 0; turn < 5; turn += 1) await act(async () => undefined);
}

/** Lets the page take answers in until `isDone`, which the test expects to come. */
async function settleUntil(isDone: () => boolean): Promise<void> {
  for (let turn = 0; turn < 50 && !isDone(); turn += 1)
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  if (!isDone()) throw new Error("The page never got there");
}

const flow = (): HotelFormFlow => {
  if (page === null) throw new Error("The page is not mounted");
  return page.flow;
};

/** Opens the link, asks for a code with the claim, enters it, and lets the draft and `me` load. */
async function signIn(): Promise<void> {
  client = createQueryClient({ retryRateLimited: false });
  mounted = await mount(
    <ApiProvider baseUrl="https://api.example.test" fetch={fakeFetch} queryClient={client}>
      <Harness />
    </ApiProvider>,
  );
  await settleUntil(() => flow().state.phase.kind === "welcome");
  await act(async () => flow().start());
  const claim = {
    fullName: NAME,
    designationChoice: "General Manager",
    designationOther: "",
    mobile: MOBILE,
    noticeAccepted: true,
  };
  await act(async () => flow().changeClaim(claim));
  await act(async () => flow().sendCode({ token: "bot-pass", reset: () => undefined }));
  await settleUntil(() => flow().state.phase.kind === "identity" && !flow().isSendingCode);
  await act(async () => flow().changeCode("482917"));
  await act(async () => flow().verifyCode());
  await settleUntil(() => flow().draft.data !== undefined && flow().me.data !== undefined);
  expect(flow().state.session).toBe(SESSION);
  expect(flow().draft.data?.contributors[0]?.fullName).toBe(NAME);
}

/** Everything the query client holds: every query's data, and every call's variables and answer. */
function held(): string {
  return JSON.stringify([
    client
      .getQueryCache()
      .getAll()
      .map((query) => query.state.data),
    client
      .getMutationCache()
      .getAll()
      .map((call) => [call.state.variables, call.state.data]),
  ]);
}

const PERSONAL = [NAME, "70000", "04321", SECRET, SESSION, MESSAGE];

function expectNothingPersonal(): void {
  const left = held();
  for (const value of PERSONAL) expect(left, value).not.toContain(value);
}

describe("the form's query client once the person leaves", () => {
  it("holds the claim, the person and the draft while signed in", async () => {
    await signIn();
    const signedIn = held();
    for (const value of [NAME, "04321", SECRET, SESSION]) expect(signedIn).toContain(value);
  });

  it("holds nothing personal after sign-out", async () => {
    await signIn();
    await act(async () => flow().signOut());
    await settle();
    expect(flow().state.phase.kind).toBe("welcome");
    expectNothingPersonal();
  });

  it("holds nothing personal after Remove my details, a correction sent before included", async () => {
    await signIn();
    const correction = { message: MESSAGE, botToken: "bot-pass" };
    await act(async () => {
      await page?.correction.mutateAsync({ sessionToken: SESSION, correction });
    });
    expect(held()).toContain(MESSAGE);
    const withdrawal = { kind: "all", requestRemoval: true } as const;
    await act(async () => {
      await page?.withdrawal.mutateAsync({ sessionToken: SESSION, withdrawal });
    });
    api.signOutStatus = 401;
    await act(async () => flow().signOut());
    await settle();
    expectNothingPersonal();
  });
});
