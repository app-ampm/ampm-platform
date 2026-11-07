import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SERVICES } from "./services-content";
import { ServicesPage } from "./services-page";

/** Text as React writes it into HTML (apostrophes and ampersands escaped). */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** PUB-03 rendered as the server sends it: the mock's four services, their pills and their links. */
describe("services page", () => {
  const html = renderToStaticMarkup(<ServicesPage />);

  it("opens with the hero heading, the gold words emphasised", () => {
    expect(html).toMatch(/<h1 [^>]*id="services-heading"/);
    expect(html).toContain('What we <span class="text-brand">take off your hands.</span>');
  });

  it("shows the four services in order, then the closing question", () => {
    const titles = [...html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map((match) => match[1]);
    expect(titles).toEqual([
      "Hotel assistance",
      "Design and décor",
      "Vendor coordination",
      "Complete management",
      "Not sure which you need?",
    ]);
    for (const service of SERVICES) {
      expect(html).toContain(`>Service ${service.number}</p>`);
      expect(html).toContain(`>${escapeHtml(service.description)}</p>`);
      for (const tag of service.tags) expect(html).toContain(`>${escapeHtml(tag)}</li>`);
    }
  });

  it("sends each service's gold link to the enquiry form, the arrow hidden from screen readers", () => {
    for (const { enquiry } of SERVICES)
      expect(html).toMatch(
        new RegExp(`<a [^>]*href="/contact"[^>]*>${enquiry}<span aria-hidden="true">→</span></a>`),
      );
  });

  it("names every photo placeholder and puts every second photo on the right from 1024", () => {
    const photos = [...html.matchAll(/<div role="img" aria-label="([^"]+)" class="([^"]+)"/g)];
    expect(photos.map((match) => match[1])).toEqual([
      "Site visit photo",
      "Décor render",
      "Vendor at work",
      "Wedding day",
    ]);
    const isOnRight = photos.map((match) => match[2]?.split(" ").includes("lg:order-last"));
    expect(isOnRight).toEqual([false, true, false, true]);
  });

  it("closes with the page's one gold action, to how it works", () => {
    const goldLinks = html.match(/<a [^>]*class="(?:[^"]*\s)?bg-brand(?:\s[^"]*)?"[^>]*>/g);
    expect(goldLinks).toHaveLength(1);
    expect(goldLinks?.[0]).toContain('href="/how-it-works"');
    expect(html).toContain("Start with hotel discovery. Everything else can follow.");
  });
});
