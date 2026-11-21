import type { SavedHotelStaffView } from "@ampm/core";
import { Card, DataTable, Stack, StatusChip, Text, type DataTableColumn } from "@ampm/ui";

import {
  savedHotelDay,
  savedHotelNote,
  savedHotelPlace,
  savedHotelStatusChip,
  savedHotelSummary,
} from "./saved-hotels.format";

function HotelCell({ item }: { readonly item: SavedHotelStaffView }) {
  const chip = savedHotelStatusChip(item.hotel);
  return (
    <Stack gap={1}>
      <Text variant="body" numberOfLines={2}>
        {item.hotel.name}
      </Text>
      <Text variant="bodySmall" tone="muted" numberOfLines={1}>
        {savedHotelPlace(item.hotel)}
      </Text>
      {chip ? <StatusChip label={chip.label} tone={chip.tone} size="sm" /> : null}
    </Stack>
  );
}

// The widths add up to 580, inside the card's 591 at 768 beside the collapsed rail, so a tablet shows the
// whole table without scrolling it sideways; from 1024 the Note column takes the spare width.
const COLUMNS: DataTableColumn<SavedHotelStaffView>[] = [
  {
    key: "client",
    header: "Client",
    width: 150,
    render: (item) => (
      <Text variant="body" weight="semibold" numberOfLines={2}>
        {item.account.name}
      </Text>
    ),
  },
  {
    key: "hotel",
    header: "Hotel",
    width: 170,
    render: (item) => <HotelCell item={item} />,
  },
  {
    key: "note",
    header: "Client's note",
    width: 150,
    grow: true,
    render: (item) => (
      <Text variant="bodySmall" tone={item.note ? "body" : "muted"} numberOfLines={3}>
        {savedHotelNote(item.note) ?? "—"}
      </Text>
    ),
  },
  {
    key: "saved",
    header: "Saved",
    width: 110,
    align: "end",
    render: (item) => (
      <Text variant="data" tone="body">
        {savedHotelDay(item.savedAt)}
      </Text>
    ),
  },
];

export interface ClientSavedHotelsTableProps {
  /** The loaded saves across every client, newest first. */
  readonly items: readonly SavedHotelStaffView[];
  /** Opens the client's hub, where their whole list sits beside their enquiries. */
  readonly onOpenClient: (accountId: string) => void;
}

/**
 * Every client's saved hotels in one glass card (the T4 table pattern): who saved it, the hotel and where
 * it is, the client's note and the day. From 768 a table; below it each row stacks with the client first.
 * A row opens the client's hub.
 */
export function ClientSavedHotelsTable({ items, onOpenClient }: ClientSavedHotelsTableProps) {
  return (
    <Card padding="sm" testID="client-saved-hotels-table">
      <DataTable
        columns={COLUMNS}
        rows={items}
        keyExtractor={(item) => item.id}
        onRowPress={(item) => onOpenClient(item.account.id)}
        rowAccessibilityLabel={(item) => savedHotelSummary(item, true)}
      />
    </Card>
  );
}
