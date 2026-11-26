import { renderToStaticMarkup } from "react-dom/server";

import { HOTEL_FORM_SESSION_REFUSAL_MESSAGES } from "@ampm/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EMPTY_DETAILS } from "./details.form";
import { HOTEL_FORM_COPY } from "./hotel-form-copy";
import { HotelFormFrame } from "./hotel-form-frame";
import {
  HELP,
  ME,
  ON_SCREEN,
  buttonsIn,
  decoded,
  flowAt,
  overviewOf,
  screenOf,
  tagsWith,
} from "./screen.test-utils";
import type { MeView } from "./use-hotel-form-flow";

/*
 * Signed in, HF-08, the opening card and the form's frame (D-189 §8). Signed in, the person lands on the
 * overview (HF-04, D-190 §5), which kept the signed-in page's label, note, status, details and Sign out.
 */

vi.mock("@/components/bot-check/use-bot-check", () => ({
  useBotCheck: () => ({
    ref: () => undefined,
    check: { status: "checking" },
    token: null,
    reset: () => undefined,
  }),
}));

const NOW = Date.parse("2026-11-25T10:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => vi.useRealTimers());

const loaded: MeView = { data: ME, isLoading: false, error: null, retry: () => undefined };
const signedIn = (reverify: null | { step: "details" } = null, me = loaded, state = {}) =>
  overviewOf(flowAt({ phase: { kind: "signed_in", reverify }, session: "s", ...state }, { me }));

describe("signed in", () => {
  it("leaves the sign-in for the overview: the sign-in itself shows only that it is opening the form", () => {
    const html = screenOf(flowAt({ phase: { kind: "signed_in", reverify: null }, session: "s" }));
    expect(html).toMatch(/<p role="status"[^>]*>Opening your form…<\/p>/);
    expect(html).not.toContain("<h1");
  });

  it("shows AMPM's label and note, the status as a word, your details, and Sign out", () => {
    const html = decoded(signedIn());
    expect(html).toMatch(/<h1 [^>]*>Seasonal refresh 2027<\/h1>/);
    expect(html).toContain("Signed in as Asha Rao");
    expect(html).toContain("A note from AMPM");
    expect(html).toContain("Please add the new banquet hall.");
    expect(html).toMatch(/Status<\/span><span class="[^"]*"><span class="[^"]*">Open<\/span>/);
    expect(html).toContain("Asha Rao · General Manager");
    expect(buttonsIn(html)).toEqual(["Edit your details", "Sign out"]);
  });

  it("names the request plainly when AMPM gave it no label, and leaves out an empty note", () => {
    const me = { ...ME, request: { ...ME.request, displayLabel: null, staffNote: null } };
    const html = decoded(signedIn(null, { ...loaded, data: me }));
    expect(html).toContain(HOTEL_FORM_COPY.signedIn.defaultTitle);
    expect(html).not.toContain("A note from AMPM");
  });

  it("offers no edit once the request shows its status only", () => {
    const me = { ...ME, request: { ...ME.request, status: "merged" as const } };
    const html = signedIn(null, { ...loaded, data: me });
    expect(html).toContain(">Complete<");
    expect(buttonsIn(html)).toEqual(["Sign out"]);
  });

  it("asks for a new code in place over the page, the details typed filled in, the page kept below", () => {
    const message = HOTEL_FORM_SESSION_REFUSAL_MESSAGES.session_expired;
    const claim = { ...EMPTY_DETAILS, fullName: "Asha Rao", mobile: "70000 01234" };
    const html = signedIn({ step: "details" }, loaded, {
      claim,
      notice: { message, retryAt: null, isReload: false },
    });
    expect(html).toMatch(/<h2 id="hf-reverify-heading"[^>]*>Enter a new code to continue<\/h2>/);
    expect(html).toContain(message);
    expect(tagsWith(html, "input", 'id="hf-mobile"')[0]).toContain('value="70000 01234"');
    expect(html).toMatch(/<h1 [^>]*>Seasonal refresh 2027<\/h1>/);
    expect(html.indexOf("hf-reverify-heading")).toBeLessThan(html.indexOf("Your details"));
  });

  it("takes the new code in place too", () => {
    const html = overviewOf(
      flowAt(
        {
          phase: {
            kind: "signed_in",
            reverify: { step: "code", issued: ON_SCREEN, resendAt: NOW + 30_000 },
          },
        },
        { me: loaded },
      ),
    );
    expect(html).toContain('id="hf-code"');
    expect(html).toContain("Seasonal refresh 2027");
  });

  it("lets the page move focus to the panel's heading, which only the page can focus", () => {
    const [heading] = tagsWith(signedIn({ step: "details" }), "h2", 'id="hf-reverify-heading"');
    expect(heading).toContain('tabindex="-1"');
  });

  it("makes the new code the page when there is no request to show yet", () => {
    const empty: MeView = {
      data: undefined,
      isLoading: false,
      error: null,
      retry: () => undefined,
    };
    const html = signedIn({ step: "details" }, empty);
    expect(html).toMatch(/<h1 [^>]*>Enter a new code to continue<\/h1>/);
    expect(html).toContain('id="hf-full-name"');
  });

  it("gives that page's code step a heading of its own, so focus moves to it when the step changes", () => {
    const empty: MeView = {
      data: undefined,
      isLoading: false,
      error: null,
      retry: () => undefined,
    };
    const details = signedIn({ step: "details" }, empty);
    const reverify = { step: "code" as const, issued: ON_SCREEN, resendAt: NOW + 30_000 };
    const code = overviewOf(
      flowAt({ phase: { kind: "signed_in", reverify }, session: null }, { me: empty }),
    );
    const idOf = (html: string) => /<h1 id="([^"]+)"/.exec(html)?.[1];
    expect(idOf(details)).toBeDefined();
    expect(idOf(code)).toBeDefined();
    expect(idOf(code)).not.toBe(idOf(details));
  });

  it("shows a loading card, and a failure with Try again", () => {
    const loading: MeView = {
      data: undefined,
      isLoading: true,
      error: null,
      retry: () => undefined,
    };
    expect(signedIn(null, loading)).toMatch(/role="status"[^>]*>Loading your request…<\/p>/);
    const failed = { ...loading, isLoading: false, error: HOTEL_FORM_COPY.errors.network };
    const html = decoded(signedIn(null, failed));
    expect(html).toContain(HOTEL_FORM_COPY.errors.network);
    expect(buttonsIn(html)).toEqual(["Try again"]);
  });
});

