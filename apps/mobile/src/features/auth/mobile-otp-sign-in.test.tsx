import { fireEvent, renderWithProviders, screen } from "../../test/render";
import { MobileOtpSignIn } from "./mobile-otp-sign-in";

const mockReplace = jest.fn();
const mockClear = jest.fn();
const mockSetAccessToken = jest.fn();

const mockRequest = {
  mutate: jest.fn((_body: unknown, opts?: { onSuccess?: (result: unknown) => void }) =>
    opts?.onSuccess?.({ demoCode: "123456", expiresInSeconds: 300 }),
  ),
  isPending: false,
  isError: false,
  error: null,
};
const mockVerify = {
  mutate: jest.fn((_body: unknown, opts?: { onSuccess?: (result: unknown) => void }) =>
    opts?.onSuccess?.({
      accessToken: "tok-123",
      user: { id: "client-1", name: "Rhea Client", email: "client@example.com" },
    }),
  ),
  reset: jest.fn(),
  isPending: false,
  isError: false,
  error: null,
};
const mockCreate = {
  mutate: jest.fn((_body: unknown, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.()),
  isPending: false,
  isError: false,
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

describe("MobileOtpSignIn", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("starts on the mobile-number step with no code shown", async () => {
    await renderWithProviders(<MobileOtpSignIn />);
    expect(screen.getByPlaceholderText("98765 43210")).toBeTruthy();
    expect(screen.queryByText("123456")).toBeNull();
  });

  it("shows the demo code after requesting it, then verifies and signs in", async () => {
    await renderWithProviders(<MobileOtpSignIn />);

    await fireEvent.changeText(screen.getByPlaceholderText("98765 43210"), "9876543210");
    await fireEvent.press(screen.getByText("Send code"));

    expect(mockRequest.mutate).toHaveBeenCalledWith({ phone: "9876543210" }, expect.anything());
    // The one-time code is shown on screen (no SMS yet), under the boxes.
    expect(screen.getByText("123456")).toBeTruthy();

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

  it("creates a new client from a name + mobile, then sends and shows its first code", async () => {
    await renderWithProviders(<MobileOtpSignIn />);

    await fireEvent.changeText(screen.getByPlaceholderText("98765 43210"), "9876500010");
    await fireEvent.changeText(screen.getByPlaceholderText("e.g. Aditi Sharma"), "Aditi Sharma");
    await fireEvent.press(screen.getByText("Create client & send code"));

    // The client is created from the typed name + mobile (trimmed)...
    expect(mockCreate.mutate).toHaveBeenCalledWith(
      { name: "Aditi Sharma", phone: "9876500010" },
      expect.anything(),
    );
    // ...and its first OTP is then requested and shown on screen.
    expect(mockRequest.mutate).toHaveBeenCalledWith({ phone: "9876500010" }, expect.anything());
    expect(screen.getByText("123456")).toBeTruthy();
  });
});
