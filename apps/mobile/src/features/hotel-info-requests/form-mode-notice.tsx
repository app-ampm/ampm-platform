import type { UseQueryResult } from "@tanstack/react-query";

import type { HotelFormMode } from "@ampm/core";
import { Callout, Skeleton } from "@ampm/ui";

import { formModeNotice } from "./info-requests.format";

export interface FormModeNoticeProps {
  /** The hotel form's mode, read afresh as the sheet opened (`useHotelFormMode`). */
  readonly mode: UseQueryResult<HotelFormMode>;
  /** Whether the request is a test, which test mode admits. */
  readonly isTest: boolean;
}

/**
 * What the hotel form's mode means for this request's link and its email, beside "Email it" (D-188 §6
 * and §7): off and test mode in gold, on in peacock. A mode that cannot be read says so, and the create
 * answer still tells what became of the email.
 *
 *   <FormModeNotice mode={useHotelFormMode({ enabled: open })} isTest={draft.isTest} />
 */
export function FormModeNotice({ mode, isTest }: FormModeNoticeProps) {
  if (mode.isPending) return <Skeleton className="h-16 w-full" testID="form-mode-loading" />;
  if (mode.isError) {
    return (
      <Callout
        kind="info"
        title="Could not read the hotel form's mode"
        action={{ label: "Try again", onPress: () => void mode.refetch() }}
        blur={false}
        testID="form-mode-unknown"
      >
        You can still make the request: the answer says whether its link was emailed.
      </Callout>
    );
  }
  const notice = formModeNotice(mode.data, isTest);
  return (
    <Callout kind={notice.kind} title={notice.title} blur={false} testID="form-mode">
      {notice.description}
    </Callout>
  );
}
