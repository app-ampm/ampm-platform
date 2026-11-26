// @vitest-environment jsdom
import { act } from "react";
import type * as ApiClient from "@ampm/api-client";
import {
  HOTEL_FORM_ACCURACY_DECLARATION,
  HOTEL_FORM_DISPLAY_AUTHORISATION,
  HOTEL_FORM_ERRORS,
  type HotelFormDraftView,
} from "@ampm/core";
import { buttonNamed, byId, type Mounted } from "@ampm/web-forms/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DRAFT, EDITED_AT, draftWith } from "../draft.test-fixtures";
import { SESSION } from "../screen.test-utils";
import {
  NOW,
  READY,
  declare,
  linksTo,
  mountReview,
  pressSubmit,
  reviewSite,
} from "./review.test-utils";

/* HF-06, Review and submit, in a browser (D-190 §5): the summary, the warnings, 7.4, 7.5 and Submit. */

const api = vi.hoisted(() => ({ submit: vi.fn() }));
const router = vi.hoisted(() => ({ replace: vi.fn() }));
const bot = vi.hoisted(() => ({ token: "turnstile-pass" as string | null, reset: vi.fn() }));

vi.mock("@ampm/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClient>()),
  useSubmitHotelForm: () => ({ mutateAsync: api.submit }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/components/bot-check/use-bot-check", () => ({
  useBotCheck: () => ({
    ref: () => undefined,
    check: bot.token === null ? { status: "checking" } : { status: "passed", token: bot.token },
    token: bot.token,
    reset: bot.reset,
  }),
}));

let mounted: Mounted | null = null;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(NOW);
  api.submit.mockReset();
  router.replace.mockReset();
  bot.reset.mockReset();
  bot.token = "turnstile-pass";
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.useRealTimers();
});

async function open(draft: HotelFormDraftView = READY): Promise<HTMLElement> {
  mounted?.unmount();
  mounted = await mountReview(reviewSite(draft));
  return mounted.host;
}

describe("the summary", () => {
  it("shows every section's answers, read-only, each with an Edit link to its page", async () => {
    const host = await open();
    expect(host.querySelector("h1")?.textContent).toBe("Review and submit.");
    expect(host.textContent).toContain("Synthetic Lake Palace");
    expect(host.textContent).toContain("events@hotel.example");
    expect(linksTo(host, "/hotel-form/sections/property")).toContain("Edit Property and location");
    expect(linksTo(host, "/hotel-form/sections/fact_sheet_media")).toContain(
      "Edit Fact sheet, photos and floor plans",
    );
    // Nothing to type here but the declarations: the answers are read-only.
    expect(
      host.querySelectorAll("input:not([type=radio]):not([type=checkbox]), textarea"),
    ).toHaveLength(0);
  });

  it("lists what a new hotel still needs, each a link to its section, and warns of incomplete ones", async () => {
    let host = await open(DRAFT);
    expect(linksTo(host, "/hotel-form/sections/property")).toContain(
      "Property and location: Choose the state",
    );
    expect(linksTo(host, "/hotel-form/sections/contact")).toContain(
      "Contact for weddings and events: Add a contact with an email or a phone number",
    );
    expect(host.textContent).toContain("Sections not complete");
    expect(linksTo(host, "/hotel-form/sections/rooms")).toContain("Rooms");
    // A section with a missing item is listed there only, not warned of again.
    expect(linksTo(host, "/hotel-form/sections/property")).not.toContain("Property and location");
    host = await open(READY);
    expect(host.textContent).toContain("Everything needed to submit is answered.");
  });

  it("warns when a colleague saved in the last five minutes, a colleague unnamed too, never for you", async () => {
    const sections = {
      ...READY.sections,
      venues: { ...READY.sections.venues, lastEditedBy: null, lastEditedAt: EDITED_AT },
    };
    let host = await open({ ...READY, sections });
    expect(host.textContent).toContain("Ravi Kumar saved Property and location at");
    expect(host.textContent).toContain("A colleague saved Venues at");
    expect(host.textContent).not.toContain("Asha Rao saved");
    vi.setSystemTime(Date.parse(EDITED_AT) + 5 * 60_000);
    host = await open(READY);
    expect(host.textContent).not.toContain("saved some answers a moment ago");
  });

  it("measures the five minutes on the API's clock, so a device clock running fast hides no colleague's save", async () => {
    // This device runs six minutes fast: by it, Ravi Kumar's save a minute ago is seven minutes old.
    vi.setSystemTime(NOW + 6 * 60_000);
    const site = reviewSite(READY);
    const draft = { ...site.flow.draft, clockSkewMs: -6 * 60_000 };
    mounted = await mountReview({ ...site, flow: { ...site.flow, draft } });
    expect(mounted.host.textContent).toContain("Ravi Kumar saved Property and location at");
  });

  it("asks 7.4 as a required tick and 7.5 as Yes or No in core's words, neither chosen yet", async () => {
    const host = await open();
    expect(host.textContent).toContain(HOTEL_FORM_ACCURACY_DECLARATION.statement);
    expect(host.textContent).toContain(HOTEL_FORM_DISPLAY_AUTHORISATION.question);
    expect(host.textContent).toContain(HOTEL_FORM_DISPLAY_AUTHORISATION.ifYes);
    expect(host.textContent).toContain(HOTEL_FORM_DISPLAY_AUTHORISATION.ifNo);
    const accuracy = byId("hf-accuracy");
    expect(accuracy).toHaveProperty("checked", false);
    expect(accuracy.getAttribute("aria-required")).toBe("true");
    const radios = [...host.querySelectorAll<HTMLInputElement>('input[name="hf-display"]')];
    expect(radios.map((radio) => radio.value)).toEqual(["yes", "no"]);
    expect(radios.some((radio) => radio.checked)).toBe(false);
  });
});

