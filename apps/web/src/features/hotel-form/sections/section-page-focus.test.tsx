// @vitest-environment jsdom
import { act } from "react";
import { AppError, HOTEL_FORM_ERRORS, errors, hotelFormReadOnlyDetails } from "@ampm/core";
import { buttonNamed, byId, press } from "@ampm/web-forms/testing";
import { describe, expect, it, vi } from "vitest";

import { EDITED_AT } from "../draft.test-fixtures";
import { AUTOSAVE_DELAY_MS } from "./section-autosave";
import {
  TOTAL,
  advance,
  api,
  leaveField,
  openRooms,
  setUpPageTests,
  type,
} from "./section-page.test-utils";

/*
 * Focus as a section turns read-only under it (D-190 §5, review fix F5): a colleague submitted, so the
 * person's save came back locked. A control that goes with it (the save line's Retry, Add, Remove) or is
 * disabled (a list, a tick, a choice, a chip) never leaves focus on <body>: it goes to the locked banner's
 * heading, which says why. Synthetic answers only.
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

const locked = () =>
  new AppError(
    "conflict",
    HOTEL_FORM_ERRORS.readOnly,
    hotelFormReadOnlyDetails({
      status: "submitted",
      submittedBy: "Ravi Kumar",
      submittedAt: EDITED_AT,
    }),
  );

const LOCKED_HEADING = "hf-locked-heading";

describe("focus as the section turns read-only (review fix F5)", () => {
  it("goes to the locked banner's heading when Retry, pressed, goes as the save comes back locked", async () => {
    api.save.mockRejectedValueOnce(errors.network()).mockRejectedValueOnce(locked());
    const page = await openRooms();
    await type(TOTAL, "41");
    await advance(AUTOSAVE_DELAY_MS);
    const retry = buttonNamed(page.host, "Retry");
    retry.focus();
    await press(retry);
    await advance(0);
    expect(retry.isConnected).toBe(false);
    expect(document.activeElement).toBe(byId(LOCKED_HEADING));
  });

  it("goes to the locked banner's heading when a list it was on is disabled, never staying on <body>", async () => {
    let refuse: (error: unknown) => void = () => undefined;
    api.save.mockImplementationOnce(() => new Promise((_resolve, reject) => (refuse = reject)));
    const page = await openRooms();
    await type(TOTAL, "41");
    await leaveField(TOTAL);
    const list = page.host.querySelector<HTMLSelectElement>('select[id$="-unitType"]');
    if (list === null) throw new Error("No unit type list");
    list.focus();
    // A browser lets focus go from a control disabled under it to <body> at its next frame: it moves first.
    await act(async () => refuse(locked()));
    expect(list.disabled).toBe(true);
    expect(document.activeElement).toBe(byId(LOCKED_HEADING));
  });

  it("leaves focus on nothing when it had left Retry for the page's background before Retry went", async () => {
    api.save.mockRejectedValueOnce(errors.network());
    const page = await openRooms();
    await type(TOTAL, "41");
    await advance(AUTOSAVE_DELAY_MS);
    const retry = buttonNamed(page.host, "Retry");
    retry.focus();
    retry.blur();
    api.save.mockRejectedValueOnce(locked());
    await type(TOTAL, "42");
    await advance(AUTOSAVE_DELAY_MS);
    expect(retry.isConnected).toBe(false);
    expect(document.activeElement).toBe(document.body);
  });

  it("leaves focus where it is when it was not lost: a text field stays focused, read-only", async () => {
    let refuse: (error: unknown) => void = () => undefined;
    api.save.mockImplementationOnce(() => new Promise((_resolve, reject) => (refuse = reject)));
    await openRooms();
    await type(TOTAL, "41");
    await leaveField(TOTAL);
    const total = byId(TOTAL);
    total.focus();
    await act(async () => refuse(locked()));
    expect(document.activeElement).toBe(total);
  });
});
