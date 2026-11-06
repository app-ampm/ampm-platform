/**
 * The generator behind `pnpm tokens:build` (scripts/build.ts writes what this returns):
 *   tailwind.preset.cjs       the preset the Expo app loads after NativeWind's (`presets: [nativewind, preset]`)
 *   tailwind.preset.web.cjs   the Next.js site's preset: the same theme, fonts through next/font variables,
 *                             and the `web:` variant so classes shared with packages/ui mean the same there
 *   tailwind.preset.d.cts     the type of both presets
 *   tokens.css                the CSS variables, for contexts without Tailwind
 *
 * Colours become CSS variables holding RGB channels (`--color-brand: 221 184 97`) and the presets map
 * them as `rgb(var(--color-brand) / <alpha-value>)`, so `bg-brand/14` works with any step in
 * opacity.ts. Peacock Night is dark only: `:root` and `.dark:root` (the selector NativeWind's compiler
 * recognises for class dark mode) hold the same values, so the scheme switch changes nothing.
 */
import { breakpoints } from "../src/breakpoints.ts";
import { MIN_TEXT_CONTRAST, colors, contrastPairs } from "../src/colors.ts";
import { backdropBlur, backdropSaturate } from "../src/glass.ts";
import { layers } from "../src/layers.ts";
import { duration, easing } from "../src/motion.ts";
import { opacity } from "../src/opacity.ts";
import { radii } from "../src/radii.ts";
import { shadows } from "../src/shadows.ts";
import { sizes, spacing } from "../src/spacing.ts";
import {
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
  webFontFamilyTypeface,
  webFontVariables,
} from "../src/typography.ts";
import { channels, contrast } from "./contrast.ts";

export const LIGHT_ROOT_SELECTOR = ":root";
export const DARK_ROOT_SELECTOR = ".dark:root";
export { MIN_TEXT_CONTRAST };

type Scheme = "light" | "dark";
type FamilyName = keyof typeof fontFamily;

export interface Outputs {
  readonly preset: string;
  readonly webPreset: string;
  readonly types: string;
  readonly css: string;
}

/** Every pair in `contrastPairs`, in both schemes, against its own minimum (4.5:1 unless it says otherwise). */
export function contrastFailures(): string[] {
  const failures: string[] = [];
  for (const scheme of ["light", "dark"] as const) {
    for (const pair of contrastPairs) {
      const min = pair.min ?? MIN_TEXT_CONTRAST;
      const ratio = contrast(colors[pair.text][scheme], colors[pair.on][scheme]);
      if (ratio < min)
        failures.push(
          `${scheme}: ${pair.text} on ${pair.on} is ${ratio.toFixed(2)}:1, needs ${min}:1 (${pair.use})`,
        );
    }
  }
  return failures;
}

export function checkContrast(): void {
  const failures = contrastFailures();
  if (failures.length > 0) {
    throw new Error(
      `tokens: colour pairs below their contrast minimum\n  ${failures.join("\n  ")}`,
    );
  }
}

function colorVariables(scheme: Scheme): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, token] of Object.entries(colors)) {
    out[`--color-${name}`] = channels(token[scheme]).join(" ");
  }
  return out;
}

function cssFontList(stack: readonly string[]): string {
  return stack.map((f) => (/\s/.test(f) && !f.startsWith("var(") ? `"${f}"` : f)).join(", ");
}

function fontVariables(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, stack] of Object.entries(fontFamily))
    out[`--font-${name}`] = cssFontList(stack);
  return out;
}

/**
 * The site's families: each typeface's next/font variable first (falling back to the family name, so
 * the declaration stays valid where the variable is missing), then the system fallbacks. The face names
 * the Expo app registers are dropped; next/font serves every weight of the one family.
 */
function webFontFamily(): Record<FamilyName, string[]> {
  const out = {} as Record<FamilyName, string[]>;
  for (const [name, stack] of Object.entries(fontFamily) as [FamilyName, readonly string[]][]) {
    const variable = webFontVariables[webFontFamilyTypeface[name]];
    const [, family, ...fallback] = stack;
    out[name] = [`var(${variable}, ${family})`, ...fallback];
  }
  return out;
}

/** On the site a weight family also sets its weight, since next/font serves one family for all weights. */
const WEB_WEIGHT_UTILITIES = {
  ".font-sans-medium": { fontWeight: fontWeight.medium },
  ".font-sans-semibold": { fontWeight: fontWeight.semibold },
  ".font-sans-bold": { fontWeight: fontWeight.bold },
  ".font-sans-extrabold": { fontWeight: fontWeight.extrabold },
  ".font-mono": { fontWeight: fontWeight.semibold, fontVariantNumeric: "tabular-nums" },
};

