import { renderWithProviders, screen } from "../../test/render";
import { Image } from "./image";

const source = { uri: "https://example.com/pavilion.jpg" };

describe("Image", () => {
  it("describes the picture to screen readers", async () => {
    await renderWithProviders(
      <Image source={source} alt="Lakeside pavilion" className="h-20 w-20" testID="photo" />,
    );
    expect(screen.getByLabelText("Lakeside pavilion")).toBeOnTheScreen();
    expect(screen.getByTestId("photo-skeleton", { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it("hides a decorative image", async () => {
    await renderWithProviders(
      <Image source={source} alt="" className="h-20 w-20" testID="photo" />,
    );
    expect(screen.queryByLabelText("Lakeside pavilion")).toBeNull();
  });
});
