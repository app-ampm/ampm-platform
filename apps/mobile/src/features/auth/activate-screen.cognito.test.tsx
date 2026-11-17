import { ACTIVATION_ERRORS, AppError } from "@ampm/core";

import { fireEvent, renderWithProviders, screen, within } from "../../test/render";
import { ActivateScreen } from "./activate-screen";

const mockReplace = jest.fn();
const mockSetAccessToken = jest.fn();
const mockExchange = jest.fn();
const mockActivate = jest.fn();
const mockSession = { signedIn: false };

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
}));
jest.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ clear: jest.fn() }) }));
jest.mock("@ampm/api-client", () => ({
  useDevInviteSignIn: () => ({ mutateAsync: mockExchange }),
  useActivate: () => ({ mutateAsync: mockActivate }),
}));
// Under Cognito the invitee signs in to the pool first, and that session is the provider token.
jest.mock("@/lib/env", () => ({ env: { EXPO_PUBLIC_IDENTITY_PROVIDER: "cognito" } }));
jest.mock("@/lib/session", () => ({
  setAccessToken: (token: string | null) => mockSetAccessToken(token),
  useIsSignedIn: () => mockSession.signedIn,
}));

const INVITE = "inv-1";
const outcome = () => within(screen.getByTestId("activation-outcome"));

describe("ActivateScreen (Cognito)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.signedIn = false;
    mockActivate.mockResolvedValue({ userId: "u-1", status: "active" });
  });

  it("asks a signed-out invitee to sign in first, with no way to activate yet", async () => {
    await renderWithProviders(<ActivateScreen inviteToken={INVITE} />);
    expect(outcome().getByText("Sign in first")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Activate account" })).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Go to sign in" }));
    expect(mockReplace).toHaveBeenCalledWith("/sign-in");
  });

  it("activates with the session's token and never takes the local stand-in", async () => {
    mockSession.signedIn = true;
    await renderWithProviders(<ActivateScreen inviteToken={INVITE} />);
    await fireEvent.press(screen.getByRole("button", { name: "Activate account" }));

    expect(mockExchange).not.toHaveBeenCalled();
    expect(mockActivate).toHaveBeenCalledWith({ token: INVITE, accessToken: undefined });
    // The session is Amplify's: there is no local token to store.
    expect(mockSetAccessToken).not.toHaveBeenCalled();
    expect(outcome().getByText("Your account is active")).toBeOnTheScreen();
  });

  it("explains a sign-in whose email is not the invitation's", async () => {
    mockSession.signedIn = true;
    mockActivate.mockRejectedValue(
      new AppError("forbidden", "The sign-in email must match the invitation"),
    );
    await renderWithProviders(<ActivateScreen inviteToken={INVITE} />);
    await fireEvent.press(screen.getByRole("button", { name: "Activate account" }));
    expect(
      screen.getByRole("alert", { name: "This invitation is for another email" }),
    ).toBeOnTheScreen();
  });

  it("still says when the link has expired", async () => {
    mockSession.signedIn = true;
    mockActivate.mockRejectedValue(
      new AppError("unauthenticated", ACTIVATION_ERRORS.invalidInvite),
    );
    await renderWithProviders(<ActivateScreen inviteToken={INVITE} />);
    await fireEvent.press(screen.getByRole("button", { name: "Activate account" }));
    expect(outcome().getByText("This link has expired or was already used")).toBeOnTheScreen();
  });
});
