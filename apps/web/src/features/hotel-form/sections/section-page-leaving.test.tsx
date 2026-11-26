// @vitest-environment jsdom
import { act } from "react";
import { errors, type HotelFormSectionSaved } from "@ampm/core";
import { buttonNamed, press } from "@ampm/web-forms/testing";
import { describe, expect, it, vi } from "vitest";

import { AUTOSAVE_DELAY_MS } from "./section-autosave";
import {
  SAVED,
  TOTAL,
  advance,
  api,
  leaveField,
  leavePage,
  openOverview,
  openRooms,
  rowOf,
  saveLine,
  setUpPageTests,
  tooMany,
  type,
  valueOf,
} from "./section-page.test-utils";

/*
 * Leaving a section's page before its save is done (D-190 §5, review fixes E1 and E4): the layout's held
 * sections outlive the page, as they do between the form's pages, so the save still goes, the page opens
 * again as it was left, and the overview says which sections still wait.
 */

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

describe("leaving the section before its save is done (review fixes E1 and E4)", () => {
  it("opens again on what was typed while its save was on the way, then takes that save's answer", async () => {
    let answer: (saved: HotelFormSectionSaved) => void = () => undefined;
    api.save
      .mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)))
      .mockResolvedValue({ ...SAVED, version: 4 });
    await openRooms();
    await type(TOTAL, "41");
    // Next: leaving the field sends the save, then the page goes before it is answered.
    await leaveField(TOTAL);
    expect(api.save).toHaveBeenCalledTimes(1);
    leavePage();
    // Back, still before the answer: the section as it was left, not the draft from before its save.
    await openRooms();
    expect(valueOf(TOTAL)).toBe("41");
    expect(saveLine()).toBe("Saving…");
    await act(async () => answer(SAVED));
    expect(saveLine()).toBe("Saved");
    await type(TOTAL, "42");
    await advance(AUTOSAVE_DELAY_MS);
    expect(api.save.mock.calls[1]?.[0].save).toMatchObject({
      answers: { totalRooms: 42 },
      expectedVersion: 3,
    });
  });

  it("keeps a 429's wait after leaving, sends what was typed once it is over, and shows it on return", async () => {
    api.save.mockRejectedValueOnce(tooMany()).mockResolvedValue(SAVED);
    await openRooms();
    await type(TOTAL, "41");
    await advance(AUTOSAVE_DELAY_MS);
    expect(saveLine()).toContain("trying again in 0:03");
    // Typed during the wait, then Next.
    await type(TOTAL, "43");
    leavePage();
    await advance(3_000);
    expect(api.save).toHaveBeenCalledTimes(2);
    expect(api.save.mock.calls[1]?.[0].save).toMatchObject({ answers: { totalRooms: 43 } });
    await openRooms();
    expect(valueOf(TOTAL)).toBe("43");
    expect(saveLine()).toBe("Saved");
  });

  it("keeps Not saved and its Retry after leaving: leaving tries once more, Retry is there on return", async () => {
    api.save.mockRejectedValue(errors.network());
    await openRooms();
    await type(TOTAL, "41");
    await advance(AUTOSAVE_DELAY_MS);
    expect(saveLine()).toContain("Not saved");
    leavePage();
    // Leaving the section saves at once, as leaving a field does; it is refused again.
    expect(api.save).toHaveBeenCalledTimes(2);
    await advance(0);
    const back = await openRooms();
    expect(valueOf(TOTAL)).toBe("41");
    expect(saveLine()).toContain("Not saved");
    api.save.mockResolvedValue(SAVED);
    await press(buttonNamed(back.host, "Retry"));
    expect(api.save).toHaveBeenCalledTimes(3);
    expect(saveLine()).toBe("Saved");
  });
});

describe("the overview, while a section left waits to save (review fix E1)", () => {
  it("says which section still waits to save, and which needs the person, as it changes", async () => {
    api.save.mockRejectedValueOnce(tooMany()).mockRejectedValue(errors.network());
    await openRooms();
    await type(TOTAL, "41");
    await advance(AUTOSAVE_DELAY_MS);
    leavePage();
    await openOverview();
    expect(rowOf("rooms")).toContain("Changes waiting to be saved");
    expect(rowOf("venues")).not.toContain("Changes");
    // The wait is over and the save fails: the person has to open the section to retry.
    await advance(3_000);
    expect(rowOf("rooms")).toContain("Changes not saved: open the section to see why");
  });
});
