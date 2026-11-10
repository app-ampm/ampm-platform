import { useEffect, useState } from "react";

import { useAddLeadActivity } from "@ampm/api-client";
import { isAppError } from "@ampm/core";
import { Button, FilterChip, Input, Row, Sheet, Stack, Text, useToast } from "@ampm/ui";

import {
  buildActivityBody,
  emptyActivityDraft,
  followUpLabel,
  FOLLOW_UP_CHOICES,
  LOGGABLE_ACTIVITY_TYPES,
  type ActivityDraft,
} from "./leads.form";
import { activityLabel } from "./sales.format";

/** The add-activity form: logs an activity and schedules an optional follow-up reminder (AC-01.5). */
function useAddActivityForm(leadId: string, open: boolean, onClose: () => void) {
  const toast = useToast();
  const add = useAddLeadActivity(leadId);
  const [draft, setDraft] = useState<ActivityDraft>(emptyActivityDraft);
  useEffect(() => {
    if (open) setDraft(emptyActivityDraft());
  }, [open]);
  const patch = (next: Partial<ActivityDraft>): void => setDraft((prev) => ({ ...prev, ...next }));
  const submit = (): void => {
    if (add.isPending) return;
    add.mutate(buildActivityBody(draft, Date.now()), {
      onSuccess: () => {
        toast.show({ title: "Activity logged", tone: "success" });
        onClose();
      },
      onError: (error) =>
        toast.show({
          title: isAppError(error) ? error.message : "Could not log the activity",
          tone: "danger",
        }),
    });
  };
  return { draft, patch, pending: add.isPending, submit };
}

/** A labelled row of single-select chips; the chosen one carries a check, never colour alone. */
function ChipRow<T extends string>({
  label,
  options,
  value,
  labelOf,
  onChange,
  testID,
}: {
  readonly label: string;
  readonly options: readonly T[];
  readonly value: T;
  readonly labelOf: (option: T) => string;
  readonly onChange: (option: T) => void;
  readonly testID: string;
}) {
  return (
    <Stack gap={2}>
      <Text variant="label" tone="body">
        {label}
      </Text>
      <Row gap={2} wrap testID={testID}>
        {options.map((option) => (
          <FilterChip
            key={option}
            label={labelOf(option)}
            selected={option === value}
            icon={option === value ? "check" : undefined}
            onPress={() => onChange(option)}
          />
        ))}
      </Row>
    </Stack>
  );
}

export interface LeadActivitySheetProps {
  /** The lead to log an activity for, or null when the sheet is closed. */
  readonly leadId: string | null;
  readonly onClose: () => void;
}

/** Log an activity on a lead's timeline (Sales): the type, a free-text note, and an optional follow-up. */
export function LeadActivitySheet({ leadId, onClose }: LeadActivitySheetProps) {
  const { draft, patch, pending, submit } = useAddActivityForm(
    leadId ?? "",
    leadId !== null,
    onClose,
  );
  return (
    <Sheet
      open={leadId !== null}
      onClose={onClose}
      title="Log activity"
      testID="lead-activity-sheet"
      footer={
        <Button fullWidth loading={pending} onPress={submit} testID="lead-activity-submit">
          Log activity
        </Button>
      }
    >
      <Stack gap={4}>
        <ChipRow
          label="Type"
          options={LOGGABLE_ACTIVITY_TYPES}
          value={draft.activityType}
          labelOf={activityLabel}
          onChange={(activityType) => patch({ activityType })}
          testID="activity-type"
        />
        <Input
          label="Note"
          value={draft.summary}
          onChangeText={(summary) => patch({ summary })}
          placeholder="What happened on this touch?"
          multiline
          testID="activity-summary"
        />
        <ChipRow
          label="Schedule a follow-up"
          options={FOLLOW_UP_CHOICES}
          value={draft.followUp}
          labelOf={followUpLabel}
          onChange={(followUp) => patch({ followUp })}
          testID="activity-follow-up"
        />
      </Stack>
    </Sheet>
  );
}
