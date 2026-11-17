import { AccessibilityInfo } from "react-native";

import { ACTIVATION_ERRORS, AppError } from "@ampm/core";

import { fireEvent, renderWithProviders, screen, within } from "../../test/render";
import { ActivateScreen } from "./activate-screen";

const mockReplace = jest.fn();
const mockClear = jest.fn();
const mockSetAccessToken = jest.fn();
const mockExchange = jest.fn();
const mockActivate = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
}));
jest.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ clear: mockClear }) }));
jest.mock("@ampm/api-client", () => ({
  useDevInviteSignIn: () => ({ mutateAsync: mockExchange }),
  useActivate: () => ({ mutateAsync: mockActivate }),
}));
// The test box's provider: the invitation link stands in for the provider sign-in.
jest.mock("@/lib/env", () => ({ env: { EXPO_PUBLIC_IDENTITY_PROVIDER: "local" } }));
jest.mock("@/lib/session", () => ({
  setAccessToken: (token: string | null) => mockSetAccessToken(token),
  useIsSignedIn: () => false,
}));

const INVITE = "inv-1";
const MINTED = { accessToken: "tok-ira", user: { id: "u-1", name: "Ira", email: "ira@x.test" } };

/** A promise the test settles when it chooses, to see the screen while a request is in flight. */
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

const activateButton = () => screen.getByRole("button", { name: "Activate account" });
const outcome = () => within(screen.getByTestId("activation-outcome"));

describe("ActivateScreen (local provider)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExchange.mockResolvedValue(MINTED);
    mockActivate.mockResolvedValue({ userId: "u-1", status: "active" });
  });

  it("opens on the invitation: the welcome, the card's title and the one gold action", async () => {
    await renderWithProviders(<ActivateScreen inviteToken={INVITE} />);
    expect(screen.getByRole("header", { name: "Welcome aboard." })).toBeOnTheScreen();
    const card = within(screen.getByTestId("activate-card"));
    expect(card.getByText("Activate your account")).toBeOnTheScreen();
    expect(card.getByRole("button", { name: "Activate account" })).toBeEnabled();
    expect(mockExchange).not.toHaveBeenCalled();
  });

  it("activates with the token the link stands in for, signs the account in, then continues", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibilityWithOptions");
    await renderWithProviders(<ActivateScreen inviteToken={INVITE} />);
    await fireEvent.press(activateButton());

    expect(mockExchange).toHaveBeenCalledWith({ token: INVITE });
    expect(mockActivate).toHaveBeenCalledWith({ token: INVITE, accessToken: "tok-ira" });
    // The minted token is now the activated account's session, and nothing cached from before stays.
    expect(mockSetAccessToken).toHaveBeenCalledWith("tok-ira");
    expect(mockClear).toHaveBeenCalled();
    expect(outcome().getByText("Your account is active")).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith(expect.stringContaining("Your account is active"), {
      queue: true,
    });
    expect(screen.queryByRole("button", { name: "Activate account" })).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("shows the request in flight and ignores a second press", async () => {
    const exchange = deferred<typeof MINTED>();
    mockExchange.mockReturnValue(exchange.promise);
    await renderWithProviders(<ActivateScreen inviteToken={INVITE} />);
    await fireEvent.press(activateButton());
    expect(activateButton()).toBeBusy();
    expect(activateButton()).toBeDisabled();
    await fireEvent.press(activateButton());
    expect(mockExchange).toHaveBeenCalledTimes(1);

    exchange.resolve(MINTED);
    expect(await screen.findByText("Your account is active")).toBeOnTheScreen();
  });

  it("says when the link has expired or was used, and sends the person to sign-in", async () => {
    mockExchange.mockRejectedValue(
      new AppError("unauthenticated", ACTIVATION_ERRORS.invalidInvite),
    );
    await renderWithProviders(<ActivateScreen inviteToken={INVITE} />);
    await fireEvent.press(activateButton());

    expect(outcome().getByText("This link has expired or was already used")).toBeOnTheScreen();
    expect(mockActivate).not.toHaveBeenCalled();
    expect(mockSetAccessToken).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Go to sign in" }));
    expect(mockReplace).toHaveBeenCalledWith("/sign-in");
  });

  it("treats an invitation claimed by a racing activation as used, and holds no session", async () => {
    mockActivate.mockRejectedValue(new AppError("conflict", ACTIVATION_ERRORS.inviteUsed));
    await renderWithProviders(<ActivateScreen inviteToken={INVITE} />);
    await fireEvent.press(activateButton());

    expect(outcome().getByText("This link has expired or was already used")).toBeOnTheScreen();
    // The minted token never became the session: activation did not link it.
    expect(mockSetAccessToken).not.toHaveBeenCalled();
  });

  it("tells an account that is already active to sign in", async () => {
    mockExchange.mockRejectedValue(new AppError("conflict", ACTIVATION_ERRORS.alreadyActive));
    await renderWithProviders(<ActivateScreen inviteToken={INVITE} />);
    await fireEvent.press(activateButton());

    expect(outcome().getByText("Your account is already active")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Go to sign in" })).toBeOnTheScreen();
  });

  it("keeps the action after a failure that can be tried again, and succeeds on retry", async () => {
    mockExchange.mockRejectedValueOnce(new AppError("network_error", "Could not reach the server"));
    await renderWithProviders(<ActivateScreen inviteToken={INVITE} />);
    await fireEvent.press(activateButton());

    // A friendly reason, never the raw message, announced as an alert.
    expect(screen.getByRole("alert", { name: "We couldn't reach AMPM" })).toBeOnTheScreen();
    expect(screen.queryByText("Could not reach the server")).toBeNull();
    await fireEvent.press(activateButton());
    expect(await screen.findByText("Your account is active")).toBeOnTheScreen();
    expect(screen.queryByText("We couldn't reach AMPM")).toBeNull();
  });

  it("asks to wait after too many tries", async () => {
    mockExchange.mockRejectedValue(new AppError("rate_limited", "Too many requests"));
    await renderWithProviders(<ActivateScreen inviteToken={INVITE} />);
    await fireEvent.press(activateButton());
    expect(screen.getByText("Too many tries")).toBeOnTheScreen();
    expect(activateButton()).toBeEnabled();
  });

  it("says a link without a token is incomplete, and offers sign-in instead of activating", async () => {
    await renderWithProviders(<ActivateScreen inviteToken={undefined} />);
    expect(outcome().getByText("This link is incomplete")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Activate account" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Go to sign in" }));
    expect(mockReplace).toHaveBeenCalledWith("/sign-in");
    expect(mockExchange).not.toHaveBeenCalled();
  });
});
