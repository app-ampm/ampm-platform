import type { NotificationTemplate } from "@ampm/core";

import {
  CHANNEL_FIELDS,
  templateDraftFromValue,
  templateFieldKey,
  templateFromDraft,
  validateTemplateDraft,
  type TemplateDraft,
} from "./notification-template.edit";

const emailTemplate: NotificationTemplate = {
  email: { subject: "Your AMPM invitation", html: "<p>Hi {{name}}</p>", text: "Hi {{name}}" },
};

describe("notification-template.edit", () => {
  it("CHANNEL_FIELDS mirrors every field of each channel in the schema", () => {
    expect(CHANNEL_FIELDS.email.map((f) => f.key)).toEqual(["subject", "html", "text"]);
    expect(CHANNEL_FIELDS.sms.map((f) => f.key)).toEqual(["text"]);
    expect(CHANNEL_FIELDS.whatsapp.map((f) => f.key)).toEqual(["providerTemplateId", "params"]);
    expect(CHANNEL_FIELDS.push.map((f) => f.key)).toEqual(["title", "body"]);
  });

  describe("templateDraftFromValue / templateFromDraft", () => {
    it("enables the channels a template defines and leaves the rest off", () => {
      const draft = templateDraftFromValue(emailTemplate);
      expect(draft.email.enabled).toBe(true);
      expect(draft.email.fields.subject).toBe("Your AMPM invitation");
      expect(draft.sms.enabled).toBe(false);
      expect(draft.whatsapp.enabled).toBe(false);
      expect(draft.push.enabled).toBe(false);
    });

    it("joins WhatsApp params to lines on load and splits them back, trimming only trailing blanks", () => {
      const draft = templateDraftFromValue({
        whatsapp: { providerTemplateId: "t1", params: ["{{name}}", "{{date}}"] },
      });
      expect(draft.whatsapp.fields.params).toBe("{{name}}\n{{date}}");
      // Trailing blank lines are editing noise and are dropped.
      const trailing: TemplateDraft = {
        ...draft,
        whatsapp: { enabled: true, fields: { providerTemplateId: "t1", params: "a\nb\n\n  " } },
      };
      expect(templateFromDraft(trailing).whatsapp?.params).toEqual(["a", "b"]);
    });

    it("preserves an empty middle WhatsApp param across a round-trip (positional fidelity)", () => {
      // A blank middle positional param is a real slot: editing an unrelated field must not shift it.
      const template: NotificationTemplate = {
        whatsapp: { providerTemplateId: "t", params: ["{{name}}", "", "{{ref}}"] },
      };
      const draft = templateDraftFromValue(template);
      expect(draft.whatsapp.fields.params).toBe("{{name}}\n\n{{ref}}");
      expect(templateFromDraft(draft)).toEqual(template);
    });

    it("round-trips a template through the draft and back", () => {
      expect(templateFromDraft(templateDraftFromValue(emailTemplate))).toEqual(emailTemplate);
    });

    it("omits a disabled channel from the assembled template", () => {
      const draft = templateDraftFromValue(emailTemplate);
      const off: TemplateDraft = { ...draft, email: { ...draft.email, enabled: false } };
      expect(templateFromDraft(off)).toEqual({});
    });
  });

  describe("validateTemplateDraft", () => {
    it("assembles a valid template and reports no errors", () => {
      const result = validateTemplateDraft(templateDraftFromValue(emailTemplate));
      expect(result.value).toEqual(emailTemplate);
      expect(result.fieldErrors).toEqual({});
    });

    it("requires the primary field of each enabled channel, naming it", () => {
      const draft = templateDraftFromValue(emailTemplate);
      const blank: TemplateDraft = {
        ...draft,
        email: { ...draft.email, fields: { ...draft.email.fields, subject: "  " } },
      };
      const result = validateTemplateDraft(blank);
      expect(result.value).toBeUndefined();
      expect(result.fieldErrors[templateFieldKey("email", "subject")]).toContain("subject");
    });

    it("ignores blank content on a channel that is turned off", () => {
      // SMS is off and empty; the enabled email is complete → the template is valid.
      const draft = templateDraftFromValue(emailTemplate);
      expect(validateTemplateDraft(draft).value).toEqual(emailTemplate);
    });

    it("allows a template with every channel turned off (an empty template)", () => {
      const draft = templateDraftFromValue(emailTemplate);
      const allOff: TemplateDraft = {
        email: { ...draft.email, enabled: false },
        sms: { ...draft.sms, enabled: false },
        whatsapp: { ...draft.whatsapp, enabled: false },
        push: { ...draft.push, enabled: false },
      };
      expect(validateTemplateDraft(allOff).value).toEqual({});
    });
  });
});
