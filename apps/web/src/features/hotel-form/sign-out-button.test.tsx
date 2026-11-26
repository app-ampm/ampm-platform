// @vitest-environment jsdom
import type * as ApiClient from "@ampm/api-client";
import { buttonNamed, byId, mount, press, type Mounted } from "@ampm/web-forms/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DRAFT } from "./draft.test-fixtures";
import type { HotelFormSite } from "./hotel-form-provider";
import { OverviewScreen } from "./overview-screen";
import { ME, signedInSite } from "./screen.test-utils";
import type { HeldSections } from "./sections/held-sections";
import { ROOMS, typeTotal } from "./sections/held-sections.test-utils";
import { SUBMITTED, mountStatus } from "./status/status.test-utils";

/*
 * Signing out with changes not saved yet (D-190 §5, review fix F2): from the overview and the status page
 * it asks first, naming the sections; "Sign out anyway" drops the changes and signs out, "Stay signed in"
 * keeps them and puts focus back on Sign out. With nothing waiting it signs out at once.
 */

vi.mock("@ampm/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClient>()),
  useRequestHotelFormCorrection: () => ({ mutateAsync: vi.fn() }),
  useWithdrawHotelFormConsent: () => ({ mutateAsync: vi.fn() }),
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

let mounted: Mounted | null = null;
const signOut = vi.fn();

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"],
  });
  vi.setSystemTime(Date.parse("2026-11-26T10:00:00.000Z"));
  signOut.mockReset();
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.useRealTimers();
});

/** Rooms typed in and not saved yet: 41 rooms, waiting out its delay. */
function typeRooms(sections: HeldSections) {
  sections
    .open(
      "rooms",
      ROOMS,
      { version: 2, saved: { answers: { totalRooms: 40 }, noChanges: false } },
      ME.personId,
    )
    .update(typeTotal("41"));
}

async function openOverview(site: HotelFormSite): Promise<HTMLElement> {
  mounted = await mount(
    <OverviewScreen flow={site.flow} siteKey={site.siteKey} sections={site.sections} />,
  );
  return mounted.host;
}

describe("Sign out on the overview (review fix F2)", () => {
  it("signs out at once with nothing waiting to be saved", async () => {
    const site = signedInSite(DRAFT, { signOut });
    const host = await openOverview(site);
    await press(buttonNamed(host, "Sign out"));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("asks first while a section has changes not saved, naming it; staying keeps the changes", async () => {
    const site = signedInSite(DRAFT, { signOut });
    typeRooms(site.sections);
    const host = await openOverview(site);
    await press(buttonNamed(host, "Sign out"));
    expect(signOut).not.toHaveBeenCalled();
    const question = host.querySelector('[role="group"][aria-labelledby="hf-sign-out-confirm"]');
    expect(question?.textContent).toContain("Some of your changes aren't saved yet");
    expect(question?.querySelector('a[href="/hotel-form/sections/rooms"]')?.textContent).toBe(
      "Rooms",
    );
    expect(document.activeElement).toBe(byId("hf-sign-out-confirm"));
    await press(buttonNamed(host, "Stay signed in"));
    expect(host.querySelector('[aria-labelledby="hf-sign-out-confirm"]')).toBeNull();
    expect(document.activeElement).toBe(buttonNamed(host, "Sign out"));
    expect(site.sections.statuses()).toEqual({ rooms: "waiting" });
    expect(signOut).not.toHaveBeenCalled();
  });

  it("Sign out anyway drops the changes not saved and signs out", async () => {
    const site = signedInSite(DRAFT, { signOut });
    typeRooms(site.sections);
    const host = await openOverview(site);
    await press(buttonNamed(host, "Sign out"));
    await press(buttonNamed(host, "Sign out anyway"));
    expect(site.sections.hasPending()).toBe(false);
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});

describe("Sign out on the status page (review fix F2)", () => {
  it("asks first while a section has changes not saved, then signs out anyway", async () => {
    const site = signedInSite(SUBMITTED, { signOut });
    typeRooms(site.sections);
    mounted = await mountStatus(site);
    await press(buttonNamed(mounted.host, "Sign out"));
    expect(signOut).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(byId("hf-sign-out-confirm"));
    await press(buttonNamed(mounted.host, "Sign out anyway"));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
