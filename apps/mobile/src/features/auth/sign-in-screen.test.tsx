import type * as ReactModule from "react";
import type { ReactNode } from "react";

import { act, fireEvent, renderWithProviders, screen, within } from "../../test/render";
import { SignInScreen } from "./sign-in-screen";

const mockReplace = jest.fn();
const mockClear = jest.fn();
const mockSetAccessToken = jest.fn();
const mockDevLogin: {
  mutate: jest.Mock;
  isPending: boolean;
  variables: { email: string } | undefined;
  error: unknown;
} = {
  mutate: jest.fn((_body: unknown, opts?: { onSuccess?: (result: unknown) => void }) =>
    opts?.onSuccess?.({ accessToken: "tok-staff" }),
  ),
  isPending: false,
  variables: undefined,
  error: null,
};
const mockRequestOtp = {
  mutate: jest.fn((_body: unknown, opts?: { onSuccess?: (result: unknown) => void }) =>
    opts?.onSuccess?.({ demoCode: "123456", expiresInSeconds: 300 }),
  ),
  reset: jest.fn(),
  isPending: false,
  error: null,
};
const mockVerifyOtp = { mutate: jest.fn(), reset: jest.fn(), isPending: false, error: null };
const mockCreate = { mutate: jest.fn(), reset: jest.fn(), isPending: false, error: null };

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
  useDemoSignIn: () => mockDemo,
  useCreateDemoClient: () => mockCreate,
}));
jest.mock("@/lib/session", () => ({
  setAccessToken: (token: string | null) => mockSetAccessToken(token),
}));

/** The demo prospect's sign-in (#129): it answers with the demo principal's session at once. */
const mockDemo = {
  mutate: jest.fn((_body: unknown, opts?: { onSuccess?: (result: unknown) => void }) =>
    opts?.onSuccess?.({
      accessToken: "demo-tok",
      user: { id: "demo-1", name: "Dev Demo", email: "demo@example.com" },
    }),
  ),
  isPending: false,
  error: null,
};

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
const FOOTER = "Demo build · codes appear on screen, no SMS";

/** A className's classes, matched whole. */
const classes = (value: unknown): readonly string[] =>
  typeof value === "string" ? value.split(/\s+/) : [];

