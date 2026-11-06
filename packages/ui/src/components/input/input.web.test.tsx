import { renderOnWeb } from "../../test/web";
import { Input } from "./input";

/** The text of an element as a screen reader takes it: without the parts hidden from it. */
function spokenText(element: Element | null): string {
  if (!element) return "";
  const copy = element.cloneNode(true);
  if (!(copy instanceof Element)) return "";
  copy.querySelectorAll('[aria-hidden="true"]').forEach((part) => part.remove());
  return copy.textContent ?? "";
}

// On the web the field is named by its label element (aria-labelledby, which wins over aria-label):
// the drawn asterisk must stay out of that name, and the field says it is required itself.
describe("Input on the web", () => {
  it("names a required field by its label, without the asterisk, and marks it required", async () => {
    const { container } = await renderOnWeb(<Input label="Work email" required />);
    const field = container.querySelector("input");
    expect(field?.getAttribute("aria-required")).toBe("true");
    const labelId = field?.getAttribute("aria-labelledby") ?? "";
    const label = document.getElementById(labelId);
    expect(label?.textContent).toBe("Work email *");
    expect(spokenText(label)).toBe("Work email");
    expect(label?.hasAttribute("aria-label")).toBe(false);
  });

  it("leaves an optional field unmarked", async () => {
    const { container } = await renderOnWeb(<Input label="Company" />);
    expect(container.querySelector("input")?.getAttribute("aria-required")).toBe("false");
  });
});
