import { Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { classes, fireEvent, renderWithProviders, screen } from "../../test/render";
import { Sheet } from "./sheet";

const IPHONE = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, bottom: 34, left: 0, right: 0 },
};

describe("Sheet", () => {
  it("renders nothing while closed", async () => {
    await renderWithProviders(
      <Sheet open={false} onClose={() => undefined} title="Filters">
        <Text>Body</Text>
      </Sheet>,
    );
    expect(screen.queryByText("Filters")).toBeNull();
  });

  it("shows the title and content, and closes from the scrim and the button", async () => {
    const onClose = jest.fn();
    await renderWithProviders(
      <Sheet open onClose={onClose} title="Filters" testID="sheet">
        <Text>Body</Text>
      </Sheet>,
    );
    expect(screen.getByRole("header", { name: "Filters" })).toBeOnTheScreen();
    expect(screen.getByText("Body")).toBeOnTheScreen();
    // The panel is modal, so the scrim behind it is hidden from assistive technology (as it should be).
    await fireEvent.press(screen.getByTestId("sheet-scrim", { includeHiddenElements: true }));
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("is a glass panel on a midnight 70% scrim, radius 28 on top", async () => {
    await renderWithProviders(
      <Sheet open onClose={() => undefined} title="Filters" testID="sheet" size="half">
        <Text>Body</Text>
      </Sheet>,
    );
    const scrim = screen.getByTestId("sheet-scrim", { includeHiddenElements: true });
    expect(scrim.props.className).toContain("bg-overlay/70");
    const panel = screen.getByTestId("sheet-panel");
    expect(panel.props.accessibilityViewIsModal).toBe(true);
    expect(panel.props.className).toContain("rounded-t-2xl");
    expect(panel.props.className).toContain("border-t");
    expect(panel.props.className).toContain("border-primary/16");
    expect(panel.props.className).toContain("h-1/2");
    // The glass fill sits in the panel (BlurView under midnight 50% where the platform can blur).
    expect(JSON.stringify(screen.toJSON())).toContain("bg-surface/50");
  });

  it("draws the pearl handle and a round glass close button", async () => {
    await renderWithProviders(
      <Sheet open onClose={() => undefined} title="Filters" closeLabel="Close filters">
        <Text>Body</Text>
      </Sheet>,
    );
    const close = screen.getByRole("button", { name: "Close filters" });
    expect(close.props.className).toContain("rounded-full");
    expect(close.props.className).toContain("w-touch");
    expect(JSON.stringify(screen.toJSON())).toContain("bg-primary/26");
  });

  it("keeps 16 above the home indicator: the inset in style, the 16 a spacing class", async () => {
    await renderWithProviders(
      <SafeAreaProvider initialMetrics={IPHONE}>
        <Sheet open onClose={() => undefined} title="Filters" testID="sheet">
          <Text>Body</Text>
        </Sheet>
      </SafeAreaProvider>,
    );
    expect(screen.getByTestId("sheet-panel")).toHaveStyle({ paddingBottom: 34 });
    expect(classes(screen.getByTestId("sheet-content").props.className)).toContain("pb-4");
  });

  it("drops the top radius on a full-height sheet", async () => {
    await renderWithProviders(
      <Sheet open onClose={() => undefined} title="Filters" testID="sheet" size="full">
        <Text>Body</Text>
      </Sheet>,
    );
    expect(screen.getByTestId("sheet-panel").props.className).toContain("rounded-t-none");
    expect(screen.getByTestId("sheet-panel").props.className).not.toContain("rounded-t-2xl");
  });
});
