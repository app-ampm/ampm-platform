import { renderWithProviders, screen } from "../../test/render";
import { Icon } from "./icon";
import { iconNames } from "./icon.registry";

describe("Icon", () => {
  it("is decorative unless labelled", async () => {
    await renderWithProviders(<Icon name="check" testID="icon" />);
    expect(screen.queryByTestId("icon")).toBeNull();
    expect(screen.getByTestId("icon", { includeHiddenElements: true })).toHaveProp(
      "accessibilityElementsHidden",
      true,
    );
  });

  it("reads as an image when labelled", async () => {
    await renderWithProviders(<Icon name="star" label="Favourite" />);
    expect(screen.getByRole("image", { name: "Favourite" })).toBeOnTheScreen();
  });

  it("knows every registered name", async () => {
    expect(iconNames).toContain("wifi-off");
    expect(iconNames.length).toBeGreaterThan(40);
  });
});
