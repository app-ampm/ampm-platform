import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HotelFormLayout, { metadata } from "./layout";
import HotelFormPage, { dynamic } from "./page";

/* /hotel-form as the server sends it (D-189 §8; HF-G10): generic words, no index, the opening card. */
describe("/hotel-form route", () => {
  it("renders per request (D-046) under generic words a link preview may show", () => {
    expect(dynamic).toBe("force-dynamic");
    expect(metadata.title).toBe("Hotel information form · AMPM");
    expect(metadata.description).not.toMatch(/#k=|hfl_/);
  });

  it("asks not to be indexed or archived, and sends no referrer from its tags either", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false, noarchive: true });
    expect(metadata.referrer).toBe("no-referrer");
  });

  it("serves the opening card in its own frame: the link is read in the browser, never on the server", () => {
    const html = renderToStaticMarkup(
      <HotelFormLayout>
        <HotelFormPage />
      </HotelFormLayout>,
    );
    expect(html).toContain("Opening your link…");
    expect(html).not.toContain('href="/contact#chat"');
    expect(html).not.toContain("<nav");
  });
});
