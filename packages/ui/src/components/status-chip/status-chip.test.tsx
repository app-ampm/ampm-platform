import { renderWithProviders, screen } from "../../test/render";
import { StatusChip } from "./status-chip";
import { chipStyles } from "./status-chip.styles";

describe("StatusChip", () => {
  it("always carries its label", async () => {
    await renderWithProviders(<StatusChip label="Verified" tone="success" icon="check" />);
    expect(screen.getByLabelText("Verified")).toBeOnTheScreen();
    expect(screen.getByText("Verified")).toBeOnTheScreen();
  });

  it("tones only change the background", async () => {
    expect(chipStyles({ tone: "danger" })).toContain("bg-danger-soft");
    expect(chipStyles({ tone: "neutral" })).toContain("bg-surface-inset");
    expect(chipStyles({ size: "sm" })).toContain("px-2");
  });
});
