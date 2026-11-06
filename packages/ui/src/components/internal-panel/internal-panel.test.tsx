import { Text } from "react-native";

import { renderWithProviders, screen } from "../../test/render";
import { InternalPanel } from "./internal-panel";
import { internalPanelBoxStyles } from "./internal-panel.styles";

describe("InternalPanel", () => {
  it("heads its content with the internal-only label", async () => {
    await renderWithProviders(
      <InternalPanel>
        <Text>Cost ₹5,10,000 · margin 18%</Text>
      </InternalPanel>,
    );
    const label = screen.getByText("Internal · never sent to clients");
    expect(label).toBeOnTheScreen();
    expect(label.props.className).toContain("uppercase");
    expect(label.props.className).toContain("text-brand");
    expect(screen.getByText("Cost ₹5,10,000 · margin 18%")).toBeOnTheScreen();
  });

  it("takes its label as a prop", async () => {
    await renderWithProviders(<InternalPanel label="Internal note · Meera, 5 Nov" />);
    expect(screen.getByText("Internal note · Meera, 5 Nov")).toBeOnTheScreen();
    expect(screen.queryByText("Internal · never sent to clients")).toBeNull();
  });

  it("is a dashed gold panel from the internal-only recipe", async () => {
    await renderWithProviders(<InternalPanel testID="internal" className="mt-2" />);
    const panel = screen.getByTestId("internal");
    expect(panel.props.className).toContain("border-dashed");
    expect(panel.props.className).toContain("border-brand/50");
    expect(panel.props.className).toContain("bg-brand/6");
    expect(panel.props.className).toContain("rounded-lg");
    expect(panel.props.className).toContain("p-4");
    expect(panel.props.className).toContain("mt-2");
    expect(internalPanelBoxStyles()).toContain("gap-2");
  });
});