describe("Submit", () => {
  it("is never disabled for a missing answer: pressed, it says what is missing and goes to it", async () => {
    const host = await open();
    expect(buttonNamed(host, "Submit to AMPM").disabled).toBe(false);
    await pressSubmit(host);
    expect(api.submit).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Confirm that the information is correct");
    expect(host.textContent).toContain("Answer Yes or No");
    expect(document.activeElement).toBe(byId("hf-accuracy"));
  });

  it("names what is still needed when pressed with items missing, sending nothing", async () => {
    const host = await open(DRAFT);
    await declare(host);
    await pressSubmit(host);
    expect(api.submit).not.toHaveBeenCalled();
    const notice = byId("hf-submit-notice");
    expect(document.activeElement).toBe(notice);
    expect(notice.textContent).toContain(HOTEL_FORM_ERRORS.submitIncomplete);
    expect(notice.querySelector('a[href="/hotel-form/sections/property"]')?.textContent).toBe(
      "Property and location: Choose the state",
    );
  });

  it("waits for the bot check, saying so, rather than sending without its pass", async () => {
    bot.token = null;
    const host = await open();
    await declare(host);
    await pressSubmit(host);
    expect(api.submit).not.toHaveBeenCalled();
    expect(byId("hf-submit-notice").textContent).toContain("The security check hasn't finished");
    expect(document.activeElement).toBe(byId("hf-submit-notice"));
  });

  it("sends both declarations, the versions the page showed and the pass, then goes to the status page", async () => {
    let answer: (value: unknown) => void = () => undefined;
    api.submit.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const host = await open();
    await declare(host, "yes");
    await pressSubmit(host);
    expect(api.submit).toHaveBeenCalledWith({
      sessionToken: SESSION,
      submit: {
        accuracy: { accepted: true, textVersion: "hf-accuracy-2026-11-26" },
        display: { answer: "yes", textVersion: "hf-display-2026-11-26" },
        sectionVersions: {
          property: 3,
          contact: 2,
          rooms: 2,
          venues: 0,
          booking_terms: 0,
          food_beverage: 0,
          fact_sheet_media: 0,
        },
        botToken: "turnstile-pass",
      },
    });
    // The pass is spent, so a fresh check starts; Submit is disabled only while it sends.
    expect(bot.reset).toHaveBeenCalled();
    const sending = buttonNamed(host, "Submitting…");
    expect(sending.disabled).toBe(true);
    expect(sending.getAttribute("aria-busy")).toBe("true");
    await act(async () =>
      answer({ reference: "HIR-2026-0042", status: "submitted", submittedAt: EDITED_AT }),
    );
    expect(router.replace).toHaveBeenCalledWith("/hotel-form/status");
  });
});

describe("a request no longer taking answers", () => {
  it("goes to the status page, submitted, in review or complete", async () => {
    for (const status of ["submitted", "in_review", "merged"] as const) {
      router.replace.mockReset();
      await open(draftWith({ status, state: status === "merged" ? "status_only" : "locked" }));
      expect(router.replace).toHaveBeenCalledWith("/hotel-form/status");
    }
  });
});
