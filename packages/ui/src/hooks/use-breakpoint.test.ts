import { breakpointFor } from "./use-breakpoint";

describe("breakpointFor", () => {
  it("steps at the tokens' widths", () => {
    expect(breakpointFor(390)).toBe("base");
    expect(breakpointFor(767)).toBe("base");
    expect(breakpointFor(768)).toBe("md");
    expect(breakpointFor(1024)).toBe("lg");
    expect(breakpointFor(1280)).toBe("xl");
  });
});
