// @vitest-environment jsdom
import { buttonNamed, mount, press, type Mounted } from "@ampm/web-forms/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Phase } from "./flow";
import { HotelFormIdentityPage } from "./identity-page";
import { HotelFormSiteContext, useReturnPage, type HotelFormSite } from "./hotel-form-provider";
import { HotelFormOverviewPage } from "./overview-page";
import { ME, flowAt } from "./screen.test-utils";
import { HotelFormSectionPage } from "./sections/section-page";
import { innerPageStep, useSignedInPage } from "./use-signed-in-page";

/*
 * The form's pages sharing one session (D-190 §5): a page behind the sign-in opened without a session goes
 * to the sign-in and is returned to afterwards; signing in lands on the overview.
 */

const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/components/bot-check/use-bot-check", () => ({
  useBotCheck: () => ({
    ref: () => undefined,
    check: { status: "checking" },
    token: null,
    reset: () => undefined,
  }),
}));

let mounted: Mounted | null = null;

beforeEach(() => router.replace.mockClear());

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

/** The form's shared state at a phase, its return page recorded by spies. */
function siteAt(phase: Phase, landing = "/hotel-form/overview"): HotelFormSite {
  return {
    flow: flowAt(
      { phase, session: phase.kind === "signed_in" ? "s" : null },
      { me: { data: ME, isLoading: false, error: null, retry: () => undefined } },
    ),
    siteKey: "test-site-key",
    rememberReturn: vi.fn(),
    landing: () => landing,
    arrived: vi.fn(),
    carryNotice: vi.fn(),
    carriedNotice: () => null,
  };
}

const SIGNED_IN: Phase = { kind: "signed_in", reverify: null };

describe("a page behind the sign-in", () => {
  it("waits while the link opens, shows itself signed in, and otherwise goes to the sign-in", () => {
    expect(innerPageStep({ kind: "opening" })).toBe("wait");
    expect(innerPageStep(SIGNED_IN)).toBe("show");
    expect(innerPageStep({ kind: "signed_in", reverify: { step: "details" } })).toBe("show");
    for (const phase of [
      { kind: "welcome" },
      { kind: "identity", identity: { step: "details" } },
      { kind: "no_link" },
      { kind: "gone", message: null },
      { kind: "unreachable", message: "", retryAt: null },
    ] satisfies Phase[])
      expect(innerPageStep(phase)).toBe("sign_in");
  });

  it("opened with no session (a deep link, a reload), remembers itself and goes to the sign-in", async () => {
    const site = siteAt({ kind: "welcome" });
    mounted = await mount(
      <HotelFormSiteContext.Provider value={site}>
        <HotelFormSectionPage sectionKey="venues" />
      </HotelFormSiteContext.Provider>,
    );
    expect(site.rememberReturn).toHaveBeenCalledWith("/hotel-form/sections/venues");
    expect(router.replace).toHaveBeenCalledWith("/hotel-form");
    expect(mounted.host.textContent).toContain("Opening your form…");
  });

  it("stays put once it is leaving: its person asked to be removed and was signed out there", async () => {
    const site = siteAt({ kind: "welcome" });
    function Leaving() {
      const shown = useSignedInPage("/hotel-form/status", { isLeaving: true });
      return <p>{shown === null ? "left" : "shown"}</p>;
    }
    mounted = await mount(
      <HotelFormSiteContext.Provider value={site}>
        <Leaving />
      </HotelFormSiteContext.Provider>,
    );
    expect(router.replace).not.toHaveBeenCalled();
    expect(site.rememberReturn).not.toHaveBeenCalled();
    expect(mounted.host.textContent).toBe("left");
  });

  it("does nothing while the link opens, and once signed in says it was arrived at", async () => {
    const opening = siteAt({ kind: "opening" });
    mounted = await mount(
      <HotelFormSiteContext.Provider value={opening}>
        <HotelFormOverviewPage />
      </HotelFormSiteContext.Provider>,
    );
    expect(router.replace).not.toHaveBeenCalled();
    mounted.unmount();
    const signedIn = siteAt(SIGNED_IN);
    mounted = await mount(
      <HotelFormSiteContext.Provider value={signedIn}>
        <HotelFormOverviewPage />
      </HotelFormSiteContext.Provider>,
    );
    expect(signedIn.arrived).toHaveBeenCalledWith("/hotel-form/overview");
    expect(router.replace).not.toHaveBeenCalled();
    expect(mounted.host.querySelector("h1")?.textContent).toBe("Seasonal refresh 2027");
  });

  it("signing out goes back to the welcome through the sign-in", async () => {
    const signOut = vi.fn();
    const site = { ...siteAt(SIGNED_IN), flow: { ...siteAt(SIGNED_IN).flow, signOut } };
    mounted = await mount(
      <HotelFormSiteContext.Provider value={site}>
        <HotelFormOverviewPage />
      </HotelFormSiteContext.Provider>,
    );
    await press(buttonNamed(mounted.host, "Sign out"));
    expect(signOut).toHaveBeenCalled();
  });
});

