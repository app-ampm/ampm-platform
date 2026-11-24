import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { staffPrincipal } from "../../policy/testing/staff-principal.js";
import {
  buildIssueService as build,
  everythingWritten,
  REQUEST_ID,
  requestRow,
  SITE,
} from "./testing/info-request-fixtures.js";

/*
 * Reissuing a request's link (D-188 §3 and §4): a new secret replaces the old one, which stops working;
 * the generation goes up by one, so the form's sessions bound to the old one end (Slice 7b); the expiry
 * stays; the new link is answered once and emailed only when asked.
 */

const HT = staffPrincipal(["HT"]);

/** The secret of the link an answer carries. */
const secretOf = (url: string) => url.replace(`${SITE}/hotel-form#k=`, "");

describe("HotelInfoRequestIssueService.reissue", () => {
  it("rotates the secret, adds one to the generation and clears the emailed time, only while the link is as read", async () => {
    const fakes = build({ row: requestRow({ tokenGeneration: 2, linkEmailedAt: new Date() }) });
    const answer = await fakes.service.reissue(REQUEST_ID, { emailIt: false }, HT);
    const secret = secretOf(answer.link.url);
    expect(secret).toMatch(/^hfl_[A-Za-z0-9_-]{43}$/);
    expect(fakes.repo.updateIf).toHaveBeenCalledWith(
      REQUEST_ID,
      { statuses: ["open"], generation: 2 },
      expect.objectContaining({
        tokenHash: createHash("sha256").update(secret).digest("hex"),
        tokenGeneration: 3,
        linkIssuedAt: expect.any(Date),
        linkEmailedAt: null,
        updatedBy: HT.userId,
      }),
      expect.anything(),
    );
    expect(everythingWritten({ repo: fakes.repo, journal: fakes.journal })).not.toContain(secret);
  });

  it("keeps the expiry, writes its event and audits it with the action share", async () => {
    const expiresAt = new Date("2099-12-24T10:00:00.000Z");
    const fakes = build({ row: requestRow({ expiresAt }) });
    const answer = await fakes.service.reissue(REQUEST_ID, { emailIt: false }, HT);
    expect(answer.link.expiresAt).toBe(expiresAt.toISOString());
    expect(fakes.journal.event).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "link_reissued", detail: { generation: 2 } }),
      expect.anything(),
    );
    expect(fakes.journal.record).toHaveBeenCalledWith(
      REQUEST_ID,
      {
        action: "share",
        before: { tokenGeneration: 1 },
        after: { issued: "reissued", tokenGeneration: 2 },
      },
      expect.anything(),
    );
  });

  it("two links never share a secret: each reissue answers a new one", async () => {
    const first = await build().service.reissue(REQUEST_ID, { emailIt: false }, HT);
    const second = await build().service.reissue(REQUEST_ID, { emailIt: false }, HT);
    expect(secretOf(first.link.url)).not.toBe(secretOf(second.link.url));
  });

  it("emails the new link when asked, for the new generation, and says what became of it", async () => {
    const fakes = build({ row: requestRow({ displayLabel: "Lake refresh", tokenGeneration: 4 }) });
    fakes.mailer.sendLink.mockResolvedValueOnce("mode_off");
    const answer = await fakes.service.reissue(REQUEST_ID, { emailIt: true }, HT);
    expect(answer.email).toBe("mode_off");
    expect(fakes.mailer.sendLink).toHaveBeenCalledWith(
      expect.objectContaining({ hotelName: "Lake refresh", generation: 5, url: answer.link.url }),
      true,
      { kind: "staff", userId: HT.userId },
    );
  });

  it("refuses to email a link to a request without a recipient email, rotating nothing", async () => {
    const fakes = build({ row: requestRow({ recipientEmail: null }) });
    await expect(fakes.service.reissue(REQUEST_ID, { emailIt: true }, HT)).rejects.toMatchObject({
      code: "validation_failed",
      details: [{ path: "emailIt" }],
    });
    expect(fakes.repo.updateIf).not.toHaveBeenCalled();
  });

  it("refuses with 409 a request that is no longer live, or whose link has expired", async () => {
    for (const status of ["merged", "rejected", "revoked"] as const) {
      const fakes = build({ row: requestRow({ status }) });
      await expect(
        fakes.service.reissue(REQUEST_ID, { emailIt: false }, HT),
        status,
      ).rejects.toMatchObject({
        code: "conflict",
      });
    }
    const expired = build({ row: requestRow({ expiresAt: new Date("2020-01-01T00:00:00.000Z") }) });
    await expect(expired.service.reissue(REQUEST_ID, { emailIt: false }, HT)).rejects.toMatchObject(
      {
        code: "conflict",
        message: expect.stringContaining("extend"),
      },
    );
    expect(expired.repo.updateIf).not.toHaveBeenCalled();
  });

  it("refuses with 409 when another reissue or change landed first, and 404 for no such request", async () => {
    const raced = build();
    raced.repo.updateIf.mockResolvedValueOnce(0);
    await expect(raced.service.reissue(REQUEST_ID, { emailIt: false }, HT)).rejects.toMatchObject({
      code: "conflict",
    });
    expect(raced.journal.event).not.toHaveBeenCalled();
    const missing = build();
    missing.repo.findById.mockResolvedValueOnce(null);
    await expect(missing.service.reissue(REQUEST_ID, { emailIt: false }, HT)).rejects.toMatchObject(
      {
        code: "not_found",
      },
    );
  });
});
