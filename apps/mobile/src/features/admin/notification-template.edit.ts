import { notificationTemplate, type NotificationTemplate } from "@ampm/core";

import {
  TEMPLATE_CHANNELS,
  templateChannelLabel,
  type TemplateChannel,
} from "./notification-templates.format";

/*
 * The editor model for one notification template (admin console): the per-channel draft the form edits,
 * the conversion to and from the stored `NotificationTemplate`, and validation. Pure — no React, no
 * fetching. The assembled template is parsed by the key's own `@ampm/core` schema (`notificationTemplate`
 * — the same shape the API enforces), and each enabled channel must carry its primary content (an enabled
 * channel with a blank subject/message would send an empty notification). WhatsApp parameters are edited
 * as one-per-line text. Editing covers existing templates' content and which channels they use; the set of
 * template keys is code (the sends reference them), so keys are not added or removed here.
 */

/** One field of a channel's content: the key in the channel object, its label and how it is edited. */
export interface TemplateChannelField {
  readonly key: string;
  readonly label: string;
  readonly multiline?: boolean;
  readonly help?: string;
  /** Required (non-empty) while the channel is enabled. */
  readonly primary?: boolean;
}

/** The fields each external channel carries, in display order (mirrors the `notificationTemplate` schema). */
export const CHANNEL_FIELDS: Record<TemplateChannel, readonly TemplateChannelField[]> = {
  email: [
    { key: "subject", label: "Subject", primary: true },
    { key: "html", label: "HTML body", multiline: true },
    { key: "text", label: "Text body", multiline: true },
  ],
  sms: [{ key: "text", label: "Message", multiline: true, primary: true }],
  whatsapp: [
    { key: "providerTemplateId", label: "Provider template ID", primary: true },
    { key: "params", label: "Parameters", multiline: true, help: "One parameter per line." },
  ],
  push: [
    { key: "title", label: "Title", primary: true },
    { key: "body", label: "Body", multiline: true },
  ],
};

/** One channel's draft: whether it is on, and its fields keyed by field key (WhatsApp params as text). */
export interface ChannelDraft {
  readonly enabled: boolean;
  readonly fields: Readonly<Record<string, string>>;
}

/** A template's whole draft: one `ChannelDraft` per channel. */
export type TemplateDraft = Record<TemplateChannel, ChannelDraft>;

/** The outcome of validating a draft: the assembled template when valid, else the messages to show. */
export interface TemplateValidation {
  readonly value?: NotificationTemplate;
  readonly fieldErrors: Readonly<Record<string, string>>;
  readonly formError?: string;
}

/** The error key for one channel field, e.g. `email.subject`. */
export function templateFieldKey(channel: TemplateChannel, field: string): string {
  return `${channel}.${field}`;
}

function splitParams(text: string): string[] {
  // WhatsApp params are positional, so a blank line is a real empty slot and must be kept in place;
  // only trailing blank lines (editing noise) are dropped, so a save never shifts an untouched param.
  const lines = text.split("\n").map((line) => line.trim());
  while (lines.length > 0 && lines.at(-1) === "") lines.pop();
  return lines;
}

function emailDraft(template: NotificationTemplate): ChannelDraft {
  return {
    enabled: template.email !== undefined,
    fields: {
      subject: template.email?.subject ?? "",
      html: template.email?.html ?? "",
      text: template.email?.text ?? "",
    },
  };
}

function whatsappDraft(template: NotificationTemplate): ChannelDraft {
  return {
    enabled: template.whatsapp !== undefined,
    fields: {
      providerTemplateId: template.whatsapp?.providerTemplateId ?? "",
      params: (template.whatsapp?.params ?? []).join("\n"),
    },
  };
}

/** The draft that mirrors a template's current content. */
export function templateDraftFromValue(template: NotificationTemplate): TemplateDraft {
  return {
    email: emailDraft(template),
    sms: { enabled: template.sms !== undefined, fields: { text: template.sms?.text ?? "" } },
    whatsapp: whatsappDraft(template),
    push: {
      enabled: template.push !== undefined,
      fields: { title: template.push?.title ?? "", body: template.push?.body ?? "" },
    },
  };
}

/** Assemble a `NotificationTemplate` from the draft: only enabled channels, their fields trimmed as stored. */
export function templateFromDraft(draft: TemplateDraft): NotificationTemplate {
  const template: NotificationTemplate = {};
  if (draft.email.enabled) {
    const f = draft.email.fields;
    template.email = { subject: f.subject ?? "", html: f.html ?? "", text: f.text ?? "" };
  }
  if (draft.sms.enabled) template.sms = { text: draft.sms.fields.text ?? "" };
  if (draft.whatsapp.enabled) {
    const f = draft.whatsapp.fields;
    template.whatsapp = {
      providerTemplateId: f.providerTemplateId ?? "",
      params: splitParams(f.params ?? ""),
    };
  }
  if (draft.push.enabled) {
    const f = draft.push.fields;
    template.push = { title: f.title ?? "", body: f.body ?? "" };
  }
  return template;
}

/**
 * Validate a draft and, when it is sound, assemble the template to merge into the record. Each enabled
 * channel must have its primary field (so an enabled channel is never blank); the assembled template is
 * then parsed by `notificationTemplate` as the backstop.
 */
export function validateTemplateDraft(draft: TemplateDraft): TemplateValidation {
  const fieldErrors: Record<string, string> = {};
  for (const channel of TEMPLATE_CHANNELS) {
    if (!draft[channel].enabled) continue;
    for (const field of CHANNEL_FIELDS[channel]) {
      if (field.primary && (draft[channel].fields[field.key] ?? "").trim().length === 0) {
        fieldErrors[templateFieldKey(channel, field.key)] =
          `Add the ${field.label.toLowerCase()} for ${templateChannelLabel(channel)}`;
      }
    }
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  const value = templateFromDraft(draft);
  const parsed = notificationTemplate.safeParse(value);
  if (!parsed.success) return { fieldErrors, formError: "This template isn't valid" };
  return { value: parsed.data, fieldErrors };
}
