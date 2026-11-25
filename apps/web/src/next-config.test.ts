import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { describe, expect, it } from "vitest";

import nextConfig from "../next.config";

/* The static headers next.config sends (HF-G10): none of the site's is doubled on /hotel-form. */

interface HeaderRule {
  readonly source: string;
  readonly headers: readonly { readonly key: string; readonly value: string }[];
}

async function rules(): Promise<readonly HeaderRule[]> {
  return (await nextConfig.headers?.()) ?? [];
}

/** The values a path gets for `key`, matched as Next matches a header rule's source. */
async function valuesFor(path: string, key: string): Promise<string[]> {
  return (await rules())
    .filter((rule) => getPathMatch(rule.source, { strict: true, removeUnnamedParams: true })(path))
    .flatMap((rule) => rule.headers.filter((header) => header.key === key))
    .map((header) => header.value);
}

describe("next.config headers", () => {
  it("send the site's referrer policy everywhere but the hotel form, which sends its own", async () => {
    for (const path of ["/", "/contact", "/hotel-forms", "/_next/static/chunks/main.js"])
      expect(await valuesFor(path, "Referrer-Policy")).toEqual(["strict-origin-when-cross-origin"]);
    for (const path of ["/hotel-form", "/hotel-form/", "/hotel-form/overview"])
      expect(await valuesFor(path, "Referrer-Policy")).toEqual([]);
  });

  it("send the other security headers once on every path, the hotel form's included", async () => {
    // "/" itself is checked on the running site (the e2e): Next's strict matcher reads it apart.
    for (const path of ["/about", "/hotel-form", "/hotel-form/overview"]) {
      expect(await valuesFor(path, "X-Content-Type-Options")).toEqual(["nosniff"]);
      expect(await valuesFor(path, "X-Frame-Options")).toEqual(["DENY"]);
      expect(await valuesFor(path, "Permissions-Policy")).toHaveLength(1);
    }
  });
});
