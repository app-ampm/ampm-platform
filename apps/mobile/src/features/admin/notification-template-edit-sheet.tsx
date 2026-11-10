import { useEffect, useState } from "react";

import { useUpdateNotificationTemplates } from "@ampm/api-client";
import type { NotificationTemplates } from "@ampm/core";
import { Button, Callout, Input, Sheet, Stack, Text, Toggle, useToast } from "@ampm/ui";

import {
  notificationTemplateLabel,
  templateChannelLabel,
  templatePlaceholders,
  TEMPLATE_CHANNELS,
  type TemplateChannel,
  type TemplateEntry,
} from "./notification-templates.format";
import {
  CHANNEL_FIELDS,
  templateDraftFromValue,
  templateFieldKey,
  templateFromDraft,
  validateTemplateDraft,
  type ChannelDraft,
  type TemplateDraft,
  type TemplateValidation,
} from "./notification-template.edit";

type SetEnabled = (channel: TemplateChannel, enabled: boolean) => void;
type SetField = (channel: TemplateChannel, key: string, value: string) => void;

function clearFieldError(prev: TemplateValidation, key: string): TemplateValidation {
  if (!prev.fieldErrors[key] && prev.formError === undefined) return prev;
  return {
    fieldErrors: Object.fromEntries(Object.entries(prev.fieldErrors).filter(([k]) => k !== key)),
  };
}

/** The edit form's state, validation and submission; kept out of the view so each stays small. */
function useTemplateEditForm(
  entry: TemplateEntry | null,
  allTemplates: NotificationTemplates,
  onClose: () => void,
) {
  const toast = useToast();
  const update = useUpdateNotificationTemplates();
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [validation, setValidation] = useState<TemplateValidation>({ fieldErrors: {} });
  useEffect(() => {
    if (entry) {
      setDraft(templateDraftFromValue(entry.template));
      setValidation({ fieldErrors: {} });
    }
  }, [entry]);
  const setEnabled: SetEnabled = (channel, enabled) =>
    setDraft((prev) => (prev ? { ...prev, [channel]: { ...prev[channel], enabled } } : prev));
  const setField: SetField = (channel, key, value) => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            [channel]: { ...prev[channel], fields: { ...prev[channel].fields, [key]: value } },
          }
        : prev,
    );
    setValidation((prev) => clearFieldError(prev, templateFieldKey(channel, key)));
  };
  const submit = (): void => {
    if (update.isPending || !entry || !draft) return;
    const result = validateTemplateDraft(draft);
    if (!result.value) return setValidation(result);
    // One template is one slice of the record, so an edit writes the whole record back.
    update.mutate(
      { ...allTemplates, [entry.key]: result.value },
      {
        onSuccess: () => {
          toast.show({ title: "Template saved", tone: "success" });
          onClose();
        },
        onError: () => toast.show({ title: "Could not save the template", tone: "danger" }),
      },
    );
  };
  return { draft, setEnabled, setField, validation, submit, pending: update.isPending };
}

interface ChannelEditorProps {
  readonly channel: TemplateChannel;
  readonly draft: ChannelDraft;
  readonly validation: TemplateValidation;
  readonly setEnabled: SetEnabled;
  readonly setField: SetField;
}

/** One channel: a switch to use it, and — when on — its content fields. */
function ChannelEditor({ channel, draft, validation, setEnabled, setField }: ChannelEditorProps) {
  return (
    <Stack gap={2}>
      <Toggle
        label={templateChannelLabel(channel)}
        value={draft.enabled}
        onValueChange={(next) => setEnabled(channel, next)}
        testID={`template-channel-${channel}`}
      />
      {draft.enabled
        ? CHANNEL_FIELDS[channel].map((field) => (
            <Input
              key={field.key}
              label={field.label}
              multiline={field.multiline}
              value={draft.fields[field.key] ?? ""}
              onChangeText={(next) => setField(channel, field.key, next)}
              errorText={validation.fieldErrors[templateFieldKey(channel, field.key)]}
              helpText={field.help}
              testID={`template-field-${channel}-${field.key}`}
            />
          ))
        : null}
    </Stack>
  );
}

export interface NotificationTemplateEditSheetProps {
  readonly entry: TemplateEntry | null;
  /** The whole record, so an edited template is merged back without dropping the others. */
  readonly allTemplates: NotificationTemplates;
  readonly onClose: () => void;
}

/**
 * Edit one notification template (`admin.configurations.update`, Super Admin). Each channel has a switch
 * and, when on, its content fields (email subject/HTML/text, SMS message, WhatsApp id + parameters, push
 * title/body); the `{{variables}}` the content references are shown live. On save the edited template is
 * merged into the record and written through the config endpoint; the server remains the real gate.
 *
 *   <NotificationTemplateEditSheet entry={editing} allTemplates={all} onClose={close} />
 */
export function NotificationTemplateEditSheet({
  entry,
  allTemplates,
  onClose,
}: NotificationTemplateEditSheetProps) {
  const { draft, setEnabled, setField, validation, submit, pending } = useTemplateEditForm(
    entry,
    allTemplates,
    onClose,
  );
  const variables = draft ? templatePlaceholders(templateFromDraft(draft)) : [];
  return (
    <Sheet
      open={entry !== null}
      onClose={onClose}
      title={entry ? `Edit ${notificationTemplateLabel(entry.key)}` : "Edit template"}
      size="full"
      testID="notification-template-edit"
      footer={
        <Button
          fullWidth
          loading={pending}
          onPress={submit}
          testID="notification-template-edit-submit"
        >
          Save changes
        </Button>
      }
    >
      {entry && draft ? (
        <Stack gap={4}>
          {variables.length > 0 ? (
            <Text variant="bodySmall" tone="muted">{`Variables: ${variables.join(", ")}`}</Text>
          ) : null}
          {validation.formError ? (
            <Callout kind="danger" title={validation.formError} blur={false} />
          ) : null}
          {TEMPLATE_CHANNELS.map((channel) => (
            <ChannelEditor
              key={channel}
              channel={channel}
              draft={draft[channel]}
              validation={validation}
              setEnabled={setEnabled}
              setField={setField}
            />
          ))}
        </Stack>
      ) : null}
    </Sheet>
  );
}
