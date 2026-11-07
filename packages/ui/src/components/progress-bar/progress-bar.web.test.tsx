import { byRole, renderOnWeb } from "../../test/web";
import { ProgressBar } from "./progress-bar";

// react-native-web drops accessibilityValue: without aria-valuenow a progressbar is indeterminate,
// and readiness "80%" or the RSVP's "3 of 7" would never be read.
describe("ProgressBar on the web", () => {
  it("is a named progressbar with its value", async () => {
    const { container } = await renderOnWeb(<ProgressBar value={0.8} label="Readiness, Sangeet" />);
    const bar = byRole(container, "progressbar");
    expect(bar.getAttribute("aria-label")).toBe("Readiness, Sangeet");
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
    expect(bar.getAttribute("aria-valuenow")).toBe("80");
    expect(bar.hasAttribute("aria-valuetext")).toBe(false);
  });

  it("says a segmented bar's steps", async () => {
    const { container } = await renderOnWeb(<ProgressBar value={3 / 7} steps={7} label="RSVP" />);
    const bar = byRole(container, "progressbar");
    expect(bar.getAttribute("aria-valuetext")).toBe("3 of 7");
    expect(bar.getAttribute("aria-valuenow")).toBe("43");
  });
});
