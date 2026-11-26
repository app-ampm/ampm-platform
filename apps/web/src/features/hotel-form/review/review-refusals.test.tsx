// @vitest-environment jsdom
import { act } from "react";
import type * as ApiClient from "@ampm/api-client";
import {
  AppError,
  HOTEL_FORM_ERRORS,
  hotelFormMissingItemDetails,
  hotelFormReadOnlyDetails,
  hotelFormSectionsChangedDetails,
  hotelFormSessionError,
} from "@ampm/core";
import { buttonNamed, byId, type Mounted } from "@ampm/web-forms/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EDITED_AT } from "../draft.test-fixtures";
import type { HotelFormSite } from "../hotel-form-provider";
import { NOW, READY, declare, mountReview, pressSubmit, reviewSite } from "./review.test-utils";

/* HF-06's Submit refused (D-190 §5, as fixed after the reviews): each refusal, with focus on its message. */

const api = vi.hoisted(() => ({ submit: vi.fn() }));
const router = vi.hoisted(() => ({ replace: vi.fn() }));
const bot = vi.hoisted(() => ({ reset: vi.fn() }));

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
    reset: bot.reset,
  }),
}));

let mounted: Mounted | null = null;
let site: HotelFormSite;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(NOW);
  api.submit.mockReset();
  router.replace.mockReset();
  bot.reset.mockReset();
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.useRealTimers();
});

/** Submits the ready draft, declared, the API refusing with `error`; answers the notice shown. */
async function refusedWith(error: unknown, refuseSession = () => false) {
  api.submit.mockRejectedValueOnce(error);
  mounted?.unmount();
  site = reviewSite(READY, refuseSession);
  mounted = await mountReview(site);
  await declare(mounted.host);
  await pressSubmit(mounted.host);
  return mounted.host.querySelector<HTMLElement>("#hf-submit-notice");
}

/** The words of a section's card in the summary. */
const sectionCard = (key: string) =>
  byId(`hf-answers-${key}`).closest("article")?.textContent ?? "";

describe("Submit's refusals, each with focus on its message", () => {
  it("a colleague's save during the review marks those sections and keeps the declarations", async () => {
    const notice = await refusedWith(
      new AppError(
        "conflict",
        HOTEL_FORM_ERRORS.sectionsChanged,
        hotelFormSectionsChangedDetails(["rooms", "contact"]),
      ),
    );
    expect(document.activeElement).toBe(notice);
    expect(notice?.textContent).toContain(HOTEL_FORM_ERRORS.sectionsChanged);
    expect(notice?.querySelector('a[href="/hotel-form/sections/contact"]')).not.toBeNull();
    expect(notice?.querySelector('a[href="/hotel-form/sections/rooms"]')).not.toBeNull();
    expect(sectionCard("rooms")).toContain("Changed by a colleague");
    expect(sectionCard("contact")).toContain("Changed by a colleague");
    expect(sectionCard("venues")).not.toContain("Changed by a colleague");
    expect(byId("hf-accuracy")).toHaveProperty("checked", true);
    const no = mounted?.host.querySelector<HTMLInputElement>(
      'input[name="hf-display"][value="no"]',
    );
    expect(no?.checked).toBe(true);
  });

  it("the API's own missing items, a deep path named by its row", async () => {
    const items = [
      {
        section: "venues" as const,
        field: "rows.0.seated.max",
        message: "Give the most guests seated",
      },
    ];
    const notice = await refusedWith(
      new AppError(
        "validation_failed",
        HOTEL_FORM_ERRORS.submitIncomplete,
        hotelFormMissingItemDetails(items),
      ),
    );
    expect(document.activeElement).toBe(notice);
    expect(notice?.textContent).toContain(HOTEL_FORM_ERRORS.submitIncomplete);
    expect(notice?.querySelector('a[href="/hotel-form/sections/venues"]')?.textContent).toBe(
      "Venues · Venue 1: Give the most guests seated",
    );
  });

  it("old wording asks for a reload of the page", async () => {
    const notice = await refusedWith(new AppError("conflict", HOTEL_FORM_ERRORS.noticeStale));
    expect(document.activeElement).toBe(notice);
    expect(notice?.textContent).toContain(HOTEL_FORM_ERRORS.noticeStale);
    expect(buttonNamed(notice ?? document.body, "Reload the page")).toBeDefined();
  });

  it("a refused bot check says so, and its check runs again", async () => {
    const notice = await refusedWith(
      new AppError("validation_failed", HOTEL_FORM_ERRORS.botCheck, [
        { path: "botToken", message: HOTEL_FORM_ERRORS.botCheck },
      ]),
    );
    expect(document.activeElement).toBe(notice);
    expect(notice?.textContent).toContain(HOTEL_FORM_ERRORS.botCheck);
    expect(bot.reset).toHaveBeenCalled();
  });

  it("an earlier submit sends the person to the status page, carrying the API's words there", async () => {
    await refusedWith(
      new AppError(
        "conflict",
        HOTEL_FORM_ERRORS.alreadySubmitted,
        hotelFormReadOnlyDetails({
          status: "submitted",
          submittedBy: "Ravi Kumar",
          submittedAt: EDITED_AT,
        }),
      ),
    );
    expect(site.carryNotice).toHaveBeenCalledWith(
      "/hotel-form/status",
      HOTEL_FORM_ERRORS.alreadySubmitted,
    );
    expect(router.replace).toHaveBeenCalledWith("/hotel-form/status");
  });

  it("a 429 counts down, and Submit pressed meanwhile sends nothing until the wait is over", async () => {
    const notice = await refusedWith(
      new AppError("rate_limited", "Too many requests", undefined, 429, 3),
    );
    expect(notice?.textContent).toContain("Too many tries in a short time.");
    expect(notice?.textContent).toContain("You can submit again in 0:03");
    const host = mounted?.host ?? document.body;
    await pressSubmit(host);
    expect(api.submit).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(byId("hf-submit-notice"));
    await act(async () => vi.advanceTimersByTimeAsync(3_000));
    api.submit.mockResolvedValueOnce({
      reference: "HIR-2026-0042",
      status: "submitted",
      submittedAt: EDITED_AT,
    });
    await pressSubmit(host);
    expect(api.submit).toHaveBeenCalledTimes(2);
  });

  it("a session refused hands over to the flow, which asks for a new code in place", async () => {
    const refuseSession = vi.fn(() => true);
    const notice = await refusedWith(hotelFormSessionError("session_expired"), refuseSession);
    expect(refuseSession).toHaveBeenCalled();
    expect(notice).toBeNull();
  });

  it("a lost connection says so in the page's words", async () => {
    const notice = await refusedWith(new AppError("network_error", "Failed to fetch"));
    expect(notice?.textContent).toContain("We couldn't reach AMPM.");
  });
});
