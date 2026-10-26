import { renderWithProviders, screen } from "../../test/render";
import { Skeleton } from "./skeleton";

describe("Skeleton", () => {
  it("is hidden from assistive technology", async () => {
    await renderWithProviders(<Skeleton testID="skeleton" className="h-4 w-24" />);
    expect(screen.queryByTestId("skeleton")).toBeNull();
    expect(screen.getByTestId("skeleton", { includeHiddenElements: true })).toHaveProp(
      "accessibilityElementsHidden",
      true,
    );
  });
});
