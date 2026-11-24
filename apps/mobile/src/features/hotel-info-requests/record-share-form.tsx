import { useState } from "react";

import { useRecordHotelInfoRequestShare } from "@ampm/api-client";
import {
  HOTEL_INFO_REQUEST_SHARE_NOTE_MAX,
  hotelInfoRequestShareChannel,
  hotelInfoRequestShareNote,
  type HotelInfoRequestShareChannel,
} from "@ampm/core";
import { Button, Icon, Input, Row, Stack, Text, useToast } from "@ampm/ui";

import { FieldAlert } from "../hotels-admin/field-alert";
import { MediaOptionPicker } from "../hotels-admin/media-option-picker";
import { refusalOf } from "./info-request.refusal";
import { shareChannelLabel } from "./info-requests.format";

export interface RecordShareFormProps {
  readonly requestId: string;
  /** Called once the share is recorded (a sheet closes itself). */
  readonly onRecorded?: (() => void) | undefined;
  readonly testID?: string | undefined;
}

/**
 * The note's check, the API's own (core `hotelInfoRequestShareNote`): optional, at most 500 characters,
 * and never the link pasted in, in the contract's words.
 */
function noteError(note: string): string | undefined {
  if (note.trim() === "") return undefined;
  const parsed = hotelInfoRequestShareNote.safeParse(note);
  if (parsed.success) return undefined;
  const issue = parsed.error.issues[0];
  return issue?.code === "too_big"
    ? `Keep the note to ${HOTEL_INFO_REQUEST_SHARE_NOTE_MAX} characters at most`
    : issue?.message;
}

/** The form's state: the channel (none until chosen), the note, and the record's outcome. */
function useRecordShare(requestId: string, onRecorded: (() => void) | undefined) {
  const toast = useToast();
  const record = useRecordHotelInfoRequestShare();
  const [channel, setChannel] = useState<HotelInfoRequestShareChannel | null>(null);
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  const [refused, setRefused] = useState<string | undefined>(undefined);
  const onSuccess = (): void => {
    toast.show({ title: "Share recorded", tone: "success" });
    onRecorded?.();
  };
  const onError = (error: unknown): void => {
    const { message } = refusalOf(error, "Could not record the share");
    setRefused(message);
    toast.show({ title: message, tone: "danger" });
  };
  const submit = (): void => {
    if (record.isPending) return;
    setTried(true);
    if (channel === null || noteError(note)) return;
    const text = note.trim();
    const body = { channel, ...(text === "" ? {} : { note: text }) };
    record.mutate({ requestId, body }, { onSuccess, onError });
  };
  return { channel, setChannel, note, setNote, tried, refused, submit, record };
}

/** The channel (none until chosen) and the optional note, with their checks after a try. */
function ShareFields({
  form,
  id,
}: {
  readonly form: ReturnType<typeof useRecordShare>;
  readonly id: (part: string) => string | undefined;
}) {
  return (
    <>
      <MediaOptionPicker
        label="How it was shared"
        value={form.channel}
        options={hotelInfoRequestShareChannel.options}
        optionLabel={shareChannelLabel}
        onChange={form.setChannel}
        required
        errorText={form.tried && form.channel === null ? "Choose how it was shared" : undefined}
        testID={id("channel")}
      />
      <Input
        label="Note for AMPM"
        helpText="Optional: who it went to, for example. Never paste the link here."
        value={form.note}
        onChangeText={form.setNote}
        errorText={form.tried ? noteError(form.note) : undefined}
        testID={id("note")}
      />
    </>
  );
}

/**
 * Records how staff passed a link on by hand (D-188 §3: WhatsApp, a plain copy or another way), with an
 * optional note for AMPM. The link itself is never sent. Shown after a copy or a share, and from the
 * request panel's Record share; once recorded it says so.
 *
 *   {copied ? <RecordShareForm requestId={request.id} /> : null}
 */
export function RecordShareForm({ requestId, onRecorded, testID }: RecordShareFormProps) {
  const form = useRecordShare(requestId, onRecorded);
  const id = (part: string): string | undefined => (testID ? `${testID}-${part}` : undefined);
  if (form.record.isSuccess) {
    return (
      <Row gap={2} align="center" testID={id("done")}>
        <Icon name="check-circle" tone="primary" size="sm" />
        <Text variant="bodySmall">Share recorded.</Text>
      </Row>
    );
  }
  return (
    <Stack gap={3} testID={testID}>
      <ShareFields form={form} id={id} />
      <Button
        variant="highlight"
        icon="check"
        loading={form.record.isPending}
        onPress={form.submit}
        testID={id("submit")}
      >
        Record share
      </Button>
      {form.refused ? <FieldAlert text={form.refused} testID={id("refused")} /> : null}
    </Stack>
  );
}
