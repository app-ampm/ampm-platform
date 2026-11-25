import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Page, { dynamic, metadata } from "./page";

/** The route renders per request (D-046: the strict-nonce CSP) with its own title. */
describe("/services route", () => {
  it("renders per request, under its own title and description", () => {
    expect(dynamic).toBe("force-dynamic");
    expect(metadata.title).toBe("Services · AMPM");
    expect(metadata.description).toMatch(/^What we take off your hands:/);
  });

  it("renders the Services page", () => {
    expect(renderToStaticMarkup(<Page />)).toMatch(/<h1 [^>]*id="services-heading"/);
  });
});
