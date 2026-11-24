import { useEffect, useState } from "react";

import { useHotelFormMode, useReissueHotelInfoRequest } from "@ampm/api-client";
import type { HotelInfoRequestFullView } from "@ampm/core";
import { Button, Callout, Sheet, Stack, Toggle, useToast } from "@ampm/ui";

import { FormModeNotice } from "./form-mode-notice";
import { refusalOf } from "./info-request.refusal";
import { IssuedLink } from "./issued-link";

type Reissue = ReturnType<typeof useReissue>;

/** The reissue's state: "Email it", the API's refusal, and the answer that holds the new link once. */
function useReissue(open: boolean, request: HotelInfoRequestFullView, onClose: () => void) {
  const toast = useToast();
  const reissue = useReissueHotelInfoRequest();
  const mode = useHotelFormMode({ enabled: open });
  const [emailIt, setEmailIt] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const { reset } = reissue;
  useEffect(() => {
    if (!open) return;
    setEmailIt(false);
    setRefused(null);
    reset();
  }, [open, reset]);
  const onError = (error: unknown): void => {
    const { message } = refusalOf(error, "Could not reissue the link");
    setRefused(message);
    toast.show({ title: message, tone: "danger" });
  };
  const submit = (): void => {
    if (reissue.isPending) return;
    setRefused(null);
    reissue.mutate({ requestId: request.id, body: { emailIt } }, { onError });
  };
  const close = (): void => {
    reset();
    onClose();
  };
  return { reissue, mode, emailIt, setEmailIt, refused, submit, close };
}

/** Before the reissue: the warning, the API's refusal, "Email it" and what the mode makes of it. */
function ReissueConfirm({
  state,
  request,
}: {
  readonly state: Reissue;
  readonly request: HotelInfoRequestFullView;
}) {
  const to = request.recipientEmail;
  return (
    <Stack gap={4}>
      <Callout kind="warning" title="The current link stops working" blur={false}>
        Every copy of it stops working at once, the ones the hotel forwarded to colleagues too. The
        draft is kept, and the new link is shown once.
      </Callout>
      {state.refused ? (
        <Callout kind="danger" title={state.refused} blur={false} testID="reissue-refusal" />
      ) : null}
      <Toggle
        label="Email it"
        description={
          to
            ? `AMPM emails the new link to ${to}, when the hotel form's mode allows.`
            : "Add the recipient's email (Edit) to email the link."
        }
        value={state.emailIt}
        onValueChange={state.setEmailIt}
        disabled={to === null}
        testID="reissue-email-it"
      />
      <FormModeNotice mode={state.mode} isTest={request.isTest} />
    </Stack>
  );
}

function ReissueFooter({ state }: { readonly state: Reissue }) {
  if (state.reissue.data) {
    return (
      <Button fullWidth variant="secondary" onPress={state.close} testID="reissue-done">
        Done
      </Button>
    );
  }
  return (
    <Button
      fullWidth
      loading={state.reissue.isPending}
      onPress={state.submit}
      testID="reissue-submit"
    >
      Reissue link
    </Button>
  );
}

export interface ReissueSheetProps {
  readonly open: boolean;
  readonly request: HotelInfoRequestFullView;
  readonly onClose: () => void;
}

/**
 * Reissue a live request's link (D-188 §3 and §7; plan §4.2): the warning that every copy of the current
 * link stops working, the ones the hotel forwarded too, and "Email it" (with the recipient's email only)
 * under the hotel form's mode. The new link then shows here once, with Copy and Share; closing forgets it.
 *
 *   <ReissueSheet open={action === "reissue"} request={request} onClose={close} />
 */
export function ReissueSheet({ open, request, onClose }: ReissueSheetProps) {
  const state = useReissue(open, request, onClose);
  const issued = state.reissue.data ?? null;
  return (
    <Sheet
      open={open}
      onClose={state.close}
      title={issued ? "New link" : `Reissue ${request.reference}'s link`}
      size="full"
      footer={<ReissueFooter state={state} />}
      testID="reissue"
    >
      {issued ? (
        <IssuedLink issued={issued} canRecordShare />
      ) : (
        <ReissueConfirm state={state} request={request} />
      )}
    </Sheet>
  );
}
