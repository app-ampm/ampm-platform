import { View } from "react-native";

import { Text } from "../text";
import type { DataTableProps } from "./data-table";
import { DataTableRowFrame } from "./data-table-row-frame";

type StackedProps<Row> = Pick<
  DataTableProps<Row>,
  "columns" | "rows" | "keyExtractor" | "onRowPress" | "rowAccessibilityLabel" | "selectedKey"
>;

/**
 * A phone's table: each row a block led by its first column (the record's name, or the event's time),
 * then every other column as a muted label at the left and its value at the right. Nothing runs off
 * the screen's edge, where a sideways-scrolling table showed only its first two columns (audit log,
 * configuration). Internal to the DataTable.
 */
export function DataTableStacked<Row>({
  columns,
  rows,
  keyExtractor,
  onRowPress,
  rowAccessibilityLabel,
  selectedKey,
}: StackedProps<Row>) {
  // The first column names the row in every table here (a hotel, a role, a setting, an event's time);
  // the growing column is the widest on a desktop, often a value, so it does not choose the lead.
  const [lead, ...facts] = columns;
  return (
    <View testID="data-table-stacked">
      {rows.map((row, index) => (
        <DataTableRowFrame
          key={keyExtractor(row)}
          className="gap-2 px-1 py-3.5"
          last={index === rows.length - 1}
          selected={selectedKey !== undefined && keyExtractor(row) === selectedKey}
          onPress={onRowPress ? () => onRowPress(row) : undefined}
          label={rowAccessibilityLabel?.(row)}
        >
          {lead ? <View className="pl-2">{lead.render(row)}</View> : null}
          {facts.map((column) => (
            <View key={column.key} className="flex-row items-center justify-between gap-3 pl-2">
              <Text variant="eyebrow" tone="muted" numberOfLines={1} className="shrink-0">
                {column.header}
              </Text>
              <View className="min-w-0 shrink items-end">{column.render(row)}</View>
            </View>
          ))}
        </DataTableRowFrame>
      ))}
    </View>
  );
}
