import { act, type ReactElement } from "react";
import { AppError, HOTEL_FORM_ERRORS, type HotelFormSectionSaved } from "@ampm/core";
import { byId, mount, type Mounted } from "@ampm/web-forms/testing";
import { afterEach, beforeEach, vi } from "vitest";

import { draftView } from "../draft.test-fixtures";
import type { IdentityStep } from "../flow";
import { HotelFormSiteContext, type HotelFormSite } from "../hotel-form-provider";
import { HotelFormOverviewPage } from "../overview-page";
import { ME, flowAt } from "../screen.test-utils";
import type { HotelFormFlow } from "../use-hotel-form-flow";
import type { HeldSections } from "./held-sections";
import { heldSectionsFor } from "./held-sections.test-utils";
import { roomsId } from "./rooms.form";
import { HotelFormSectionPage } from "./section-page";

/*
 * The rooms page in a browser (jsdom) under the form's shared state, as the section page tests drive it:
 * the layout's held sections outlive any one page, the page can be left and opened again, and the
 * overview opened between. Each test file still mocks the router and the bot check itself. Tests only.
 */

/** The section save the held sections make, which each test answers. */
export const api = { save: vi.fn() };

export const SESSION = `hfs_${"y".repeat(43)}`;
export const SAVED: HotelFormSectionSaved = {
  version: 3,
  isComplete: false,
  contentHash: "a".repeat(64),
  lastEditedBy: "Asha Rao",
  lastEditedAt: "2026-11-26T10:00:00.000Z",
  isLastSaveYours: true,
};
export const TOTAL = roomsId("totalRooms");

/** A 429 asking for 3 seconds. */
export const tooMany = () =>
  new AppError("rate_limited", HOTEL_FORM_ERRORS.writeLimit, undefined, 429, 3);

/** The page on screen, the flow it sees, and the layout's held sections. */
const shown: {
  mounted: Mounted | null;
  flow: HotelFormFlow | null;
  sections: HeldSections | null;
  refuseSession: ReturnType<typeof vi.fn<() => boolean>>;
} = { mounted: null, flow: null, sections: null, refuseSession: vi.fn(() => true) };

/** The flow's spy for a session refused on the way. */
export const refusedSession = () => shown.refuseSession;

/** The clock and the clean-up for the page tests; call it once at the top of a test file. */
export function setUpPageTests(): void {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"],
    });
    vi.setSystemTime(Date.parse("2026-11-26T10:00:00.000Z"));
    api.save.mockReset();
    shown.refuseSession = vi.fn(() => true);
    shown.sections = heldSectionsFor(() => {
      if (shown.flow === null) throw new Error("No page has been opened");
      return shown.flow;
    }, api.save);
  });
  afterEach(() => {
    leavePage();
    vi.useRealTimers();
  });
}

/** The form's shared state, signed in, or asking for a new code in place. */
export function siteAt(reverify: IdentityStep | null = null): HotelFormSite {
  if (shown.sections === null) throw new Error("setUpPageTests() is not called");
  const flow = flowAt(
    { phase: { kind: "signed_in", reverify }, session: reverify === null ? SESSION : null },
    {
      me: { data: ME, isLoading: false, error: null, retry: () => undefined },
      draft: draftView(),
      refuseSession: shown.refuseSession,
    },
  );
  shown.flow = flow;
  return {
    flow,
    sections: shown.sections,
    siteKey: "test-site-key",
    rememberReturn: vi.fn(),
    landing: () => "/hotel-form/overview",
    arrived: vi.fn(),
    carryNotice: vi.fn(),
    carriedNotice: () => null,
  };
}

/** Shows `element` as the page on screen. */
export async function show(element: ReactElement): Promise<Mounted> {
  shown.mounted = await mount(element);
  return shown.mounted;
}

/** The rooms page, opened (again) under the layout's held sections. */
export const openRooms = (): Promise<Mounted> =>
  show(
    <HotelFormSiteContext.Provider value={siteAt()}>
      <HotelFormSectionPage sectionKey="rooms" />
    </HotelFormSiteContext.Provider>,
  );

/** The overview, under the same held sections. */
export const openOverview = (): Promise<Mounted> =>
  show(
    <HotelFormSiteContext.Provider value={siteAt()}>
      <HotelFormOverviewPage />
    </HotelFormSiteContext.Provider>,
  );

/** Leaves the page on screen (Next, Back to the overview): the page goes, the held sections stay. */
export function leavePage(): void {
  shown.mounted?.unmount();
  shown.mounted = null;
}

/** The save line of the section on screen. */
export const saveLine = () =>
  shown.mounted?.host.querySelector('p[role="status"][aria-live="polite"]')?.textContent;

/** The words of the overview's row for a section, by its page's address. */
export const rowOf = (key: string) =>
  shown.mounted?.host.querySelector(`a[href="/hotel-form/sections/${key}"]`)?.textContent ?? "";

/** Types into a field as a person does: the input event React listens for. */
export async function type(id: string, text: string): Promise<void> {
  const input = byId(id);
  if (!(input instanceof HTMLInputElement)) throw new Error(`#${id} is not an input`);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

export const advance = (ms: number) => act(async () => vi.advanceTimersByTimeAsync(ms));

/** Leaves a field, which saves the section at once. */
export const leaveField = (id: string) =>
  act(async () => byId(id).dispatchEvent(new FocusEvent("focusout", { bubbles: true })));

/** An input's value on screen. */
export const valueOf = (id: string) => {
  const input = byId(id);
  return input instanceof HTMLInputElement ? input.value : null;
};
