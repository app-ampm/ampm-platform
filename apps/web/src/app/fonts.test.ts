import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { webFontVariables } from "@ampm/tokens";

// next/font cannot run under Vitest, so the loaders' literal options are checked in the source.
const source = readFileSync(fileURLToPath(new URL("fonts.ts", import.meta.url)), "utf8");

describe("site fonts", () => {
  it("declares exactly the CSS variables the tokens' web preset reads", () => {
    for (const variable of Object.values(webFontVariables))
      expect(source).toContain(`variable: "${variable}"`);
  });

  it("loads the Peacock Night typefaces", () => {
    expect(source).toMatch(
      /import \{ Gilda_Display, Manrope, Rozha_One \} from "next\/font\/google"/,
    );
  });
});
