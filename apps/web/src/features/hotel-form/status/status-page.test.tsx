// @vitest-environment jsdom
import type * as ApiClient from "@ampm/api-client";
import { HOTEL_FORM_ERRORS, type HotelFormDraftView } from "@ampm/core";
import { type Mounted } from "@ampm/web-forms/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DRAFT, EDITED_AT, draftWith } from "../draft.test-fixtures";
import type { HotelFormSite } from "../hotel-form-provider";
import { momentOf } from "../hotel-form-time";
import { SUBMITTED, mountStatus, statusSite } from "./status.test-utils";

/* HF-07, where the request stands (D-190 §5; plan §8): in each state, as the person reads it. */

const router = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("@ampm/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClient>()),
  useRequestHotelFormCorrection: () => ({ mutateAsync: vi.fn() }),
  useWithdrawHotelFormConsent: () => ({ mutateAsync: vi.fn() }),
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

let mounted: Mounted | null = null;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(Date.parse(EDITED_AT));
  router.replace.mockReset();
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.useRealTimers();
});

async function open(draft: HotelFormDraftView, site: HotelFormSite = statusSite(draft)) {
  mounted?.unmount();
  mounted = await mountStatus(site);
  return mounted.host;
}

const links = (host: HTMLElement) =>
  [...host.querySelectorAll("a")].map((link) => [link.getAttribute("href"), link.textContent]);

describe("HF-07, a submitted request", () => {
  it("gives the reference, the status in plain words, who submitted and when, and the answers read-only", async () => {
    const host = await open(SUBMITTED);
    expect(host.querySelector("h1")?.textContent).toBe("Your answers are with AMPM.");
    expect(host.textContent).toContain("HIR-2026-0042");
    expect(host.textContent).toContain("Submitted");
    expect(host.textContent).toContain(`Submitted by Ravi Kumar ${momentOf(EDITED_AT)}.`);
    expect(host.textContent).toContain("AMPM's Hotel team has your answers and will review them.");
    expect(host.textContent).toContain("Synthetic Lake Palace");
    // Read-only: no Edit link, no field to type in but the correction's.
    expect(links(host).map(([href]) => href)).not.toContain("/hotel-form/sections/property");
    expect(host.querySelectorAll("input:not([type=checkbox]):not([type=radio])")).toHaveLength(0);
    expect(host.querySelectorAll("textarea")).toHaveLength(1);
    expect(links(host)).toContainEqual(["/hotel-form/overview", "Back to the overview"]);
  });

  it("names no one when the submitter withdrew their consent, and still says when", async () => {
    const host = await open(draftWith({ ...SUBMITTED.request, submittedBy: null }));
    expect(host.textContent).toContain(`Submitted ${momentOf(EDITED_AT)}.`);
    expect(host.textContent).not.toContain("Ravi Kumar submitted");
    expect(host.textContent).not.toContain("null");
  });

  it("offers a correction, withdrawing 7.5 and removing the person's details", async () => {
    const host = await open(SUBMITTED);
    expect(host.textContent).toContain("Request a correction");
    expect(host.textContent).toContain("Withdraw my permission to show photos");
    expect(host.textContent).toContain("Remove my details");
  });

  it("shows the words a refused submit carried here (an earlier submit), announced", async () => {
    const site = {
      ...statusSite(SUBMITTED),
      carriedNotice: () => HOTEL_FORM_ERRORS.alreadySubmitted,
    };
    const host = await open(SUBMITTED, site);
    const notice = host.querySelector('[role="alert"]');
    expect(notice?.textContent).toBe(HOTEL_FORM_ERRORS.alreadySubmitted);
    expect(site.arrived).toHaveBeenCalledWith("/hotel-form/status");
  });
});

describe("HF-07 in the other states", () => {
  it("in review and complete: the status in words, a correction still offered", async () => {
    let host = await open(draftWith({ ...SUBMITTED.request, status: "in_review" }));
    expect(host.querySelector("h1")?.textContent).toBe("AMPM is reviewing your answers.");
    expect(host.textContent).toContain("Request a correction");
    host = await open(draftWith({ ...SUBMITTED.request, status: "merged", state: "status_only" }));
    expect(host.querySelector("h1")?.textContent).toBe("This request is complete.");
    expect(host.textContent).toContain("Complete");
    expect(host.textContent).toContain("Request a correction");
  });

  it("changes requested: a link back to the overview to update the answers, no correction", async () => {
    const host = await open(
      draftWith({ ...SUBMITTED.request, status: "changes_requested", state: "ready" }),
    );
    expect(host.querySelector("h1")?.textContent).toBe("AMPM asked for some changes.");
    expect(links(host)).toContainEqual(["/hotel-form/overview", "Update your answers"]);
    expect(host.textContent).not.toContain("Request a correction");
    expect(host.textContent).toContain("Remove my details");
  });

  it("never submitted: says so, leads back to the overview, and offers nothing to withdraw yet", async () => {
    const host = await open(DRAFT);
    expect(host.querySelector("h1")?.textContent).toBe("Not submitted yet.");
    expect(links(host)).toContainEqual(["/hotel-form/overview", "Update your answers"]);
    expect(host.textContent).not.toContain("Request a correction");
    expect(host.textContent).not.toContain("Remove my details");
    expect(host.textContent).toContain(
      "After the form is submitted, you can ask AMPM for a correction",
    );
  });
});