function presetColors(): Record<string, string> {
  const out: Record<string, string> = {
    transparent: "transparent",
    current: "currentColor",
    inherit: "inherit",
  };
  for (const name of Object.keys(colors)) {
    out[name] = `rgb(var(--color-${name}) / <alpha-value>)`;
  }
  return out;
}

function screens(): Record<string, string> {
  return Object.fromEntries(Object.entries(breakpoints).map(([name, px]) => [name, `${px}px`]));
}

function theme(families: Record<string, readonly string[]>) {
  return {
    colors: presetColors(),
    spacing,
    borderRadius: radii,
    fontFamily: families,
    fontSize,
    fontWeight,
    boxShadow: shadows,
    opacity,
    screens: screens(),
    zIndex: layers,
    transitionDuration: duration,
    transitionTimingFunction: easing,
    extend: {
      // NativeWind's native preset extends `sans`, `serif` and `mono` with the platform's system fonts,
      // and a preset's `extend` outranks every preset's `theme`; repeating the families here (this preset
      // comes after NativeWind's) keeps `font-sans` on Manrope on iOS and Android.
      fontFamily: families,
      height: sizes,
      minHeight: sizes,
      width: sizes,
      minWidth: sizes,
      letterSpacing,
      backdropBlur,
      backdropSaturate,
    },
  };
}

function variables(): Record<string, Record<string, string>> {
  return {
    [LIGHT_ROOT_SELECTOR]: colorVariables("light"),
    [DARK_ROOT_SELECTOR]: colorVariables("dark"),
  };
}

const header =
  "/* Generated by `pnpm tokens:build` from packages/tokens/src. Do not edit; change the tokens and rebuild. */";

function json(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(/\n/g, "\n  ");
}

function presetSource(): string {
  return [
    header,
    '"use strict";',
    'const plugin = require("tailwindcss/plugin");',
    "",
    "/** The colour variables; Peacock Night is dark only, so both schemes hold the same values. */",
    `const variables = ${JSON.stringify(variables(), null, 2)};`,
    "",
    '/** @type {import("tailwindcss").Config} */',
    "module.exports = {",
    '  darkMode: "class",',
    `  theme: ${json(theme(fontFamily))},`,
    "  plugins: [plugin(({ addBase }) => addBase(variables))],",
    "};",
    "",
  ].join("\n");
}

function webPresetSource(): string {
  return [
    header,
    '"use strict";',
    'const plugin = require("tailwindcss/plugin");',
    "",
    "/** The colour variables; Peacock Night is dark only, so both schemes hold the same values. */",
    `const variables = ${JSON.stringify(variables(), null, 2)};`,
    "",
    "/** A weight family also sets its weight here: next/font serves one family for every weight. */",
    `const weightUtilities = ${JSON.stringify(WEB_WEIGHT_UTILITIES, null, 2)};`,
    "",
    '/** @type {import("tailwindcss").Config} */',
    "module.exports = {",
    '  darkMode: "class",',
    `  theme: ${json(theme(webFontFamily()))},`,
    "  plugins: [",
    "    plugin(({ addBase }) => addBase(variables)),",
    "    // The site is always the web: `web:` classes shared with packages/ui apply, as on Expo's web export.",
    '    plugin(({ addVariant }) => addVariant("web", "&")),',
    "    plugin(({ addUtilities }) => addUtilities(weightUtilities)),",
    "  ],",
    "};",
    "",
  ].join("\n");
}

function presetTypes(): string {
  return [
    header,
    'import type { Config } from "tailwindcss";',
    "declare const preset: Config;",
    "export = preset;",
    "",
  ].join("\n");
}

function cssSource(): string {
  const block = (selector: string, vars: Record<string, string>) =>
    `${selector} {\n${Object.entries(vars)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join("\n")}\n}`;
  const root = { "color-scheme": "dark", ...colorVariables("light"), ...fontVariables() };
  return [
    header,
    block(LIGHT_ROOT_SELECTOR, root),
    block(DARK_ROOT_SELECTOR, colorVariables("dark")),
    "",
  ].join("\n\n");
}

/** Checks the contrast gate, then returns the files' contents. */
export function generate(): Outputs {
  checkContrast();
  return {
    preset: presetSource(),
    webPreset: webPresetSource(),
    types: presetTypes(),
    css: cssSource(),
  };
}
