import type { NotificationTemplate } from "@ampm/core";

import {
  definedChannels,
  notificationTemplateLabel,
  templateChannelLabel,
  templateChannelsSummary,
  templatePlaceholders,
  templateSummary,
} from "./notification-templates.format";

const emailOnly: NotificationTemplate = {
  email: { subject: "Hi {{name}}", html: "<p>{{name}} — {{code}}</p>", text: "{{name}} {{code}}" },
};
const multi: NotificationTemplate = {
  sms: { text: "On {{date}}" },
  push: { title: "Reminder", body: "At {{time}}" },
  whatsapp: { providerTemplateId: "wa_reminder", params: ["{{name}}"] },
};

describe("notification-templates.format", () => {
  it("prettifies a template key", () => {
    expect(notificationTemplateLabel("staff.invite")).toBe("Staff invite");
    expect(notificationTemplateLabel("")).toBe("");
  });

  it("labels each external channel", () => {
    expect(templateChannelLabel("email")).toBe("Email");
    expect(templateChannelLabel("sms")).toBe("SMS");
    expect(templateChannelLabel("whatsapp")).toBe("WhatsApp");
    expect(templateChannelLabel("push")).toBe("Push");
  });

  it("lists the channels a template defines, in display order", () => {
    expect(definedChannels(emailOnly)).toEqual(["email"]);
    expect(definedChannels(multi)).toEqual(["sms", "whatsapp", "push"]);
  });

  it("summarises the defined channels, and says when there are none", () => {
    expect(templateChannelsSummary(emailOnly)).toBe("Email");
    expect(templateChannelsSummary(multi)).toBe("SMS · WhatsApp · Push");
    expect(templateChannelsSummary({})).toBe("No channels");
  });

  it("collects the distinct {{variables}} across channels in first-seen order", () => {
    expect(templatePlaceholders(emailOnly)).toEqual(["name", "code"]);
    expect(templatePlaceholders(multi)).toEqual(["date", "name", "time"]);
    expect(templatePlaceholders({})).toEqual([]);
  });

  it("summarises a row for the screen reader", () => {
    expect(templateSummary("staff.invite", emailOnly)).toBe("Staff invite, Email");
  });
});
