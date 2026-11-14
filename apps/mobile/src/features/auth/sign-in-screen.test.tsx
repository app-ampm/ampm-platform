import type { ReactNode } from "react";

import { fireEvent, renderWithProviders, screen } from "../../test/render";
import { SignInScreen } from "./sign-in-screen";

const mockReplace = jest.fn();
const mockClear = jest.fn();
const mockSetAccessToken = jest.fn();

/** A mutation that never resolves — the OTP/email hooks are present but not exercised by this test. */
const mockIdle = {
  mutate: jest.fn(),
  reset: jest.fn(),
  isPending: false,
  isError: false,
  error: null,
};

const mockDemo = {
  mutate: jest.fn((_body: unknown, opts?: { onSuccess?: (result: unknown) => void }) =>
    opts?.onSuccess?.({
      accessToken: "demo-tok",
      user: { id: "demo-1", name: "Dev Demo", email: "demo@example.com" },
    }),
  ),
  isPending: false,
  isError: false,
  error: null,
};

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
  // The gallery <Link> renders through expo-router's Link (asChild); a passthrough stub is enough here.
  Link: ({ children }: { readonly children: ReactNode }) => children,
}));
jest.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ clear: mockClear }) }));
jest.mock("@ampm/api-client", () => ({
  useDevLogin: () => mockIdle,
  useDemoSignIn: () => mockDemo,
  useRequestDevOtp: () => mockIdle,
  useVerifyDevOtp: () => mockIdle,
  useCreateDemoClient: () => mockIdle,
}));
jest.mock("@/lib/session", () => ({
  setAccessToken: (token: string | null) => mockSetAccessToken(token),
}));

describe("SignInScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("offers the demo entry and signs the demo prospect in on tap", async () => {
    await renderWithProviders(<SignInScreen />);
    const enter = screen.getByRole("button", { name: "Explore the demo" });
    expect(enter).toBeTruthy();

    await fireEvent.press(enter);

    expect(mockDemo.mutate).toHaveBeenCalled();
    expect(mockSetAccessToken).toHaveBeenCalledWith("demo-tok");
    expect(mockReplace).toHaveBeenCalledWith("/");
    // The cache is cleared so the demo never sees a previous principal's cached data.
    expect(mockClear).toHaveBeenCalled();
  });
});
