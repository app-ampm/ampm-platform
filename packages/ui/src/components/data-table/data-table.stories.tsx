import { defineStories } from "../../stories/define";
import { StatusChip } from "../status-chip";
import { Text } from "../text";
import { DataTable, type DataTableColumn } from "./data-table";

interface Event {
  readonly id: string;
  readonly when: string;
  readonly action: string;
  readonly entity: string;
}

const EVENTS: Event[] = [
  { id: "1", when: "5 NOV 2026 · 18:02", action: "Update", entity: "staff_user" },
  { id: "2", when: "5 NOV 2026 · 17:40", action: "Create", entity: "hotel" },
  { id: "3", when: "4 NOV 2026 · 09:15", action: "Delete", entity: "rate_card" },
];

const COLUMNS: DataTableColumn<Event>[] = [
  {
    key: "when",
    header: "When",
    width: 180,
    render: (event) => <Text variant="data">{event.when}</Text>,
  },
  {
    key: "action",
    header: "Action",
    width: 120,
    render: (event) => <StatusChip label={event.action} tone="info" size="sm" />,
  },
  {
    key: "entity",
    header: "Entity",
    width: 160,
    // The primary column grows, so the table fills the width of its card instead of ending short.
    grow: true,
    render: (event) => <Text variant="bodySmall">{event.entity}</Text>,
  },
];

export const stories = defineStories({
  title: "DataTable",
  stories: [
    {
      name: "Audit-style rows",
      render: () => (
        <DataTable columns={COLUMNS} rows={EVENTS} keyExtractor={(event) => event.id} />
      ),
    },
    {
      name: "Pressable rows",
      render: () => (
        <DataTable
          columns={COLUMNS}
          rows={EVENTS}
          keyExtractor={(event) => event.id}
          onRowPress={() => undefined}
          rowAccessibilityLabel={(event) => `${event.action} ${event.entity}`}
        />
      ),
    },
  ],
});
