import { cn } from "./cn";

describe("cn", () => {
  it("joins and drops falsy values", () => {
    const isHidden: boolean = false;
    expect(cn("p-4", undefined, isHidden && "hidden", ["gap-2"])).toBe("p-4 gap-2");
  });

  it("lets the last conflicting class win", () => {
    expect(cn("p-4 text-primary", "p-2")).toBe("text-primary p-2");
    expect(cn("bg-surface", "bg-brand")).toBe("bg-brand");
  });

  it("keeps a size and a colour apart", () => {
    expect(cn("text-lg", "text-primary")).toBe("text-lg text-primary");
  });
});
