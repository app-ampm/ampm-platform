import { renderWithProviders, screen } from "../test/render";
import { DemoBanner, isDemoEnvironment } from "./demo-banner";

// A demo build: EXPO_PUBLIC_DEMO=true, so the banner shows by default (the env-driven path).
jest.mock("@/lib/env", () => ({
  env: { EXPO_PUBLIC_DEMO: "true", EXPO_PUBLIC_API_URL: "http://localhost:3900" },
}));

describe("DemoBanner in a demo build", () => {
  it("is the demo environment and shows the banner with no show prop", async () => {
    expect(isDemoEnvironment()).toBe(true);
    await renderWithProviders(<DemoBanner />);
    expect(screen.getByTestId("demo-banner")).toBeOnTheScreen();
  });
});
