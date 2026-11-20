import { ACTIVATION_ERRORS, SIGN_IN_ERRORS } from "@ampm/core";

import { fireEvent, renderWithProviders, screen } from "../../test/render";
import { AmpmActivateScreen } from "./ampm-activate-screen";
import { AmpmSignInScreen } from "./ampm-sign-in-screen";
import { ForgotPasswordScreen } from "./forgot-password-screen";
import { ResetPasswordScreen } from "./reset-password-screen";
import type { StaffSignIn } from "./staff-sign-in.types";
import type { AmpmActivation } from "./use-ampm-activation";
import type { AmpmClientSignIn } from "./use-ampm-client-sign-in";

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, back: jest.fn() }),
}));
jest.mock("react-native-qrcode-svg", () => () => null);

const mockSession: { current: StaffSignIn | null } = { current: null };
jest.mock("./use-ampm-sign-in", () => ({ useAmpmSignIn: () => mockSession.current }));

// The client card's own flow runs against a fake API in ampm-client-sign-in.test.tsx; here it is a
// model, so these tests are about the screen around it.
const mockClient: { current: AmpmClientSignIn | null } = { current: null };
jest.mock("./use-ampm-client-sign-in", () => ({ useAmpmClientSignIn: () => mockClient.current }));

const mockActivation: { current: AmpmActivation | null } = { current: null };
jest.mock("./use-ampm-activation", () => ({ useAmpmActivation: () => mockActivation.current }));

const mockApi = {
  preview: {
    isPending: false,
    isError: false,
    error: null as Error | null,
    data: undefined as unknown,
  },
  forgot: { mutate: jest.fn(), isSuccess: false, isPending: false, isError: false, error: null },
  reset: {
    mutate: jest.fn(),
    isSuccess: false,
    isPending: false,
    isError: false,
    error: null as Error | null,
  },
};
jest.mock("@ampm/api-client", () => ({
  useInvitationPreview: () => mockApi.preview,
  useForgotPassword: () => mockApi.forgot,
  useResetPassword: () => mockApi.reset,
}));

function session(overrides: Partial<StaffSignIn>): StaffSignIn {
  return {
    phase: { kind: "credentials" },
    pending: false,
    error: undefined,
    email: "",
    setEmail: jest.fn(),
    signIn: jest.fn(),
    submitChallenge: jest.fn(),
    toggleRecoveryCode: jest.fn(),
    submitRecoveryCode: jest.fn(),
    ...overrides,
  };
}

function clientSignIn(overrides: Partial<AmpmClientSignIn>): AmpmClientSignIn {
  return {
    phone: "",
    setPhone: jest.fn(),
    canSend: false,
    sendCode: jest.fn(),
    sent: null,
    formError: undefined,
    code: "",
    setCode: jest.fn(),
    confirm: jest.fn(),
    resend: jest.fn(),
    change: jest.fn(),
    verifying: false,
    sending: false,
    codeError: undefined,
    sendError: undefined,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.current = clientSignIn({});
  mockApi.preview = { isPending: false, isError: false, error: null, data: undefined };
  mockApi.reset = { ...mockApi.reset, isSuccess: false, isError: false, error: null };
});

/** A className's classes, matched whole. */
const classes = (value: unknown): readonly string[] =>
  typeof value === "string" ? value.split(/\s+/) : [];

/** The screen opens on the client card; the staff screen is one tap away. */
async function openTeamSignIn() {
  await renderWithProviders(<AmpmSignInScreen />);
  await fireEvent.press(screen.getByRole("button", { name: "AMPM team sign-in" }));
}

describe("AMPM's own sign-in screen: client and team", () => {
  it("opens on the client card, with the team's sign-in under it and the way back", async () => {
    mockSession.current = session({});
    await renderWithProviders(<AmpmSignInScreen />);
    expect(screen.getByRole("header", { name: "Sign in with your mobile" })).toBeOnTheScreen();
    expect(screen.getByText("Sign in with your mobile and a one-time code.")).toBeOnTheScreen();
    expect(screen.queryByText("Work email")).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "AMPM team sign-in" }));
    expect(screen.getByText("Work email")).toBeOnTheScreen();
    expect(screen.queryByRole("header", { name: "Sign in with your mobile" })).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "Client sign-in" }));
    expect(screen.getByRole("header", { name: "Sign in with your mobile" })).toBeOnTheScreen();
  });

  it("keeps one gold action, Send code; the switch is a text button that says where it goes", async () => {
    mockSession.current = session({});
    mockClient.current = clientSignIn({ phone: "9876543210", canSend: true });
    await renderWithProviders(<AmpmSignInScreen />);
    const gold = screen
      .getAllByRole("button")
      .filter((button) => classes(button.props.className).includes("bg-brand"));
    expect(gold.map((button) => button.props.accessibilityLabel)).toEqual(["Send code"]);
    expect(screen.getByRole("button", { name: "AMPM team sign-in" }).props.accessibilityHint).toBe(
      "Sign in with your work email, password and authenticator",
    );
  });

  it("leaves the switch off the client's code step, which has Change", async () => {
    mockSession.current = session({});
    mockClient.current = clientSignIn({
      phone: "9876543210",
      sent: { expiresInSeconds: 300, resendAfterSeconds: 30 },
    });
    await renderWithProviders(<AmpmSignInScreen />);
    expect(screen.getByRole("button", { name: "Change" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "AMPM team sign-in" })).toBeNull();
  });

  it("leaves the way back off the staff's code step", async () => {
    mockSession.current = session({ phase: { kind: "totpCode" } });
    await openTeamSignIn();
    expect(screen.getByLabelText("Authenticator code")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Client sign-in" })).toBeNull();
  });
});

