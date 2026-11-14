import type * as ReactModule from "react";

import { act, fireEvent, renderWithProviders, screen, within } from "../../test/render";
import { CognitoSignInScreen } from "./cognito-sign-in-screen";

const mockSignIn = jest.fn();
jest.mock("./use-staff-sign-in", () => ({
  useStaffSignIn: () => ({
    phase: { kind: "credentials" },
    pending: false,
    error: undefined,
    email: "asha@ampm.example",
    setEmail: jest.fn(),
    signIn: (password: string) => mockSignIn(password),
    submitChallenge: jest.fn(),
    confirmEnrollment: jest.fn(),
  }),
}));
jest.mock("react-native-qrcode-svg", () => () => null);

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

describe("CognitoSignInScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lays D1 on a desktop: the phase's instruction beside a titled card holding its form", async () => {
    mockWindow.width = 1440;
    await renderWithProviders(<CognitoSignInScreen />);
    const hero = within(screen.getByTestId("sign-in-hero"));
    expect(hero.getByRole("header", { name: "Welcome back." })).toBeOnTheScreen();
    expect(hero.getByText("Sign in with your work email and password.")).toBeOnTheScreen();
    expect(hero.getByText("No sign-up · AMPM sets up every account")).toBeOnTheScreen();

    const card = within(screen.getByTestId("sign-in-card"));
    expect(card.getByRole("header", { name: "Staff sign-in" })).toBeOnTheScreen();
    await fireEvent.changeText(card.getByLabelText("Password"), "correct horse");
    await fireEvent.press(card.getByText("Sign in"));
    expect(mockSignIn).toHaveBeenCalledWith("correct horse");
  });

  it("keeps the phone layout: no card title, nothing beside the form", async () => {
    mockWindow.width = 390;
    await renderWithProviders(<CognitoSignInScreen />);
    expect(String(screen.getByTestId("sign-in-columns").props.className)).toContain("flex-col");
    expect(screen.queryByText("Staff sign-in")).toBeNull();
    expect(
      within(screen.getByTestId("sign-in-card")).getByLabelText("Work email"),
    ).toBeOnTheScreen();
  });
  it("keeps a typed password when the window crosses 1024", async () => {
    mockWindow.width = 820;
    await renderWithProviders(<CognitoSignInScreen />);
    await fireEvent.changeText(screen.getByLabelText("Password"), "correct horse");
    for (const [width, direction] of [
      [1180, "flex-row"],
      [390, "flex-col"],
    ] as const) {
      await resizeTo(width);
      expect(String(screen.getByTestId("sign-in-columns").props.className)).toContain(direction);
      expect(screen.getByLabelText("Password").props.value).toBe("correct horse");
    }
  });
});
