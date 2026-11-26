// @vitest-environment jsdom
import { act, useState } from "react";
import type * as ApiClient from "@ampm/api-client";
import {
  AppError,
  HOTEL_FORM_ERRORS,
  hotelFormReadOnlyDetails,
  hotelFormSectionConflictDetails,
  hotelFormSessionError,
  type HotelFormSectionSaved,
} from "@ampm/core";
import { buttonNamed, byId, mount, press, type Mounted } from "@ampm/web-forms/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EDITED_AT, draftView } from "../draft.test-fixtures";
import type { IdentityStep } from "../flow";
import { HotelFormSiteContext, type HotelFormSite } from "../hotel-form-provider";
import { ME, flowAt } from "../screen.test-utils";
import { AUTOSAVE_DELAY_MS } from "./section-autosave";
import { HotelFormSectionPage } from "./section-page";
import { roomsId } from "./rooms.form";

/* A section's page in a browser (D-190 §5): autosave's timing, a colleague's save, a locked request, a session. */

const api = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@ampm/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClient>()),
  useSaveHotelFormSection: () => ({ mutateAsync: api.save }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/components/bot-check/use-bot-check", () => ({
  useBotCheck: () => ({
    ref: () => undefined,
    check: { status: "checking" },
    token: null,
    reset: () => undefined,
  }),
}));

const SESSION = `hfs_${"y".repeat(43)}`;
const SAVED: HotelFormSectionSaved = { version: 3, isComplete: false, contentHash: "a".repeat(64) };

let mounted: Mounted | null = null;
let refuseSession = vi.fn(() => true);

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"],
  });
  vi.setSystemTime(Date.parse("2026-11-26T10:00:00.000Z"));
  api.save.mockReset();
  refuseSession = vi.fn(() => true);
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.useRealTimers();
});

function siteAt(reverify: IdentityStep | null = null): HotelFormSite {
  return {
    flow: flowAt(
      { phase: { kind: "signed_in", reverify }, session: reverify === null ? SESSION : null },
      {
        me: { data: ME, isLoading: false, error: null, retry: () => undefined },
        draft: draftView(),
        refuseSession,
      },
    ),
    siteKey: "test-site-key",
    rememberReturn: vi.fn(),
    landing: () => "/hotel-form/overview",
    arrived: vi.fn(),
  };
}

/** The rooms page under a flow that can ask for a new code in place, and take it, on a press. */
function RoomsWithNewCode() {
  const [reverify, setReverify] = useState<IdentityStep | null>(null);
  return (
    <>
      <button type="button" onClick={() => setReverify({ step: "details" })}>
        Session ends
      </button>
      <button type="button" onClick={() => setReverify(null)}>
        New code entered
      </button>
      <HotelFormSiteContext.Provider value={siteAt(reverify)}>
        <HotelFormSectionPage sectionKey="rooms" />
      </HotelFormSiteContext.Provider>
    </>
  );
}

async function openRooms(): Promise<Mounted> {
  const site: HotelFormSite = {
    flow: flowAt(
      { phase: { kind: "signed_in", reverify: null }, session: SESSION },
      {
        me: { data: ME, isLoading: false, error: null, retry: () => undefined },
        draft: draftView(),
        refuseSession,
      },
    ),
    siteKey: "test-site-key",
    rememberReturn: vi.fn(),
    landing: () => "/hotel-form/overview",
    arrived: vi.fn(),
  };
  return mount(
    <HotelFormSiteContext.Provider value={site}>
      <HotelFormSectionPage sectionKey="rooms" />
    </HotelFormSiteContext.Provider>,
  );
}

