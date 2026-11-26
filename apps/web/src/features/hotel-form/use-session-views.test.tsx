// @vitest-environment jsdom
import { useState } from "react";
import type * as ApiClient from "@ampm/api-client";
import { hotelFormSessionError } from "@ampm/core";
import { buttonNamed, mount, press, type Mounted } from "@ampm/web-forms/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DRAFT } from "./draft.test-fixtures";
import { INITIAL_FLOW, type FlowState } from "./flow";
import { ME } from "./screen.test-utils";
import { useSessionViews, type OnSessionRefused } from "./use-session-views";

/* The signed-in pages' data (D-190 §5): a session refused once is handed to the flow once. */

interface QueryStub {
  data: unknown;
  error: Error | null;
  isLoading: boolean;
  refetch: () => Promise<unknown>;
  dataUpdatedAt: number;
}

const queries = vi.hoisted(() => ({
  me: {
    data: undefined,
    error: null,
    isLoading: false,
    refetch: async () => undefined,
    dataUpdatedAt: 0,
  } as QueryStub,
  draft: {
    data: undefined,
    error: null,
    isLoading: false,
    refetch: async () => undefined,
    dataUpdatedAt: 0,
  } as QueryStub,
}));

vi.mock("@ampm/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClient>()),
  useHotelFormMe: () => queries.me,
  useHotelFormDraft: () => queries.draft,
}));

const SIGNED_IN: FlowState = {
  ...INITIAL_FLOW,
  phase: { kind: "signed_in", reverify: null },
  session: "s",
};

/** The views as a page holds them, drawn again on a press (a query's answer changing). */
function Views({ onSessionRefused }: { readonly onSessionRefused: OnSessionRefused }) {
  const [, setDraws] = useState(0);
  const { draft } = useSessionViews(SIGNED_IN, onSessionRefused);
  return (
    <>
      <output>{draft.clockSkewMs}</output>
      <button type="button" onClick={() => setDraws((draws) => draws + 1)}>
        Draw again
      </button>
    </>
  );
}

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

describe("a session refused while reading the draft", () => {
  it("is handed to the flow once, not again when the person's details change meanwhile", async () => {
    const onSessionRefused = vi.fn<OnSessionRefused>();
    queries.me = { ...queries.me, data: ME };
    queries.draft = { ...queries.draft, error: hotelFormSessionError("session_expired") };
    mounted = await mount(<Views onSessionRefused={onSessionRefused} />);
    expect(onSessionRefused).toHaveBeenCalledTimes(1);
    expect(onSessionRefused.mock.calls[0]?.[0].kind).toBe("new_code");
    // A new code: `me` is the person again (a new object), while the draft is still being read again.
    queries.me = { ...queries.me, data: { ...ME, person: { ...ME.person } } };
    await press(buttonNamed(mounted.host, "Draw again"));
    expect(onSessionRefused).toHaveBeenCalledTimes(1);
  });
});

describe("the API's clock", () => {
  const READ_AT = "2026-11-26T10:00:00.000Z";
  const skewIn = (host: HTMLElement) => Number(host.querySelector("output")?.textContent);

  it("is how far it runs from this device's, taken once per read of the draft, never from a cache update", async () => {
    queries.me = { ...queries.me, data: ME, error: null };
    // The draft arrived when this device's clock said 10:06, six minutes fast.
    const received = Date.parse(READ_AT) + 6 * 60_000;
    queries.draft = {
      ...queries.draft,
      error: null,
      data: { ...DRAFT, readAt: READ_AT },
      dataUpdatedAt: received,
    };
    mounted = await mount(<Views onSessionRefused={vi.fn()} />);
    expect(skewIn(mounted.host)).toBe(-6 * 60_000);
    // A save written into the cache ten minutes later keeps the read's time: the skew stays.
    queries.draft = {
      ...queries.draft,
      data: { ...DRAFT, readAt: READ_AT },
      dataUpdatedAt: received + 600_000,
    };
    await press(buttonNamed(mounted.host, "Draw again"));
    expect(skewIn(mounted.host)).toBe(-6 * 60_000);
    // The next read, the device's clock now set right, gives the skew afresh.
    const next = "2026-11-26T10:20:00.000Z";
    queries.draft = {
      ...queries.draft,
      data: { ...DRAFT, readAt: next },
      dataUpdatedAt: Date.parse(next),
    };
    await press(buttonNamed(mounted.host, "Draw again"));
    expect(skewIn(mounted.host)).toBe(0);
  });
});
