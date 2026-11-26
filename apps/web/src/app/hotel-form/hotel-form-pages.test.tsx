import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { HOTEL_FORM_SECTION_KEYS } from "@ampm/core";
import { describe, expect, it, vi } from "vitest";

import { config, middleware } from "@/middleware";

import HotelFormLayout from "./layout";
import NotFound from "./not-found";
import HotelFormOverview, { dynamic as overviewDynamic } from "./overview/page";
import HotelFormSection, { dynamic as sectionDynamic } from "./sections/[section]/page";

/* The form's pages behind the sign-in (D-190 §5): HF-04 and HF-05 as the server sends them. */

const next = vi.hoisted(() => ({ notFound: new Error("NEXT_HTTP_ERROR_FALLBACK;404") }));

// Rendered outside Next: the pages ask its router where to go, and a mistyped section is not found.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  notFound: () => {
    throw next.notFound;
  },
}));

const INNER_PAGES = [
  "/hotel-form/overview",
  ...HOTEL_FORM_SECTION_KEYS.map((key) => `/hotel-form/sections/${key}`),
  "/hotel-form/review",
  "/hotel-form/status",
];

/** A section page's props as Next hands them, for the key in its address. */
const propsFor = (section: string) => ({
  params: Promise.resolve({ section }),
  searchParams: Promise.resolve({}),
});

const pageOf = (element: ReactElement) =>
  renderToStaticMarkup(<HotelFormLayout>{element}</HotelFormLayout>);

describe("the overview and the sections, as the server sends them", () => {
  it("render per request (D-046), so the nonce CSP reaches Next's scripts", () => {
    expect(overviewDynamic).toBe("force-dynamic");
    expect(sectionDynamic).toBe("force-dynamic");
  });

  it("send only an opening card: the request and its answers are read in the browser, in the session", async () => {
    for (const html of [
      pageOf(<HotelFormOverview />),
      pageOf(await HotelFormSection(propsFor("rooms"))),
    ]) {
      expect(html).toMatch(/<p role="status"[^>]*>Opening your form…<\/p>/);
      expect(html).not.toContain("<nav");
      expect(html).not.toContain('href="/contact#chat"');
    }
  });

  it("answer a section's mistyped key with the not-found page, inside the form's frame", async () => {
    await expect(HotelFormSection(propsFor("spa"))).rejects.toBe(next.notFound);
    const html = pageOf(<NotFound />);
    expect(html).toMatch(
      /<h1 [^>]*>This page <span class="text-brand">isn&#x27;t part of the form\.<\/span><\/h1>/,
    );
    expect(html).toMatch(/<a [^>]*href="\/hotel-form\/overview"[^>]*>/);
    expect(html).not.toContain('href="/"');
  });
});

describe("the form's headers and CSP on every page (middleware matcher)", () => {
  it("run the middleware on each of the form's pages, and not on Next's static files", () => {
    for (const url of INNER_PAGES)
      expect(unstable_doesMiddlewareMatch({ config, url }), url).toBe(true);
    expect(unstable_doesMiddlewareMatch({ config, url: "/_next/static/chunks/main.js" })).toBe(
      false,
    );
  });

  it("send no referrer, no index and no store, with the nonce CSP and the API's images, on each", () => {
    for (const url of INNER_PAGES) {
      const response = middleware(new NextRequest(`https://site.example${url}`));
      expect(response.headers.get("referrer-policy"), url).toBe("no-referrer");
      expect(response.headers.get("x-robots-tag"), url).toBe("noindex, nofollow, noarchive");
      expect(response.headers.get("cache-control"), url).toBe("no-store");
      const csp = response.headers.get("content-security-policy") ?? "";
      expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
      expect(csp).toContain("img-src 'self' data: blob: http://localhost:3900");
    }
  });
});
