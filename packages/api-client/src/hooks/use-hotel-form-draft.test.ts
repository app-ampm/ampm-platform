import type * as ReactQuery from "@tanstack/react-query";
import { QueryClient } from "@tanstack/react-query";
import {
  AppError,
  HOTEL_FORM_ACCURACY_VERSION,
  HOTEL_FORM_CAPS,
  HOTEL_FORM_DISPLAY_VERSION,
  HOTEL_FORM_ERRORS,
  hotelFormReadOnlyDetails,
  hotelFormSectionConflictDetails,
  hotelFormSectionConflictOf,
  isAppError,
  type HotelFormDraftView,
  type HotelFormMe,
} from "@ampm/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "../client";
import { HOTEL_FORM_ME_QUERY_KEY } from "./use-hotel-form";
import {
  HOTEL_FORM_DRAFT_QUERY_KEY,
  hotelFormDraftCalls,
  hotelFormDraftQueryOptions,
  useRequestHotelFormCorrection,
  useSaveHotelFormSection,
  useSubmitHotelForm,
  useWithdrawHotelFormConsent,
} from "./use-hotel-form-draft";

/* The hotel form's own routes (D-190 §3): what is sent, as whom, what is read back and what is cached. */

interface Sent {
  readonly url: string;
  readonly method: string | undefined;
  readonly headers: Record<string, string>;
  readonly body: unknown;
}

const wire = vi.hoisted(() => ({ sent: [] as Sent[], status: 200, answer: null as unknown }));

interface MutationSeen {
  readonly mutationFn: (variables: unknown) => Promise<unknown>;
  readonly onSuccess?: (data: unknown, variables: unknown) => unknown;
  readonly onError?: (error: unknown, variables: unknown) => unknown;
}

const hooks = vi.hoisted(() => ({ options: [] as MutationSeen[] }));
const cache = new QueryClient();

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactQuery>()),
  useMutation: (options: MutationSeen) => {
    hooks.options.push(options);
    return options;
  },
  useQueryClient: () => cache,
}));

const fakeFetch: typeof fetch = async (input, init) => {
  wire.sent.push({
    url: String(input),
    method: init?.method,
    headers: { ...(init?.headers as Record<string, string>) },
    body: typeof init?.body === "string" ? JSON.parse(init.body) : init?.body,
  });
  const envelope = wire.status < 400 ? { data: wire.answer } : wire.answer;
  return new Response(JSON.stringify(envelope), {
    status: wire.status,
    headers: { "content-type": "application/json" },
  });
};

const api = createApiClient({
  baseUrl: "https://api.example.test/_api",
  getAccessToken: () => "staff-session-token",
  fetch: fakeFetch,
});

vi.mock("../provider", () => ({ useApiClient: () => api }));

const SESSION = `hfs_${"B".repeat(43)}`;
const AT = "2026-11-26T09:30:00.000Z";
const unsaved = {
  answers: {},
  version: 0,
  isComplete: false,
  noChanges: false,
  lastEditedBy: null,
  lastEditedAt: null,
};
const DRAFT: HotelFormDraftView = {
  request: {
    reference: "HIR-2026-0042",
    kind: "onboarding",
    status: "open",
    state: "ready",
    displayLabel: "Synthetic Lake Palace, winter 2026",
    staffNote: null,
    expiresAt: "2026-12-26T00:00:00.000Z",
    submittedAt: null,
    submittedBy: null,
  },
  sections: {
    property: unsaved,
    contact: unsaved,
    rooms: {
      ...unsaved,
      answers: { totalRooms: 30 },
      version: 2,
      lastEditedBy: "Colleague",
      lastEditedAt: AT,
    },
    venues: unsaved,
    booking_terms: unsaved,
    food_beverage: unsaved,
    fact_sheet_media: { ...unsaved, isComplete: true },
  },
  contributors: [{ fullName: "Synthetic Person", designation: "General Manager", isYou: true }],
  caps: HOTEL_FORM_CAPS,
  options: {
    cuisines: { options: ["Indian"], other: "Other" },
    facilities: { options: ["Spa"], other: "Other" },
  },
};
const ME: HotelFormMe = {
  person: { fullName: "Synthetic Person", designation: "General Manager" },
  request: {
    displayLabel: null,
    staffNote: null,
    status: "open",
    expiresAt: "2026-12-26T00:00:00.000Z",
  },
};
const SUBMIT = {
  accuracy: { accepted: true as const, textVersion: HOTEL_FORM_ACCURACY_VERSION },
  display: { answer: "yes" as const, textVersion: HOTEL_FORM_DISPLAY_VERSION },
  botToken: "turnstile-pass",
};