describe("HF-08, Link not active", () => {
  const gone = (message: string | null, helpContact: string | null = HELP) =>
    decoded(screenOf(flowAt({ phase: { kind: "gone", message }, helpContact })));

  it("says the link is not active, with AMPM's help contact", () => {
    const html = gone(null);
    expect(html).toMatch(
      /<h1 [^>]*>This link <span class="text-brand">isn't active\.<\/span><\/h1>/,
    );
    expect(html).toContain(HOTEL_FORM_COPY.gone.body);
    expect(html).toContain("Contact AMPM");
    expect(html).toContain(HELP);
  });

  it("gives the API's reason when there is one, and whom to ask while AMPM has set no contact", () => {
    const html = gone(HOTEL_FORM_SESSION_REFUSAL_MESSAGES.link_changed, null);
    expect(html).toContain("AMPM replaced this link. Ask AMPM for the new one.");
    expect(html).toContain(HOTEL_FORM_COPY.helpFallback);
  });

  it("says how to open the form when the page has no link", () => {
    const html = decoded(screenOf(flowAt({ phase: { kind: "no_link" } })));
    expect(html).toContain("This page needs");
    expect(html).toContain(HOTEL_FORM_COPY.noLink.body);
  });

  it("offers to try again when the link could not be opened, once the wait is over", () => {
    const flow = flowAt({
      phase: { kind: "unreachable", message: HOTEL_FORM_COPY.errors.network, retryAt: NOW + 9_000 },
    });
    expect(buttonsIn(screenOf(flow))).toEqual(["Try again in 0:09"]);
  });
});

describe("opening", () => {
  it("shows the opening card, its words in a status region, before the link is read", () => {
    const html = screenOf(flowAt({ phase: { kind: "opening" } }));
    expect(html).toMatch(/<p role="status"[^>]*>Opening your link…<\/p>/);
    expect(html).not.toContain("<h1");
  });
});

describe("the form's frame", () => {
  const html = renderToStaticMarkup(
    <HotelFormFrame>
      <p>Step</p>
    </HotelFormFrame>,
  );

  it("draws the wordmark as plain text, the step in main, and no navigation or chat pill", () => {
    expect(html).toMatch(/^<a href="#main"/);
    expect(html).toMatch(/<p class="[^"]*font-display[^"]*">AMPM<\/p>/);
    expect(html).toMatch(/<main id="main"[^>]*><div[^>]*><p>Step<\/p><\/div><\/main>/);
    expect(html).not.toContain("<nav");
    expect(html).not.toContain('href="/contact#chat"');
    expect([...html.matchAll(/<a /g)]).toHaveLength(1);
  });
});