/** Types into a field as a person does: the input event React listens for. */
async function type(id: string, text: string): Promise<void> {
  const input = byId(id);
  if (!(input instanceof HTMLInputElement)) throw new Error(`#${id} is not an input`);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const advance = (ms: number) => act(async () => vi.advanceTimersByTimeAsync(ms));
const saveLine = () =>
  mounted?.host.querySelector('p[role="status"][aria-live="polite"]')?.textContent;
const TOTAL = roomsId("totalRooms");

describe("autosave", () => {
  it("saves 1.5 seconds after typing stops, on the version the page opened, then says Saved", async () => {
    api.save.mockResolvedValue(SAVED);
    mounted = await openRooms();
    expect(saveLine()).toBe("Your answers save as you type.");
    await type(TOTAL, "41");
    await advance(AUTOSAVE_DELAY_MS - 1);
    expect(api.save).not.toHaveBeenCalled();
    await advance(1);
    expect(api.save).toHaveBeenCalledTimes(1);
    expect(api.save.mock.calls[0]?.[0]).toEqual({
      sessionToken: SESSION,
      section: "rooms",
      save: {
        answers: {
          totalRooms: 41,
          // The blank row the page starts with is not sent.
          rows: [],
          noLongerOffered: null,
        },
        expectedVersion: 2,
        noChanges: false,
      },
    });
    expect(saveLine()).toBe("Saved");
  });

  it("saves at once on leaving a field, and sends nothing when the answers are back as saved", async () => {
    api.save.mockResolvedValue(SAVED);
    mounted = await openRooms();
    await type(TOTAL, "40");
    await act(async () => byId(TOTAL).dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
    await advance(AUTOSAVE_DELAY_MS);
    expect(api.save).not.toHaveBeenCalled();
    await type(TOTAL, "42");
    await act(async () => byId(TOTAL).dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
    expect(api.save).toHaveBeenCalledTimes(1);
  });

  it("saves at once when the page is hidden (another tab, the phone locked)", async () => {
    api.save.mockResolvedValue(SAVED);
    mounted = await openRooms();
    await type(TOTAL, "41");
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    await act(async () => document.dispatchEvent(new Event("visibilitychange")));
    Reflect.deleteProperty(document, "visibilityState");
    expect(api.save).toHaveBeenCalledTimes(1);
  });

  it("waits out a 429's Retry-After, counting down, then saves again", async () => {
    api.save
      .mockRejectedValueOnce(
        new AppError("rate_limited", HOTEL_FORM_ERRORS.writeLimit, undefined, 429, 3),
      )
      .mockResolvedValue(SAVED);
    mounted = await openRooms();
    await type(TOTAL, "41");
    await advance(AUTOSAVE_DELAY_MS);
    expect(saveLine()).toContain("trying again in 0:03");
    await advance(3_000);
    expect(api.save).toHaveBeenCalledTimes(2);
    expect(saveLine()).toBe("Saved");
  });
});

describe("a colleague's save", () => {
  const theirs = {
    section: "rooms" as const,
    version: 7,
    answers: { totalRooms: 44 },
    noChanges: false,
    editedBy: "Ravi Kumar",
    editedAt: EDITED_AT,
  };
  const conflict = () =>
    new AppError(
      "conflict",
      HOTEL_FORM_ERRORS.sectionConflict,
      hotelFormSectionConflictDetails(theirs),
    );

  it("Keep mine saves this page's answers on the colleague's version", async () => {
    api.save.mockRejectedValueOnce(conflict()).mockResolvedValue(SAVED);
    mounted = await openRooms();
    await type(TOTAL, "41");
    await advance(AUTOSAVE_DELAY_MS);
    expect(mounted.host.querySelector('[role="alert"]')?.textContent).toContain(
      "A colleague saved this section at",
    );
    await press(buttonNamed(mounted.host, "Keep mine"));
    expect(api.save).toHaveBeenCalledTimes(2);
    expect(api.save.mock.calls[1]?.[0].save).toMatchObject({
      answers: { totalRooms: 41 },
      expectedVersion: 7,
    });
    expect(mounted.host.querySelector('[role="alert"]')).toBeNull();
  });

  it("Take theirs puts the colleague's answers on the page and saves nothing", async () => {
    api.save.mockRejectedValueOnce(conflict());
    mounted = await openRooms();
    await type(TOTAL, "41");
    await advance(AUTOSAVE_DELAY_MS);
    await press(buttonNamed(mounted.host, "Take theirs"));
    const total = byId(TOTAL);
    expect(total instanceof HTMLInputElement && total.value).toBe("44");
    await advance(AUTOSAVE_DELAY_MS);
    expect(api.save).toHaveBeenCalledTimes(1);
  });
});

describe("a locked request and an ended session", () => {
  it("says who submitted and when after a refused save, keeping the unsaved text on the page", async () => {
    const readOnly = {
      status: "submitted" as const,
      submittedBy: "Ravi Kumar",
      submittedAt: EDITED_AT,
    };
    api.save.mockRejectedValue(
      new AppError("conflict", HOTEL_FORM_ERRORS.readOnly, hotelFormReadOnlyDetails(readOnly)),
    );
    mounted = await openRooms();
    await type(TOTAL, "41");
    await advance(AUTOSAVE_DELAY_MS);
    const alert = mounted.host.querySelector('[role="alert"]')?.textContent ?? "";
    expect(alert).toContain("Ravi Kumar submitted the form on 26 Nov 2026");
    expect(alert).not.toContain("complete");
    const input = byId(TOTAL);
    expect(input instanceof HTMLInputElement && input.value).toBe("41");
    expect(input.matches(":disabled")).toBe(true);
  });

  it("after a new code in place, puts focus back in the field the person was in", async () => {
    mounted = await mount(<RoomsWithNewCode />);
    byId(TOTAL).focus();
    await press(buttonNamed(mounted.host, "Session ends"));
    // The panel's heading takes focus, so a keyboard and a screen reader start at the new code.
    expect(document.activeElement?.id).toBe("hf-reverify-heading");
    await press(buttonNamed(mounted.host, "New code entered"));
    expect(document.activeElement).toBe(byId(TOTAL));
  });

  it("hands an ended session to the flow, which asks for a new code in place", async () => {
    api.save.mockRejectedValue(hotelFormSessionError("session_expired"));
    mounted = await openRooms();
    await type(TOTAL, "41");
    await advance(AUTOSAVE_DELAY_MS);
    expect(refuseSession).toHaveBeenCalledTimes(1);
    expect(saveLine()).toContain("enter a new code");
  });
});
