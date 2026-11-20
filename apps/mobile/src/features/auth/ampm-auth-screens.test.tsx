import { ACTIVATION_ERRORS, SIGN_IN_ERRORS } from "@ampm/core";

import { fireEvent, renderWithProviders, screen } from "../../test/render";
import { AmpmActivateScreen } from "./ampm-activate-screen";
import { AmpmSignInScreen } from "./ampm-sign-in-screen";
import { ForgotPasswordScreen } from "./forgot-password-screen";
import { ResetPasswordScreen } from "./reset-password-screen";
import type { StaffSignIn } from "./staff-sign-in.types";
import type { AmpmActivation } from "./use-ampm-activation";

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, back: jest.fn() }),
}));
jest.mock("react-native-qrcode-svg", () => () => null);

const mockSession: { current: StaffSignIn | null } = { current: null };
jest.mock("./use-ampm-sign-in", () => ({ useAmpmSignIn: () => mockSession.current }));

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
    confirmEnrollment: jest.fn(),
    toggleRecoveryCode: jest.fn(),
    submitRecoveryCode: jest.fn(),
    finish: jest.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.preview = { isPending: false, isError: false, error: null, data: undefined };
  mockApi.reset = { ...mockApi.reset, isSuccess: false, isError: false, error: null };
});

describe("AMPM's own staff sign-in screen", () => {
  it("offers a forgotten-password link on the first step", async () => {
    mockSession.current = session({});
    await renderWithProviders(<AmpmSignInScreen />);
    await fireEvent.press(screen.getByText("Forgot password?"));
    expect(mockPush).toHaveBeenCalledWith("/forgot-password");
  });

  it("offers a recovery code in place of the authenticator code", async () => {
    const toggleRecoveryCode = jest.fn();
    mockSession.current = session({ phase: { kind: "totpCode" }, toggleRecoveryCode });
    await renderWithProviders(<AmpmSignInScreen />);
    await fireEvent.press(screen.getByText("Use a recovery code instead"));
    expect(toggleRecoveryCode).toHaveBeenCalled();
  });

  it("shows the recovery codes once and leaves them only when they are saved", async () => {
    const finish = jest.fn();
    const codes = Array.from({ length: 10 }, (_, i) => `ABCD${i}-EFGHJ`);
    mockSession.current = session({ phase: { kind: "recoveryCodes", codes }, finish });
    await renderWithProviders(<AmpmSignInScreen />);
    for (const code of codes) expect(screen.getByText(code)).toBeTruthy();
    await fireEvent.press(screen.getByText("I’ve saved them"));
    expect(finish).toHaveBeenCalled();
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

  it("tells a client their activation is not available yet", async () => {
    mockApi.preview = {
      ...mockApi.preview,
      data: { name: "Cara", email: "cara@ampm.example", userType: "client" },
    };
    mockActivation.current = activation({ kind: "password" });
    await renderWithProviders(<AmpmActivateScreen inviteToken="invite" />);
    expect(screen.getByText(SIGN_IN_ERRORS.clientActivationUnavailable)).toBeTruthy();
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
