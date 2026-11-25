import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

import { hotelInfoRequestKind, type HotelFormMode } from "@ampm/core";
import { Input, Stack, Text, Toggle } from "@ampm/ui";

import { MediaOptionPicker } from "../hotels-admin/media-option-picker";
import { FormModeNotice } from "./form-mode-notice";
import type { RequestDraft, RequestErrors } from "./info-request.form";
import { infoRequestKindLabel } from "./info-requests.format";

/*
 * The fields the Send request and Invite a new hotel sheets share (D-188 §7; plan §8): who the link goes
 * to and whether AMPM emails it, under the hotel form's mode; the round, the label and the note, which the
 * hotel sees; AMPM's own reference (the official website and the switchboard with its source), which it
 * does not; and the Super Admin's test switch.
 */

type Patch = (next: Partial<RequestDraft>) => void;

interface FieldsProps {
  readonly draft: RequestDraft;
  readonly patch: Patch;
  readonly errors: RequestErrors;
}

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <Stack gap={3}>
      <Text variant="eyebrow" tone="muted" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </Stack>
  );
}

/** The recipient, "Email it" and what the mode makes of it. */
export function RecipientFields({
  draft,
  patch,
  errors,
  mode,
}: FieldsProps & { readonly mode: UseQueryResult<HotelFormMode> }) {
  return (
    <Section title="Who it goes to">
      <Input
        label="Recipient's name"
        value={draft.recipientName}
        onChangeText={(recipientName) => patch({ recipientName })}
        errorText={errors.recipientName}
        autoCapitalize="words"
        testID="request-recipient-name"
      />
      <Input
        label="Recipient's email"
        helpText="The hotel's contact for this request, as AMPM knows them."
        value={draft.recipientEmail}
        onChangeText={(recipientEmail) => patch({ recipientEmail })}
        errorText={errors.recipientEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        testID="request-recipient-email"
      />
      <Toggle
        label="Email it"
        description="AMPM emails the link to the recipient, when the hotel form's mode allows."
        value={draft.emailIt}
        onValueChange={(emailIt) => patch({ emailIt })}
        testID="request-email-it"
      />
      <FormModeNotice mode={mode} isTest={draft.isTest} />
    </Section>
  );
}

/** The round: onboarding or a refresh for an existing hotel; a new hotel's is its onboarding. */
function RoundField({
  draft,
  patch,
  showKind,
}: Pick<FieldsProps, "draft" | "patch"> & { readonly showKind: boolean }) {
  if (!showKind) {
    return (
      <Text variant="bodySmall" tone="muted">
        A new hotel&apos;s request is its onboarding.
      </Text>
    );
  }
  return (
    <MediaOptionPicker
      label="Round"
      value={draft.kind}
      options={hotelInfoRequestKind.options}
      optionLabel={infoRequestKindLabel}
      onChange={(kind) => patch({ kind })}
      testID="request-kind"
    />
  );
}

/** The round (an existing hotel's only), and the label and note the hotel sees. */
export function RequestDetailFields({
  draft,
  patch,
  errors,
  showKind,
}: FieldsProps & { readonly showKind: boolean }) {
  return (
    <Section title="The request">
      <RoundField draft={draft} patch={patch} showKind={showKind} />
      <Input
        label="Label"
        helpText="The hotel sees it, in the email and on the form, instead of the catalogue's name."
        value={draft.displayLabel}
        onChangeText={(displayLabel) => patch({ displayLabel })}
        errorText={errors.displayLabel}
        testID="request-label"
      />
      <Input
        label="Note to the hotel"
        helpText="The hotel sees it on the form's first page. Keep internal notes out of it."
        value={draft.staffNote}
        onChangeText={(staffNote) => patch({ staffNote })}
        errorText={errors.staffNote}
        multiline
        testID="request-note"
      />
    </Section>
  );
}

/** AMPM's own reference for its checks: the official website and the switchboard with its source. */
export function ReferenceFields({ draft, patch, errors }: FieldsProps) {
  return (
    <Section title="AMPM's reference (not shown to the hotel)">
      <Input
        label="Official website"
        value={draft.officialWebsite}
        onChangeText={(officialWebsite) => patch({ officialWebsite })}
        errorText={errors.officialWebsite}
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="https://www.hotel.example"
        testID="request-official-website"
      />
      <Input
        label="Switchboard number"
        value={draft.switchboardPhone}
        onChangeText={(switchboardPhone) => patch({ switchboardPhone })}
        errorText={errors.switchboardPhone}
        keyboardType="phone-pad"
        placeholder="+91 141 234 5678"
        testID="request-switchboard"
      />
      <Input
        label="Where the number came from"
        helpText="Needed with the number, such as the hotel's own website."
        value={draft.switchboardSource}
        onChangeText={(switchboardSource) => patch({ switchboardSource })}
        errorText={errors.switchboardSource}
        testID="request-switchboard-source"
      />
    </Section>
  );
}

/** Whether the test switch shows (the Super Admin's) and may be turned on (a draft or new hotel). */
export interface TestSwitch {
  readonly shown: boolean;
  /** Why it may not be turned on here; undefined when it may. */
  readonly refusal?: string | undefined;
}

/** The Super Admin's test request switch; off and held where the hotel is not a draft. */
export function TestRequestToggle({
  draft,
  patch,
  test,
}: Pick<FieldsProps, "draft" | "patch"> & { readonly test: TestSwitch }) {
  if (!test.shown) return null;
  return (
    <Toggle
      label="Test request"
      description={
        test.refusal ??
        "A test request reaches the hotel while the form is in test mode, and stays out of the queue."
      }
      value={draft.isTest}
      onValueChange={(isTest) => patch({ isTest })}
      disabled={test.refusal !== undefined}
      testID="request-is-test"
    />
  );
}
