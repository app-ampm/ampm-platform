import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import NotFound, { metadata } from "./not-found";

/** Every address without a page lands here, inside the site's frame (the root layout draws it). */
describe("not-found route", () => {
  it("is titled as the missing page, with its one line as the description", () => {
    expect(metadata.title).toBe("Page not found · AMPM");
    expect(metadata.description).toMatch(/^The link may be out of date/);
  });

  it("says the page isn't here, as the page's one h1 with its gold ending", () => {
    const html = renderToStaticMarkup(<NotFound />);
    expect(html.match(/<h1 /g)).toHaveLength(1);
    expect(html).toMatch(
      /<h1 [^>]*>This page <span class="text-brand">isn&#x27;t here\.<\/span><\/h1>/,
    );
    expect(html).toContain("Page not found");
  });

  it("leads back to the home page (the gold action) and on to the contact page", () => {
    const html = renderToStaticMarkup(<NotFound />);
    const links = [...html.matchAll(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g)].map((m) => [
      m[1],
      m[2]?.replace(/<[^>]+>/g, ""),
    ]);
    expect(links).toEqual([
      ["/", "Back to home"],
      ["/contact", "Contact us"],
    ]);
  });
});
