import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import SiteLayout from "./(site)/layout";
import RootLayout, { dynamic } from "./layout";

// next/font runs only under Next's compiler (fonts.test.ts reads its source instead).
vi.mock("./fonts", () => ({ fontVariables: "font-variables" }));

/*
 * The site's frame and the root document are apart (D-189 §8): the root layout is the document alone,
 * so a section of the site with a frame of its own (the hotel form) gets no top bar, footer or chat pill;
 * the marketing pages take theirs from the (site) group's layout.
 */
describe("root layout", () => {
  const html = renderToStaticMarkup(
    <RootLayout params={Promise.resolve({})}>
      <p>Page</p>
    </RootLayout>,
  );

  it("is the midnight document, rendered per request (D-046)", () => {
    expect(dynamic).toBe("force-dynamic");
    expect(html).toMatch(
      /^<html lang="en" class="font-variables scroll-pt-28"><head><\/head><body class="[^"]*bg-surface[^"]*"><p>Page<\/p><\/body><\/html>$/,
    );
  });

  it("draws no chrome of its own", () => {
    expect(html).not.toContain("<header");
    expect(html).not.toContain("<footer");
    expect(html).not.toContain('href="/contact#chat"');
  });
});

describe("the site's layout", () => {
  const html = renderToStaticMarkup(
    <SiteLayout>
      <p>Page</p>
    </SiteLayout>,
  );

  it("frames every marketing page: the skip link, the top bar, the page in main, the footer", () => {
    expect(html).toMatch(/^<a href="#main"[^>]*>/);
    expect(html).toContain("<header");
    expect(html).toMatch(/<main id="main"[^>]*><p>Page<\/p><\/main>/);
    expect(html).toContain("<footer");
  });

  it("floats the chat pill over the page", () => {
    expect(html).toContain('href="/contact#chat"');
  });
});
