import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HomePage } from "./home-page";

/** PUB-01 rendered as the server sends it: the mock's copy, its destinations and its links. */
describe("home page", () => {
  const html = renderToStaticMarkup(<HomePage />);

  it("opens with the hero heading, the gold words emphasised", () => {
    expect(html).toMatch(/<h1 [^>]*id="hero-heading"/);
    expect(html).toContain('Weddings, planned <span class="text-brand">end to end.</span>');
  });

  it("sends the hero's actions to the demo request and the destinations", () => {
    expect(html).toMatch(/href="\/contact\?type=demo"[^>]*><span[^>]*>Request a demo<\/span>/);
    expect(html).toMatch(/href="\/destinations"[^>]*><span[^>]*>Explore destinations<\/span>/);
  });

  it("shows the three stages in order with their links", () => {
    const stages = [
      ...html.matchAll(/<h3[^>]*>(Discover hotels|Hotel assistance|Complete management)</g),
    ];
    expect(stages.map((match) => match[1])).toEqual([
      "Discover hotels",
      "Hotel assistance",
      "Complete management",
    ]);
    expect(html).toContain('href="/how-it-works"');
  });

  it("lists six destinations from the mock, and the link to all of them", () => {
    for (const name of ["Udaipur", "Jaipur", "Jodhpur", "Goa", "Kerala", "Mussoorie"])
      expect(html).toContain(`>${name}</h3>`);
    expect(html).toContain("All destinations →");
  });

  it("links the hero's selected-work card to the section it names", () => {
    expect(html).toContain('href="#selected-work"');
    expect(html).toMatch(/<section id="selected-work"/);
  });

  it("closes with the enquiry and the demo request", () => {
    expect(html).toContain('href="/contact"');
    expect(html).toContain("Send an enquiry");
  });

  it("promises WhatsApp only once there is a WhatsApp number to open", () => {
    expect(html).not.toContain("Or message us on WhatsApp");
  });

  it("shows no prices anywhere (the site never quotes a rate)", () => {
    expect(html).not.toMatch(/₹|INR|lakh/);
  });
});
