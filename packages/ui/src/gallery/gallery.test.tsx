import type { ReactNode } from "react";
import { Text } from "react-native";

import { allStories } from "../stories";
import { renderWithProviders, screen, within } from "../test/render";
import { Gallery } from "./gallery";

// The Link stories render Expo Router links; the gallery test has no navigation container.
jest.mock("expo-router", () => ({
  Link: ({ children }: { children: ReactNode }) => children,
}));

describe("Gallery", () => {
  it("renders every story module on the Peacock Night screen", async () => {
    await renderWithProviders(<Gallery />);
    expect(screen.getByTestId("gallery")).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "AMPM UI" })).toBeOnTheScreen();
    expect(screen.getByText("Peacock Night")).toBeOnTheScreen();
    const missing = allStories
      .map((module) => module.title)
      .filter((title) => screen.queryAllByText(title).length === 0);
    expect(missing).toEqual([]);
  });

  it("shows the breakpoint and offers no scheme switch (dark only)", async () => {
    await renderWithProviders(<Gallery />);
    expect(screen.getByText(/^(base|md|lg|xl) · \d+ px$/)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /^(light|dark)$/i })).toBeNull();
  });

  // §3: only top-level panels blur. The stories draw their own glass cards, bars and notices, so the
  // section around them is glass that does not blur, or the catalogue would draw blur on blur.
  it("draws each section as unblurred glass, leaving the blur to the stories' panels", async () => {
    await renderWithProviders(<Gallery />);
    const section = screen.getByTestId("gallery-section-Card");
    const glass = section.children[0];
    if (glass === undefined || typeof glass === "string") throw new Error("no glass layer");
    expect(JSON.stringify(glass.toJSON())).toContain("bg-surface/50");
    expect(JSON.stringify(glass.toJSON())).not.toContain("ExpoBlur");
    expect(JSON.stringify(section.toJSON())).toContain("ExpoBlur");
  });

  it("pins the app's shortcuts in Screen's footer, clear of the home indicator", async () => {
    await renderWithProviders(<Gallery footer={<Text>Account</Text>} />);
    expect(within(screen.getByTestId("gallery-footer")).getByText("Account")).toBeOnTheScreen();
  });
});