/** A colleague's newer save of the rooms section, as a 409 carries it. */
const THEIRS = {
  section: "rooms" as const,
  version: 4,
  answers: { totalRooms: 44 },
  noChanges: false,
  editedBy: "Colleague",
  editedAt: AT,
};

function answer(data: unknown, status = 200): void {
  wire.answer = data;
  wire.status = status;
}

const calls = hotelFormDraftCalls(api);
const route = (sent: Sent | undefined) => [sent?.method, sent?.url.split("/_api")[1]];

beforeEach(() => {
  wire.sent.length = 0;
  hooks.options.length = 0;
  cache.clear();
  answer(null);
});

describe("the form's calls", () => {
  it("read the draft with the form session as the Bearer, never the staff session", async () => {
    answer(DRAFT);
    await expect(calls.draft(SESSION)).resolves.toEqual(DRAFT);
    expect(route(wire.sent[0])).toEqual(["GET", "/hotel-form/draft"]);
    expect(wire.sent[0]?.headers["authorization"]).toBe(`Bearer ${SESSION}`);
    answer({ ...DRAFT, hotelName: "Not for the form" });
    await expect(calls.draft(SESSION)).rejects.toThrow();
  });

  it("save a section compact, its blanks left out, under the section's own path", async () => {
    answer({ version: 3, isComplete: false, contentHash: "a".repeat(64) });
    const save = {
      answers: { totalRooms: 40, rows: [], noLongerOffered: null },
      expectedVersion: 2,
      noChanges: false,
    };
    await calls.saveSection({ sessionToken: SESSION, section: "rooms", save });
    expect(route(wire.sent[0])).toEqual(["PUT", "/hotel-form/draft/sections/rooms"]);
    expect(wire.sent[0]?.body).toEqual({
      answers: { totalRooms: 40 },
      expectedVersion: 2,
      noChanges: false,
    });
    expect(wire.sent[0]?.headers["authorization"]).toBe(`Bearer ${SESSION}`);
  });

  it("submit, ask for a correction and withdraw consent, each answer held to its contract", async () => {
    answer({ reference: "HIR-2026-0042", status: "submitted", submittedAt: AT });
    await calls.submit({ sessionToken: SESSION, submit: SUBMIT });
    answer({ ok: true });
    await calls.requestCorrection({
      sessionToken: SESSION,
      correction: { message: "The lawn seats 900.", botToken: "pass" },
    });
    answer({ withdrawn: ["display_authorisation"], removalRequested: false });
    await calls.withdrawConsent({
      sessionToken: SESSION,
      withdrawal: { kind: "display_authorisation", requestRemoval: false },
    });
    expect(wire.sent.map(route)).toEqual([
      ["POST", "/hotel-form/submit"],
      ["POST", "/hotel-form/corrections"],
      ["POST", "/hotel-form/consent-withdrawal"],
    ]);
    expect(wire.sent.every((sent) => sent.headers["authorization"] === `Bearer ${SESSION}`)).toBe(
      true,
    );
    expect(wire.sent[0]?.body).toEqual(SUBMIT);
    answer({ ok: true, correctionId: "x" });
    await expect(
      calls.requestCorrection({ sessionToken: SESSION, correction: { message: "x" } }),
    ).rejects.toThrow();
  });

  it("raise a colleague's newer save as an AppError whose details core reads back", async () => {
    const theirs = { ...THEIRS, version: 3 };
    answer(
      {
        error: {
          code: "conflict",
          message: HOTEL_FORM_ERRORS.sectionConflict,
          details: hotelFormSectionConflictDetails(theirs),
        },
      },
      409,
    );
    const save = { answers: { totalRooms: 40 }, expectedVersion: 2, noChanges: false };
    const error = await calls
      .saveSection({ sessionToken: SESSION, section: "rooms", save })
      .catch((caught: unknown) => caught);
    expect(isAppError(error) && hotelFormSectionConflictOf(error, "rooms")).toEqual(theirs);
  });

  it("read the draft only while there is a session, keyed apart from `me`", () => {
    expect(hotelFormDraftQueryOptions(api, null).enabled).toBe(false);
    expect(hotelFormDraftQueryOptions(api, SESSION).queryKey).toEqual(HOTEL_FORM_DRAFT_QUERY_KEY);
    expect(HOTEL_FORM_DRAFT_QUERY_KEY).not.toEqual(HOTEL_FORM_ME_QUERY_KEY);
  });
});

