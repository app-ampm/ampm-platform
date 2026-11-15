import { errors } from "@ampm/core";

import { fireEvent, renderWithProviders, screen } from "../../test/render";
import { MobileOtpSignIn } from "./mobile-otp-sign-in";

const mockReplace = jest.fn();
const mockClear = jest.fn();
const mockSetAccessToken = jest.fn();

type Mutation = { mutate: jest.Mock; reset: jest.Mock; isPending: boolean; error: unknown };

const mockRequest: Mutation = {
  mutate: jest.fn((_body: unknown, opts?: { onSuccess?: (result: unknown) => void }) =>
    opts?.onSuccess?.({ demoCode: "123456", expiresInSeconds: 300 }),
  ),
  reset: jest.fn(),
  isPending: false,
  error: null,
};
const mockVerify: Mutation = {
  mutate: jest.fn((_body: unknown, opts?: { onSuccess?: (result: unknown) => void }) =>
    opts?.onSuccess?.({
      accessToken: "tok-123",
      user: { id: "client-1", name: "Rhea Client", email: "client@example.com" },
    }),
  ),
  reset: jest.fn(),
  isPending: false,
  error: null,
};
const mockCreate: Mutation = {
  mutate: jest.fn((_body: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.()),
  reset: jest.fn(),
  isPending: false,
  error: null,
};

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
}));
jest.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ clear: mockClear }) }));
jest.mock("@ampm/api-client", () => ({
  useRequestDevOtp: () => mockRequest,
  useVerifyDevOtp: () => mockVerify,
  useCreateDemoClient: () => mockCreate,
}));
jest.mock("@/lib/session", () => ({
  setAccessToken: (token: string | null) => mockSetAccessToken(token),
}));

const MOBILE = "98765 43210";

async function typeMobile(value: string) {
  await fireEvent.changeText(screen.getByPlaceholderText(MOBILE), value);
}

describe("MobileOtpSignIn", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest.error = null;
    mockCreate.error = null;
  });

  it("opens on Sign in: the switch, the mobile with +91, no code yet", async () => {
    await renderWithProviders(<MobileOtpSignIn />);
    expect(screen.getByRole("tab", { name: "Sign in", selected: true })).toBeOnTheScreen();
    expect(screen.getByText("+91")).toBeOnTheScreen();
    expect(screen.queryByPlaceholderText("e.g. Aditi Sharma")).toBeNull();
    expect(screen.queryByText("123456")).toBeNull();
  });

  it("signs in: sends a code, shows it on screen with the number, then verifies", async () => {
    await renderWithProviders(<MobileOtpSignIn />);
    await typeMobile("9876543210");
    await fireEvent.press(screen.getByRole("button", { name: "Send code" }));

    expect(mockRequest.mutate).toHaveBeenCalledWith({ phone: "9876543210" }, expect.anything());
    expect(screen.getByText("Signing in")).toBeOnTheScreen();
    expect(screen.getByText("+91 98765 43210")).toBeOnTheScreen();
    // The one-time code is shown on screen (no SMS yet).
    expect(screen.getByText("123456")).toBeOnTheScreen();
    expect(
      screen.getByText("Demo only: no SMS is sent. It expires in 5 minutes."),
    ).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText("Verification code"), "654321");
    expect(mockVerify.mutate).toHaveBeenCalledWith(
      { phone: "9876543210", code: "654321" },
      expect.anything(),
    );
    expect(mockSetAccessToken).toHaveBeenCalledWith("tok-123");
    expect(mockReplace).toHaveBeenCalledWith("/");
    // The query cache is cleared so a new principal never sees the previous one's cached data.
    expect(mockClear).toHaveBeenCalled();
  });

  it("fills in the shown code on tap, which signs in once", async () => {
    await renderWithProviders(<MobileOtpSignIn />);
    await typeMobile("9876543210");
    await fireEvent.press(screen.getByRole("button", { name: "Send code" }));
    await fireEvent.press(screen.getByRole("button", { name: "Use this code" }));

    expect(screen.getByLabelText("Verification code").props.value).toBe("123456");
    expect(mockVerify.mutate).toHaveBeenCalledTimes(1);
    expect(mockVerify.mutate).toHaveBeenCalledWith(
      { phone: "9876543210", code: "123456" },
      expect.anything(),
    );
  });

  it("signs up: a name first, then the mobile; creates the client and shows its code", async () => {
    await renderWithProviders(<MobileOtpSignIn />);
    await fireEvent.press(screen.getByRole("tab", { name: "Sign up" }));
    // The name field comes before the mobile (queries return the tree's order).
    const [name, mobile] = screen.getAllByPlaceholderText(/^(e\.g\. Aditi Sharma|98765 43210)$/);
    expect(name?.props.placeholder).toBe("e.g. Aditi Sharma");
    expect(mobile?.props.placeholder).toBe(MOBILE);
    expect(screen.getByRole("button", { name: "Sign up" })).toBeDisabled();

    await fireEvent.changeText(screen.getByPlaceholderText("e.g. Aditi Sharma"), " Aditi Sharma ");
    await typeMobile("9876500010");
    await fireEvent.press(screen.getByRole("button", { name: "Sign up" }));

    expect(mockCreate.mutate).toHaveBeenCalledWith(
      { name: "Aditi Sharma", phone: "9876500010" },
      expect.anything(),
    );
    expect(mockRequest.mutate).toHaveBeenCalledWith({ phone: "9876500010" }, expect.anything());
    expect(screen.getByText("Account created for Aditi Sharma")).toBeOnTheScreen();
    expect(screen.getByText("123456")).toBeOnTheScreen();
  });

  it("offers Sign up for a number no client uses, keeping the number", async () => {
    mockRequest.error = errors.notFound();
    await renderWithProviders(<MobileOtpSignIn />);
    await typeMobile("9000000999");
    expect(screen.getByText("No client uses this number yet.")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Sign up instead" }));
    expect(screen.getByRole("tab", { name: "Sign up", selected: true })).toBeOnTheScreen();
    expect(screen.getByPlaceholderText(MOBILE).props.value).toBe("9000000999");
    expect(mockRequest.reset).toHaveBeenCalled();
  });

  it("offers Sign in for a number a client already uses", async () => {
    mockCreate.error = errors.conflict("A client already uses that mobile number");
    await renderWithProviders(<MobileOtpSignIn />);
    await fireEvent.press(screen.getByRole("tab", { name: "Sign up" }));
    expect(screen.getByText("A client already uses this number.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Sign in instead" }));
    expect(screen.getByRole("tab", { name: "Sign in", selected: true })).toBeOnTheScreen();
  });

  it("asks for a 10-digit mobile before sending anything", async () => {
    await renderWithProviders(<MobileOtpSignIn />);
    await typeMobile("12345");
    await fireEvent.press(screen.getByRole("button", { name: "Send code" }));
    expect(screen.getByText("Enter a 10-digit mobile number")).toBeOnTheScreen();
    expect(mockRequest.mutate).not.toHaveBeenCalled();
  });

  it("goes back with Change, keeping the number, and sends a new code on request", async () => {
    await renderWithProviders(<MobileOtpSignIn />);
    await typeMobile("9876543210");
    await fireEvent.press(screen.getByRole("button", { name: "Send code" }));
    await fireEvent.press(screen.getByRole("button", { name: "Send a new code" }));
    expect(mockRequest.mutate).toHaveBeenCalledTimes(2);

    await fireEvent.press(screen.getByRole("button", { name: "Change" }));
    expect(screen.queryByText("123456")).toBeNull();
    expect(screen.getByPlaceholderText(MOBILE).props.value).toBe("9876543210");
  });
});