describe("SignInScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDevLogin.isPending = false;
    mockDevLogin.variables = undefined;
  });

  it("lays D1 on a desktop: the hero beside a card holding the Sign in / Sign up switch", async () => {
    mockWindow.width = 1440;
    await renderWithProviders(<SignInScreen />);
    const hero = within(screen.getByTestId("sign-in-hero"));
    const title = hero.getByRole("header", { name: "Welcome back." });
    expect(classes(title.props.className)).toEqual(
      expect.arrayContaining(["lg:text-7xl", "lg:tracking-tight"]),
    );
    expect(hero.getByText(FOOTER)).toBeOnTheScreen();

    const card = within(screen.getByTestId("sign-in-card"));
    expect(card.getByRole("tab", { name: "Sign in", selected: true })).toBeOnTheScreen();
    expect(card.getByRole("header", { name: "Sign in with your mobile" })).toBeOnTheScreen();
    expect(card.getByText("Mobile number")).toBeOnTheScreen();
    // The development ways in stay out of the client card.
    expect(card.queryByText("Explore the demo")).toBeNull();
    expect(card.queryByText("Sameer Sales")).toBeNull();
  });

  it("turns the headline to Join AMPM. while signing up", async () => {
    mockWindow.width = 1440;
    await renderWithProviders(<SignInScreen />);
    await fireEvent.press(screen.getByRole("tab", { name: "Sign up" }));
    expect(screen.getByRole("header", { name: "Join AMPM." })).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Create a client account" })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("tab", { name: "Sign in" }));
    expect(screen.getByRole("header", { name: "Welcome back." })).toBeOnTheScreen();
  });

  it("puts the demo prospect and the seeded accounts under the card, one tap each", async () => {
    mockWindow.width = 1440;
    await renderWithProviders(<SignInScreen />);
    const aside = within(screen.getByTestId("sign-in-aside"));
    expect(aside.getByTestId("demo-entry")).toBeOnTheScreen();
    const accounts = within(aside.getByTestId("dev-accounts"));
    for (const name of [...STAFF, "Rhea Client", "Prasad Prospect"]) {
      expect(accounts.getByText(name)).toBeOnTheScreen();
    }
    expect(aside.getByLabelText("Component gallery")).toBeOnTheScreen();

    await fireEvent.press(
      accounts.getByRole("button", { name: "Sign in as Asha Admin, Super Admin" }),
    );
    expect(mockDevLogin.mutate).toHaveBeenCalledWith(
      { email: "admin@example.com" },
      expect.anything(),
    );
    expect(mockSetAccessToken).toHaveBeenCalledWith("tok-staff");
    expect(mockClear).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("marks the account being signed in", async () => {
    mockWindow.width = 1440;
    mockDevLogin.isPending = true;
    mockDevLogin.variables = { email: "finance@example.com" };
    await renderWithProviders(<SignInScreen />);
    const row = within(screen.getByTestId("dev-account-finance@example.com"));
    expect(row.getByText("Signing in…")).toBeOnTheScreen();
    expect(screen.getAllByText("Signing in…")).toHaveLength(1);
  });

  it("signs the demo prospect in from its own card", async () => {
    mockWindow.width = 1440;
    await renderWithProviders(<SignInScreen />);
    const entry = within(screen.getByTestId("demo-entry"));
    await fireEvent.press(entry.getByRole("button", { name: "Explore the demo" }));

    expect(mockDemo.mutate).toHaveBeenCalled();
    expect(mockSetAccessToken).toHaveBeenCalledWith("demo-tok");
    expect(mockReplace).toHaveBeenCalledWith("/");
    // The cache is cleared so the demo never sees a previous principal's cached data.
    expect(mockClear).toHaveBeenCalled();
  });

  it("keeps the phone layout: the header first, then glass cards, one account a row", async () => {
    mockWindow.width = 390;
    await renderWithProviders(<SignInScreen />);
    expect(classes(screen.getByTestId("sign-in-columns").props.className)).toContain("flex-col");
    const card = within(screen.getByTestId("sign-in-card"));
    expect(card.getByRole("tab", { name: "Sign up" })).toBeOnTheScreen();
    expect(card.queryByTestId("dev-accounts")).toBeNull();
    expect(screen.getByTestId("dev-accounts")).toBeOnTheScreen();
    expect(screen.queryByText(FOOTER)).toBeNull();
  });

  it("signs in with another seeded email behind its link", async () => {
    mockWindow.width = 1440;
    await renderWithProviders(<SignInScreen />);
    expect(screen.queryByText("Work email")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Use another seeded email" }));
    await fireEvent.changeText(
      screen.getByPlaceholderText("name@example.com"),
      " hotel@example.com ",
    );
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(mockDevLogin.mutate).toHaveBeenCalledWith(
      { email: "hotel@example.com" },
      expect.anything(),
    );
  });

  it("keeps the code step when a tablet turns past 1024", async () => {
    mockWindow.width = 820;
    await renderWithProviders(<SignInScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText("98765 43210"), "+911234567003");
    await fireEvent.press(screen.getByRole("button", { name: "Send code" }));
    await fireEvent.changeText(screen.getByLabelText("Verification code"), "123");

    for (const [width, direction] of [
      [1180, "flex-row"],
      [390, "flex-col"],
      [820, "flex-col"],
    ] as const) {
      await resizeTo(width);
      expect(classes(screen.getByTestId("sign-in-columns").props.className)).toContain(direction);
      // Still the code step: the number, the code on screen, and the digits typed so far.
      expect(screen.getByText("+91 12345 67003")).toBeOnTheScreen();
      expect(screen.getByText("123456")).toBeOnTheScreen();
      expect(screen.getByLabelText("Verification code").props.value).toBe("123");
    }
    expect(mockRequestOtp.mutate).toHaveBeenCalledTimes(1);
  });

  it("keeps the open email form and what was typed when the window narrows past 1024 and 768", async () => {
    mockWindow.width = 1440;
    await renderWithProviders(<SignInScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Use another seeded email" }));
    await fireEvent.changeText(
      screen.getByPlaceholderText("name@example.com"),
      "hotel@example.com",
    );
    for (const width of [900, 390, 1440]) {
      await resizeTo(width);
      expect(screen.getByPlaceholderText("name@example.com").props.value).toBe("hotel@example.com");
    }
  });
});
