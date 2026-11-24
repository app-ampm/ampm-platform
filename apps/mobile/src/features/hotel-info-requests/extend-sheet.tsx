import { useEffect, useState } from "react";

import { useUpdateHotelInfoRequest } from "@ampm/api-client";
import { formatDay, type HotelInfoRequestFullView } from "@ampm/core";
import { Button, Input, Sheet, Stack, Text, useToast } from "@ampm/ui";

import { extendPreview } from "./info-request.form";
import { refusalOf } from "./info-request.refusal";

export interface ExtendSheetProps {
  readonly open: boolean;
  readonly request: HotelInfoRequestFullView;
  readonly onClose: () => void;
}

/** The extension's state: the days typed, their preview, and the API's word on a refusal. */
function useExtend(open: boolean, request: HotelInfoRequestFullView, onClose: () => void) {
  const toast = useToast();
  const update = useUpdateHotelInfoRequest();
  const [days, setDays] = useState("");
  const [tried, setTried] = useState(false);
  const [refused, setRefused] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!open) return;
    setDays("");
    setTried(false);
    setRefused(undefined);
  }, [open]);
  const preview = extendPreview(request, days, new Date());
  const onSuccess = (updated: { readonly expiresAt: string }): void => {
    toast.show({ title: `Link extended to ${formatDay(updated.expiresAt)}`, tone: "success" });
    onClose();
  };
  const onError = (error: unknown): void => {
    const { message } = refusalOf(error, "Could not extend the link");
    setRefused(message);
    toast.show({ title: message, tone: "danger" });
  };
  const submit = (): void => {
    if (update.isPending) return;
    setTried(true);
    if (preview.days === undefined) return;
    const extendDays = preview.days;
    update.mutate({ requestId: request.id, body: { extendDays } }, { onSuccess, onError });
  };
  const change = (next: string): void => {
    setDays(next);
    setRefused(undefined);
  };
  return { days, change, preview, tried, refused, submit, pending: update.isPending };
}

/**
 * Extend a live request's link by whole days (D-188 §3 and §7): the days are added to the later of now and
 * the current expiry, up to the latest date the policy allows, which the sheet names, with the new
 * expiry as it will be. An expired link comes back to life for that many days.
 *
 *   <ExtendSheet open={action === "extend"} request={request} onClose={close} />
 */
export function ExtendSheet({ open, request, onClose }: ExtendSheetProps) {
  const state = useExtend(open, request, onClose);
  const limit = request.extendableUntil ? formatDay(request.extendableUntil) : null;
  const typed = state.days.trim() !== "";
  const error = state.refused ?? (state.tried || typed ? state.preview.error : undefined);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Extend ${request.reference}'s link`}
      footer={
        <Button fullWidth loading={state.pending} onPress={state.submit} testID="extend-submit">
          Extend link
        </Button>
      }
      testID="extend"
    >
      <Stack gap={4}>
        <Text variant="bodySmall" tone="body">
          The link now runs to {formatDay(request.expiresAt)}
          {limit ? `; it can run to ${limit} at the latest.` : "."}
        </Text>
        <Input
          label="Days to add"
          value={state.days}
          onChangeText={state.change}
          keyboardType="number-pad"
          errorText={error}
          helpText={limit ? `Up to ${limit}, the latest this link can run.` : undefined}
          testID="extend-days"
        />
        {state.preview.expiresAt ? (
          <Text variant="bodySmall" testID="extend-preview">
            New expiry: {formatDay(state.preview.expiresAt)}
          </Text>
        ) : null}
      </Stack>
    </Sheet>
  );
}
