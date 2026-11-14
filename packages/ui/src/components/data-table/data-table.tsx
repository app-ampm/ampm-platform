import type { ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { cn } from "../../lib/cn";
import { Text } from "../text";

export interface DataTableColumn<Row> {
  readonly key: string;
  readonly header: string;
  /** Column width in points; the header and every cell share it so the columns line up. Default 140. */
  readonly width?: number | undefined;
  /**
   * The column that absorbs the spare width on a wide screen (one per table, the primary label), so the
   * table fills its card instead of leaving the right half empty. `width` becomes its minimum, so a
   * narrow screen still scrolls the table sideways rather than crushing it.
   */
  readonly grow?: boolean | undefined;
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
  /** The open row's key, when a detail beside the table shows it (T12's role in the side column). */
  readonly selectedKey?: string | undefined;
  readonly className?: string | undefined;
  readonly testID?: string | undefined;
}

const DEFAULT_WIDTH = 140;

// A column's width is a layout number, so it is the one value set through `style` (styling.md allows
// `style` for dynamic numbers); every other value here is a token class. A growing column takes the spare
// width (`flex-1`) and keeps its width as the floor (`minWidth`); a fixed column is exactly its width.
function cellLayout(column: { width?: number | undefined; grow?: boolean | undefined }): {
  className: string;
  style: { width: number } | { minWidth: number };
} {
  const width = column.width ?? DEFAULT_WIDTH;
  return column.grow
    ? { className: "flex-1", style: { minWidth: width } }
    : { className: "", style: { width } };
}

// T4 and T12: the header is a line of muted eyebrows over a pearl 16% rule, with no fill of its own.
function HeaderRow<Row>({ columns }: { readonly columns: readonly DataTableColumn<Row>[] }) {
  return (
    <View className="w-full flex-row border-b border-primary/16">
      {columns.map((column) => {
        const layout = cellLayout(column);
        return (
          <View
            key={column.key}
            style={layout.style}
            className={cn("px-3 py-2.5", layout.className, column.align === "end" && "items-end")}
          >
            <Text variant="eyebrow" tone="muted" numberOfLines={1}>
              {column.header}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

interface DataRowProps<Row> {
  readonly row: Row;
  readonly columns: readonly DataTableColumn<Row>[];
  readonly onPress: (() => void) | undefined;
  readonly label: string | undefined;
  readonly last: boolean;
  readonly selected: boolean;
}

/**
 * The open row is marked by a shape as well as a tint (never colour alone): a peacock bar at its start,
 * placed absolutely so it takes no column's width. Screen readers hear it as selected natively and as
 * the current row on the web, where react-native-web drops accessibilityState.
 */
const SELECTED_ROW_A11Y = {
  "aria-current": "true",
  accessibilityState: { selected: true },
} as const;

function RowCells<Row>({ row, columns }: Pick<DataRowProps<Row>, "row" | "columns">) {
  return columns.map((column) => {
    const layout = cellLayout(column);
    return (
      <View
        key={column.key}
        style={layout.style}
        className={cn(
          // T4's rows breathe on a desktop: 14 above and below each cell from 1024.
          "justify-center px-3 py-3 lg:py-3.5",
          layout.className,
          column.align === "end" && "items-end",
        )}
      >
        {column.render(row)}
      </View>
    );
  });
}

function DataRow<Row>({ row, columns, onPress, label, last, selected }: DataRowProps<Row>) {
  const cells = (
    <View
      className={cn(
        "w-full flex-row",
        !last && "border-b border-primary/12",
        selected && "bg-highlight/10",
      )}
    >
      {selected ? (
        <View
          className="absolute inset-y-2 left-0 w-1 rounded-full bg-highlight"
          testID="data-table-selected-mark"
        />
      ) : null}
      <RowCells row={row} columns={columns} />
    </View>
  );
  if (!onPress) return cells;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...(selected ? SELECTED_ROW_A11Y : {})}
    >
      {cells}
    </Pressable>
  );
}

/**
 * A columnar table for the admin workspace's data-dense screens (first used by the audit log, TW-96).
 * Every column declares a fixed width so the header and cells line up; mark the primary column `grow` so
 * the table fills the width of its card on a desktop. The whole table scrolls horizontally when it is
 * wider than the screen, so it works on a phone too. Presentational only: data in via `rows`, a tap out
 * via `onRowPress`; loading, empty and error states belong to the caller. Right-align dates, counts and
 * money with `align: "end"`. `selectedKey` marks the row whose detail is open beside the table.
 *
 *   <DataTable columns={columns} rows={page.items} keyExtractor={(e) => e.id} onRowPress={open} />
 *   <DataTable … onRowPress={pick} selectedKey={pickedRole?.id} />
 */
export function DataTable<Row>({
  columns,
  rows,
  keyExtractor,
  onRowPress,
  rowAccessibilityLabel,
  selectedKey,
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
      {/* min-w-full, so the table fills the card when the columns are narrower than it, and grows past
          it (scrolling) when they are wider, as on a phone. */}
      <View className="min-w-full">
        <HeaderRow columns={columns} />
        {rows.map((row, index) => (
          <DataRow
            key={keyExtractor(row)}
            row={row}
            columns={columns}
            onPress={onRowPress ? () => onRowPress(row) : undefined}
            label={rowAccessibilityLabel?.(row)}
            last={index === rows.length - 1}
            selected={selectedKey !== undefined && keyExtractor(row) === selectedKey}
          />
        ))}
      </View>
    </ScrollView>
  );
}
