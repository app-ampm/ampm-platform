// @vitest-environment jsdom
import { useState } from "react";
import {
  AppError,
  HOTEL_FORM_ERRORS,
  hotelFormReadOnlyDetails,
  hotelFormSectionConflictDetails,
  hotelFormSessionError,
} from "@ampm/core";
import { buttonNamed, byId, press } from "@ampm/web-forms/testing";
import { describe, expect, it, vi } from "vitest";

import { EDITED_AT } from "../draft.test-fixtures";
import type { IdentityStep } from "../flow";
import { HotelFormSiteContext } from "../hotel-form-provider";
import { AUTOSAVE_DELAY_MS } from "./section-autosave";
import { HotelFormSectionPage } from "./section-page";
import {
  SAVED,
  SESSION,
  TOTAL,
  advance,
  api,
  leaveField,
  openRooms,
  refusedSession,
  saveLine,
  setUpPageTests,
  show,
  siteAt,
  tooMany,
  type,
} from "./section-page.test-utils";

/* A section's page in a browser (D-190 §5): autosave's timing, a colleague's save, a locked request, a session. */

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/components/bot-check/use-bot-check", () => ({
  useBotCheck: () => ({
    ref: () => undefined,
    check: { status: "checking" },
    token: null,
    reset: () => undefined,
  }),
}));

setUpPageTests();

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

describe("autosave", () => {
  it("saves 1.5 seconds after typing stops, on the version the page opened, then says Saved", async () => {
    api.save.mockResolvedValue(SAVED);
    await openRooms();
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
    await openRooms();
    await type(TOTAL, "40");
    await leaveField(TOTAL);
    await advance(AUTOSAVE_DELAY_MS);
    expect(api.save).not.toHaveBeenCalled();
    await type(TOTAL, "42");
    await leaveField(TOTAL);
    expect(api.save).toHaveBeenCalledTimes(1);
  });

  it("waits out a 429's Retry-After, counting down, then saves again", async () => {
    api.save.mockRejectedValueOnce(tooMany()).mockResolvedValue(SAVED);
    await openRooms();
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
    const page = await openRooms();
    await type(TOTAL, "41");
    await advance(AUTOSAVE_DELAY_MS);
    expect(page.host.querySelector('[role="alert"]')?.textContent).toContain(
      "A colleague saved this section at",
    );
    await press(buttonNamed(page.host, "Keep mine"));
    expect(api.save).toHaveBeenCalledTimes(2);
    expect(api.save.mock.calls[1]?.[0].save).toMatchObject({
      answers: { totalRooms: 41 },
      expectedVersion: 7,
    });
    expect(page.host.querySelector('[role="alert"]')).toBeNull();
  });

  it("Take theirs puts the colleague's answers on the page and saves nothing", async () => {
    api.save.mockRejectedValueOnce(conflict());
    const page = await openRooms();
    await type(TOTAL, "41");
    await advance(AUTOSAVE_DELAY_MS);
    await press(buttonNamed(page.host, "Take theirs"));
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
    const page = await openRooms();
    await type(TOTAL, "41");
    await advance(AUTOSAVE_DELAY_MS);
    const alert = page.host.querySelector('[role="alert"]')?.textContent ?? "";
    expect(alert).toContain("Ravi Kumar submitted the form on 26 Nov 2026");
    expect(alert).not.toContain("complete");
    const input = byId(TOTAL);
    expect(input instanceof HTMLInputElement && input.value).toBe("41");
    expect(input.matches(":disabled")).toBe(true);
  });

  it("after a new code in place, puts focus back in the field the person was in", async () => {
    const page = await show(<RoomsWithNewCode />);
    byId(TOTAL).focus();
    await press(buttonNamed(page.host, "Session ends"));
    // The panel's heading takes focus, so a keyboard and a screen reader start at the new code.
    expect(document.activeElement?.id).toBe("hf-reverify-heading");
    await press(buttonNamed(page.host, "New code entered"));
    expect(document.activeElement).toBe(byId(TOTAL));
  });

  it("hands an ended session to the flow, which asks for a new code in place", async () => {
    api.save.mockRejectedValue(hotelFormSessionError("session_expired"));
    await openRooms();
    await type(TOTAL, "41");
    await advance(AUTOSAVE_DELAY_MS);
    expect(refusedSession()).toHaveBeenCalledTimes(1);
    expect(saveLine()).toContain("enter a new code");
  });
});