describe("the sign-in", () => {
  it("sends a signed-in person on to where they were going, replacing itself in the history", async () => {
    mounted = await mount(
      <HotelFormSiteContext.Provider value={siteAt(SIGNED_IN, "/hotel-form/sections/rooms")}>
        <HotelFormIdentityPage />
      </HotelFormSiteContext.Provider>,
    );
    expect(router.replace).toHaveBeenCalledWith("/hotel-form/sections/rooms");
    expect(router.replace).toHaveBeenCalledTimes(1);
  });

  it("stays on the welcome until then", async () => {
    mounted = await mount(
      <HotelFormSiteContext.Provider value={siteAt({ kind: "welcome" })}>
        <HotelFormIdentityPage />
      </HotelFormSiteContext.Provider>,
    );
    expect(router.replace).not.toHaveBeenCalled();
    expect(mounted.host.querySelector("h1")?.textContent).toBe("Tell AMPM about your hotel.");
  });
});

/** The return page's three calls, from a component, so the hook runs as the layout runs it. */
function ReturnPage({ run }: { readonly run: (page: ReturnType<typeof useReturnPage>) => void }) {
  run(useReturnPage());
  return null;
}

describe("the page remembered across the sign-in", () => {
  it("is the overview unless a page of the form's own was remembered, and is forgotten on arrival", async () => {
    const seen: string[] = [];
    mounted = await mount(
      <ReturnPage
        run={({ rememberReturn, landing, arrived }) => {
          seen.push(landing());
          rememberReturn("/hotel-form/sections/rooms");
          seen.push(landing());
          rememberReturn("https://elsewhere.example/hotel-form/overview");
          seen.push(landing());
          rememberReturn("/hotel-form/review");
          arrived("/hotel-form/overview");
          seen.push(landing());
          arrived("/hotel-form/review");
          seen.push(landing());
        }}
      />,
    );
    expect(seen.slice(0, 5)).toEqual([
      "/hotel-form/overview",
      "/hotel-form/sections/rooms",
      "/hotel-form/overview",
      "/hotel-form/review",
      "/hotel-form/overview",
    ]);
  });

  it("carries a notice to the page the person is sent to, read there until that page has arrived", async () => {
    const seen: (string | null)[] = [];
    mounted = await mount(
      <ReturnPage
        run={({ carryNotice, carriedNotice, arrived }) => {
          carryNotice("/hotel-form/status", "This form has already been submitted.");
          seen.push(carriedNotice("/hotel-form/overview"), carriedNotice("/hotel-form/status"));
          arrived("/hotel-form/overview");
          seen.push(carriedNotice("/hotel-form/status"));
          arrived("/hotel-form/status");
          seen.push(carriedNotice("/hotel-form/status"));
        }}
      />,
    );
    expect(seen.slice(0, 4)).toEqual([
      null,
      "This form has already been submitted.",
      "This form has already been submitted.",
      null,
    ]);
  });
});
