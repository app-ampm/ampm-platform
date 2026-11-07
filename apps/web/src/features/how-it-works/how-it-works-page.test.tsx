import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { COMPARISON_ROWS, FAQ_ITEMS, STAGE_PLANS } from "./how-it-works-content";
import { HowItWorksPage } from "./how-it-works-page";

/** Text as React writes it into HTML (apostrophes and ampersands escaped). */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** PUB-02 + PUB-07 rendered as the server sends it: the mock's copy, its plans and its links. */
describe("how it works page", () => {
  // The price comes from the plan catalogue at render time (plan-price.ts); here it is the seed's.
  const html = renderToStaticMarkup(<HowItWorksPage planPrices={{ hotel_discovery: "₹50,000" }} />);

  it("opens with the hero heading, the gold words emphasised", () => {
    expect(html).toMatch(/<h1 [^>]*id="how-it-works-heading"/);
    expect(html).toContain(
      'Three stages. Pay for <span class="text-brand">the one you need.</span>',
    );
  });

  it("shows the three stages in order, with the price on hotel discovery only", () => {
    const titles = [...html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map((match) => match[1]);
    expect(titles.slice(0, 3)).toEqual(STAGE_PLANS.map((stage) => stage.title));
    expect(html.match(/₹50,000/g)).toHaveLength(1);
    expect(html.match(/>What you get<\/h3>/g)).toHaveLength(3);
    expect(html.match(/>What AMPM does<\/h3>/g)).toHaveLength(3);
    for (const stage of STAGE_PLANS)
      for (const item of [...stage.youGet, ...stage.ampmDoes])
        expect(html).toContain(`>${escapeHtml(item)}</li>`);
  });

  it("leaves the price out, terms kept, when the catalogue could not say", () => {
    const withoutPrice = renderToStaticMarkup(
      <HowItWorksPage planPrices={{ hotel_discovery: null }} />,
    );
    expect(withoutPrice).not.toContain("₹");
    expect(withoutPrice).toContain("One month from the day it activates.");
  });

  it("compares the stages in a table named by its heading, each mark spoken as a word", () => {
    expect(html).toMatch(/<table role="table" aria-labelledby="comparison-heading"/);
    const columns = [...html.matchAll(/<th role="columnheader" scope="col"[^>]*>([^<]+)</g)];
    expect(columns.map((match) => match[1])).toEqual(["Discovery", "Assistance", "Management"]);
    const rows = [...html.matchAll(/<th role="rowheader" scope="row"[^>]*>([^<]+)</g)];
    expect(rows.map((match) => match[1])).toEqual(COMPARISON_ROWS.map((row) => row.label));
    // The mock's ticks: everything in management, assistance from availability checks up.
    expect(html.match(/>Included<\/span>/g)).toHaveLength(16);
    expect(html.match(/>Not included<\/span>/g)).toHaveLength(8);
  });

  it("has one gold action, the demo request, and sends the demo's locations there too", () => {
    const goldLinks = html.match(/<a [^>]*class="(?:[^"]*\s)?bg-brand(?:\s[^"]*)?"/g);
    expect(goldLinks).toHaveLength(1);
    expect(html).toMatch(/href="\/contact\?type=demo"[^>]*><span[^>]*>Request a demo<\/span>/);
    for (const name of ["Udaipur", "Jaipur", "Goa"])
      expect(html).toMatch(
        new RegExp(`<a [^>]*href="/contact\\?type=demo"[^>]*><span [^>]*><span [^>]*>${name}<`),
      );
    expect(html).toContain("Plus a sample wedding, so you can see the planning side.");
  });

  it("marks the demo with the kit's gold badge, a label rather than a needs-you status", () => {
    expect(html).toMatch(
      /<span class="[^"]*\bbg-brand\b[^"]*"><span class="[^"]*\btext-brand-ink\b[^"]*">Demo<\/span><\/span>/,
    );
  });

  it("answers the questions in native disclosures, open as the mock shows them", () => {
    expect(html.match(/<details open=""/g)).toHaveLength(FAQ_ITEMS.length);
    for (const { question, answer } of FAQ_ITEMS) {
      expect(html).toMatch(
        new RegExp(`<summary [^>]*>${escapeHtml(question).replace("?", "\\?")}`),
      );
      expect(html).toContain(`>${escapeHtml(answer)}</p></details>`);
    }
  });
});
