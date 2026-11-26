import {
  HOTEL_FORM_ERRORS,
  hotelFormSectionConflictDetails,
  hotelFormSectionConflictOf,
  isAppError,
} from "@ampm/core";
import { beforeEach, describe, expect, it } from "vitest";

import { createApiClient } from "../client";
import { HOTEL_FORM_ME_QUERY_KEY } from "./use-hotel-form";
import {
  HOTEL_FORM_DRAFT_QUERY_KEY,
  hotelFormDraftCalls,
  hotelFormDraftQueryOptions,
} from "./use-hotel-form-draft";
import { AT, DRAFT, SESSION, SUBMIT, THEIRS } from "./use-hotel-form-draft.test-fixtures";

/*
 * The hotel form's own routes (D-190 §3): what is sent, as whom, and what is read back. What the hooks
 * cache is in use-hotel-form-draft.cache.test.ts.
 */

interface Sent {
  readonly url: string;
  readonly method: string | undefined;
  readonly headers: Record<string, string>;
  readonly body: unknown;
}

const wire = { sent: [] as Sent[], status: 200, answer: null as unknown };

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

function answer(data: unknown, status = 200): void {
  wire.answer = data;
  wire.status = status;
}

const calls = hotelFormDraftCalls(api);
const route = (sent: Sent | undefined) => [sent?.method, sent?.url.split("/_api")[1]];

beforeEach(() => {
  wire.sent.length = 0;
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
    answer({
      version: 3,
      isComplete: false,
      contentHash: "a".repeat(64),
      lastEditedBy: "Synthetic Person",
      lastEditedAt: AT,
      isLastSaveYours: true,
    });
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
