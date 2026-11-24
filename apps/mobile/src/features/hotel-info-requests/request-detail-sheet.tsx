import { useHotelInfoRequest } from "@ampm/api-client";
import { QueryErrorState, Sheet, Skeleton } from "@ampm/ui";

import { RequestCard } from "./request-card";

/** The request once loaded, its loading skeleton, or why it did not load. */
function DetailBody({
  detail,
  canUpdate,
}: {
  readonly detail: ReturnType<typeof useHotelInfoRequest>;
  readonly canUpdate: boolean;
}) {
  if (detail.isError) {
    return (
      <QueryErrorState error={detail.error} onRetry={() => void detail.refetch()} blur={false} />
    );
  }
  if (!detail.data) return <Skeleton className="h-40 w-full" testID="request-detail-loading" />;
  return <RequestCard request={detail.data} canUpdate={canUpdate} />;
}

export interface RequestDetailSheetProps {
  /** The request to show, or null while the sheet is shut. */
  readonly requestId: string | null;
  /** The reference to title the sheet with while the request loads. */
  readonly reference: string;
  readonly canUpdate: boolean;
  readonly onClose: () => void;
}

/**
 * One request on a sheet, from TW-99 (D-188 §7): a new hotel's request has no hotel record to hold its
 * panel yet, so its facts, history and actions open here, in the reader's model.
 *
 *   <RequestDetailSheet requestId={opened?.id ?? null} reference={opened?.reference ?? ""} … />
 */
export function RequestDetailSheet({
  requestId,
  reference,
  canUpdate,
  onClose,
}: RequestDetailSheetProps) {
  const detail = useHotelInfoRequest(requestId);
  return (
    <Sheet
      open={requestId !== null}
      onClose={onClose}
      title={reference || "Information request"}
      size="full"
      testID="request-detail"
    >
      <DetailBody detail={detail} canUpdate={canUpdate} />
    </Sheet>
  );
}
