import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ButtonLink } from "./button-link";
import { Chip } from "./chip";
import { GlowOrbs } from "./glow-orbs";
import { PhotoPlaceholder } from "./photo-placeholder";
import { SectionHeading } from "./section-heading";

/** The DOM building blocks every page reuses, rendered as the server sends them. */
describe("site building blocks", () => {
  it("ButtonLink is a link styled as the kit's button, gold for primary", () => {
    const html = renderToStaticMarkup(
      <ButtonLink href="/contact?type=demo" size="lg">
        Request a demo
      </ButtonLink>,
    );
    expect(html).toMatch(/^<a [^>]*href="\/contact\?type=demo"/);
    expect(html).toContain("bg-brand");
    expect(html).toContain("rounded-full");
    expect(html).toContain("text-brand-ink");
    expect(html).toContain(">Request a demo</span>");
  });

  it("ButtonLink secondary is the pearl outline", () => {
    const html = renderToStaticMarkup(
      <ButtonLink href="/destinations" variant="secondary">
        Explore destinations
      </ButtonLink>,
    );
    expect(html).toContain("border-primary/40");
    expect(html).not.toContain("bg-brand");
  });

  it("SectionHeading puts the emphasised words in gold", () => {
    const html = renderToStaticMarkup(
      <SectionHeading as="h1" emphasis="end to end.">
        Weddings, planned
      </SectionHeading>,
    );
    expect(html).toMatch(/^<h1 [^>]*class="[^"]*font-display/);
    expect(html).toContain('Weddings, planned <span class="text-brand">end to end.</span>');
  });

  it("PhotoPlaceholder is a named image with its caption, or decoration without a label", () => {
    const named = renderToStaticMarkup(<PhotoPlaceholder label="Wedding photo · Lake Pichola" />);
    expect(named).toContain('role="img"');
    expect(named).toContain('aria-label="Wedding photo · Lake Pichola"');
    expect(named).toContain("bg-stripes-gold");
    const decorative = renderToStaticMarkup(<PhotoPlaceholder tone="peacock" />);
    expect(decorative).toContain('aria-hidden="true"');
    expect(decorative).not.toContain('role="img"');
    expect(decorative).toContain("bg-stripes-peacock");
  });

  it("GlowOrbs is hidden decoration with the page's four orbs", () => {
    const html = renderToStaticMarkup(<GlowOrbs />);
    expect(html).toMatch(/^<div aria-hidden="true" class="[^"]*pointer-events-none/);
    expect(html.match(/bg-glow-(gold|peacock)/g)).toHaveLength(4);
    expect(renderToStaticMarkup(<GlowOrbs variant="card" />).match(/bg-glow-gold/g)).toHaveLength(
      1,
    );
  });

  it("Chip always carries its word, with an optional dot", () => {
    const html = renderToStaticMarkup(
      <Chip tone="success" dot>
        Verified 2 Nov
      </Chip>,
    );
    expect(html).toContain("Verified 2 Nov");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("bg-success");
  });
});
