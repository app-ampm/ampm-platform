// @vitest-environment jsdom
import { act, useState } from "react";
import { ApiProvider, createQueryClient, forgetHotelForm } from "@ampm/api-client";
import { hotelFormSessionError, type HotelFormSectionSaved } from "@ampm/core";
import { mount, type Mounted } from "@ampm/web-forms/testing";
import type { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ME, flowAt } from "../screen.test-utils";
import type { HotelFormFlow } from "../use-hotel-form-flow";
import type { HeldSections } from "./held-sections";
import { ROOMS_MODEL, type RoomsFields } from "./rooms.form";
import { AUTOSAVE_DELAY_MS } from "./section-autosave";
import { payloadOf } from "./section-payload";
import { useHeldSections } from "./use-held-sections";

/*
 * The layout's held sections in a browser (D-190 §5, review fix E1): a hidden page saves at once, and what
 * one person typed is dropped when the form is forgotten or someone else signs in, and sent when the same
 * person does.
 */

const SESSION = `hfs_${"y".repeat(43)}`;
const NEW_SESSION = `hfs_${"z".repeat(43)}`;
const COLLEAGUE = "0192f3a0-7d3e-7b1a-9c2f-0000000000b7";
const SAVED: HotelFormSectionSaved = {
  version: 3,
  isComplete: false,
  contentHash: "a".repeat(64),
  lastEditedBy: "Asha Rao",
  lastEditedAt: "2026-11-26T10:00:00.000Z",
  isLastSaveYours: true,
};

interface Sent {
  readonly bearer: string | undefined;
  readonly keepalive: boolean | undefined;
  readonly body: unknown;
}

/** The API as the test plays it: every section save is recorded, and answered as `answers` says. */
const wire = { sent: [] as Sent[], answers: [] as (() => Response)[] };
const ok = () => Response.json({ data: SAVED });
const sessionEnded = () => {
  const ended = hotelFormSessionError("session_expired");
  const error = { code: ended.code, message: ended.message, details: ended.details };
  return Response.json({ error }, { status: 401 });
};

const fakeFetch: typeof fetch = async (_input, init) => {
  const headers = new Headers(init?.headers);
  wire.sent.push({
    bearer: headers.get("authorization")?.replace("Bearer ", ""),
    keepalive: init?.keepalive,
    body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
  });
  return (wire.answers.shift() ?? ok)();
};

let held: HeldSections | null = null;
let setFlow: (flow: HotelFormFlow) => void = () => undefined;
let mounted: Mounted | null = null;
let client: QueryClient;

function Layout({ initial }: { readonly initial: HotelFormFlow }) {
  const [flow, replace] = useState(initial);
  setFlow = replace;
  held = useHeldSections(flow);
  return null;
}

const signedIn = (session: string | null = SESSION, personId: string | null = null) =>
  flowAt(
    { phase: { kind: "signed_in", reverify: null }, session, personId },
    { me: { data: ME, isLoading: false, error: null, retry: () => undefined } },
  );

async function mountLayout(flow = signedIn()): Promise<HeldSections> {
  client = createQueryClient({ retryRateLimited: false });
  mounted = await mount(
    <ApiProvider baseUrl="https://api.example.test" fetch={fakeFetch} queryClient={client}>
      <Layout initial={flow} />
    </ApiProvider>,
  );
  if (held === null) throw new Error("The layout did not mount");
  return held;
}

/** The rooms section, typed in as its page would: 41 rooms, saving after the delay. */
function typeRooms(sections: HeldSections, total = "41") {
  const rooms = sections.open(
    "rooms",
    { model: ROOMS_MODEL, check: payloadOf },
    { version: 2, saved: { answers: { totalRooms: 40 }, noChanges: false } },
  );
  rooms.update((fields: RoomsFields) => ({ ...fields, totalRooms: total }));
  return rooms;
}

const settle = () => act(async () => vi.advanceTimersByTimeAsync(0));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  wire.sent.length = 0;
  wire.answers.length = 0;
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  held = null;
  vi.useRealTimers();
});

describe("the page going", () => {
  it("saves what waits at once when the page is hidden, and when it is closed", async () => {
    const sections = await mountLayout();
    typeRooms(sections);
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    Reflect.deleteProperty(document, "visibilityState");
    await settle();
    expect(wire.sent).toHaveLength(1);
    typeRooms(sections, "42");
    window.dispatchEvent(new Event("pagehide"));
    await settle();
    expect(wire.sent).toHaveLength(2);
  });
});

describe("whose typing it is (review fix E1)", () => {
  it("drops what is held when the form is forgotten (sign-out, consent withdrawn, HF-08)", async () => {
    const sections = await mountLayout();
    typeRooms(sections);
    act(() => forgetHotelForm(client));
    expect(sections.hasPending()).toBe(false);
    await act(async () => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2));
    expect(wire.sent).toHaveLength(0);
  });

  it("drops what one person typed when someone else's code opens the next session", async () => {
    wire.answers.push(sessionEnded);
    const sections = await mountLayout();
    const rooms = typeRooms(sections);
    rooms.leave("hf-rooms-totalRooms");
    await settle();
    expect(rooms.snapshot().save).toEqual({ kind: "session" });
    await act(async () => setFlow(signedIn(NEW_SESSION, COLLEAGUE)));
    await act(async () => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2));
    expect(wire.sent).toHaveLength(1);
    expect(sections.hasPending()).toBe(false);
  });

  it("sends what waited, under the new session, once the same person enters a new code", async () => {
    wire.answers.push(sessionEnded);
    const sections = await mountLayout();
    const rooms = typeRooms(sections);
    rooms.leave("hf-rooms-totalRooms");
    await settle();
    await act(async () => setFlow(signedIn(NEW_SESSION, ME.personId)));
    await settle();
    expect(wire.sent).toHaveLength(2);
    expect(wire.sent[1]?.bearer).toBe(NEW_SESSION);
    expect(wire.sent[1]?.body).toMatchObject({ answers: { totalRooms: 41 }, expectedVersion: 2 });
    expect(rooms.snapshot().save).toEqual({ kind: "saved" });
  });
});
