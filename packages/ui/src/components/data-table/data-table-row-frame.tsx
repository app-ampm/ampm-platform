import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { cn } from "../../lib/cn";

/** Screen readers hear the open row as selected natively, and as the current one on the web. */
const SELECTED_ROW_A11Y = {
  "aria-current": "true",
  accessibilityState: { selected: true },
} as const;

export interface DataTableRowFrameProps {
  readonly children: ReactNode;
  /** The row's own layout: a line of cells (the table) or a stack of facts (a phone). */
  readonly className: string;
  readonly last: boolean;
  readonly selected: boolean;
  readonly onPress: (() => void) | undefined;
  readonly label: string | undefined;
}

/**
 * One row of a DataTable, as a table line or a phone's stacked block: the divider under it, and, for
 * the open row, a peacock tint plus a bar at its start (a shape as well as a colour, never colour
 * alone; absolute, so it takes no cell's width). A row that opens something is one pressable named by
 * its label. Internal to the DataTable.
 */
export function DataTableRowFrame({
  children,
  className,
  last,
  selected,
  onPress,
  label,
}: DataTableRowFrameProps) {
  const body = (
    <View
      className={cn(
        className,
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
      {children}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...(selected ? SELECTED_ROW_A11Y : {})}
    >
      {body}
    </Pressable>
  );
}
