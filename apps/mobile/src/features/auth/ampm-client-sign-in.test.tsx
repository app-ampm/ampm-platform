import { SIGN_IN_ERRORS } from "@ampm/core";

import { act, fireEvent, screen, waitFor } from "../../test/render";
import { AmpmSignInScreen } from "./ampm-sign-in-screen";
import {
  authFetch,
  createTestQueryClient,
  GRANT,
  neverAnswers,
  ok,
  refused,
  renderWithApi,
} from "./auth.test-utils";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
}));
const mockSetAccessToken = jest.fn();
jest.mock("@/lib/session", () => ({
  setAccessToken: (token: string | null) => mockSetAccessToken(token),
}));

const MOBILE = "98765 43210";
const PHONE = "+919876543210";
/** A code sent while SMS delivery is not live: the API returns it for the screen too. */
const SHOWN = { expiresInSeconds: 300, resendAfterSeconds: 30, screenCode: "482917" };
/** A code sent by SMS alone. */
const SMS_ONLY = { expiresInSeconds: 300, resendAfterSeconds: 30 };

/** The real screen, hooks and API client, against the fake API; the cache's clear is watched. */
async function renderScreen(api: ReturnType<typeof authFetch>) {
  const queryClient = createTestQueryClient();
  const clear = jest.spyOn(queryClient, "clear");
  await renderWithApi(<AmpmSignInScreen />, api.fetch, { queryClient });
  return { clear };
}

async function sendCode(mobile = MOBILE) {
  await fireEvent.changeText(screen.getByPlaceholderText(MOBILE), mobile);
  await fireEvent.press(screen.getByRole("button", { name: "Send code" }));
}

beforeEach(() => jest.clearAllMocks());

