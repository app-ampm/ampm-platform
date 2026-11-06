import { createRequire } from "node:module";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

import { colors, contrastPairs, palette } from "../src/colors.ts";
import { glass, glow } from "../src/glass.ts";
import { opacity } from "../src/opacity.ts";
import { webFontVariables } from "../src/typography.ts";
import { channels, contrast } from "./contrast.ts";
import { DARK_ROOT_SELECTOR, MIN_TEXT_CONTRAST, contrastFailures, generate } from "./generate.ts";

const require = createRequire(import.meta.url);

interface LoadedPreset {
  darkMode: string;
  theme: {
    colors: Record<string, string>;
    fontFamily: Record<string, string[]>;
    opacity: Record<string, string>;
    extend: { letterSpacing: Record<string, string>; backdropBlur: Record<string, string> };
  };
  plugins: unknown[];
}

function loadPreset(source: string): LoadedPreset {
  const module = { exports: {} as Record<string, unknown> };
  vm.runInNewContext(source, { module, exports: module.exports, require });
  return module.exports as unknown as LoadedPreset;
}

const FOUR = new Set(Object.values(palette).map((hex) => hex.toUpperCase()));

/** A pre-blended token is one of the four over midnight: it lies on a line from midnight to a colour. */
function isTintOfTheFour(hex: string): boolean {
  if (FOUR.has(hex.toUpperCase())) return true;
  const base = channels(palette.midnight);
  const value = channels(hex as `#${string}`);
  return Object.values(palette).some((colour) => {
    const target = channels(colour);
    const alphas = value.map((v, i) => {
      const span = (target[i] ?? 0) - (base[i] ?? 0);
      return span === 0 ? null : (v - (base[i] ?? 0)) / span;
    });
    const known = alphas.filter((a): a is number => a !== null);
    // The handoff rounded its blends, so channels may disagree by a few percent.
    return known.every((a) => a > 0 && a < 1 && Math.abs(a - (known[0] ?? 0)) < 0.08);
  });
}

describe("contrast", () => {
  it("measures black on white as 21:1", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });

  it("passes every declared pair at its minimum", () => {
    expect(contrastFailures()).toEqual([]);
  });

  it("holds every pair to 4.5:1 except the documented midnight-on-peacock exceptions", () => {
    const exceptions = contrastPairs.filter((pair) => (pair.min ?? MIN_TEXT_CONTRAST) < 4.5);
    expect(exceptions.map((pair) => `${pair.text} on ${pair.on}`)).toEqual([
      "highlight-ink on highlight",
      "highlight-ink on success",
    ]);
    for (const pair of exceptions) expect(pair.min).toBe(3);
  });

  it("checks pearl, gold and the body strength on all three surfaces", () => {
    for (const text of ["primary", "body", "muted", "brand"] as const)
      for (const on of ["surface", "surface-elevated", "surface-inset"] as const)
        expect(contrastPairs).toContainEqual(expect.objectContaining({ text, on }));
  });

  it("would fail a colour that drops below the gate", () => {
    expect(contrast("#2E344D", colors.surface.dark)).toBeLessThan(MIN_TEXT_CONTRAST);
  });
});

describe("Peacock Night palette", () => {
  it("is dark only: both schemes hold the same value", () => {
    for (const token of Object.values(colors)) expect(token.light).toBe(token.dark);
  });

  it("uses only the four colours, or one of them over midnight", () => {
    const offenders = Object.entries(colors)
      .filter(([, token]) => !isTintOfTheFour(token.dark))
      .map(([name, token]) => `${name} ${token.dark}`);
    expect(offenders).toEqual([]);
    for (const recipe of Object.values(glass)) expect(isTintOfTheFour(recipe.fallback)).toBe(true);
    expect(glow.peacock.color).toBe(palette.peacock);
    expect(glow.gold.color).toBe(palette.gold);
  });

  it("offers the opacity steps the glass recipes need", () => {
    for (const step of ["6", "12", "14", "16", "20", "30", "40", "50", "58", "70", "80"])
      expect(opacity).toHaveProperty(step);
  });
});

describe("generate", () => {
  const outputs = generate();

  it("emits the native preset with class dark mode and semantic colours only", () => {
    const preset = loadPreset(outputs.preset);
    expect(preset.darkMode).toBe("class");
    expect(preset.theme.colors.brand).toBe("rgb(var(--color-brand) / <alpha-value>)");
    expect(preset.theme.colors.highlight).toBe("rgb(var(--color-highlight) / <alpha-value>)");
    expect(preset.theme.colors).not.toHaveProperty("blue");
    expect(preset.theme.colors).not.toHaveProperty("gold");
    expect(preset.theme.opacity["16"]).toBe("0.16");
    expect(preset.theme.extend.letterSpacing.eyebrow).toBe("0.22em");
    expect(preset.theme.extend.backdropBlur.glass).toBe("24px");
    expect(preset.theme.fontFamily.display?.[0]).toBe("GildaDisplay-Regular");
    expect(preset.plugins).toHaveLength(1);
  });

  it("emits the web preset with next/font variables and the web variant", () => {
    const preset = loadPreset(outputs.webPreset);
    expect(preset.theme.fontFamily.display?.[0]).toBe(
      `var(${webFontVariables.display}, Gilda Display)`,
    );
    expect(preset.theme.fontFamily["sans-semibold"]?.[0]).toBe(
      `var(${webFontVariables.sans}, Manrope)`,
    );
    expect(preset.theme.colors.surface).toBe("rgb(var(--color-surface) / <alpha-value>)");
    expect(outputs.webPreset).toContain('addVariant("web", "&")');
    expect(preset.plugins).toHaveLength(3);
  });

  it("puts the same variables on :root and .dark:root", () => {
    expect(outputs.preset).toContain(`"${DARK_ROOT_SELECTOR}": {`);
    expect(outputs.css).toMatch(/^:root \{/m);
    expect(outputs.css).toContain(`${DARK_ROOT_SELECTOR} {`);
    expect(outputs.css).toContain("--color-surface: 14 21 52;");
    expect(outputs.css).toContain("--color-highlight: 19 138 133;");
    expect(outputs.css).toContain("color-scheme: dark;");
  });

  it("types the presets as a Tailwind Config", () => {
    expect(outputs.types).toContain("export = preset;");
  });
});
