import { useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

import { useHotelInfoRequest, useHotelInfoRequestHistory } from "@ampm/api-client";
import {
  isLiveHotelInfoRequestStatus,
  type HotelInfoRequestDetail,
  type HotelInfoRequestSummaryView,
  type HotelStaffDetail,
} from "@ampm/core";
import { Button, Card, QueryErrorState, Row, Skeleton, Stack, Text } from "@ampm/ui";

import { currentRequestOf } from "./info-requests.format";
import { RequestCard } from "./request-card";
import { SendRequestSheet } from "./send-request-sheet";
import { useInfoRequestPermissions } from "./use-info-request-permissions";

/** The panel's title, and Send request where it may be sent (no live request, the create key). */
function PanelHeading({ onSend }: { readonly onSend: (() => void) | undefined }) {
  return (
    <Row justify="between" align="center" gap={3}>
      <Text variant="subheading" accessibilityRole="header" className="shrink">
        Information request
      </Text>
      {onSend ? (
        <Button variant="secondary" size="sm" icon="send" onPress={onSend} testID="request-send">
          Send request
        </Button>
      ) : null}
    </Row>
  );
}

interface BodyProps {
  readonly history: ReturnType<typeof useHotelInfoRequestHistory>;
  readonly current: HotelInfoRequestSummaryView | null;
  readonly detail: UseQueryResult<HotelInfoRequestDetail>;
  readonly canUpdate: boolean;
}

/** The hotel's request: loading, a failed load (offline included), none yet, or its card. */
function PanelBody({ history, current, detail, canUpdate }: BodyProps) {
  if (history.isPending) return <Skeleton className="h-24 w-full" testID="request-panel-loading" />;
  if (history.isError) {
    return <QueryErrorState error={history.error} onRetry={history.refetch} blur={false} />;
  }
  if (!current) {
    return (
      <Text variant="bodySmall" tone="muted" testID="request-panel-empty">
        No information request yet. Send one to have the hotel fill in its details on the form.
      </Text>
    );
  }
  // The history's summary stands in while the request's own model loads.
  return (
    <Card padding="sm" testID="request-panel-card">
      <RequestCard request={detail.data ?? current} canUpdate={canUpdate} />
    </Card>
  );
}

export interface HotelRequestPanelProps {
  readonly hotelId: string;
  /** The hotel once loaded: the Send request sheet names it and checks it is a draft for a test. */
  readonly hotel: Pick<HotelStaffDetail, "id" | "name" | "status"> | undefined;
}

/**
 * The hotel record's request panel (D-188 §7; plan §8): the hotel's live information request, else its
 * latest, with its reference, status, expiry, recipient, link and latest events, and the actions a
 * holder of the update key may take (D-164 grants). With no live request, Send request opens the sheet
 * for a role that may create one. A reader of the summary (SM, PM) sees no recipient, no events and no
 * action; a role that may not read requests sees no panel.
 *
 *   <HotelRequestPanel hotelId={hotelId} hotel={hotel.data} />
 */
export function HotelRequestPanel({ hotelId, hotel }: HotelRequestPanelProps) {
  const { canRead, canCreate, canUpdate } = useInfoRequestPermissions();
  const history = useHotelInfoRequestHistory(hotelId, { enabled: canRead });
  const current = currentRequestOf(history.items);
  const detail = useHotelInfoRequest(current?.id ?? null, { enabled: canRead });
  const [sending, setSending] = useState(false);
  if (!canRead) return null;
  const hasLive = current !== null && isLiveHotelInfoRequestStatus(current.status);
  const canSend =
    canCreate && !hasLive && !history.isPending && !history.isError && hotel !== undefined;
  return (
    <Stack gap={2} testID="request-panel">
      <PanelHeading onSend={canSend ? () => setSending(true) : undefined} />
      <PanelBody history={history} current={current} detail={detail} canUpdate={canUpdate} />
      {hotel && canCreate ? (
        <SendRequestSheet open={sending} hotel={hotel} onClose={() => setSending(false)} />
      ) : null}
    </Stack>
  );
}
