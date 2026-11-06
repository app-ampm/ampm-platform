import { renderOnWeb } from "../../test/web";
import { Image } from "./image";

const source = { uri: "https://example.com/pavilion.jpg" };

// expo-image's web build writes the <img>'s alt from accessibilityLabel only.
describe("Image on the web", () => {
  it('gives a decorative picture alt="" so screen readers skip it', async () => {
    const { container } = await renderOnWeb(<Image source={source} alt="" testID="photo" />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("alt")).toBe("");
    expect(img?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("describes a meaningful picture with its alt text", async () => {
    const { container } = await renderOnWeb(
      <Image source={source} alt="Lakeside pavilion at dusk" testID="photo" />,
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("alt")).toBe("Lakeside pavilion at dusk");
    expect(img?.closest('[aria-hidden="true"]')).toBeNull();
  });
});
