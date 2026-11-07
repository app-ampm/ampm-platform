import type { ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { cn } from "../../lib/cn";
import { Text } from "../text";

export interface DataTableColumn<Row> {
  readonly key: string;
  readonly header: string;
  /** Column width in points; the header and every cell share it so the columns line up. Default 140. */
  readonly width?: number | undefined;
  /** `end` right-aligns the column, for dates, counts and money. */
  readonly align?: "start" | "end" | undefined;
  readonly render: (row: Row) => ReactNode;
}

export interface DataTableProps<Row> {
  readonly columns: readonly DataTableColumn<Row>[];
  readonly rows: readonly Row[];
  readonly keyExtractor: (row: Row) => string;
  readonly onRowPress?: ((row: Row) => void) | undefined;
  readonly rowAccessibilityLabel?: ((row: Row) => string) | undefined;
  readonly className?: string | undefined;
  readonly testID?: string | undefined;
}

const DEFAULT_WIDTH = 140;

// A column width is a layout number, so it is the one value set through `style` (styling.md allows
// `style` for dynamic numbers); every other value here is a token class.
function cellWidth(width: number | undefined): { width: number } {
  return { width: width ?? DEFAULT_WIDTH };
}

function HeaderRow<Row>({ columns }: { readonly columns: readonly DataTableColumn<Row>[] }) {
  return (
    <View className="flex-row border-b border-primary/16 bg-primary/6">
      {columns.map((column) => (
        <View
          key={column.key}
          style={cellWidth(column.width)}
          className={cn("px-3 py-2.5", column.align === "end" && "items-end")}
        >
          <Text variant="eyebrow" tone="muted" numberOfLines={1}>
            {column.header}
          </Text>
        </View>
      ))}
    </View>
  );
}

interface DataRowProps<Row> {
  readonly row: Row;
  readonly columns: readonly DataTableColumn<Row>[];
  readonly onPress: (() => void) | undefined;
  readonly label: string | undefined;
  readonly last: boolean;
}

function DataRow<Row>({ row, columns, onPress, label, last }: DataRowProps<Row>) {
  const cells = (
    <View className={cn("flex-row", !last && "border-b border-primary/12")}>
      {columns.map((column) => (
        <View
          key={column.key}
          style={cellWidth(column.width)}
          className={cn("justify-center px-3 py-3", column.align === "end" && "items-end")}
        >
          {column.render(row)}
        </View>
      ))}
    </View>
  );
  if (!onPress) return cells;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      {cells}
    </Pressable>
  );
}

/**
 * A columnar table for the admin workspace's data-dense screens (first used by the audit log, TW-96).
 * Every column declares a fixed width so the header and cells line up, and the whole table scrolls
 * horizontally when it is wider than the screen, so it works on a phone too. Presentational only: data
 * in via `rows`, a tap out via `onRowPress`; loading, empty and error states belong to the caller.
 * Right-align dates, counts and money with `align: "end"`.
 *
 *   <DataTable columns={columns} rows={page.items} keyExtractor={(e) => e.id} onRowPress={open} />
 */
export function DataTable<Row>({
  columns,
  rows,
  keyExtractor,
  onRowPress,
  rowAccessibilityLabel,
  className,
  testID,
}: DataTableProps<Row>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className={cn(className)}
      contentContainerClassName="min-w-full"
      testID={testID}
    >
      <View>
        <HeaderRow columns={columns} />
        {rows.map((row, index) => (
          <DataRow
            key={keyExtractor(row)}
            row={row}
            columns={columns}
            onPress={onRowPress ? () => onRowPress(row) : undefined}
            label={rowAccessibilityLabel?.(row)}
            last={index === rows.length - 1}
          />
        ))}
      </View>
    </ScrollView>
  );
}
