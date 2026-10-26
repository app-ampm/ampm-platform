import { createRequire } from "node:module";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

import { colors } from "../src/colors.ts";
import { contrast } from "./contrast.ts";
import { DARK_ROOT_SELECTOR, MIN_TEXT_CONTRAST, contrastFailures, generate } from "./generate.ts";

const require = createRequire(import.meta.url);

function loadPreset(source: string): Record<string, unknown> {
  const module = { exports: {} as Record<string, unknown> };
  vm.runInNewContext(source, { module, exports: module.exports, require });
  return module.exports;
}

describe("contrast", () => {
  it("measures black on white as 21:1", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });

  it("passes every text colour on every surface in both schemes", () => {
    expect(contrastFailures()).toEqual([]);
  });

  it("would fail a colour that drops below the gate", () => {
    expect(contrast("#b8860b", colors.surface.light)).toBeLessThan(MIN_TEXT_CONTRAST);
  });
});

describe("generate", () => {
  const outputs = generate();

  it("emits a Tailwind preset with class dark mode and semantic colours only", () => {
    const preset = loadPreset(outputs.preset) as {
      darkMode: string;
      theme: { colors: Record<string, string> };
      plugins: unknown[];
    };
    expect(preset.darkMode).toBe("class");
    expect(preset.theme.colors.brand).toBe("rgb(var(--color-brand) / <alpha-value>)");
    expect(preset.theme.colors).not.toHaveProperty("blue");
    expect(preset.plugins).toHaveLength(1);
  });

  it("puts the light variables on :root and the dark ones on .dark:root", () => {
    expect(outputs.preset).toContain(`"${DARK_ROOT_SELECTOR}": {`);
    expect(outputs.css).toMatch(/^:root \{/m);
    expect(outputs.css).toContain(`${DARK_ROOT_SELECTOR} {`);
    expect(outputs.css).toContain("--color-surface: 248 246 250;");
    expect(outputs.css).toContain("--color-surface: 23 19 25;");
  });

  it("types the preset as a Tailwind Config", () => {
    expect(outputs.types).toContain("export = preset;");
  });
});
