#!/usr/bin/env node
/**
 * Class audit: fails when source code uses a Tailwind class the project's presets do not generate.
 *
 * Tailwind drops an unknown class without a word, so a typo, an opacity step outside the tokens
 * (`bg-brand/15`), a retired token (`shadow-sm`) or an arbitrary value simply renders nothing. This
 * audit makes that a lint error (.claude/rules/styling.md: theme values come only from the tokens).
 *
 *   node class-audit.mjs native src ../../packages/ui/src   # Expo app and packages/ui
 *   node class-audit.mjs web src                            # the Next.js site
 *
 * It reads the class strings with the TypeScript parser: `className` and `*ClassName` props, the
 * arguments of `cn`, `variants`, `cva`, `clsx` and `twMerge`, and every string in a `*.styles.ts`
 * recipe file. Each class is then run through Tailwind with the workspace's presets: `native` mode uses
 * NativeWind's preset (web and native builds) followed by `@ampm/tokens/tailwind.preset`, and a class
 * must exist on both platforms unless it carries a platform variant (`web:`, `native:`, `ios:`,
 * `android:`); `web` mode uses `@ampm/tokens/tailwind.preset.web`. Tests are skipped.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const [mode, ...dirs] = process.argv.slice(2);
if (!["native", "web"].includes(mode) || dirs.length === 0) {
  process.stderr.write("usage: class-audit.mjs <native|web> <dir>...\n");
  process.exit(2);
}

const require = createRequire(path.join(process.cwd(), "package.json"));
const ts = require("typescript");

const CLASS_CALLS = new Set(["cn", "variants", "cva", "clsx", "twMerge"]);
/** Marker classes that generate no CSS of their own. */
const MARKERS = new Set(["group", "peer", "dark"]);

function sourceFiles(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|d)\.tsx?$/.test(entry.name))
      out.push(full);
  }
  return out;
}

/** A token that reads like a Tailwind utility (for recipe files, whose strings also hold variant and tone names). */
const STANDALONE =
  "absolute|relative|fixed|sticky|static|flex|inline-flex|grid|inline-grid|block|inline-block|inline|contents|hidden|grow|shrink|truncate|uppercase|lowercase|capitalize|normal-case|italic|not-italic|underline|no-underline|tabular-nums|transition|visible|invisible|sr-only|antialiased|border|rounded|shadow|ring|outline|outline-none";
const PREFIXED =
  "bg|text|border|rounded|p[trblxy]?|m[trblxy]?|gap|space|w|h|min|max|size|flex|grow|shrink|basis|items|justify|self|content|place|inset|top|bottom|left|right|z|font|leading|tracking|shadow|ring|opacity|overflow|grid|col|row|backdrop|blur|aspect|object|line-clamp|whitespace|transition|duration|ease|delay|translate|scale|rotate|outline|order|pointer-events|select|cursor|fill|stroke|list|decoration|animate|divide|align|break";
/** A token that reads like a Tailwind utility (recipe files also hold variant and tone names, e.g. "left"). */
const UTILITY = new RegExp(`^!?(?:[a-z0-9-]+:)*-?(?:(?:${STANDALONE})$|(?:${PREFIXED})-)`);

function addWords(
  text,
  at,
  file,
  found,
  { trimStart = false, trimEnd = false, utilitiesOnly = false } = {},
) {
  const words = text.split(/\s+/);
  if (trimStart && !/^\s/.test(text)) words.shift();
  if (trimEnd && !/\s$/.test(text)) words.pop();
  const { line } = file.getLineAndCharacterOfPosition(at);
  for (const word of words) {
    if (!word || (utilitiesOnly && !UTILITY.test(word))) continue;
    found.push({ token: word, line: line + 1 });
  }
}

function addLiteral(n, file, found, options) {
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
    addWords(n.text, n.getStart(file), file, found, options);
    return true;
  }
  if (ts.isTemplateExpression(n)) {
    addWords(n.head.text, n.getStart(file), file, found, { ...options, trimEnd: true });
    n.templateSpans.forEach((span, i) => {
      collectClassExpr(span.expression, file, found);
      const last = i === n.templateSpans.length - 1;
      addWords(span.literal.text, span.literal.getStart(file), file, found, {
        ...options,
        trimStart: true,
        trimEnd: !last,
      });
    });
    return true;
  }
  return false;
}

