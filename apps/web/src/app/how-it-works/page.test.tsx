import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import Page, { dynamic, metadata } from "./page";

// The route reads the plan catalogue; the reader has its own tests (plan-price.test.ts).
vi.mock("@/features/how-it-works/plan-price", () => ({
  fetchPlanPrice: vi.fn(async () => "₹50,000"),
}));

/** The route renders per request (D-046: the strict-nonce CSP) with its own title. */
describe("/how-it-works route", () => {
  it("renders per request, under its own title and description", () => {
    expect(dynamic).toBe("force-dynamic");
    expect(metadata.title).toBe("How it works · AMPM");
    expect(metadata.description).toMatch(/^Three stages\. Pay for the one you need\./);
  });

  it("renders the How it works page with the catalogue price on hotel discovery", async () => {
    const html = renderToStaticMarkup(await Page());
    expect(html).toMatch(/<h1 [^>]*id="how-it-works-heading"/);
    expect(html.match(/₹50,000/g)).toHaveLength(1);
  });
});