describe("the hooks keep the cached draft as the API holds it", () => {
  const isInvalidated = (key: readonly string[]) =>
    cache.getQueryState(key)?.isInvalidated === true;

  it("after a save: the section's new version, its normalised answers and you as its editor", () => {
    cache.setQueryData(HOTEL_FORM_DRAFT_QUERY_KEY, DRAFT);
    cache.setQueryData(HOTEL_FORM_ME_QUERY_KEY, ME);
    useSaveHotelFormSection();
    const [save] = hooks.options;
    const call = {
      sessionToken: SESSION,
      section: "rooms",
      save: {
        answers: { totalRooms: 41, noLongerOffered: "  " },
        expectedVersion: 2,
        noChanges: false,
      },
    };
    save?.onSuccess?.({ version: 3, isComplete: false, contentHash: "b".repeat(64) }, call);
    const rooms = cache.getQueryData<HotelFormDraftView>(HOTEL_FORM_DRAFT_QUERY_KEY)?.sections
      .rooms;
    expect(rooms).toMatchObject({
      answers: { totalRooms: 41, noLongerOffered: null },
      version: 3,
      lastEditedBy: "Synthetic Person",
    });
    expect(rooms?.lastEditedAt).not.toBe(AT);
  });

  it("after a conflict: the colleague's save, so Keep mine saves on their version", () => {
    cache.setQueryData(HOTEL_FORM_DRAFT_QUERY_KEY, DRAFT);
    useSaveHotelFormSection();
    const [save] = hooks.options;
    const theirs = THEIRS;
    const error = new AppError(
      "conflict",
      HOTEL_FORM_ERRORS.sectionConflict,
      hotelFormSectionConflictDetails(theirs),
    );
    save?.onError?.(error, { sessionToken: SESSION, section: "rooms", save: {} });
    expect(
      cache.getQueryData<HotelFormDraftView>(HOTEL_FORM_DRAFT_QUERY_KEY)?.sections.rooms,
    ).toEqual({
      answers: { totalRooms: 44 },
      version: 4,
      isComplete: false,
      noChanges: false,
      lastEditedBy: "Colleague",
      lastEditedAt: AT,
    });
  });

  it("after a refused save on a locked request, and after a submit or a withdrawal: read again", () => {
    useSaveHotelFormSection();
    useSubmitHotelForm();
    useWithdrawHotelFormConsent();
    useRequestHotelFormCorrection();
    const [save, submit, withdraw, correction] = hooks.options;
    const reseed = () => {
      cache.setQueryData(HOTEL_FORM_DRAFT_QUERY_KEY, DRAFT);
      cache.setQueryData(HOTEL_FORM_ME_QUERY_KEY, ME);
    };
    reseed();
    const locked = new AppError(
      "conflict",
      HOTEL_FORM_ERRORS.readOnly,
      hotelFormReadOnlyDetails({ status: "submitted", submittedBy: "Colleague", submittedAt: AT }),
    );
    save?.onError?.(locked, { sessionToken: SESSION, section: "rooms", save: {} });
    expect(isInvalidated(HOTEL_FORM_DRAFT_QUERY_KEY)).toBe(true);
    expect(isInvalidated(HOTEL_FORM_ME_QUERY_KEY)).toBe(true);
    reseed();
    submit?.onSuccess?.({ reference: "HIR-2026-0042", status: "submitted", submittedAt: AT }, {});
    expect(isInvalidated(HOTEL_FORM_DRAFT_QUERY_KEY)).toBe(true);
    expect(isInvalidated(HOTEL_FORM_ME_QUERY_KEY)).toBe(true);
    reseed();
    withdraw?.onSuccess?.({ withdrawn: [], removalRequested: true }, {});
    expect(isInvalidated(HOTEL_FORM_DRAFT_QUERY_KEY)).toBe(true);
    expect(correction?.onSuccess).toBeUndefined();
  });
});