describe("AMPM's own staff sign-in screen", () => {
  it("offers a forgotten-password link on the first step", async () => {
    mockSession.current = session({});
    await openTeamSignIn();
    await fireEvent.press(screen.getByText("Forgot password?"));
    expect(mockPush).toHaveBeenCalledWith("/forgot-password");
  });

  it("offers a recovery code in place of the authenticator code", async () => {
    const toggleRecoveryCode = jest.fn();
    mockSession.current = session({ phase: { kind: "totpCode" }, toggleRecoveryCode });
    await openTeamSignIn();
    await fireEvent.press(screen.getByText("Use a recovery code instead"));
    expect(toggleRecoveryCode).toHaveBeenCalled();
  });
});

describe("AMPM's own activation screen", () => {
  const activation = (phase: AmpmActivation["phase"]): AmpmActivation => ({
    phase,
    pending: false,
    error: undefined,
    setPassword: jest.fn(),
    confirmCode: jest.fn(),
    finish: jest.fn(),
  });

  it("greets a staff invitation and asks for a password", async () => {
    mockApi.preview = {
      ...mockApi.preview,
      data: { name: "Sana", email: "sana@ampm.example", userType: "staff" },
    };
    mockActivation.current = activation({ kind: "password" });
    await renderWithProviders(<AmpmActivateScreen inviteToken="invite" />);
    expect(
      screen.getByText("Welcome, Sana. Choose a password for sana@ampm.example."),
    ).toBeTruthy();
    expect(screen.getByText("Continue")).toBeTruthy();
  });

  it("sends an already-active account to sign-in", async () => {
    mockApi.preview = {
      ...mockApi.preview,
      isError: true,
      error: new Error(ACTIVATION_ERRORS.alreadyActive),
    };
    mockActivation.current = activation({ kind: "password" });
    await renderWithProviders(<AmpmActivateScreen inviteToken="invite" />);
    await fireEvent.press(screen.getByText("Go to sign-in"));
    expect(mockReplace).toHaveBeenCalledWith("/sign-in");
  });

  it("shows the recovery codes once and enters the app only when they are saved", async () => {
    mockApi.preview = {
      ...mockApi.preview,
      data: { name: "Sana", email: "sana@ampm.example", userType: "staff" },
    };
    const codes = Array.from({ length: 10 }, (_, i) => `ABCD${i}-EFGHJ`);
    const ready = activation({ kind: "recoveryCodes", codes });
    mockActivation.current = ready;
    await renderWithProviders(<AmpmActivateScreen inviteToken="invite" />);
    for (const code of codes) expect(screen.getByText(code)).toBeTruthy();
    await fireEvent.press(screen.getByText("I’ve saved them"));
    expect(ready.finish).toHaveBeenCalled();
  });

  it("explains an incomplete link", async () => {
    mockActivation.current = activation({ kind: "password" });
    await renderWithProviders(<AmpmActivateScreen inviteToken={undefined} />);
    expect(screen.getByText(/This invitation link is incomplete/)).toBeTruthy();
  });
});

describe("password recovery screens", () => {
  it("asks for the work email and sends the reset request", async () => {
    await renderWithProviders(<ForgotPasswordScreen />);
    await fireEvent.changeText(screen.getByLabelText("Work email"), " sana@ampm.example ");
    await fireEvent.press(screen.getByText("Email me a link"));
    expect(mockApi.forgot.mutate).toHaveBeenCalledWith({ email: "sana@ampm.example" });
  });

  it("offers a new link when the reset link has expired", async () => {
    mockApi.reset = {
      ...mockApi.reset,
      isError: true,
      error: new Error(SIGN_IN_ERRORS.invalidResetLink),
    };
    await renderWithProviders(<ResetPasswordScreen token="reset" />);
    await fireEvent.press(screen.getByText("Send me a new link"));
    expect(mockReplace).toHaveBeenCalledWith("/forgot-password");
  });

  it("confirms a changed password and points to sign-in", async () => {
    mockApi.reset = { ...mockApi.reset, isSuccess: true };
    await renderWithProviders(<ResetPasswordScreen token="reset" />);
    expect(screen.getByText(/Your password is changed/)).toBeTruthy();
  });
});
