import type { NotificationTemplate } from "@ampm/core";

// Reuse the channel label and the template-key prettifier from the notifications-log formatter (same
// admin feature), re-exporting the prettifier so a templates screen has one import home.
import { notificationChannelLabel, notificationTemplateLabel } from "./notifications.format";

export { notificationTemplateLabel };

/*
 * Presentation helpers for the notification templates (admin console): which channels a template
 * defines, a readable summary of them, and the `{{var}}` placeholders it references. No fetching.
 */

/** One template keyed by its `templateKey`, as the screen and the detail sheet pass it around. */
export interface TemplateEntry {
  readonly key: string;
  readonly template: NotificationTemplate;
}

/** The external channels a template can carry a block for, in display order (in-app has no template). */
export const TEMPLATE_CHANNELS = ["email", "sms", "whatsapp", "push"] as const;
export type TemplateChannel = (typeof TEMPLATE_CHANNELS)[number];

export function templateChannelLabel(channel: TemplateChannel): string {
  return notificationChannelLabel(channel);
}

/** The channels this template actually defines a block for, in display order. */
export function definedChannels(template: NotificationTemplate): TemplateChannel[] {
  return TEMPLATE_CHANNELS.filter((channel) => template[channel] !== undefined);
}

/** A short summary of the defined channels, e.g. "Email · SMS"; "No channels" when a template is empty. */
export function templateChannelsSummary(template: NotificationTemplate): string {
  const labels = definedChannels(template).map(templateChannelLabel);
  return labels.length > 0 ? labels.join(" · ") : "No channels";
}

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

function channelTexts(template: NotificationTemplate): string[] {
  const texts: string[] = [];
  if (template.email) texts.push(template.email.subject, template.email.html, template.email.text);
  if (template.sms) texts.push(template.sms.text);
  if (template.whatsapp)
    texts.push(template.whatsapp.providerTemplateId, ...template.whatsapp.params);
  if (template.push) texts.push(template.push.title, template.push.body);
  return texts;
}

/** The distinct `{{var}}` names a template references across its channels, in first-seen order. */
export function templatePlaceholders(template: NotificationTemplate): string[] {
  const names: string[] = [];
  for (const text of channelTexts(template)) {
    for (const match of text.matchAll(PLACEHOLDER)) {
      if (!names.includes(match[1])) names.push(match[1]);
    }
  }
  return names;
}

/** A screen-reader summary of one template row. */
export function templateSummary(key: string, template: NotificationTemplate): string {
  return `${notificationTemplateLabel(key)}, ${templateChannelsSummary(template)}`;
}