/** A variants()/cva() config: classes are the values under `variants` and the `class` of compound variants. */
function collectVariantsConfig(n, file, found) {
  if (!ts.isObjectLiteralExpression(n)) return collectClassExpr(n, file, found);
  for (const prop of n.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const name = prop.name.getText(file).replace(/["']/g, "");
    if (name === "defaultVariants") continue;
    if (name === "variants" && ts.isObjectLiteralExpression(prop.initializer)) {
      for (const group of prop.initializer.properties) {
        if (!ts.isPropertyAssignment(group) || !ts.isObjectLiteralExpression(group.initializer))
          continue;
        for (const option of group.initializer.properties)
          if (ts.isPropertyAssignment(option)) collectClassExpr(option.initializer, file, found);
      }
    } else if (name === "compoundVariants" && ts.isArrayLiteralExpression(prop.initializer)) {
      for (const entry of prop.initializer.elements) {
        if (!ts.isObjectLiteralExpression(entry)) continue;
        for (const p of entry.properties)
          if (ts.isPropertyAssignment(p) && /^"?class(Name)?"?$/.test(p.name.getText(file)))
            collectClassExpr(p.initializer, file, found);
      }
    }
  }
}

/** The strings in class positions of an expression: literals, branches, `&&` operands, arrays, class helpers. */
function collectClassExpr(n, file, found) {
  if (addLiteral(n, file, found)) return;
  if (ts.isParenthesizedExpression(n) || ts.isJsxExpression(n) || ts.isAsExpression(n)) {
    if (n.expression) collectClassExpr(n.expression, file, found);
  } else if (ts.isConditionalExpression(n)) {
    collectClassExpr(n.whenTrue, file, found);
    collectClassExpr(n.whenFalse, file, found);
  } else if (ts.isBinaryExpression(n)) {
    const op = n.operatorToken.kind;
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) collectClassExpr(n.right, file, found);
    if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) {
      collectClassExpr(n.left, file, found);
      collectClassExpr(n.right, file, found);
    }
  } else if (ts.isArrayLiteralExpression(n)) {
    n.elements.forEach((e) => collectClassExpr(e, file, found));
  } else if (ts.isObjectLiteralExpression(n)) {
    // clsx({ "bg-brand": isActive }): the keys are the classes.
    for (const prop of n.properties)
      if (ts.isPropertyAssignment(prop) && ts.isStringLiteral(prop.name))
        addLiteral(prop.name, file, found);
  } else if (
    ts.isCallExpression(n) &&
    ts.isIdentifier(n.expression) &&
    CLASS_CALLS.has(n.expression.text)
  ) {
    const isRecipe = n.expression.text === "variants" || n.expression.text === "cva";
    n.arguments.forEach((arg, i) =>
      isRecipe && i === 1
        ? collectVariantsConfig(arg, file, found)
        : collectClassExpr(arg, file, found),
    );
  }
}

/** Every string under a node, utilities only: recipe files hold class strings next to variant and tone names. */
function collectRecipeStrings(node, file, found) {
  const visit = (n) => {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n) || ts.isTypeNode(n)) return;
    if (ts.isPropertyAssignment(n)) return visit(n.initializer);
    if (addLiteral(n, file, found, { utilitiesOnly: true })) return;
    ts.forEachChild(n, visit);
  };
  visit(node);
}

function classesIn(fileName) {
  const text = fs.readFileSync(fileName, "utf8");
  const file = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found = [];
  if (fileName.endsWith(".styles.ts")) collectRecipeStrings(file, file, found);
  const visit = (n) => {
    if (ts.isJsxAttribute(n) && /className$/i.test(n.name.getText(file)) && n.initializer) {
      collectClassExpr(n.initializer, file, found);
      return;
    }
    if (
      ts.isCallExpression(n) &&
      ts.isIdentifier(n.expression) &&
      CLASS_CALLS.has(n.expression.text)
    ) {
      collectClassExpr(n, file, found);
      return;
    }
    ts.forEachChild(n, visit);
  };
  if (!fileName.endsWith(".styles.ts")) visit(file);
  return found;
}

async function generatedSet(presets, os, candidates) {
  const postcss = require("postcss");
  const tailwind = require("tailwindcss");
  const escape = require("tailwindcss/lib/util/escapeClassName").default;
  const saved = process.env.NATIVEWIND_OS;
  if (os) process.env.NATIVEWIND_OS = os;
  try {
    const result = await postcss([
      tailwind({
        presets,
        content: [{ raw: candidates.join(" ") }],
        corePlugins: { preflight: false },
      }),
    ]).process("@tailwind base; @tailwind components; @tailwind utilities;", { from: undefined });
    return new Set(candidates.filter((c) => result.css.includes(`.${escape(c)}`)));
  } finally {
    if (saved === undefined) delete process.env.NATIVEWIND_OS;
    else process.env.NATIVEWIND_OS = saved;
  }
}

/** NativeWind picks its web or native preset from NATIVEWIND_OS when the module loads. */
function nativewindPreset(os) {
  const key = require.resolve("nativewind/preset");
  for (const cached of Object.keys(require.cache)) {
    if (cached.includes(`${path.sep}nativewind${path.sep}`)) delete require.cache[cached];
  }
  const saved = process.env.NATIVEWIND_OS;
  process.env.NATIVEWIND_OS = os;
  try {
    return require(key);
  } finally {
    if (saved === undefined) delete process.env.NATIVEWIND_OS;
    else process.env.NATIVEWIND_OS = saved;
  }
}

async function main() {
  const where = new Map();
  for (const dir of dirs) {
    for (const fileName of sourceFiles(path.resolve(dir), [])) {
      for (const { token, line } of classesIn(fileName)) {
        if (MARKERS.has(token) || where.has(token)) continue;
        where.set(token, `${path.relative(process.cwd(), fileName)}:${line}`);
      }
    }
  }
  const candidates = [...where.keys()];
  let ok;
  if (mode === "web") {
    ok = await generatedSet([require("@ampm/tokens/tailwind.preset.web")], undefined, candidates);
  } else {
    const tokens = require("@ampm/tokens/tailwind.preset");
    const onWeb = await generatedSet([nativewindPreset("web"), tokens], "web", candidates);
    const onNative = await generatedSet([nativewindPreset("ios"), tokens], "ios", candidates);
    const nativeOnly = /(^|:)(native|ios|android):/;
    const webOnly = /(^|:)web:/;
    ok = new Set(
      candidates.filter(
        (c) => (onWeb.has(c) || nativeOnly.test(c)) && (onNative.has(c) || webOnly.test(c)),
      ),
    );
  }
  const missing = candidates
    .filter((c) => !ok.has(c))
    .sort((a, b) => where.get(a).localeCompare(where.get(b)));
  for (const c of missing) process.stdout.write(`${where.get(c)}  ${c}\n`);
  process.stdout.write(
    `class-audit (${mode}): ${candidates.length} classes, ${missing.length} not generated by the presets\n`,
  );
  if (missing.length > 0) process.exit(1);
}

await main();
