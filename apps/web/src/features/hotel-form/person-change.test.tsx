// @vitest-environment jsdom
import type * as ApiClient from "@ampm/api-client";
import type { HotelFormMe } from "@ampm/core";
import { act } from "react";
import { buttonNamed, byId, press } from "@ampm/web-forms/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EDITED_AT } from "./draft.test-fixtures";
import type { HotelFormSite } from "./hotel-form-provider";
import { mountLivePage, type LivePage } from "./live-page.test-utils";
import { NOW, READY, declare, reviewSite } from "./review/review.test-utils";
import { HotelFormReviewPage } from "./review/review-page";
import { ME } from "./screen.test-utils";
import { HotelFormStatusPage } from "./status/status-page";
import { SUBMITTED, statusSite, typeInto } from "./status/status.test-utils";

/*
 * What a person chose on a page is theirs (D-190 §5, review fix C2): a new code entered in place keeps 7.4,
 * 7.5 and an unsent correction while the same person signs in again, and starts them afresh when someone
 * else does, told by the person's id, never by name. Synthetic people only.
 */

const withdraw = vi.hoisted(() =>
  vi.fn(async () => ({ withdrawn: ["display_authorisation"], removalRequested: false })),
);

vi.mock("@ampm/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClient>()),
  useSubmitHotelForm: () => ({ mutateAsync: vi.fn() }),
  useRequestHotelFormCorrection: () => ({ mutateAsync: vi.fn() }),
  useWithdrawHotelFormConsent: () => ({ mutateAsync: withdraw }),
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

const OTHER_PERSON_ID = "0192f3a0-7d3e-7b1a-9c2f-0000000000b2";

/** Someone else, with the same name as the person: only the id tells them apart. */
const SOMEONE_ELSE: HotelFormMe = { ...ME, personId: OTHER_PERSON_ID };

/** `site` with `me` as the person signed in. */
function signedInAs(site: HotelFormSite, me: HotelFormMe): HotelFormSite {
  return { ...site, flow: { ...site.flow, me: { ...site.flow.me, data: me } } };
}

/** `site` while a new code is asked for in place: no session, the page's data still shown. */
function askingForCode(site: HotelFormSite): HotelFormSite {
  const phase = { kind: "signed_in", reverify: { step: "details" } } as const;
  return { ...site, flow: { ...site.flow, state: { ...site.flow.state, phase, session: null } } };
}

let page: LivePage | null = null;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  page?.unmount();
  page = null;
  vi.useRealTimers();
});

const radios = (host: HTMLElement) => [
  ...host.querySelectorAll<HTMLInputElement>('input[name="hf-display"]'),
];

describe("7.4 and 7.5 on the review page across a new code", () => {
  it("are kept when the same person signs in again, and start afresh for someone else", async () => {
    page = await mountLivePage(HotelFormReviewPage, reviewSite(READY));
    await declare(page.host, "yes");
    await page.rerender(askingForCode(reviewSite(READY)));
    await page.rerender(signedInAs(reviewSite(READY), { ...ME, person: { ...ME.person } }));
    expect(byId("hf-accuracy")).toHaveProperty("checked", true);
    expect(radios(page.host).find((radio) => radio.checked)?.value).toBe("yes");
    await page.rerender(askingForCode(reviewSite(READY)));
    await page.rerender(signedInAs(reviewSite(READY), SOMEONE_ELSE));
    expect(byId("hf-accuracy")).toHaveProperty("checked", false);
    expect(radios(page.host).some((radio) => radio.checked)).toBe(false);
  });
});

describe("an unsent correction on the status page across a new code", () => {
  it("is kept for the same person, and emptied for someone else", async () => {
    vi.setSystemTime(Date.parse(EDITED_AT));
    page = await mountLivePage(HotelFormStatusPage, statusSite(SUBMITTED));
    await typeInto(byId("hf-correction"), "The pool closes at 9 pm, not 10.");
    await page.rerender(askingForCode(statusSite(SUBMITTED)));
    await page.rerender(signedInAs(statusSite(SUBMITTED), { ...ME }));
    expect(byId("hf-correction")).toHaveProperty("value", "The pool closes at 9 pm, not 10.");
    await page.rerender(askingForCode(statusSite(SUBMITTED)));
    await page.rerender(signedInAs(statusSite(SUBMITTED), SOMEONE_ELSE));
    expect(byId("hf-correction")).toHaveProperty("value", "");
  });
});

describe("7.5 withdrawn on the status page across a new code", () => {
  it("keeps its block for the same person, and shows none to someone else holding no permission", async () => {
    vi.setSystemTime(Date.parse(EDITED_AT));
    page = await mountLivePage(HotelFormStatusPage, statusSite(SUBMITTED));
    await press(buttonNamed(page.host, "Withdraw my permission to show photos"));
    await act(async () => undefined);
    const none = statusSite(SUBMITTED, {}, "none");
    await page.rerender(askingForCode(none));
    await page.rerender(signedInAs(none, { ...ME, photoPermission: "none" }));
    expect(page.host.textContent).toContain("Showing your hotel's photographs");
    await page.rerender(askingForCode(none));
    await page.rerender(signedInAs(none, { ...SOMEONE_ELSE, photoPermission: "none" }));
    expect(page.host.textContent).not.toContain("Showing your hotel's photographs");
  });
});
