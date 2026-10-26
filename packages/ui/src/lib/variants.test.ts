import { describe, expect, it } from "vitest";

import { variants } from "./variants";

const chip = variants("rounded-full px-3 py-1 text-sm", {
  variants: {
    tone: { success: "bg-success-soft text-success", danger: "bg-danger-soft text-danger" },
    size: { sm: "px-2 text-xs", md: "px-3" },
  },
  defaultVariants: { tone: "success", size: "md" },
});

/** Class order is Tailwind's concern, not the caller's: compare the sets. */
const classes = (value: string) => value.split(" ").sort();

describe("variants", () => {
  it("applies the defaults", () => {
    expect(classes(chip())).toEqual(
      classes("rounded-full px-3 py-1 text-sm bg-success-soft text-success"),
    );
  });

  it("merges a variant's classes over the base instead of stacking them", () => {
    const result = chip({ size: "sm" });
    expect(classes(result)).toEqual(
      classes("rounded-full px-2 py-1 text-xs bg-success-soft text-success"),
    );
    expect(result).not.toContain("px-3");
    expect(result).not.toContain("text-sm");
  });

  it("merges a caller's className last", () => {
    const result = chip({ tone: "danger", className: "py-2" });
    expect(classes(result)).toEqual(
      classes("rounded-full px-3 py-2 text-sm bg-danger-soft text-danger"),
    );
    expect(result).not.toContain("py-1");
  });
});
