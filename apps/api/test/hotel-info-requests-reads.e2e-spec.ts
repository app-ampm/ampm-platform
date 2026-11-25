import {
  hotelInfoRequestFullView,
  hotelInfoRequestPage,
  hotelInfoRequestSummaryView,
} from "@ampm/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  newSuiteHotel,
  requestCalls,
  setFormPolicy,
  startRequestSuite,
  stopRequestSuite,
  type RequestSuite,
} from "./hotel-info-requests-suite.js";

/**
 * Reading hotel information requests end to end (D-188 §3): one response model per audience (the full
 * view, with the recipient and the events, for SA and HT; the summary for SM and PM; 404 for everyone
 * else), the inbox (newest first, by cursor, filtered, test requests hidden unless asked for), a hotel's
 * history, and the duplicate hints of the Invite a new hotel sheet. No read ever answers the link.
 */
describe("Hotel information requests: reads and duplicate hints (e2e)", () => {
  let suite: RequestSuite;
  let requestId: string;
  let testRequestId: string;
  const { create, get, list, history, hints, mode } = requestCalls(() => suite);

  beforeAll(async () => {
    suite = await startRequestSuite("e2e-hir-read-");
    const created = await create("ht", {
      target: "existing",
      hotelId: suite.hotelId,
      recipientName: "Synthetic Sales Desk",
      recipientEmail: "sales@synthetic-hotel.example",
      staffNote: "Synthetic note",
    }).expect(201);
    requestId = created.body.data.request.id;
    const test = await create("sa", {
      target: "existing",
      hotelId: suite.draftHotelId,
      isTest: true,
    }).expect(201);
    testRequestId = test.body.data.request.id;
  });

  afterAll(async () => {
    await stopRequestSuite(suite);
  });

  it("answers SA and HT in full, SM and PM in summary, and CD, FA and a client 404", async () => {
    for (const role of ["sa", "ht"] as const) {
      const full = await get(role, requestId).expect(200);
      expect(hotelInfoRequestFullView.safeParse(full.body.data).success, role).toBe(true);
      expect(full.body.data).toMatchObject({
        recipientEmail: "sales@synthetic-hotel.example",
        hotelName: "E2E Request Hotel active",
      });
    }
    for (const role of ["sm", "pm"] as const) {
      const summary = await get(role, requestId).expect(200);
      expect(hotelInfoRequestSummaryView.safeParse(summary.body.data).success, role).toBe(true);
      expect(JSON.stringify(summary.body.data)).not.toContain("sales@synthetic-hotel.example");
      expect(summary.body.data).not.toHaveProperty("events");
    }
    for (const role of ["cd", "fa", "client"] as const) {
      await get(role, requestId).expect(404);
      await history(role, suite.hotelId).expect(404);
    }
    await get("ht", "0192f1a0-0000-7000-8000-00000000dead").expect(404);
    await get("ht", "not-a-uuid").expect(400);
  });

  it("lists the inbox in summary, newest first, test requests only when asked for", async () => {
    const inbox = await list("pm", { limit: "100" }).expect(200);
    expect(hotelInfoRequestPage.safeParse(inbox.body.data).success).toBe(true);
    const ids = inbox.body.data.items.map((item: { id: string }) => item.id);
    expect(ids).toContain(requestId);
    expect(ids).not.toContain(testRequestId);
    const withTests = await list("ht", { includeTests: "true", limit: "100" }).expect(200);
    const all = withTests.body.data.items.map((item: { id: string }) => item.id);
    expect(all).toContain(testRequestId);
    expect(all.indexOf(testRequestId)).toBeLessThan(all.indexOf(requestId));
    const refreshes = await list("ht", { kind: "refresh", includeTests: "true" }).expect(200);
    expect(refreshes.body.data.items.map((item: { id: string }) => item.id)).not.toContain(
      requestId,
    );
    await list("ht", { status: "expired" }).expect(400);
  });

  it("pages the inbox by cursor", async () => {
    const first = await list("ht", { includeTests: "true", limit: "1" }).expect(200);
    expect(first.body.data.items).toHaveLength(1);
    expect(first.body.data.nextCursor).toBe(first.body.data.items[0].id);
    const second = await list("ht", {
      includeTests: "true",
      limit: "1",
      cursor: first.body.data.nextCursor,
    }).expect(200);
    expect(second.body.data.items[0].id).not.toBe(first.body.data.items[0].id);
  });

  it("lists a hotel's history, tests included, and 404 for a hotel that is gone", async () => {
    const own = await history("sm", suite.hotelId).expect(200);
    expect(own.body.data.items.map((item: { id: string }) => item.id)).toEqual([requestId]);
    const draft = await history("ht", suite.draftHotelId).expect(200);
    expect(draft.body.data.items.map((item: { id: string }) => item.id)).toEqual([testRequestId]);
    const gone = await newSuiteHotel(suite, "gone", { deletedAt: new Date() });
    await history("ht", gone).expect(404);
  });

  it("never answers the link or its hash on a read", async () => {
    for (const response of [
      await get("ht", requestId),
      await list("ht", { includeTests: "true" }),
      await history("ht", suite.hotelId),
    ]) {
      const text = JSON.stringify(response.body);
      for (const forbidden of ["hfl_", "#k=", "tokenHash", "token_hash"]) {
        expect(text).not.toContain(forbidden);
      }
    }
  });

  it("answers every reader the hotel form's mode alone, as switched a moment ago, and 404 to the rest", async () => {
    await setFormPolicy(suite, {
      mode: "test_only",
      replyTo: "desk@synthetic-ampm.example",
      helpContact: "Synthetic help desk",
    });
    for (const role of ["sa", "ht", "sm", "pm"] as const) {
      const answer = await mode(role).expect(200);
      // The mode alone: the reply-to, the help contact and the limits stay in the admin console.
      expect(answer.body.data, role).toEqual({ mode: "test_only" });
    }
    // Read past the five-minute configuration cache: a switch shows on the next read.
    await setFormPolicy(suite, { mode: "on" });
    expect((await mode("pm").expect(200)).body.data).toEqual({ mode: "on" });
    for (const role of ["cd", "fa", "client"] as const) await mode(role).expect(404);
  });

  it("hints hotels by name and name variant (case and accents aside), web address and host, deleted ones included", async () => {
    const host = `${suite.prefix}hints.example`;
    const named = await newSuiteHotel(suite, "named", { name: "Hôtel Rosé Fort Palace" });
    const variant = await newSuiteHotel(suite, "variant", {
      name: "E2E Fort Annexe",
      nameAliases: ["Rose Fort Palace"],
    });
    const deleted = await newSuiteHotel(suite, "deleted", {
      website: `https://www.${host}/`,
      deletedAt: new Date("2026-11-01T00:00:00.000Z"),
    });
    const sameHost = await newSuiteHotel(suite, "host", { website: `https://${host}/goa` });
    const byName = await hints("ht", { name: "rose fort palace" }).expect(200);
    const reasons = (body: { hints: { hotelId: string; reasons: string[] }[] }, id: string) =>
      body.hints.find((hint) => hint.hotelId === id)?.reasons;
    expect(reasons(byName.body.data, named)).toEqual(["name"]);
    expect(reasons(byName.body.data, variant)).toEqual(["name_variant"]);
    const byAddress = await hints("sa", { webAddress: `http://${host}` }).expect(200);
    expect(reasons(byAddress.body.data, deleted)).toEqual(["web_address"]);
    expect(reasons(byAddress.body.data, sameHost)).toEqual(["website_host"]);
    expect(
      byAddress.body.data.hints.find((hint: { hotelId: string }) => hint.hotelId === deleted),
    ).toMatchObject({ deletedAt: "2026-11-01T00:00:00.000Z", sharedHost: false });
    await hints("ht", { name: "x", extra: "1" }).expect(400);
  });
});
