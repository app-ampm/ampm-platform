import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChatPill } from "./chat-pill";
import { SiteFooter } from "./site-footer";
import { INSTAGRAM_URL } from "./site-links";

/** The opening tag of the element whose class list holds `token`, whatever else it holds. */
function tagWithClass(html: string, token: string): string {
  const pattern = new RegExp(`<[a-z]+ [^>]*class="(?:[^"]*\\s)?${token}(?:\\s[^"]*)?"[^>]*>`);
  return pattern.exec(html)?.[0] ?? "";
}

describe("site footer on every page but home (W2–W6, W8)", () => {
  const html = renderToStaticMarkup(<SiteFooter />);

  it("sends privacy and terms to their own pages, with no placeholder in the footer", () => {
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/terms"');
    expect(html).not.toContain("before the site launches");
  });

  it("offers client sign-in on the portal and the copyright line", () => {
    expect(html).toContain('href="http://localhost:8082/sign-in"');
    expect(html).toContain("© 2026 AMPM");
  });

  it("leaves Instagram out until its address is known", () => {
    expect(INSTAGRAM_URL).toBeNull();
    expect(html).not.toContain("Instagram");
  });

  it("lists the pages for the phone, where the bar hides them", () => {
    for (const href of ["/how-it-works", "/destinations", "/services", "/about", "/contact"])
      expect(html).toContain(`href="${href}"`);
  });

  it("draws no card on a phone (W8) and the glass card from a tablet", () => {
    expect(tagWithClass(html, "md:hidden")).not.toContain("backdrop-blur-glass");
    const card = tagWithClass(html, "web:backdrop-blur-glass");
    expect(card).toContain("hidden");
    expect(card).toContain("md:flex");
  });

  it("keeps the home page's line and columns to the home page", () => {
    expect(html).not.toContain("Destination weddings in India");
    expect(html).not.toContain(">Explore<");
  });
});

describe("site footer on the home page (W1, W8)", () => {
  const html = renderToStaticMarkup(<SiteFooter variant="home" />);

  it("gives AMPM's line and the Explore column without Contact", () => {
    expect(html).toContain("Destination weddings in India, planned and run by one team.");
    expect(html).toMatch(/<nav aria-labelledby="footer-explore"/);
    const explore = html.slice(html.indexOf('aria-labelledby="footer-explore"'));
    const column = explore.slice(0, explore.indexOf("</nav>"));
    for (const href of ["/how-it-works", "/destinations", "/services", "/about"])
      expect(column).toContain(`href="${href}"`);
    expect(column).not.toContain('href="/contact"');
  });

  it("leads the Contact column to the enquiry while AMPM's channels have no address", () => {
    const contact = html.slice(html.indexOf('aria-labelledby="footer-contact"'));
    const column = contact.slice(0, contact.indexOf("</nav>"));
    expect(column).toMatch(/href="\/contact"[^>]*>Send an enquiry</);
  });

  it("closes with the copyright, privacy, terms and client sign-in", () => {
    expect(html).toContain("© 2026 AMPM");
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="http://localhost:8082/sign-in"');
  });
});

describe("chat pill", () => {
  const html = renderToStaticMarkup(<ChatPill />);

  it("opens the contact page's chat section, with the online line", () => {
    expect(html).toContain('href="/contact#chat"');
    expect(html).toContain("Chat with AMPM");
    expect(html).toContain("We&#x27;re online");
  });

  it("wears gold glass with a gold dot, gold being the colour of what is live (W1, W8)", () => {
    const pill = tagWithClass(html, "bg-brand/14");
    expect(pill).toContain("border-brand/50");
    expect(html).toMatch(/<span aria-hidden="true" class="[^"]*\bbg-brand\b[^"]*"><\/span>/);
    expect(html).not.toContain("bg-highlight");
  });
});
