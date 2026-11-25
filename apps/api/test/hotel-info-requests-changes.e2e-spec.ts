import { HOTEL_INFO_REQUEST_PASTED_LINK_REFUSAL } from "@ampm/core";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  newSuiteHotel,
  requestCalls,
  startRequestSuite,
  stopRequestSuite,
  type RequestSuite,
  type Role,
} from "./hotel-info-requests-suite.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Changing hotel information requests end to end (D-188 §3): SA and HT record a share, change the label,
 * note and recipient, extend the link within maxExtensionDays of its first expiry, and revoke; SM and PM
 * may only read (403), and everyone else is answered as if there were nothing (404). Deleting a hotel
 * revokes its live request as the System, whatever its live status.
 */
describe("Hotel information requests: changes and the hotel delete (e2e)", () => {
  let suite: RequestSuite;
  const calls = requestCalls(() => suite);
  const { create, shareRecord, patch, revoke, reissue, get } = calls;

  /** A new hotel with an open request for it, made by the Hotel team. */
  async function openRequest(suffix: string): Promise<{ hotelId: string; id: string }> {
    const hotelId = await newSuiteHotel(suite, suffix, { status: "active" });
    const created = await create("ht", { target: "existing", hotelId }).expect(201);
    return { hotelId, id: created.body.data.request.id as string };
  }

  beforeAll(async () => {
    suite = await startRequestSuite("e2e-hir-change-");
  });

  afterAll(async () => {
    await stopRequestSuite(suite);
  });

  it("lets SM and PM read but change nothing (403), and answers CD, FA and a client 404", async () => {
    const { hotelId, id } = await openRequest("roles");
    // Thunks: supertest listens per request, so each call is made only when it is awaited.
    const writes = (role: Role) => [
      () => create(role, { target: "existing", hotelId }),
      () => reissue(role, id),
      () => shareRecord(role, id, { channel: "copy" }),
      () => patch(role, id, { displayLabel: "X" }),
      () => revoke(role, id, { reason: "X" }),
      () => calls.hints(role, { name: "E2E" }),
    ];
    for (const role of ["sm", "pm"] as const) {
      for (const call of writes(role)) await call().expect(403);
      await get(role, id).expect(200);
    }
    for (const role of ["cd", "fa", "client"] as const) {
      for (const call of writes(role)) await call().expect(404);
      await get(role, id).expect(404);
      await calls.list(role).expect(404);
    }
  });

  it("records a share by its channel and note, audited as share, and never takes the link", async () => {
    const { id } = await openRequest("share");
    const shared = await shareRecord("ht", id, { channel: "whatsapp", note: "To the GM" }).expect(
      200,
    );
    expect(shared.body.data.events[0]).toMatchObject({
      eventType: "share_recorded",
      actorKind: "staff",
      detail: { channel: "whatsapp", note: "To the GM" },
    });
    const audit = await suite.prisma.auditEvent.findFirstOrThrow({
      where: {
        entityId: id,
        action: "share",
        afterJson: { path: ["channel"], equals: "whatsapp" },
      },
    });
    expect(audit.entityType).toBe("hotel_info_request");
    await shareRecord("ht", id, { channel: "copy", url: "https://x.example/#k=hfl_x" }).expect(400);
  });

  it("refuses a label, note or share note holding a pasted link, naming the field (400)", async () => {
    const { id } = await openRequest("pasted-link");
    const pasted = "Sent https://site.synthetic.example/hotel-form#k=abc on WhatsApp";
    const refusals = [
      await patch("ht", id, { staffNote: pasted }).expect(400),
      await patch("ht", id, { displayLabel: `hf${"l_"}SyntheticPastedSecretRun01` }).expect(400),
      await shareRecord("ht", id, { channel: "whatsapp", note: pasted }).expect(400),
    ];
    expect(refusals.map((answer) => answer.body.error.details[0].path)).toEqual([
      "staffNote",
      "displayLabel",
      "note",
    ]);
    for (const answer of refusals) {
      expect(answer.body.error.details[0].message).toBe(HOTEL_INFO_REQUEST_PASTED_LINK_REFUSAL);
    }
    const row = await suite.prisma.hotelInfoRequest.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ staffNote: null, displayLabel: null });
  });

  it("changes the label and recipient, naming the fields, and extends up to 60 days past the first expiry", async () => {
    const { id } = await openRequest("patch");
    const before = await get("ht", id).expect(200);
    const firstExpiry = Date.parse(before.body.data.expiresAt);
    expect(before.body.data.extendableUntil).toBe(
      new Date(firstExpiry + 60 * DAY_MS).toISOString(),
    );
    const changed = await patch("sa", id, {
      displayLabel: "E2E label",
      recipientEmail: "Front@Synthetic-Hotel.example",
    }).expect(200);
    expect(changed.body.data).toMatchObject({
      displayLabel: "E2E label",
      recipientEmail: "front@synthetic-hotel.example",
    });
    expect(changed.body.data.events[0]).toMatchObject({
      eventType: "updated",
      detail: { fields: ["displayLabel", "recipientEmail"] },
    });
    const extended = await patch("ht", id, { extendDays: 30 }).expect(200);
    expect(Date.parse(extended.body.data.expiresAt)).toBe(firstExpiry + 30 * DAY_MS);
    expect(extended.body.data.events[0]).toMatchObject({ eventType: "expiry_extended" });
    const tooFar = await patch("ht", id, { extendDays: 31 }).expect(400);
    expect(tooFar.body.error.details[0].path).toBe("extendDays");
    await patch("ht", id, { extendDays: 30 }).expect(200);
    await patch("ht", id, { tokenGeneration: 9 }).expect(400);
  });

  it("revokes with a reason through §7, and a revoked request is read-only", async () => {
    const { id } = await openRequest("revoke");
    const revoked = await revoke("ht", id, { reason: "Sent to the wrong hotel" }).expect(200);
    expect(revoked.body.data).toMatchObject({
      status: "revoked",
      revokeReason: "Sent to the wrong hotel",
      extendableUntil: null,
    });
    expect(revoked.body.data.events[0]).toMatchObject({
      eventType: "revoked",
      detail: { fromStatus: "open", cause: "staff" },
    });
    await revoke("sa", id, { reason: "Again" }).expect(409);
    await patch("sa", id, { displayLabel: "Too late" }).expect(409);
    await reissue("sa", id).expect(409);
    await shareRecord("sa", id, { channel: "copy" }).expect(409);
  });

  it("leaves a submitted request to the reviewers: staff cannot revoke it (409)", async () => {
    const { id } = await openRequest("submitted");
    await suite.prisma.hotelInfoRequest.update({ where: { id }, data: { status: "submitted" } });
    await revoke("sa", id, { reason: "No" }).expect(409);
  });

  it("revokes a deleted hotel's live request as the System, whatever its live status, audited as such", async () => {
    for (const status of ["open", "submitted", "in_review", "changes_requested"] as const) {
      const { hotelId, id } = await openRequest(`deleted-${status}`);
      await suite.prisma.hotelInfoRequest.update({ where: { id }, data: { status } });
      await request(suite.app.getHttpServer())
        .delete(`/hotels-admin/hotels/${hotelId}`)
        .set("Authorization", suite.bearer.sa)
        .expect(200);
      const row = await suite.prisma.hotelInfoRequest.findUniqueOrThrow({ where: { id } });
      expect(row, status).toMatchObject({ status: "revoked", revokedAt: expect.any(Date) });
      expect(row.revokeReason).toContain("deleted");
      const event = await suite.prisma.hotelInfoRequestEvent.findFirstOrThrow({
        where: { requestId: id, eventType: "revoked" },
      });
      expect(event).toMatchObject({
        actorKind: "system",
        actorUserId: null,
        detail: { fromStatus: status, cause: "hotel_deleted" },
      });
      const audit = await suite.prisma.auditEvent.findFirstOrThrow({
        where: { entityType: "hotel_info_request", entityId: id, action: "update" },
      });
      const deletion = await suite.prisma.auditEvent.findFirstOrThrow({
        where: { entityType: "hotel", entityId: hotelId, action: "delete" },
      });
      expect(audit).toMatchObject({ actorType: "system", actorUserId: null });
      expect(audit.requestId).toBe(deletion.requestId);
    }
  });

  it("deletes a hotel without a live request as before", async () => {
    const hotelId = await newSuiteHotel(suite, "plain", { status: "active" });
    await request(suite.app.getHttpServer())
      .delete(`/hotels-admin/hotels/${hotelId}`)
      .set("Authorization", suite.bearer.ht)
      .expect(200);
    const hotel = await suite.prisma.hotel.findUniqueOrThrow({ where: { id: hotelId } });
    expect(hotel.deletedAt).not.toBeNull();
  });
});
