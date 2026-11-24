import { createHash } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ENV, type Env } from "../src/env.js";
import {
  requestCalls,
  rowsHolding,
  secretOf,
  startRequestSuite,
  stopRequestSuite,
  type RequestSuite,
} from "./hotel-info-requests-suite.js";

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

/**
 * Issuing hotel information requests' links end to end (D-188 §3 and §4): the Super Admin and the Hotel
 * team create a request for an existing or a new hotel and reissue its link; the link is answered once,
 * by those two routes alone, and the database never holds it but as its SHA-256; one live request per
 * hotel and per web address, http and https alike; test requests are the Super Admin's, for a draft or
 * new hotel. Reads, changes, email and the hotel delete are in the other hotel-info-requests suites.
 */
describe("Hotel information requests: issuing links (e2e)", () => {
  let suite: RequestSuite;
  let site: string;
  const { create, reissue, revoke, get } = requestCalls(() => suite);

  beforeAll(async () => {
    suite = await startRequestSuite("e2e-hir-issue-");
    site = suite.app.get<Env>(ENV).PUBLIC_SITE_URL;
  });

  afterAll(async () => {
    await stopRequestSuite(suite);
  });

  it("answers the link once, with no-store, and stores only its hash: no row anywhere holds it", async () => {
    const created = await create("ht", {
      target: "existing",
      hotelId: suite.hotelId,
      kind: "onboarding",
      displayLabel: "E2E onboarding",
      recipientName: "Synthetic Sales Desk",
      recipientEmail: "sales@synthetic-hotel.example",
    }).expect(201);
    expect(created.headers["cache-control"]).toBe("no-store");
    const { request, link, email } = created.body.data;
    expect(link.url).toMatch(new RegExp(`^${site}/hotel-form#k=hfl_[A-Za-z0-9_-]{43}$`));
    expect(email).toBe("not_requested");
    expect(request).toMatchObject({
      reference: expect.stringMatching(/^HIR-\d{4}-\d{4,}$/),
      status: "open",
      tokenGeneration: 1,
      expiresAt: link.expiresAt,
      recipientEmail: "sales@synthetic-hotel.example",
      events: [{ eventType: "created", actorKind: "staff" }],
    });
    const secret = secretOf(link.url);
    const row = await suite.prisma.hotelInfoRequest.findUniqueOrThrow({
      where: { id: request.id },
    });
    expect(row.tokenHash).toBe(sha256(secret));
    expect(await rowsHolding(suite.prisma, secret.slice(4))).toEqual({
      requests: 0,
      events: 0,
      audits: 0,
      notifications: 0,
    });
    const read = await get("ht", request.id).expect(200);
    expect(JSON.stringify(read.body)).not.toContain(secret);
    expect(JSON.stringify(read.body)).not.toContain("tokenHash");
  });

  it("audits the issue with the action share, as the member of staff", async () => {
    const hotelTeam = await suite.prisma.user.findFirstOrThrow({
      where: { identitySubject: "local:ht" },
    });
    const [row] = await suite.prisma.hotelInfoRequest.findMany({
      where: { hotelId: suite.hotelId },
      take: 1,
    });
    const audit = await suite.prisma.auditEvent.findFirstOrThrow({
      where: { entityType: "hotel_info_request", entityId: row?.id ?? "", action: "share" },
    });
    expect(audit).toMatchObject({
      actorUserId: hotelTeam.id,
      afterJson: expect.objectContaining({ issued: "created", status: "open", tokenGeneration: 1 }),
    });
  });

  it("refuses a second live request for a hotel with 409; a revoked one frees it", async () => {
    const [live] = await suite.prisma.hotelInfoRequest.findMany({
      where: { hotelId: suite.hotelId, status: "open" },
    });
    const second = await create("sa", { target: "existing", hotelId: suite.hotelId }).expect(409);
    expect(second.body.error.message).toContain(live?.reference ?? "missing");
    await revoke("ht", live?.id ?? "", { reason: "Replaced by a refresh" }).expect(200);
    const next = await create("sa", {
      target: "existing",
      hotelId: suite.hotelId,
      kind: "refresh",
    }).expect(201);
    expect(next.body.data.request).toMatchObject({ kind: "refresh", status: "open" });
  });

  it("holds one live request per proposed web address, typed with http or https", async () => {
    const proposal = {
      target: "new",
      proposedName: "E2E Synthetic Lake Palace",
      proposedDestinationId: suite.destinationId,
    };
    const address = `${suite.prefix}palace.example`;
    const first = await create("ht", {
      ...proposal,
      proposedWebAddress: `https://www.${address}/`,
    }).expect(201);
    expect(first.body.data.request).toMatchObject({
      target: "new",
      hotelId: null,
      proposedWebAddress: `https://www.${address}/`,
      destinationName: expect.stringContaining("E2E Request Coast"),
    });
    const stored = await suite.prisma.hotelInfoRequest.findUniqueOrThrow({
      where: { id: first.body.data.request.id },
    });
    expect(stored.proposedWebAddressKey).toBe(address);
    await create("sa", { ...proposal, proposedWebAddress: `http://${address}` }).expect(409);
  });

  it("reissues a new link: a new secret, the next generation, the old hash gone, audited as share", async () => {
    const created = await create("ht", {
      target: "new",
      proposedName: "E2E Reissued Retreat",
      proposedDestinationId: suite.destinationId,
      proposedWebAddress: `${suite.prefix}retreat.example`,
    }).expect(201);
    const { request, link } = created.body.data;
    const again = await reissue("sa", request.id, {}).expect(200);
    expect(again.headers["cache-control"]).toBe("no-store");
    const next = again.body.data;
    expect(secretOf(next.link.url)).not.toBe(secretOf(link.url));
    expect(next.link.expiresAt).toBe(link.expiresAt);
    expect(next.request).toMatchObject({ tokenGeneration: 2, linkEmailedAt: null });
    expect(next.request.events[0]).toMatchObject({
      eventType: "link_reissued",
      detail: { generation: 2 },
    });
    const row = await suite.prisma.hotelInfoRequest.findUniqueOrThrow({
      where: { id: request.id },
    });
    expect(row.tokenHash).toBe(sha256(secretOf(next.link.url)));
    expect(row.tokenHash).not.toBe(sha256(secretOf(link.url)));
    const audit = await suite.prisma.auditEvent.findFirstOrThrow({
      where: {
        entityId: request.id,
        action: "share",
        afterJson: { path: ["issued"], equals: "reissued" },
      },
    });
    expect(audit).toMatchObject({ beforeJson: { tokenGeneration: 1 } });
    expect(await rowsHolding(suite.prisma, secretOf(next.link.url).slice(4))).toMatchObject({
      requests: 0,
      events: 0,
      audits: 0,
    });
  });

  it("makes test requests for the Super Admin alone, and only for a draft or new hotel", async () => {
    const draft = { target: "existing", hotelId: suite.draftHotelId, isTest: true };
    await create("ht", draft).expect(403);
    // The active hotel is refused on its status, before its live request is looked at.
    const active = await create("sa", {
      target: "existing",
      hotelId: suite.hotelId,
      isTest: true,
    }).expect(400);
    expect(active.body.error.details).toEqual([{ path: "isTest", message: expect.any(String) }]);
    const made = await create("sa", draft).expect(201);
    expect(made.body.data.request).toMatchObject({ isTest: true, hotelId: suite.draftHotelId });
  });

  it("refuses an unknown hotel or destination with 400, and a body with fields it does not take", async () => {
    const unknown = "0192f1a0-0000-7000-8000-00000000dead";
    await create("ht", { target: "existing", hotelId: unknown }).expect(400);
    await create("ht", {
      target: "new",
      proposedName: "E2E Nowhere",
      proposedDestinationId: unknown,
      proposedWebAddress: "nowhere.example",
    }).expect(400);
    await create("ht", { target: "existing", hotelId: suite.hotelId, tokenHash: "x" }).expect(400);
  });
});
