import { AccessibilityInfo } from "react-native";

import { renderWithProviders, screen, waitFor } from "../../test/render";
import { Text } from "../text";
import { GlassPanel } from "./glass-panel";
import { glassStyles } from "./glass-panel.styles";

describe("GlassPanel", () => {
  afterEach(() => jest.restoreAllMocks());

  it("renders its content", async () => {
    await renderWithProviders(
      <GlassPanel testID="panel">
        <Text>Total discovery</Text>
      </GlassPanel>,
    );
    expect(screen.getByText("Total discovery")).toBeOnTheScreen();
    expect(screen.getByTestId("panel")).toBeOnTheScreen();
  });

  it("puts the recipe's stroke on the panel", async () => {
    await renderWithProviders(<GlassPanel testID="panel" recipe="gold" />);
    expect(screen.getByTestId("panel").props.className).toContain("border-brand/50");
  });

  it("draws the web recipes from the four colours only", () => {
    expect(glassStyles({ recipe: "base" })).toContain("bg-surface/50");
    expect(glassStyles({ recipe: "peacock" })).toContain("bg-highlight/30");
    expect(glassStyles({ recipe: "gold" })).toContain("bg-brand/14");
    expect(glassStyles({ blur: true })).toContain("web:backdrop-blur-glass");
    expect(glassStyles({ blur: false })).not.toContain("backdrop-blur");
  });

  it("falls back to the opaque fill when Reduce Transparency is on", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceTransparencyEnabled").mockResolvedValue(true);
    await renderWithProviders(<GlassPanel testID="panel" />);
    await waitFor(() => expect(JSON.stringify(screen.toJSON())).toContain("bg-surface-elevated"));
  });
});
