import { Text } from "react-native";

import { fireEvent, renderWithProviders, screen } from "../../test/render";
import { Sheet } from "./sheet";

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
});
