import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AboutPage } from "./about-page";

/** PUB-05 as the server sends it: the mock's copy, the team by role (no names) and the two ways in. */
describe("about page", () => {
  const html = renderToStaticMarkup(<AboutPage />);

  it("opens with the heading, its close in gold, and the story", () => {
    expect(html).toMatch(/<h1 [^>]*id="about-heading"/);
    expect(html).toContain(
      'One team, from the first call <span class="text-brand">to the last departure.</span>',
    );
    expect(html).toContain("We started with hotels");
  });

  it("states the three principles in order", () => {
    const titles = [
      ...html.matchAll(
        /<h2[^>]*>(Dated, not guessed|Nothing without your yes|Ready before it(?:&#x27;|')s live)</g,
      ),
    ].map((match) => match[1]);
    expect(titles).toHaveLength(3);
    expect(titles[0]).toBe("Dated, not guessed");
    expect(titles[1]).toBe("Nothing without your yes");
  });

  it("shows the team as four portrait placeholders with roles and no names", () => {
    expect(html.match(/role="img" aria-label="Portrait"/g)).toHaveLength(4);
    const roles = [...html.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map((match) => match[1]);
    expect(roles).toEqual(["Founder", "Hotel team", "Production", "Guests and hospitality"]);
  });

  it("closes with the demo request and the contact page", () => {
    expect(html).toMatch(/<section[^>]*aria-labelledby="about-cta-heading"/);
    expect(html).toMatch(/href="\/contact\?type=demo"[^>]*><span[^>]*>Request a demo<\/span>/);
    expect(html).toMatch(/href="\/contact"[^>]*><span[^>]*>Contact us<\/span>/);
  });
});
