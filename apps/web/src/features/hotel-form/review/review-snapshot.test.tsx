// @vitest-environment jsdom
import type * as ApiClient from "@ampm/api-client";
import {
  AppError,
  HOTEL_FORM_ERRORS,
  hotelFormSectionsChangedDetails,
  type HotelFormDraftView,
} from "@ampm/core";
import { buttonNamed, byId, press } from "@ampm/web-forms/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EDITED_AT } from "../draft.test-fixtures";
import type { HotelFormSite } from "../hotel-form-provider";
import {
  NOW,
  READY,
  declare,
  mountLiveReview,
  pressSubmit,
  reviewSite,
  type LiveReview,
} from "./review.test-utils";

/*
 * HF-06 shows and submits the draft it opened with (D-190 §5, review fix C1): a draft read again under it
 * (the window regaining focus, a new code entered in place, a colleague's save a late conflict wrote into
 * the cache) never changes what Submit declares unseen. A colleague's change is marked and announced, and
 * "Show the latest answers" takes it in, keeping 7.4 and 7.5.
 */

const api = vi.hoisted(() => ({ submit: vi.fn() }));
const router = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("@ampm/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClient>()),
  useSubmitHotelForm: () => ({ mutateAsync: api.submit }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
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
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(NOW);
  api.submit.mockReset();
  api.submit.mockResolvedValue({
    reference: "HIR-2026-0042",
    status: "submitted",
    submittedAt: NOW,
  });
});

afterEach(() => {
  page?.unmount();
  page = null;
  vi.useRealTimers();
});

/** The ready draft with its rooms saved again: by a colleague unless told it was the person. */
function roomsSavedAgain(isLastSaveYours = false): HotelFormDraftView {
  const rooms = {
    ...READY.sections.rooms,
    answers: { totalRooms: 44 },
    version: READY.sections.rooms.version + 1,
    lastEditedBy: isLastSaveYours ? "Asha Rao" : "Ravi Kumar",
    lastEditedAt: EDITED_AT,
    isLastSaveYours,
  };
  return { ...READY, sections: { ...READY.sections, rooms } };
}

/** The words of a section's card in the summary. */
const roomsCard = () => byId("hf-answers-rooms").closest("article")?.textContent ?? "";

/** The page's polite live region that says a colleague changed what it shows. */
const announced = (host: HTMLElement) =>
  [...host.querySelectorAll('[role="status"][aria-live="polite"]')]
    .map((region) => region.textContent ?? "")
    .join(" ");

/** The rooms version the last submit sent. */
const sentRoomsVersion = () =>
  (api.submit.mock.calls.at(-1)?.[0] as { submit: { sectionVersions: { rooms: number } } }).submit
    .sectionVersions.rooms;

/** The site while a new code is asked for in place over the page: no session, the draft still shown. */
function askingForCode(draft: HotelFormDraftView): HotelFormSite {
  const site = reviewSite(draft);
  const phase = { kind: "signed_in", reverify: { step: "details" } } as const;
  return { ...site, flow: { ...site.flow, state: { ...site.flow.state, phase, session: null } } };
}

/**
 * Each way the draft is read again under an open review page: the sites the page is drawn under, in turn,
 * the last holding the draft read again.
 */
const READ_AGAIN: readonly (readonly [string, (draft: HotelFormDraftView) => HotelFormSite[]])[] = [
  ["the window regaining focus", (draft) => [reviewSite(draft)]],
  // The api-client writes the colleague's save a refused autosave carried into the cached draft.
  ["a late conflict written into the cache", (draft) => [reviewSite(draft)]],
  ["a new code entered in place", (draft) => [askingForCode(READY), reviewSite(draft)]],
];

describe("a draft read again under the review page", () => {
  for (const [how, siteWith] of READ_AGAIN) {
    it(`keeps showing and submitting what the page opened with after ${how}, marking and announcing the change`, async () => {
      page = await mountLiveReview(reviewSite(READY));
      expect(announced(page.host)).toBe("");
      for (const site of siteWith(roomsSavedAgain())) await page.rerender(site);
      expect(roomsCard()).toContain("40");
      expect(roomsCard()).not.toContain("44");
      expect(roomsCard()).toContain("Changed by a colleague");
      expect(announced(page.host)).toContain("A colleague changed Rooms while you were reviewing");
      expect(buttonNamed(page.host, "Show the latest answers")).toBeTruthy();
      await declare(page.host);
      await pressSubmit(page.host);
      expect(sentRoomsVersion()).toBe(READY.sections.rooms.version);
    });
  }

  it("takes the latest answers in on Show the latest answers, keeping 7.4 and 7.5, then submits them", async () => {
    page = await mountLiveReview(reviewSite(READY));
    await declare(page.host, "yes");
    await page.rerender(reviewSite(roomsSavedAgain()));
    await press(buttonNamed(page.host, "Show the latest answers"));
    expect(roomsCard()).toContain("44");
    expect(roomsCard()).not.toContain("Changed by a colleague");
    expect(announced(page.host)).not.toContain("A colleague changed");
    expect(document.activeElement).toBe(byId("hf-answers-heading"));
    expect(byId("hf-accuracy")).toHaveProperty("checked", true);
    const yes = page.host.querySelector<HTMLInputElement>('input[name="hf-display"][value="yes"]');
    expect(yes?.checked).toBe(true);
    await pressSubmit(page.host);
    expect(sentRoomsVersion()).toBe(READY.sections.rooms.version + 1);
  });

  it("takes the person's own late save in at once: it is theirs, not a colleague's", async () => {
    page = await mountLiveReview(reviewSite(READY));
    await page.rerender(reviewSite(roomsSavedAgain(true)));
    expect(roomsCard()).toContain("44");
    expect(roomsCard()).not.toContain("Changed by a colleague");
    expect(announced(page.host)).not.toContain("A colleague changed");
    await declare(page.host);
    await pressSubmit(page.host);
    expect(sentRoomsVersion()).toBe(READY.sections.rooms.version + 1);
  });

  it("keeps the mark through a later read until the person takes the latest answers in", async () => {
    page = await mountLiveReview(reviewSite(READY));
    await page.rerender(reviewSite(roomsSavedAgain()));
    const again = roomsSavedAgain();
    await page.rerender(reviewSite({ ...again, readAt: "2026-11-26T05:20:00.000Z" }));
    expect(roomsCard()).toContain("Changed by a colleague");
    expect(roomsCard()).toContain("40");
  });

  it("after a 409 sectionsChanged and the read it causes, takes the latest in and submits it", async () => {
    const refused = new AppError(
      "conflict",
      HOTEL_FORM_ERRORS.sectionsChanged,
      hotelFormSectionsChangedDetails(["rooms"]),
    );
    api.submit.mockRejectedValueOnce(refused);
    page = await mountLiveReview(reviewSite(READY));
    await declare(page.host);
    await pressSubmit(page.host);
    expect(byId("hf-submit-notice").textContent).toContain(HOTEL_FORM_ERRORS.sectionsChanged);
    expect(roomsCard()).toContain("Changed by a colleague");
    // The api-client reads the draft again after the 409: the colleague's save arrives under the page.
    await page.rerender(reviewSite(roomsSavedAgain()));
    expect(roomsCard()).toContain("40");
    await press(buttonNamed(page.host, "Show the latest answers"));
    expect(page.host.querySelector("#hf-submit-notice")).toBeNull();
    expect(roomsCard()).toContain("44");
    expect(roomsCard()).not.toContain("Changed by a colleague");
    await pressSubmit(page.host);
    expect(sentRoomsVersion()).toBe(READY.sections.rooms.version + 1);
  });
});
