// @vitest-environment jsdom
import { act } from "react";
import type * as ApiClient from "@ampm/api-client";
import { AppError, HOTEL_FORM_ERRORS, hotelFormSessionError } from "@ampm/core";
import { buttonNamed, byId, press, type Mounted } from "@ampm/web-forms/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EDITED_AT } from "../draft.test-fixtures";
import type { HotelFormSite } from "../hotel-form-provider";
import { mountLivePage } from "../live-page.test-utils";
import { SESSION } from "../screen.test-utils";
import { HotelFormStatusPage } from "./status-page";
import { SUBMITTED, mountStatus, settle, statusSite, typeInto } from "./status.test-utils";

/* HF-07's actions (D-190 §3 and §5; plan §9.3): a correction, withdrawing 7.5, and removing your details. */

const api = vi.hoisted(() => ({ correct: vi.fn(), withdraw: vi.fn() }));
const router = vi.hoisted(() => ({ replace: vi.fn() }));
const bot = vi.hoisted(() => ({ reset: vi.fn() }));

vi.mock("@ampm/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClient>()),
  useRequestHotelFormCorrection: () => ({ mutateAsync: api.correct }),
  useWithdrawHotelFormConsent: () => ({ mutateAsync: api.withdraw }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/components/bot-check/use-bot-check", () => ({
  useBotCheck: () => ({
    ref: () => undefined,
    check: { status: "passed", token: "turnstile-pass" },
    token: "turnstile-pass",
    reset: bot.reset,
  }),
}));

let mounted: Mounted | null = null;
let site: HotelFormSite;
const signOut = vi.fn();
const refuseSession = vi.fn(() => false);

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(Date.parse(EDITED_AT));
  for (const spy of [api.correct, api.withdraw, router.replace, bot.reset, signOut])
    spy.mockReset();
  refuseSession.mockReset().mockReturnValue(false);
  site = statusSite(SUBMITTED, { signOut, refuseSession });
  mounted = await mountStatus(site);
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.useRealTimers();
});

const host = () => mounted?.host ?? document.body;
const field = () => byId("hf-correction");

async function send() {
  await press(buttonNamed(host(), "Send to AMPM"));
  await settle();
}

describe("Request a correction", () => {
  it("counts the characters, and asks for words before sending anything", async () => {
    expect(host().textContent).toContain("0 of 2000 characters");
    await send();
    expect(api.correct).not.toHaveBeenCalled();
    expect(host().textContent).toContain("Write what should be corrected");
    expect(document.activeElement).toBe(field());
    await typeInto(field(), "The pool closes at 9 pm, not 10.");
    expect(host().textContent).toContain("32 of 2000 characters");
  });

  it("sends the message with its pass, then confirms, the field empty for another", async () => {
    api.correct.mockResolvedValue({ ok: true });
    await typeInto(field(), "The pool closes at 9 pm, not 10.");
    await send();
    expect(api.correct).toHaveBeenCalledWith({
      sessionToken: SESSION,
      correction: { message: "The pool closes at 9 pm, not 10.", botToken: "turnstile-pass" },
    });
    expect(bot.reset).toHaveBeenCalled();
    const sent = byId("hf-correction-notice");
    expect(sent.textContent).toContain("Sent to AMPM's Hotel team.");
    expect(document.activeElement).toBe(sent);
    expect(field()).toHaveProperty("value", "");
  });

  it("shows each refusal in the API's words, with focus on it, and holds Send through a day's cap", async () => {
    api.correct.mockRejectedValueOnce(new AppError("conflict", HOTEL_FORM_ERRORS.notSubmitted));
    await typeInto(field(), "The pool closes at 9 pm.");
    await send();
    expect(byId("hf-correction-notice").textContent).toContain(HOTEL_FORM_ERRORS.notSubmitted);
    expect(document.activeElement).toBe(byId("hf-correction-notice"));
    api.correct.mockRejectedValueOnce(
      new AppError("rate_limited", HOTEL_FORM_ERRORS.correctionLimit, undefined, 429, 7_200),
    );
    await send();
    expect(byId("hf-correction-notice").textContent).toContain(HOTEL_FORM_ERRORS.correctionLimit);
    await send();
    expect(api.correct).toHaveBeenCalledTimes(2);
    // The message is kept for when the wait is over.
    expect(field()).toHaveProperty("value", "The pool closes at 9 pm.");
  });

  it("a refused bot check says so and runs again; a refused session goes to the flow", async () => {
    api.correct.mockRejectedValueOnce(
      new AppError("validation_failed", HOTEL_FORM_ERRORS.botCheck, [
        { path: "botToken", message: HOTEL_FORM_ERRORS.botCheck },
      ]),
    );
    await typeInto(field(), "The pool closes at 9 pm.");
    await send();
    expect(byId("hf-correction-notice").textContent).toContain(HOTEL_FORM_ERRORS.botCheck);
    // The pass was spent as the message went, so its check is already running again.
    expect(bot.reset).toHaveBeenCalledTimes(1);
    refuseSession.mockReturnValue(true);
    api.correct.mockRejectedValueOnce(hotelFormSessionError("session_expired"));
    await send();
    expect(refuseSession).toHaveBeenCalled();
    expect(field()).toHaveProperty("value", "The pool closes at 9 pm.");
  });
});

