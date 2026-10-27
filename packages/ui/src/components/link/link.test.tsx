import { Linking } from "react-native";

import { fireEvent, renderWithProviders, screen } from "../../test/render";
import { Link } from "./link";

jest.mock("expo-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

describe("Link", () => {
  it("reads as a link and navigates inside the app", async () => {
    await renderWithProviders(<Link href="/hotels">All hotels</Link>);
    expect(screen.getByRole("link", { name: "All hotels" })).toBeOnTheScreen();
  });

  it("opens external URLs in the browser", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    await renderWithProviders(
      <Link href="https://example.com" external variant="standalone">
        Website
      </Link>,
    );
    await fireEvent.press(screen.getByRole("link", { name: "Website" }));
    expect(openURL).toHaveBeenCalledWith("https://example.com");
    openURL.mockRestore();
  });
});
