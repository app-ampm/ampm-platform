import { renderOnWeb } from "../../test/web";
import { Icon } from "./icon";

// react-native-web forwards aria-hidden but not the two native hiding props, so a decorative icon
// must say aria-hidden or the browser exposes its bare <svg>.
describe("Icon on the web", () => {
  it("hides a decorative icon from the accessibility tree", async () => {
    const { container } = await renderOnWeb(<Icon name="check" testID="icon" />);
    const icon = container.querySelector('[data-testid="icon"]');
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
    expect(icon?.querySelector("svg")).not.toBeNull();
  });

  it("names a labelled icon as an image", async () => {
    const { container } = await renderOnWeb(<Icon name="star" label="Favourite" testID="icon" />);
    const icon = container.querySelector('[data-testid="icon"]');
    expect(icon?.getAttribute("role")).toBe("img");
    expect(icon?.getAttribute("aria-label")).toBe("Favourite");
    expect(icon?.hasAttribute("aria-hidden")).toBe(false);
  });
});