describe("Withdraw my permission to show photos (7.5)", () => {
  it("sends display_authorisation and says what changed", async () => {
    api.withdraw.mockResolvedValueOnce({
      withdrawn: ["display_authorisation"],
      removalRequested: false,
    });
    await press(buttonNamed(host(), "Withdraw my permission to show photos"));
    await settle();
    expect(api.withdraw).toHaveBeenCalledWith({
      sessionToken: SESSION,
      withdrawal: { kind: "display_authorisation", requestRemoval: false },
    });
    const notice = byId("hf-display-notice");
    expect(notice.textContent).toContain("Your permission to show photos is withdrawn");
    expect(document.activeElement).toBe(notice);
    api.withdraw.mockResolvedValueOnce({ withdrawn: [], removalRequested: false });
    await press(buttonNamed(host(), "Withdraw my permission to show photos"));
    await settle();
    expect(byId("hf-display-notice").textContent).toContain(
      "You have no permission to show photos on record",
    );
  });

  it("once withdrawn, keeps the block and its notice on screen though me now answers none", async () => {
    mounted?.unmount();
    const page = await mountLivePage(HotelFormStatusPage, site);
    mounted = page;
    api.withdraw.mockResolvedValueOnce({
      withdrawn: ["display_authorisation"],
      removalRequested: false,
    });
    await press(buttonNamed(host(), "Withdraw my permission to show photos"));
    await settle();
    // me read again after the withdrawal: the person holds no permission now.
    await page.rerender(statusSite(SUBMITTED, { signOut, refuseSession }, "none"));
    expect(host().textContent).toContain("Showing your hotel's photographs");
    const notice = byId("hf-display-notice");
    expect(notice.textContent).toContain("Your permission to show photos is withdrawn");
    expect(document.activeElement).toBe(notice);
  });
});

describe("Remove my details", () => {
  it("first says what happens next, and Cancel leaves everything as it was", async () => {
    await press(buttonNamed(host(), "Remove my details"));
    expect(host().textContent).toContain("What happens next:");
    expect(host().textContent).toContain("You are signed out, here and on any other device");
    expect(document.activeElement?.textContent).toBe("Remove your details?");
    await press(buttonNamed(host(), "Cancel"));
    expect(host().textContent).not.toContain("What happens next:");
    expect(api.withdraw).not.toHaveBeenCalled();
    expect(document.activeElement?.textContent).toBe("Remove my details");
  });

  it("confirmed, withdraws every consent with a removal request, signs out and says so plainly", async () => {
    api.withdraw.mockResolvedValueOnce({
      withdrawn: ["privacy_notice", "accuracy_attestation", "display_authorisation"],
      removalRequested: true,
    });
    await press(buttonNamed(host(), "Remove my details"));
    await press(buttonNamed(host(), "Yes, remove my details"));
    await settle();
    expect(api.withdraw).toHaveBeenCalledWith({
      sessionToken: SESSION,
      withdrawal: { kind: "all", requestRemoval: true },
    });
    expect(signOut).toHaveBeenCalled();
    expect(host().querySelector("h1")?.textContent).toBe("Your consent is withdrawn.");
    expect(host().textContent).toContain("AMPM has your request to remove your details");
    expect(host().querySelector("form")).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("refused, keeps the person here with the reason, signed in", async () => {
    api.withdraw.mockRejectedValueOnce(new AppError("network_error", "Failed to fetch"));
    await press(buttonNamed(host(), "Remove my details"));
    await act(async () => buttonNamed(host(), "Yes, remove my details").click());
    await settle();
    expect(byId("hf-removal-notice").textContent).toContain("We couldn't reach AMPM.");
    expect(signOut).not.toHaveBeenCalled();
  });
});
