/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import * as styles from "./styles";

// The website (plain Next.js) imports `@ampm/ui/styles`: nothing it reaches may need React, React
// Native or a native module, at runtime or in its typecheck, so type-only imports are followed too.
const SRC = __dirname;
const BARREL = join(SRC, "styles.ts");

/** The packages a recipe may use: class-name helpers and the framework-free tokens. */
const ALLOWED_PACKAGES: ReadonlySet<string> = new Set([
  "class-variance-authority",
  "clsx",
  "tailwind-merge",
  "@ampm/tokens",
]);
const FRAMEWORK =
  /^(react|react-dom|react-native|nativewind|expo|lucide-react-native)$|^(react-native-|expo-|@expo\/|@react-native)/;

const SPECIFIER = /\b(?:from|import|require)\s*\(?\s*["']([^"']+)["']/g;

/** Import and export specifiers of a source file; comments are dropped, so JSDoc examples don't count. */
function specifiersOf(file: string): string[] {
  const source = readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  return [...source.matchAll(SPECIFIER)].map((match) => match[1] ?? "");
}

function resolveRelative(from: string, specifier: string): string {
  const base = join(dirname(from), specifier);
  const candidates = [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (found === undefined) {
    throw new Error(`${relative(SRC, from)} imports "${specifier}", which does not resolve`);
  }
  return found;
}

const packageName = (specifier: string) =>
  specifier
    .split("/")
    .slice(0, specifier.startsWith("@") ? 2 : 1)
    .join("/");

/** Every file the barrel reaches through relative imports, and every package those files import. */
function importGraph(entry: string) {
  const files = new Set<string>();
  const packages = new Set<string>();
  const queue = [entry];
  for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
    if (files.has(file)) continue;
    files.add(file);
    for (const specifier of specifiersOf(file)) {
      if (specifier.startsWith(".")) queue.push(resolveRelative(file, specifier));
      else packages.add(packageName(specifier));
    }
  }
  return { files: [...files].map((file) => relative(SRC, file)).sort(), packages: [...packages] };
}

// Exports that are not class recipes: helpers, lookup tables and the variant sets.
const NOT_RECIPES: ReadonlySet<string> = new Set([
  "cn",
  "variants",
  "initialsOf",
  "glassRecipes",
  "DEFAULT_TONE",
  "SINGLE_WEIGHT_VARIANTS",
  "statValueSize",
]);

const isRecipeFunction = (value: unknown): value is () => unknown => typeof value === "function";

/** Each recipe at its defaults, plus the variants whose layout differs from the defaults. */
function recipeSamples(): (readonly [string, string])[] {
  const exported: Readonly<Record<string, unknown>> = styles;
  const samples: (readonly [string, string])[] = [];
  for (const [name, value] of Object.entries(exported)) {
    if (NOT_RECIPES.has(name)) continue;
    const classes = isRecipeFunction(value) ? value() : value;
    samples.push([name, typeof classes === "string" ? classes : `not a class string: ${name}`]);
  }
  return [
    ...samples,
    ["buttonStyles iconOnly", styles.buttonStyles({ iconOnly: true, size: "lg" })],
    ["linkStyles standalone", styles.linkStyles({ variant: "standalone" })],
    ["linkStyles nav", styles.linkStyles({ variant: "nav" })],
    ["segmentedTrackStyles fullWidth", styles.segmentedTrackStyles({ fullWidth: true })],
    ["segmentStyles fullWidth", styles.segmentStyles({ fullWidth: true, selected: true })],
    ["fieldStyles multiline", styles.fieldStyles({ multiline: true, state: "error" })],
    ["stepperStyles vertical", styles.stepperStyles({ orientation: "vertical" })],
    ["statStyles center", styles.statStyles({ align: "center" })],
    ["cardStyles flat", styles.cardStyles({ tone: "flat", pressable: true })],
    ["listItemStyles plain", styles.listItemStyles({ tone: "plain", pressable: true })],
  ];
}

const FLEX_LAYOUT = /^(flex-(row|col|wrap|nowrap)(-reverse)?|items-.+|justify-.+|gap-.+)$/;
const utilities = (classes: string) =>
  classes
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.split(":").pop() ?? token);

describe("@ampm/ui/styles", () => {
  it("imports only recipes and the class helpers, never React or React Native", () => {
    for (const specifier of specifiersOf(BARREL)) {
      expect(specifier).toMatch(/^\.\/(lib\/[a-z-]+|components\/[a-z-]+\/[a-z-]+\.styles)$/);
    }
    const { files, packages } = importGraph(BARREL);
    expect(files.filter((file) => file.endsWith(".tsx"))).toEqual([]);
    expect(packages.filter((name) => FRAMEWORK.test(name))).toEqual([]);
    expect(packages.filter((name) => !ALLOWED_PACKAGES.has(name))).toEqual([]);
    // The walk really ran: the recipes and the helpers they are built on.
    expect(files).toEqual(
      expect.arrayContaining([
        "styles.ts",
        "lib/cn.ts",
        "lib/variants.ts",
        "components/button/button.styles.ts",
        "components/glass-panel/glass-panel.styles.ts",
        "components/text/text.styles.ts",
      ]),
    );
  });

  it("keeps every recipe that lays out children a flex container on the DOM", () => {
    const offenders = recipeSamples()
      .filter(([, classes]) => utilities(classes).some((utility) => FLEX_LAYOUT.test(utility)))
      .filter(([, classes]) => !utilities(classes).some((u) => u === "flex" || u === "inline-flex"))
      .map(([name]) => name);
    expect(offenders).toEqual([]);
  });

  it("exports only class strings and recipe functions besides the helpers", () => {
    const notClasses = recipeSamples()
      .filter(([, classes]) => classes.startsWith("not a class string"))
      .map(([name]) => name);
    expect(notClasses).toEqual([]);
  });

  it("carries the recipes the website builds its pages from", () => {
    expect(Object.keys(styles)).toEqual(
      expect.arrayContaining([
        "textStyles",
        "glassStyles",
        "focusRingStyles",
        "buttonStyles",
        "buttonLabelStyles",
        "linkStyles",
        "linkLabelStyles",
        "filterChipStyles",
        "segmentStyles",
        "fieldStyles",
        "checkboxBoxStyles",
        "chipStyles",
        "chipTextStyles",
        "badgeStyles",
        "cardStyles",
        "listItemStyles",
        "calloutStyles",
        "stateViewStyles",
      ]),
    );
    expect(styles.buttonStyles({ variant: "primary" })).toContain("bg-brand");
    expect(styles.cardStyles({ tone: "gold" })).toContain("bg-brand/14");
    expect(styles.chipTextStyles({ tone: "success" })).toContain("text-highlight-ink");
  });
});
