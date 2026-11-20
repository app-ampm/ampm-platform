import { ACTIVATION_ERRORS, SIGN_IN_ERRORS } from "@ampm/core";

import { fireEvent, screen, waitFor } from "../../test/render";
import { AmpmActivateScreen } from "./ampm-activate-screen";
import { authFetch, GRANT, ok, refused, renderWithApi } from "./auth.test-utils";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
}));
const mockSetAccessToken = jest.fn();
jest.mock("@/lib/session", () => ({
  setAccessToken: (token: string | null) => mockSetAccessToken(token),
}));

const TOKEN = "invite-token";
const CLIENT_INVITE = { name: "Cara", email: "cara@example.com", userType: "client" };
const STAFF_INVITE = { name: "Sana", email: "sana@ampm.example", userType: "staff" };
/** The activation code went to the mobile on file; SMS is not live, so it comes back for the screen. */
const CODE_SENT = {
  expiresInSeconds: 300,
  resendAfterSeconds: 30,
  screenCode: "482917",
  maskedPhone: "+91 ••••• •3210",
};

type Routes = Parameters<typeof authFetch>[0];

/** A client invitation whose code is sent and accepted; `routes` override any of the three. */
function activationApi(routes: Routes = {}) {
  return authFetch({
    "/auth/activation/preview": () => ok(CLIENT_INVITE),
    "/auth/activation/client/code": () => ok(CODE_SENT),
    "/auth/activation/client/confirm": () => ok(GRANT),
    ...routes,
  });
}

async function openInvitation(api: ReturnType<typeof authFetch>) {
  await renderWithApi(<AmpmActivateScreen inviteToken={TOKEN} />, api.fetch);
}

/** Opens the client invitation and asks for the code; resolves once the code step shows. */
async function sendActivationCode(api: ReturnType<typeof authFetch>) {
  await openInvitation(api);
  await fireEvent.press(await screen.findByRole("button", { name: "Send my code" }));
}

beforeEach(() => jest.clearAllMocks());

describe("activating a client invitation (D-147)", () => {
  it("greets the client, sends the code to the mobile on file, and activates with it", async () => {
    const api = activationApi();
    await openInvitation(api);
    expect(await screen.findByText("Welcome, Cara.")).toBeOnTheScreen();
    expect(
      screen.getByText(
        "You've been invited to AMPM. Confirm your mobile with a one-time code, and you're in.",
      ),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Send my code" }));
    const sentTo = await screen.findByText("We sent a 6-digit code to +91 ••••• •3210");
    expect(sentTo.props.accessibilityLabel).toBe(
      "We sent a 6-digit code to your mobile number ending in 3210",
    );
    expect(api.calls[1]).toEqual({ path: "/auth/activation/client/code", body: { token: TOKEN } });
    // The number is the one on file: there is nothing to change.
    expect(screen.queryByRole("button", { name: "Change" })).toBeNull();
    expect(screen.getByRole("button", { name: "Verify and activate" })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Use this code" }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"));
    expect(api.calls[2]).toEqual({
      path: "/auth/activation/client/confirm",
      body: { token: TOKEN, code: "482917" },
    });
    expect(mockSetAccessToken).toHaveBeenCalledWith("client-token");
    // A client saves no recovery codes: the session starts at once.
    expect(screen.queryByText("I’ve saved them")).toBeNull();
  });

  it("says so when the account has no mobile on file, with no code left to ask for", async () => {
    const api = activationApi({
      "/auth/activation/client/code": () => refused("conflict", SIGN_IN_ERRORS.noMobileOnFile, 409),
    });
    await sendActivationCode(api);
    expect(await screen.findByText(SIGN_IN_ERRORS.noMobileOnFile)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Send my code" })).toBeNull();
  });

  it("says so when another client account already has the mobile, with no code left to ask for", async () => {
    const api = activationApi({
      "/auth/activation/client/code": () => refused("conflict", SIGN_IN_ERRORS.mobileInUse, 409),
    });
    await sendActivationCode(api);
    expect(await screen.findByText(SIGN_IN_ERRORS.mobileInUse)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Send my code" })).toBeNull();
  });

  it("says why a code could not be sent yet, under the button, and lets the client try again", async () => {
    const api = activationApi({
      "/auth/activation/client/code": () =>
        refused("rate_limited", SIGN_IN_ERRORS.clientCodeTooSoon, 429),
    });
    await sendActivationCode(api);
    expect(await screen.findByText(SIGN_IN_ERRORS.clientCodeTooSoon)).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Send my code" })).toBeEnabled();
  });

  it("shows a wrong code under the boxes and starts no session", async () => {
    const api = activationApi({
      "/auth/activation/client/confirm": () =>
        refused("unauthenticated", SIGN_IN_ERRORS.invalidClientCode, 401),
    });
    await sendActivationCode(api);
    await fireEvent.changeText(await screen.findByLabelText("Verification code"), "111111");
    expect(await screen.findByText(SIGN_IN_ERRORS.invalidClientCode)).toBeOnTheScreen();
    expect(mockSetAccessToken).not.toHaveBeenCalled();
  });

  it("sends an account activated meanwhile to sign-in", async () => {
    const api = activationApi({
      "/auth/activation/client/confirm": () =>
        refused("conflict", ACTIVATION_ERRORS.alreadyActive, 409),
    });
    await sendActivationCode(api);
    await fireEvent.changeText(await screen.findByLabelText("Verification code"), "482917");
    await fireEvent.press(await screen.findByRole("button", { name: "Go to sign-in" }));
    expect(mockReplace).toHaveBeenCalledWith("/sign-in");
  });
});

describe("activating a staff invitation", () => {
  it("still asks for a password, with the staff's words and no code", async () => {
    const api = authFetch({ "/auth/activation/preview": () => ok(STAFF_INVITE) });
    await openInvitation(api);
    expect(
      await screen.findByText("Welcome, Sana. Choose a password for sana@ampm.example."),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        "You've been invited to AMPM. Set your password and authenticator, and you're in.",
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Continue" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Send my code" })).toBeNull();
    expect(api.calls.map((call) => call.path)).toEqual(["/auth/activation/preview"]);
  });
});
