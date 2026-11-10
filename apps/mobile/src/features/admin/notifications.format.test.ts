import {
  formatMoment,
  notificationChannelLabel,
  notificationStatusLabel,
  notificationStatusTone,
  notificationSummary,
  notificationTemplateLabel,
} from "./notifications.format";
import { notificationFixture } from "./admin.test-utils";

describe("notifications.format", () => {
  it("labels every channel", () => {
    expect(notificationChannelLabel("in_app")).toBe("In-app");
    expect(notificationChannelLabel("email")).toBe("Email");
    expect(notificationChannelLabel("whatsapp")).toBe("WhatsApp");
    expect(notificationChannelLabel("sms")).toBe("SMS");
    expect(notificationChannelLabel("push")).toBe("Push");
  });

  it("labels statuses and tones a failure danger, a delivery success, a queue neutral", () => {
    expect(notificationStatusLabel("queued")).toBe("Queued");
    expect(notificationStatusLabel("read")).toBe("Read");
    expect(notificationStatusTone("failed")).toBe("danger");
    expect(notificationStatusTone("delivered")).toBe("success");
    expect(notificationStatusTone("read")).toBe("success");
    expect(notificationStatusTone("sent")).toBe("info");
    expect(notificationStatusTone("queued")).toBe("neutral");
  });

  it("prettifies a template key and leaves an empty one as itself", () => {
    expect(notificationTemplateLabel("client.invite")).toBe("Client invite");
    expect(notificationTemplateLabel("lead.follow_up-due")).toBe("Lead follow up due");
    expect(notificationTemplateLabel("")).toBe("");
  });

  it("summarises a row for a screen reader", () => {
    const summary = notificationSummary(notificationFixture());
    expect(summary).toContain("Client invite");
    expect(summary).toContain("Email");
    expect(summary).toContain("Delivered");
  });

  it("formats a moment and leaves a bad date untouched", () => {
    expect(formatMoment(notificationFixture().createdAt)).toMatch(/·/);
    expect(formatMoment("not-a-date")).toBe("not-a-date");
  });
});
