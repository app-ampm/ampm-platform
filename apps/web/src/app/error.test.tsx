import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import RouteError from "./error";
import GlobalError from "./global-error";

// next/font runs only under Next's compiler (fonts.test.ts reads its source instead).
vi.mock("./fonts", () => ({ fontVariables: "font-variables" }));

const ERROR = new Error("A page bug");

describe("error boundaries (D-160)", () => {
  it("draws the error page inside the site's frame for a page that throws", () => {
    const html = renderToStaticMarkup(<RouteError error={ERROR} retry={() => undefined} />);
    expect(html).not.toMatch(/<html|<body/);
    expect(html).toMatch(/<h1 [^>]*>We couldn&#x27;t load/);
    expect(html).toContain("Try again");
  });

  it("brings its own document, canvas and fonts when the root layout itself fails", () => {
    const html = renderToStaticMarkup(<GlobalError error={ERROR} retry={() => undefined} />);
    // React hoists the error page's <title> into the document's head.
    expect(html).toMatch(
      /^<html lang="en" class="font-variables"><head><title>Something went wrong · AMPM<\/title><\/head><body class="[^"]*bg-surface[^"]*">/,
    );
    expect(html).toMatch(/<main class="relative isolate[^"]*">/);
    expect(html).toMatch(/<h1 [^>]*>We couldn&#x27;t load/);
    expect(html).not.toContain("A page bug");
  });
});
