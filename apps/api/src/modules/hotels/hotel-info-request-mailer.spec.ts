import { CONFIG_REGISTRY, type HotelFormMode } from "@ampm/core";
import { describe, expect, it, vi } from "vitest";

import type { AppLogger } from "../../common/logger.service.js";
import type { ConfigService } from "../admin/config/config.service.js";
import type { NotificationService } from "../admin/notification/notification.service.js";
import type { HotelInfoRequestJournal } from "./hotel-info-request-journal.js";
import { HotelInfoRequestMailer, type LinkEmail } from "./hotel-info-request-mailer.js";
import type { HotelInfoRequestsRepository } from "./hotel-info-requests.repository.js";

/*
 * The link's email (D-188 §5): queued to the recipient AMPM entered, as an external email with the
 * hotel form's reply-to when one is set, only when the mode, read past the cache, admits the request; and
 * only then is the request marked emailed, with its `link_emailed` event.
 */

const STAFF = { kind: "staff", userId: "018f0000-0000-7000-8000-00000000cafe" } as const;

const email: LinkEmail = {
  requestId: "0192f1a0-0000-7000-8000-0000000000b1",
  isTest: false,
  recipientEmail: "sales@synthetic-hotel.example",
  reference: "HIR-2026-0001",
  hotelName: "Synthetic Lake Hotel",
  expiresAt: new Date("2026-12-24T10:00:00.000Z"),
  url: "https://site.synthetic.example/hotel-form#k=hfl_synthetic-link-secret",
  generation: 1,
};

function build(mode: HotelFormMode, replyTo: string | null = null) {
  const policy = { ...CONFIG_REGISTRY["hotel_form.policy"].default, mode, replyTo };
  const config = { get: vi.fn(), getFresh: vi.fn(async () => policy) };
  const notifications = {
    queue: vi.fn(async () => ({ suppressed: false, notificationId: "n-1" })),
  };
  const tx = { tx: true };
  const repo = {
    transaction: vi.fn(async <T>(work: (client: unknown) => Promise<T>) => work(tx)),
    markEmailed: vi.fn(async () => 1),
  };
  const journal = { event: vi.fn(async () => undefined) };
  const logger = { warn: vi.fn(), info: vi.fn() };
  const mailer = new HotelInfoRequestMailer(
    repo as unknown as HotelInfoRequestsRepository,
    journal as unknown as HotelInfoRequestJournal,
    notifications as unknown as NotificationService,
    config as unknown as ConfigService,
    logger as unknown as AppLogger,
  );
  return { mailer, config, notifications, repo, journal, logger, tx };
}

describe("HotelInfoRequestMailer.sendLink", () => {
  it("queues nothing when staff did not ask", async () => {
    const { mailer, notifications, config } = build("on");
    expect(await mailer.sendLink(email, false, STAFF)).toBe("not_requested");
    expect(notifications.queue).not.toHaveBeenCalled();
    expect(config.getFresh).not.toHaveBeenCalled();
  });

  it("queues nothing while the mode is off, or test_only for a request that is not a test", async () => {
    const off = build("off");
    expect(await off.mailer.sendLink(email, true, STAFF)).toBe("mode_off");
    const testOnly = build("test_only");
    expect(await testOnly.mailer.sendLink(email, true, STAFF)).toBe("mode_test_only");
    for (const { notifications, repo } of [off, testOnly]) {
      expect(notifications.queue).not.toHaveBeenCalled();
      expect(repo.markEmailed).not.toHaveBeenCalled();
    }
  });

  it("queues a test request's link in test_only, reading the mode past the cache", async () => {
    const { mailer, notifications, config } = build("test_only");
    expect(await mailer.sendLink({ ...email, isTest: true }, true, STAFF)).toBe("queued");
    expect(notifications.queue).toHaveBeenCalledOnce();
    expect(config.getFresh).toHaveBeenCalledWith("hotel_form.policy");
    expect(config.get).not.toHaveBeenCalled();
  });

  it("queues an external email to the recipient with the reference, name, expiry and link, and no reply-to unless set", async () => {
    const { mailer, notifications } = build("on");
    expect(await mailer.sendLink(email, true, STAFF)).toBe("queued");
    expect(notifications.queue).toHaveBeenCalledWith({
      recipientType: "external",
      recipientId: email.requestId,
      recipientAddress: "sales@synthetic-hotel.example",
      channel: "email",
      eventType: "hotel_form.link",
      templateKey: "hotel_form.link",
      entityType: "hotel_info_request",
      entityId: email.requestId,
      variables: {
        reference: "HIR-2026-0001",
        hotelName: "Synthetic Lake Hotel",
        expiresOn: "24 December 2026, 15:30 IST",
        link: email.url,
      },
      gateRef: "1",
    });
    const withReplyTo = build("on", "desk@ampm.example");
    await withReplyTo.mailer.sendLink(email, true, STAFF);
    expect(withReplyTo.notifications.queue).toHaveBeenCalledWith(
      expect.objectContaining({ replyTo: "desk@ampm.example" }),
    );
  });

  it("marks the request emailed, for the link's generation, with a link_emailed event, in one transaction", async () => {
    const { mailer, repo, journal, tx } = build("on");
    await mailer.sendLink({ ...email, generation: 3 }, true, STAFF);
    expect(repo.transaction).toHaveBeenCalledOnce();
    expect(repo.markEmailed).toHaveBeenCalledWith(email.requestId, 3, expect.any(Date), tx);
    expect(journal.event).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: email.requestId,
        eventType: "link_emailed",
        actor: STAFF,
        detail: { generation: 3 },
      }),
      tx,
    );
  });

  it("names the link's generation to the send gate, so a link reissued meanwhile is not sent", async () => {
    const { mailer, notifications } = build("on");
    await mailer.sendLink({ ...email, generation: 4 }, true, STAFF);
    expect(notifications.queue).toHaveBeenCalledWith(expect.objectContaining({ gateRef: "4" }));
  });

  it("writes no link_emailed event when the link was reissued before the request could be marked", async () => {
    const { mailer, repo, journal } = build("on");
    repo.markEmailed.mockResolvedValueOnce(0);
    expect(await mailer.sendLink(email, true, STAFF)).toBe("queued");
    expect(repo.markEmailed).toHaveBeenCalledOnce();
    expect(journal.event).not.toHaveBeenCalled();
  });

  it("answers failed, marking nothing, when the email cannot be queued, and logs no address or link", async () => {
    const { mailer, notifications, repo, logger } = build("on");
    notifications.queue.mockRejectedValueOnce(new Error("database unavailable"));
    expect(await mailer.sendLink(email, true, STAFF)).toBe("failed");
    expect(repo.markEmailed).not.toHaveBeenCalled();
    const logged = JSON.stringify(logger.warn.mock.calls);
    expect(logged).not.toContain("sales@synthetic-hotel.example");
    expect(logged).not.toContain("hfl_");
  });
});
