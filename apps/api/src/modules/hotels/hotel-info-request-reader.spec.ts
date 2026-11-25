import {
  CONFIG_REGISTRY,
  hotelFormModeView,
  hotelInfoRequestFullView,
  hotelInfoRequestListQuery,
  hotelInfoRequestPage,
  hotelInfoRequestSummaryView,
} from "@ampm/core";
import { describe, expect, it, vi } from "vitest";

import { staffPrincipal } from "../../policy/testing/staff-principal.js";
import type { ConfigService } from "../admin/config/config.service.js";
import { HotelInfoRequestReader } from "./hotel-info-request-reader.js";
import type {
  HotelInfoRequestsRepository,
  RequestEventRow,
  RequestRow,
} from "./hotel-info-requests.repository.js";
import { HOTEL_ID, REQUEST_ID, requestRow } from "./testing/info-request-fixtures.js";

/*
 * Reading hotel information requests (D-188 §3): one model per audience, decided from the principal's
 * grants (D-164): the summary for a reader without `hotels.info_requests.update` (SM, PM), the full view,
 * with the recipient and the latest events, for its holders (SA, HT).
 */

const EXPIRES = new Date("2099-01-31T10:00:00.000Z");

const event: RequestEventRow = {
  id: "0192f1a0-0000-7000-8000-0000000000c1",
  eventType: "created",
  actorKind: "staff",
  actorUserId: "018f0000-0000-7000-8000-00000000cafe",
  detail: { generation: 1, expiresAt: EXPIRES.toISOString() },
  occurredAt: new Date("2026-11-24T10:00:00.000Z"),
};

function build(row: RequestRow | null = requestRow({ expiresAt: EXPIRES })) {
  const repo = {
    findById: vi.fn(async () => row),
    latestEvents: vi.fn(async () => [event]),
    firstExtensionDetail: vi.fn(async (): Promise<unknown> => null),
    list: vi.fn(async () => ({ rows: row ? [row] : [], nextCursor: null })),
    listForHotel: vi.fn(async () => ({ rows: row ? [row] : [], nextCursor: null })),
    hotelExists: vi.fn(async () => true),
  };
  const policy = CONFIG_REGISTRY["hotel_form.policy"].default;
  const config = {
    get: vi.fn(async () => policy),
    getFresh: vi.fn(async () => ({ ...policy, mode: "test_only" as const })),
  };
  const reader = new HotelInfoRequestReader(
    repo as unknown as HotelInfoRequestsRepository,
    config as unknown as ConfigService,
  );
  return { reader, repo, config };
}

describe("HotelInfoRequestReader.detail", () => {
  it("answers SM and PM the summary: no recipient and no events, not even as null", async () => {
    for (const role of ["SM", "PM"] as const) {
      const { reader, repo } = build();
      const answer = await reader.detail(REQUEST_ID, staffPrincipal([role]));
      expect(hotelInfoRequestSummaryView.safeParse(answer).success, role).toBe(true);
      for (const field of ["recipientName", "recipientEmail", "events", "extendableUntil"]) {
        expect(answer).not.toHaveProperty(field);
      }
      expect(repo.latestEvents).not.toHaveBeenCalled();
    }
  });

  it("answers SA and HT the full view: the recipient, the extension limit and the latest events", async () => {
    for (const role of ["SA", "HT"] as const) {
      const { reader } = build();
      const answer = await reader.detail(REQUEST_ID, staffPrincipal([role]));
      expect(hotelInfoRequestFullView.safeParse(answer).success, role).toBe(true);
      expect(answer).toMatchObject({
        recipientEmail: "sales@synthetic-hotel.example",
        extendableUntil: "2099-04-01T10:00:00.000Z",
        events: [{ eventType: "created", detail: { generation: 1 } }],
      });
    }
  });

  it("decides the model from grants: a custom role reads in full only with the update key", async () => {
    const readOnly = staffPrincipal([], ["hotels.info_requests.read:all"]);
    const updater = staffPrincipal([], ["hotels.info_requests.update:all"]);
    const { reader } = build();
    expect(
      hotelInfoRequestSummaryView.safeParse(await reader.detail(REQUEST_ID, readOnly)).success,
    ).toBe(true);
    expect(
      hotelInfoRequestFullView.safeParse(await reader.detail(REQUEST_ID, updater)).success,
    ).toBe(true);
  });

  it("offers no extension once the request is no longer live, and 404 for no such request", async () => {
    const { reader } = build(requestRow({ status: "revoked" }));
    const answer = await reader.detail(REQUEST_ID, staffPrincipal(["HT"]));
    expect(answer).toMatchObject({ extendableUntil: null });
    await expect(
      build(null).reader.detail(REQUEST_ID, staffPrincipal(["HT"])),
    ).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("marks an expired link as expired", async () => {
    const { reader } = build(requestRow({ expiresAt: new Date("2020-01-01T00:00:00.000Z") }));
    expect(await reader.detail(REQUEST_ID, staffPrincipal(["PM"]))).toMatchObject({
      isExpired: true,
    });
  });
});

describe("HotelInfoRequestReader lists", () => {
  it("answers the inbox as summaries, tests left out unless asked for", async () => {
    const { reader, repo } = build();
    const page = await reader.list(hotelInfoRequestListQuery.parse({ status: "open" }));
    expect(hotelInfoRequestPage.safeParse(page).success).toBe(true);
    expect(repo.list).toHaveBeenCalledWith(
      { status: "open", kind: undefined, includeTests: false },
      50,
      undefined,
    );
    await reader.list(hotelInfoRequestListQuery.parse({ includeTests: "true" }));
    expect(repo.list).toHaveBeenLastCalledWith(
      { status: undefined, kind: undefined, includeTests: true },
      50,
      undefined,
    );
  });

  it("answers a hotel's history, and 404 for a hotel that does not exist or was deleted", async () => {
    const { reader, repo } = build();
    const page = await reader.history(HOTEL_ID, { limit: 20 });
    expect(page.items).toHaveLength(1);
    expect(repo.listForHotel).toHaveBeenCalledWith(HOTEL_ID, 20, undefined);
    repo.hotelExists.mockResolvedValueOnce(false);
    await expect(reader.history(HOTEL_ID, { limit: 20 })).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("HotelInfoRequestReader.formMode", () => {
  it("reads the mode past the configuration cache and answers it alone", async () => {
    const { reader, config } = build();
    const answer = await reader.formMode();
    expect(answer).toEqual({ mode: "test_only" });
    expect(hotelFormModeView.safeParse(answer).success).toBe(true);
    expect(config.getFresh).toHaveBeenCalledWith("hotel_form.policy");
    // The cached read could be up to five minutes behind a Super Admin's switch.
    expect(config.get).not.toHaveBeenCalled();
  });
});
