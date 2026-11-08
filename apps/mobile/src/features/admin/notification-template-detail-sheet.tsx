import type { NotificationTemplate } from "@ampm/core";
import { Sheet, Stack, Text } from "@ampm/ui";

import {
  definedChannels,
  notificationTemplateLabel,
  templateChannelLabel,
  templateChannelsSummary,
  templatePlaceholders,
  type TemplateChannel,
  type TemplateEntry,
} from "./notification-templates.format";

function Field({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <Stack gap={1} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="eyebrow" tone="muted">
        {label}
      </Text>
      <Text variant="bodySmall" tone="primary">
        {value}
      </Text>
    </Stack>
  );
}

/** The label/value fields for one channel's content blocks. */
function channelFields(
  channel: TemplateChannel,
  template: NotificationTemplate,
): { label: string; value: string }[] {
  if (channel === "email" && template.email) {
    return [
      { label: "Subject", value: template.email.subject },
      { label: "HTML", value: template.email.html },
      { label: "Text", value: template.email.text },
    ];
  }
  if (channel === "sms" && template.sms) {
    return [{ label: "Message", value: template.sms.text }];
  }
  if (channel === "whatsapp" && template.whatsapp) {
    return [
      { label: "Provider template ID", value: template.whatsapp.providerTemplateId },
      { label: "Parameters", value: template.whatsapp.params.join(", ") || "—" },
    ];
  }
  if (channel === "push" && template.push) {
    return [
      { label: "Title", value: template.push.title },
      { label: "Body", value: template.push.body },
    ];
  }
  return [];
}

function ChannelSection({
  channel,
  template,
}: {
  readonly channel: TemplateChannel;
  readonly template: NotificationTemplate;
}) {
  return (
    <Stack gap={2}>
      <Text variant="label" tone="primary">
        {templateChannelLabel(channel)}
      </Text>
      {channelFields(channel, template).map((field) => (
        <Field key={field.label} label={field.label} value={field.value} />
      ))}
    </Stack>
  );
}

export interface NotificationTemplateDetailSheetProps {
  readonly entry: TemplateEntry | null;
  readonly onClose: () => void;
}

/**
 * The full content of one notification template: its key, the channels it defines, the `{{variables}}`
 * it fills, and each channel's message blocks (email subject/HTML/text, SMS, WhatsApp, push). Read-only
 * — a Super Admin edits the templates as configuration.
 */
export function NotificationTemplateDetailSheet({
  entry,
  onClose,
}: NotificationTemplateDetailSheetProps) {
  const variables = entry ? templatePlaceholders(entry.template) : [];
  return (
    <Sheet
      open={entry !== null}
      onClose={onClose}
      title={entry ? notificationTemplateLabel(entry.key) : "Template"}
      size="full"
      testID="notification-template-detail"
    >
      {entry ? (
        <Stack gap={3}>
          <Field label="Key" value={entry.key} />
          <Field label="Channels" value={templateChannelsSummary(entry.template)} />
          <Field label="Variables" value={variables.length > 0 ? variables.join(", ") : "—"} />
          {definedChannels(entry.template).map((channel) => (
            <ChannelSection key={channel} channel={channel} template={entry.template} />
          ))}
        </Stack>
      ) : null}
    </Sheet>
  );
}
