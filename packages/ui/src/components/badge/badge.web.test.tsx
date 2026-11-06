import { renderOnWeb } from "../../test/web";
import { Badge } from "./badge";

// react-native-web renders the badge as a plain element, whose label screen readers do not read: the
// words go in as visually hidden text and the drawn count is hidden.
describe("Badge on the web", () => {
  it("reads a capped count in words and hides the drawn 99+", async () => {
    const { container } = await renderOnWeb(<Badge count={128} />);
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe("99+");
    expect(container.textContent).toBe("99+More than 99");
  });

  it("adds nothing when the count reads as drawn", async () => {
    const { container } = await renderOnWeb(<Badge count={4} />);
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
    expect(container.textContent).toBe("4");
  });
});
