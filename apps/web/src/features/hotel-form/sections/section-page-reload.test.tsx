// @vitest-environment jsdom
import { act, useState } from "react";
import { ApiProvider, createQueryClient } from "@ampm/api-client";
import type { HotelFormSectionSaved } from "@ampm/core";
import { mount, type Mounted } from "@ampm/web-forms/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { draftView } from "../draft.test-fixtures";
import { HotelFormSiteContext, type HotelFormSite } from "../hotel-form-provider";
import { ME, SESSION, flowAt } from "../screen.test-utils";
import type { HotelFormFlow } from "../use-hotel-form-flow";
import { HotelFormSectionPage } from "./section-page";
import { TOTAL, leaveField, type, valueOf } from "./section-page.test-utils";
import { useHeldSections } from "./use-held-sections";

/*
 * A section's page after a reload (D-190 §5, d96b4e64), under the layout's real held sections: the
 * session comes back from the tab before `me` is read again, so the layout's copy of the session has no
 * person yet when `me` arrives and the page opens the section. The section belongs to the person the page
 * renders for, so what they type saves under their session, never refused as if a new code were needed.
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

const SAVED: HotelFormSectionSaved = {
  version: 3,
  isComplete: false,
  contentHash: "a".repeat(64),
  lastEditedBy: "Asha Rao",
  lastEditedAt: "2026-11-26T10:00:00.000Z",
  isLastSaveYours: true,
};

/** Each section save the API was sent: its Bearer and body. */
const sent: { bearer: string | undefined; body: unknown }[] = [];
const fakeFetch: typeof fetch = async (_input, init) => {
  const headers = new Headers(init?.headers);
  sent.push({
    bearer: headers.get("authorization")?.replace("Bearer ", ""),
    body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
  });
  return Response.json({ data: SAVED });
};

const SITE_CALLS = {
  siteKey: "test-site-key",
  rememberReturn: () => undefined,
  landing: () => "/hotel-form/overview",
  arrived: () => undefined,
  carryNotice: () => undefined,
  carriedNotice: () => null,
};

let setFlow: (flow: HotelFormFlow) => void = () => undefined;
let mounted: Mounted | null = null;

/** The form's layout as it runs: the flow in state, its real held sections, the rooms page under it. */
function Layout({ initial }: { readonly initial: HotelFormFlow }) {
  const [flow, replace] = useState(initial);
  setFlow = replace;
  const site: HotelFormSite = { flow, sections: useHeldSections(flow), ...SITE_CALLS };
  return (
    <HotelFormSiteContext.Provider value={site}>
      <HotelFormSectionPage sectionKey="rooms" />
    </HotelFormSiteContext.Provider>
  );
}

/** Signed in from the tab's kept session, the draft read, `me` read again or not yet. */
const afterReload = (isMeRead: boolean) =>
  flowAt(
    { phase: { kind: "signed_in", reverify: null }, session: SESSION, personId: null },
    {
      me: { data: isMeRead ? ME : undefined, isLoading: !isMeRead, error: null, retry: vi.fn() },
      draft: draftView(),
    },
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  sent.length = 0;
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.useRealTimers();
});

describe("a section's page after a reload (d96b4e64)", () => {
  it("belongs to the person the page renders for: what they type saves under their session", async () => {
    const client = createQueryClient({ retryRateLimited: false });
    mounted = await mount(
      <ApiProvider baseUrl="https://api.example.test" fetch={fakeFetch} queryClient={client}>
        <Layout initial={afterReload(false)} />
      </ApiProvider>,
    );
    expect(mounted.host.querySelector(`#${TOTAL}`)).toBeNull();
    // `me` is read again: the page opens the section in the same render the layout first hears of them.
    await act(async () => setFlow(afterReload(true)));
    expect(valueOf(TOTAL)).toBe("40");
    await type(TOTAL, "41");
    await leaveField(TOTAL);
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(sent).toHaveLength(1);
    expect(sent[0]?.bearer).toBe(SESSION);
    expect(sent[0]?.body).toMatchObject({ answers: { totalRooms: 41 }, expectedVersion: 2 });
    const line = mounted.host.querySelector('p[role="status"][aria-live="polite"]')?.textContent;
    expect(line).toBe("Saved");
  });
});
