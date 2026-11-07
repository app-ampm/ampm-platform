import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SiteHeader } from "./site-header";

/**
 * The top bar (W1, W8) rendered to static markup, as the server sends it: every link's destination
 * and the phone menu's closed state. Opening the menu is browser behaviour (Playwright, later).
 */
function hrefsIn(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1] ?? "");
}

describe("site header", () => {
  const html = renderToStaticMarkup(<SiteHeader />);

  it("links the five pages in the mock's order", () => {
    const pages = hrefsIn(html).filter((href) =>
      ["/how-it-works", "/destinations", "/services", "/about", "/contact"].includes(href),
    );
    expect(pages).toEqual(["/how-it-works", "/destinations", "/services", "/about", "/contact"]);
  });

  it("opens client sign-in on the portal's sign-in (NEXT_PUBLIC_PORTAL_URL, local by default)", () => {
    expect(html).toContain('href="http://localhost:8082/sign-in"');
    expect(html).toContain(">Client sign-in<");
  });

  it("sends both demo actions to the contact page's demo request", () => {
    const demo = hrefsIn(html).filter((href) => href === "/contact?type=demo");
    // The desktop "Request a demo" and the phone bar's "Demo" pill.
    expect(demo).toHaveLength(2);
    expect(html).toContain('aria-label="Request a demo"');
  });

  it("links the wordmark home", () => {
    expect(html).toMatch(/<a(?=[^>]*aria-label="AMPM home")(?=[^>]*href="\/")[^>]*>AMPM<\/a>/);
  });

  it("names the navigation and renders the phone menu closed", () => {
    expect(html).toContain('<nav aria-label="Main"');
    expect(html).toMatch(/<button[^>]*aria-expanded="false"[^>]*aria-controls="site-menu"/);
    // The panel is portalled in the browser only, never in the server markup.
    expect(html).not.toContain('role="dialog"');
  });
});
