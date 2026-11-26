// @vitest-environment jsdom
import { act } from "react";
import type * as ApiClient from "@ampm/api-client";
import type { HotelFormSectionSaveCall } from "@ampm/api-client";
import type { HotelFormDraftView, HotelFormSectionSaved } from "@ampm/core";
import { byId } from "@ampm/web-forms/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HotelFormSite } from "../hotel-form-provider";
import { ME } from "../screen.test-utils";
import type { HeldSections } from "../sections/held-sections";
import { SAVED, heldSectionsFor, typeTotal } from "../sections/held-sections.test-utils";
import { ROOMS_MODEL } from "../sections/rooms.form";
import { payloadOf } from "../sections/section-payload";
import { VENUES_MODEL, type VenuesFields } from "../sections/venues.form";
import { NOW, READY, declare, mountLiveReview, pressSubmit, reviewSite } from "./review.test-utils";
import type { LiveReview } from "./review.test-utils";

/*
 * HF-06 while a section still has changes not saved (D-190 §5, review fix F2): the summary marks it in
 * the overview's words, and Submit saves what waits first, says which sections, takes focus and sends
 * nothing; once they are saved (the person's own save taken in at once) Submit sends them.
 */

const api = vi.hoisted(() => ({ submit: vi.fn(), save: vi.fn() }));

vi.mock("@ampm/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClient>()),
  useSubmitHotelForm: () => ({ mutateAsync: api.submit }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/components/bot-check/use-bot-check", () => ({
  useBotCheck: () => ({
    ref: () => undefined,
    check: { status: "passed", token: "turnstile-pass" },
    token: "turnstile-pass",
    reset: () => undefined,
  }),
}));

let page: LiveReview | null = null;

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"],
  });
  vi.setSystemTime(NOW);
  api.submit.mockReset();
  api.submit.mockResolvedValue({
    reference: "HIR-2026-0042",
    status: "submitted",
    submittedAt: NOW,
  });
  api.save.mockReset();
});

afterEach(() => {
  page?.unmount();
  page = null;
  vi.useRealTimers();
});

/** The review's site, its held sections kept as the layout keeps them while the draft is read again. */
function heldSite(draft: HotelFormDraftView) {
  let current: HotelFormSite = reviewSite(draft);
  const sections: HeldSections = heldSectionsFor(
    () => current.flow,
    (call: HotelFormSectionSaveCall) => api.save(call) as Promise<HotelFormSectionSaved>,
  );
  const siteWith = (next: HotelFormDraftView): HotelFormSite => {
    current = { ...reviewSite(next), sections };
    return current;
  };
  return { sections, site: siteWith(draft), siteWith };
}

/** Rooms typed in on its page, and left before it saved: 44 rooms. */
function typeRooms(sections: HeldSections) {
  const rooms = sections.open(
    "rooms",
    { model: ROOMS_MODEL, check: payloadOf },
    {
      version: READY.sections.rooms.version,
      saved: { answers: { totalRooms: 40 }, noChanges: false },
    },
    ME.personId,
  );
  rooms.update(typeTotal("44"));
}

/** The words of a section's card in the summary. */
const card = (key: string) => byId(`hf-answers-${key}`).closest("article")?.textContent ?? "";

/** The draft as the cache holds it once the person's rooms save landed. */
const roomsSaved: HotelFormDraftView = {
  ...READY,
  sections: {
    ...READY.sections,
    rooms: {
      ...READY.sections.rooms,
      answers: { totalRooms: 44 },
      version: READY.sections.rooms.version + 1,
      lastEditedBy: ME.person.fullName,
      isLastSaveYours: true,
    },
  },
};

describe("a section with changes not saved yet, on the review (review fix F2)", () => {
  it("is marked in the overview's words: waiting to be saved, or not saved", async () => {
    const { sections, site } = heldSite(READY);
    typeRooms(sections);
    const venues = sections.open(
      "venues",
      { model: VENUES_MODEL, check: payloadOf },
      { version: 0, saved: { answers: {}, noChanges: false } },
      ME.personId,
    );
    venues.update((fields: VenuesFields) => ({ ...fields, totalSpaceValue: "a lot" }));
    page = await mountLiveReview(site);
    expect(card("rooms")).toContain("Changes waiting to be saved");
    expect(card("venues")).toContain("Changes not saved: open the section to see why");
    expect(card("property")).not.toContain("Changes");
  });

  it("Submit saves what waits first, says which sections, takes focus and sends nothing", async () => {
    let land: (saved: HotelFormSectionSaved) => void = () => undefined;
    api.save.mockImplementationOnce(() => new Promise((resolve) => (land = resolve)));
    const { sections, site, siteWith } = heldSite(READY);
    typeRooms(sections);
    page = await mountLiveReview(site);
    await declare(page.host);
    await pressSubmit(page.host);
    expect(api.submit).not.toHaveBeenCalled();
    // Saved at once, the page staying: no keepalive.
    expect(api.save).toHaveBeenCalledTimes(1);
    expect(api.save.mock.calls[0]?.[0]).toMatchObject({ save: { answers: { totalRooms: 44 } } });
    expect(api.save.mock.calls[0]?.[0].keepalive).toBeUndefined();
    const notice = byId("hf-submit-notice");
    expect(notice.textContent).toContain("nothing was submitted");
    expect(notice.querySelector('a[href="/hotel-form/sections/rooms"]')?.textContent).toBe("Rooms");
    expect(document.activeElement).toBe(notice);

    // The save lands, and the cache holds it: the person's own save, taken in at once.
    await act(async () => land({ ...SAVED, version: READY.sections.rooms.version + 1 }));
    await page.rerender(siteWith(roomsSaved));
    expect(card("rooms")).not.toContain("Changes");
    expect(card("rooms")).toContain("44");
    await pressSubmit(page.host);
    expect(api.submit).toHaveBeenCalledTimes(1);
    const sent = api.submit.mock.calls[0]?.[0] as {
      submit: { sectionVersions: { rooms: number } };
    };
    expect(sent.submit.sectionVersions.rooms).toBe(READY.sections.rooms.version + 1);
  });
});
