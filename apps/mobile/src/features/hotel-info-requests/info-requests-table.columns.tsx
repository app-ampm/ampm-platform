import { formatDay, type HotelInfoRequestSummaryView } from "@ampm/core";
import { Stack, StatusChip, Text, useLayoutAt, type DataTableColumn } from "@ampm/ui";

import {
  expiryText,
  infoRequestHotelName,
  infoRequestKindLabel,
  infoRequestStatusLabel,
  infoRequestStatusTone,
  isLinkExpired,
} from "./info-requests.format";

/*
 * TW-99's columns (D-188 §7): the hotel (the catalogue's name, or a new hotel's proposed name, with its
 * destination) and the reference, the status, the round, the link's expiry and when the request last
 * changed. Below 1024 the hotel, its reference and the status; each row stacks itself below 768.
 */

type Column = DataTableColumn<HotelInfoRequestSummaryView>;

/** The hotel, its place, and for a new hotel the word that it is one. */
function HotelCell({ request }: { readonly request: HotelInfoRequestSummaryView }) {
  const place = [request.destinationName, request.target === "new" ? "New hotel" : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <Stack gap={1}>
      <Text variant="body" numberOfLines={1}>
        {infoRequestHotelName(request)}
      </Text>
      <Text variant="bodySmall" tone="muted" numberOfLines={1}>
        {place}
      </Text>
    </Stack>
  );
}

const HOTEL: Column = {
  key: "hotel",
  header: "Hotel",
  width: 220,
  grow: true,
  render: (request) => <HotelCell request={request} />,
};

const REFERENCE: Column = {
  key: "reference",
  header: "Reference",
  width: 140,
  render: (request) => <Text variant="data">{request.reference}</Text>,
};

const STATUS: Column = {
  key: "status",
  header: "Status",
  width: 170,
  render: (request) => (
    <Stack gap={1}>
      <StatusChip
        label={infoRequestStatusLabel(request.status)}
        tone={infoRequestStatusTone(request.status)}
        size="sm"
      />
      {request.isTest ? <StatusChip label="Test" tone="neutral" size="sm" /> : null}
    </Stack>
  ),
};

const KIND: Column = {
  key: "kind",
  header: "Round",
  width: 120,
  render: (request) => <Text variant="bodySmall">{infoRequestKindLabel(request.kind)}</Text>,
};

const LINK: Column = {
  key: "link",
  header: "Link",
  width: 210,
  render: (request) => (
    <Text variant="bodySmall" tone={isLinkExpired(request) ? "brand" : "body"} numberOfLines={2}>
      {expiryText(request)}
    </Text>
  ),
};

const UPDATED: Column = {
  key: "updated",
  header: "Last change",
  width: 130,
  align: "end",
  render: (request) => (
    <Text variant="data">{formatDay(request.updatedAt, { style: "data" })}</Text>
  ),
};

/** Below 1024: the hotel, the reference and the status. */
export const REQUEST_COLUMNS: readonly Column[] = [HOTEL, REFERENCE, STATUS];

/** From 1024: every column the summary carries for the queue. */
export const REQUEST_DESKTOP_COLUMNS: readonly Column[] = [
  HOTEL,
  REFERENCE,
  STATUS,
  KIND,
  LINK,
  UPDATED,
];

/** The columns for this window. */
export function useRequestColumns(): readonly Column[] {
  return useLayoutAt("lg") ? REQUEST_DESKTOP_COLUMNS : REQUEST_COLUMNS;
}
