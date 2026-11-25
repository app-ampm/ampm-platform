import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import nextConfig from "../next.config";
import { HOTEL_FORM_HEADERS } from "./middleware";

/*
 * The production box's .htaccess for the site (deploy/site-ampmverse/htaccess.production.example) against
 * the headers the site sends itself (HF-G10): Apache may add a header only where the page sent none
 * (`setifempty`), never a second value beside the page's own (`always set`, `set`).
 */

const HTACCESS = new URL(
  "../../../deploy/site-ampmverse/htaccess.production.example",
  import.meta.url,
);

/** Each `Header` directive of the file: its action (`always set`, `setifempty`, …) and the header it names. */
function headerDirectives(): { readonly action: string; readonly name: string }[] {
  return readFileSync(HTACCESS, "utf8")
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .filter((words) => words[0] === "Header")
    .map(([, first = "", second = "", third = ""]) =>
      first === "always"
        ? { action: `always ${second}`, name: third.toLowerCase() }
        : { action: first, name: second.toLowerCase() },
    );
}

/** Every header next.config.ts or middleware.ts sets on some page. */
async function sentBySite(): Promise<Set<string>> {
  const rules = (await nextConfig.headers?.()) ?? [];
  return new Set([
    ...rules.flatMap((rule) => rule.headers.map((header) => header.key.toLowerCase())),
    ...Object.keys(HOTEL_FORM_HEADERS),
    "content-security-policy",
  ]);
}

describe("the site's production .htaccess", () => {
  it("only fills in a header the site sends itself, so none is doubled", async () => {
    const sent = await sentBySite();
    const filled = headerDirectives().filter(({ name }) => sent.has(name));
    expect(filled.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "x-content-type-options",
        "x-frame-options",
        "permissions-policy",
        "referrer-policy",
        "x-robots-tag",
      ]),
    );
    for (const { action, name } of filled) expect(action, name).toBe("setifempty");
  });

  it("still sets the headers only the box sends, and strips X-Powered-By", () => {
    const directives = headerDirectives();
    expect(directives).toContainEqual({
      action: "always set",
      name: "strict-transport-security",
    });
    expect(directives).toContainEqual({ action: "always unset", name: "x-powered-by" });
  });
});
