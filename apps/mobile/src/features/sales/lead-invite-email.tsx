import { useState } from "react";

import { useUpdateLead } from "@ampm/api-client";
import { isAppError } from "@ampm/core";
import { Button, Input, Row, Stack, Text, useToast } from "@ampm/ui";

import { buildLeadEmail } from "./leads.form";

interface LeadInviteEmailProps {
  readonly leadId: string;
  /** The email the lead has now, when staff are correcting it; blank when it came in without one. */
  readonly currentEmail?: string | undefined;
  /** Called once the email is saved, and on Cancel; only a correction offers Cancel. */
  readonly onDone?: (() => void) | undefined;
}

/** The field's value and error, and the save that validates it and patches the lead. */
function useLeadEmailForm(leadId: string, initial: string, onDone: (() => void) | undefined) {
  const toast = useToast();
  const update = useUpdateLead(leadId);
  const [email, setEmail] = useState(initial);
  const [error, setError] = useState<string | undefined>(undefined);
  const onChange = (value: string): void => {
    setEmail(value);
    setError(undefined);
  };
  const onSave = (): void => {
    const built = buildLeadEmail(email);
    if (!built.ok) {
      setError(built.error);
      return;
    }
    update.mutate(built.body, {
      onSuccess: () => {
        toast.show({ title: "Email saved", tone: "success" });
        onDone?.();
      },
      onError: (failure) =>
        toast.show({
          title: isAppError(failure) ? failure.message : "Could not save the email",
          tone: "danger",
        }),
    });
  };
  return { email, error, onChange, onSave, isSaving: update.isPending };
}

/**
 * The invitation's email step (`PATCH /crm/leads/:id`, `crm.leads.update`, which the server enforces):
 * add the couple's email to a lead that came in phone-only, or correct the one it has. The lead
 * refetches, and the card then offers "Create account and invite" to that address, so the invite only
 * ever goes to an email staff can see first.
 *
 *   <LeadInviteEmail leadId={lead.id} />
 *   <LeadInviteEmail leadId={lead.id} currentEmail={lead.email} onDone={() => setEditing(false)} />
 */
export function LeadInviteEmail({ leadId, currentEmail, onDone }: LeadInviteEmailProps) {
  const form = useLeadEmailForm(leadId, currentEmail ?? "", onDone);
  const isCorrection = currentEmail !== undefined;
  return (
    <Stack gap={3.5}>
      <Text variant="bodySmall">
        {isCorrection
          ? "Correct the email before the invite goes out."
          : "The portal invite goes by email. Add the couple's email to convert this lead."}
      </Text>
      <Input
        label="Email"
        value={form.email}
        onChangeText={form.onChange}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="off"
        maxLength={255}
        errorText={form.error}
        testID="lead-invite-email"
      />
      <Row gap={2} wrap>
        <Button loading={form.isSaving} onPress={form.onSave}>
          Save email
        </Button>
        {isCorrection ? (
          <Button variant="secondary" onPress={onDone} disabled={form.isSaving}>
            Cancel
          </Button>
        ) : null}
      </Row>
    </Stack>
  );
}
