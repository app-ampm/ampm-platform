import type * as ReactModule from "react";
import type { ReactNode } from "react";

import { act, fireEvent, renderWithProviders, screen, within } from "../../test/render";
import { SignInScreen } from "./sign-in-screen";

const mockReplace = jest.fn();
const mockClear = jest.fn();
const mockSetAccessToken = jest.fn();
const mockDevLogin = {
  mutate: jest.fn((_body: unknown, opts?: { onSuccess?: (result: unknown) => void }) =>
    opts?.onSuccess?.({ accessToken: "tok-staff" }),
  ),
  isPending: false,
  isError: false,
  error: null,
};
const mockRequestOtp = {
  mutate: jest.fn((_body: unknown, opts?: { onSuccess?: (result: unknown) => void }) =>
    opts?.onSuccess?.({ demoCode: "123456", expiresInSeconds: 300 }),
  ),
  isPending: false,
  isError: false,
  error: null,
};
const mockVerifyOtp = {
  mutate: jest.fn(),
  reset: jest.fn(),
  isPending: false,
  isError: false,
  error: null,
};

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
  // The shared Link renders Expo Router's with `asChild`: the pressable it wraps is what shows.
  Link: ({ children }: { readonly children: ReactNode }) => children,
}));
jest.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ clear: mockClear }) }));
jest.mock("@ampm/api-client", () => ({
  useDevLogin: () => mockDevLogin,
  useRequestDevOtp: () => mockRequestOtp,
  useVerifyDevOtp: () => mockVerifyOtp,
}));
jest.mock("@/lib/session", () => ({
  setAccessToken: (token: string | null) => mockSetAccessToken(token),
}));

// The window's width picks the arrangement: P1 below 768, one card to 1023, D1's split from 1024.
const mockWindow = { width: 1440, listeners: new Set<() => void>() };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => {
  const react = jest.requireActual<typeof ReactModule>("react");
  const subscribe = (listener: () => void) => {
    mockWindow.listeners.add(listener);
    return () => mockWindow.listeners.delete(listener);
  };
  return {
    __esModule: true,
    default: function useMockWindowDimensions() {
      const width = react.useSyncExternalStore(subscribe, () => mockWindow.width);
      return { width, height: 900, scale: 2, fontScale: 1 };
    },
  };
});

/** Resizes the window as a real resize does: only the components that read it re-render. */
async function resizeTo(width: number) {
  await act(() => {
    mockWindow.width = width;
    mockWindow.listeners.forEach((listener) => listener());
  });
}

const STAFF = ["Sameer Sales", "Asha Admin", "Hema Hotels", "Farah Finance"];

/** A className's classes, matched whole. */
const classes = (value: unknown): readonly string[] =>
  typeof value === "string" ? value.split(/\s+/) : [];

describe("SignInScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lays D1 on a desktop: the hero beside a card holding only the client form", async () => {
    mockWindow.width = 1440;
    await renderWithProviders(<SignInScreen />);
    const hero = within(screen.getByTestId("sign-in-hero"));
    const title = hero.getByRole("header", { name: "Welcome back." });
    expect(classes(title.props.className)).toEqual(
      expect.arrayContaining(["lg:text-7xl", "lg:tracking-tight"]),
    );
    expect(hero.getByText("No sign-up · AMPM invites every client")).toBeOnTheScreen();

    const card = within(screen.getByTestId("sign-in-card"));
    expect(card.getByRole("header", { name: "Client sign-in" })).toBeOnTheScreen();
    expect(card.getByText("Mobile number")).toBeOnTheScreen();
    expect(card.queryByText("Work email")).toBeNull();
    expect(card.queryByText("Sameer Sales")).toBeNull();
  });

  it("puts the development shortcuts under the card as one flat block", async () => {
    mockWindow.width = 1440;
    await renderWithProviders(<SignInScreen />);
    const aside = within(screen.getByTestId("sign-in-aside"));
    const block = within(aside.getByTestId("dev-sign-in-shortcuts"));
    expect(block.getByText("Work email")).toBeOnTheScreen();
    for (const name of [...STAFF, "Rhea Client", "Prasad Prospect"]) {
      expect(block.getByText(name)).toBeOnTheScreen();
    }
    expect(aside.getByLabelText("Component gallery")).toBeOnTheScreen();

    await fireEvent.press(block.getByText("Asha Admin"));
    expect(mockDevLogin.mutate).toHaveBeenCalledWith(
      { email: "admin@example.com" },
      expect.anything(),
    );
    expect(mockSetAccessToken).toHaveBeenCalledWith("tok-staff");
    expect(mockClear).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("keeps the phone layout: the header first, the client form in a card of its own", async () => {
    mockWindow.width = 390;
    await renderWithProviders(<SignInScreen />);
    expect(classes(screen.getByTestId("sign-in-columns").props.className)).toContain("flex-col");
    expect(screen.queryByTestId("dev-sign-in-shortcuts")).toBeNull();
    const card = within(screen.getByTestId("sign-in-card"));
    expect(card.getByText("Client sign-in")).toBeOnTheScreen();
    expect(card.queryByRole("header", { name: "Client sign-in" })).toBeNull();
    expect(card.queryByText("Work email")).toBeNull();
    expect(screen.getByText("Work email")).toBeOnTheScreen();
    expect(screen.queryByText("No sign-up · AMPM invites every client")).toBeNull();
  });

  it("signs in with a typed work email", async () => {
    mockWindow.width = 1440;
    await renderWithProviders(<SignInScreen />);
    await fireEvent.changeText(
      screen.getByPlaceholderText("sales@example.com"),
      " hotel@example.com ",
    );
    await fireEvent.press(screen.getByText("Sign in"));
    expect(mockDevLogin.mutate).toHaveBeenCalledWith(
      { email: "hotel@example.com" },
      expect.anything(),
    );
  });
  it("keeps the number and the code step when a tablet turns past 1024", async () => {
    mockWindow.width = 820;
    await renderWithProviders(<SignInScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText("98765 43210"), "+911234567003");
    await fireEvent.press(screen.getByText("Send code"));
    await fireEvent.changeText(screen.getByLabelText("Verification code"), "123");

    for (const [width, direction] of [
      [1180, "flex-row"],
      [390, "flex-col"],
      [820, "flex-col"],
    ] as const) {
      await resizeTo(width);
      expect(classes(screen.getByTestId("sign-in-columns").props.className)).toContain(direction);
      expect(screen.getByPlaceholderText("98765 43210").props.value).toBe("+911234567003");
      // Still the code step: the demo code shows, and the boxes keep the digits typed so far.
      expect(screen.getByText("123456")).toBeOnTheScreen();
      expect(screen.getByLabelText("Verification code").props.value).toBe("123");
    }
    expect(mockRequestOtp.mutate).toHaveBeenCalledTimes(1);
  });

  it("keeps a typed work email when the window narrows past 1024 and 768", async () => {
    mockWindow.width = 1440;
    await renderWithProviders(<SignInScreen />);
    await fireEvent.changeText(
      screen.getByPlaceholderText("sales@example.com"),
      "hotel@example.com",
    );
    for (const width of [900, 390, 1440]) {
      await resizeTo(width);
      expect(screen.getByPlaceholderText("sales@example.com").props.value).toBe(
        "hotel@example.com",
      );
    }
    expect(screen.getByTestId("dev-sign-in-shortcuts")).toBeOnTheScreen();
  });
});
