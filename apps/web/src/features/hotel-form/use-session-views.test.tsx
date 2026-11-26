// @vitest-environment jsdom
import { useState } from "react";
import type * as ApiClient from "@ampm/api-client";
import { hotelFormSessionError } from "@ampm/core";
import { buttonNamed, mount, press, type Mounted } from "@ampm/web-forms/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { INITIAL_FLOW, type FlowState } from "./flow";
import { ME } from "./screen.test-utils";
import { useSessionViews, type OnSessionRefused } from "./use-session-views";

/* The signed-in pages' data (D-190 §5): a session refused once is handed to the flow once. */

interface QueryStub {
  data: unknown;
  error: Error | null;
  isLoading: boolean;
  refetch: () => Promise<unknown>;
}

const queries = vi.hoisted(() => ({
  me: {
    data: undefined,
    error: null,
    isLoading: false,
    refetch: async () => undefined,
  } as QueryStub,
  draft: {
    data: undefined,
    error: null,
    isLoading: false,
    refetch: async () => undefined,
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
  useSessionViews(SIGNED_IN, onSessionRefused);
  return (
    <button type="button" onClick={() => setDraws((draws) => draws + 1)}>
      Draw again
    </button>
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
