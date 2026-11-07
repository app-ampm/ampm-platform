import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Page, { dynamic, metadata } from "./page";

/** The route renders per request (D-046: the strict-nonce CSP) with its own title. */
describe("/how-it-works route", () => {
  it("renders per request, under its own title and description", () => {
    expect(dynamic).toBe("force-dynamic");
    expect(metadata.title).toBe("How it works · AMPM");
    expect(metadata.description).toMatch(/^Three stages\. Pay for the one you need\./);
  });

  it("renders the How it works page", () => {
    expect(renderToStaticMarkup(<Page />)).toMatch(/<h1 [^>]*id="how-it-works-heading"/);
  });
});
