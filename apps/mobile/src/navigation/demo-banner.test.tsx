import { renderWithProviders, screen } from "../test/render";
import { DemoBanner } from "./demo-banner";

describe("DemoBanner", () => {
  it("shows the demo notice when enabled", async () => {
    await renderWithProviders(<DemoBanner show />);
    expect(screen.getByTestId("demo-banner")).toHaveProp(
      "accessibilityLabel",
      "Demo environment: sample data, not real bookings.",
    );
    expect(screen.getByText(/Demo environment/)).toBeOnTheScreen();
  });

  it("renders nothing when not the demo environment", async () => {
    await renderWithProviders(<DemoBanner show={false} />);
    expect(screen.queryByTestId("demo-banner")).toBeNull();
  });

  it("defaults to hidden when no demo flag is set (the test build)", async () => {
    await renderWithProviders(<DemoBanner />);
    expect(screen.queryByTestId("demo-banner")).toBeNull();
  });
});