describe("AMPM's own client sign-in (D-147)", () => {
  it("sends a code to the mobile, shows it while SMS is not live, and signs in with it", async () => {
    const api = authFetch({
      "/auth/client/code": () => ok(SHOWN),
      "/auth/client/sign-in": () => ok(GRANT),
    });
    const { clear } = await renderScreen(api);
    await sendCode();

    expect(await screen.findByText(`We sent a 6-digit code to +91 ${MOBILE}`)).toBeOnTheScreen();
    expect(api.calls).toEqual([{ path: "/auth/client/code", body: { phone: PHONE } }]);
    expect(screen.getByText("482917")).toBeOnTheScreen();
    expect(
      screen.getByText(
        "Sent by SMS too, and shown here while SMS delivery isn't live yet. It expires in 5 minutes.",
      ),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Use this code" }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"));
    expect(api.calls.slice(1)).toEqual([
      { path: "/auth/client/sign-in", body: { phone: PHONE, code: "482917" } },
    ]);
    expect(mockSetAccessToken).toHaveBeenCalledWith("client-token");
    expect(clear).toHaveBeenCalled();
  });

  it("with SMS live, says where the code went and takes the code typed in", async () => {
    const api = authFetch({
      "/auth/client/code": () => ok(SMS_ONLY),
      "/auth/client/sign-in": () => ok(GRANT),
    });
    await renderScreen(api);
    await sendCode();

    expect(await screen.findByText(`We sent a 6-digit code to +91 ${MOBILE}`)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Use this code" })).toBeNull();
    expect(screen.getByText("The code expires in 5 minutes.")).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText("Verification code"), "135790");
    await waitFor(() => expect(mockSetAccessToken).toHaveBeenCalledWith("client-token"));
    expect(api.calls[1]).toEqual({
      path: "/auth/client/sign-in",
      body: { phone: PHONE, code: "135790" },
    });
  });

  it("says on the form when a code was asked for too soon", async () => {
    const api = authFetch({
      "/auth/client/code": () => refused("rate_limited", SIGN_IN_ERRORS.clientCodeTooSoon, 429),
    });
    await renderScreen(api);
    await sendCode();
    expect(await screen.findByText(SIGN_IN_ERRORS.clientCodeTooSoon)).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Send code" })).toBeOnTheScreen();
  });

  it("says under Send a new code when another code is refused, keeping the step", async () => {
    let asked = 0;
    const api = authFetch({
      "/auth/client/code": () =>
        asked++ === 0
          ? ok({ ...SMS_ONLY, resendAfterSeconds: 0 })
          : refused("rate_limited", SIGN_IN_ERRORS.clientCodeLimit, 429),
    });
    await renderScreen(api);
    await sendCode();
    await fireEvent.press(await screen.findByRole("button", { name: "Send a new code" }));
    expect(await screen.findByText(SIGN_IN_ERRORS.clientCodeLimit)).toBeOnTheScreen();
    expect(screen.getByLabelText("Verification code")).toBeOnTheScreen();
  });

  it("shows a wrong code under the boxes and starts no session", async () => {
    const api = authFetch({
      "/auth/client/code": () => ok(SMS_ONLY),
      "/auth/client/sign-in": () =>
        refused("unauthenticated", SIGN_IN_ERRORS.invalidClientCode, 401),
    });
    await renderScreen(api);
    await sendCode();
    await fireEvent.changeText(await screen.findByLabelText("Verification code"), "111111");
    expect(await screen.findByText(SIGN_IN_ERRORS.invalidClientCode)).toBeOnTheScreen();
    expect(mockSetAccessToken).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("marks Send code busy while the code is on its way", async () => {
    await renderScreen(authFetch({ "/auth/client/code": neverAnswers }));
    await sendCode();
    await waitFor(() => expect(screen.getByRole("button", { name: "Send code" })).toBeBusy());
  });

  it("marks Verify busy while the code is checked, holding Change and resend meanwhile", async () => {
    const api = authFetch({
      "/auth/client/code": () => ok({ ...SMS_ONLY, resendAfterSeconds: 0 }),
      "/auth/client/sign-in": neverAnswers,
    });
    await renderScreen(api);
    await sendCode();
    await fireEvent.changeText(await screen.findByLabelText("Verification code"), "135790");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Verify and sign in" })).toBeBusy(),
    );
    expect(screen.getByRole("button", { name: "Change" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send a new code" })).toBeDisabled();
  });

  it("asks for a 10-digit mobile before sending anything", async () => {
    const api = authFetch({});
    await renderScreen(api);
    await sendCode("12345");
    expect(screen.getByText("Enter a 10-digit mobile number")).toBeOnTheScreen();
    expect(api.calls).toEqual([]);
  });

  it("goes back with Change, keeping the number", async () => {
    const api = authFetch({ "/auth/client/code": () => ok(SHOWN) });
    await renderScreen(api);
    await sendCode();
    await fireEvent.press(await screen.findByRole("button", { name: "Change" }));
    expect(screen.queryByText("482917")).toBeNull();
    expect(screen.getByPlaceholderText(MOBILE).props.value).toBe(MOBILE);
  });

  it("switches to the team's sign-in and back, keeping the typed number", async () => {
    await renderScreen(authFetch({}));
    await fireEvent.changeText(screen.getByPlaceholderText(MOBILE), MOBILE);
    await fireEvent.press(screen.getByRole("button", { name: "AMPM team sign-in" }));
    expect(screen.getByText("Sign in with your work email and password.")).toBeOnTheScreen();
    expect(screen.getByLabelText("Work email")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Client sign-in" }));
    expect(screen.getByPlaceholderText(MOBILE).props.value).toBe(MOBILE);
  });
});

describe("AMPM's own client sign-in: the wait before another code", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("holds Send a new code back for the API's wait, then sends another and waits again", async () => {
    const api = authFetch({ "/auth/client/code": () => ok(SMS_ONLY) });
    await renderScreen(api);
    await sendCode();

    const waiting = await screen.findByRole("button", { name: "Send a new code in 30 seconds" });
    expect(waiting).toBeDisabled();
    expect(screen.getByText("Send a new code in 0:30")).toBeOnTheScreen();

    await act(() => jest.advanceTimersByTime(30_000));
    const ready = screen.getByRole("button", { name: "Send a new code" });
    expect(ready).toBeEnabled();
    await fireEvent.press(ready);

    expect(await screen.findByText("Send a new code in 0:30")).toBeOnTheScreen();
    expect(api.calls.map((call) => call.path)).toEqual(["/auth/client/code", "/auth/client/code"]);
  });
});
