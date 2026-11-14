import { Children, isValidElement, type ReactNode } from "react";
import { View, type ViewProps } from "react-native";

import { cn } from "../../lib/cn";
import { alignClass, gapClass, type Align, type Gap } from "./layout.styles";
import { useLayoutAt, type LayoutAt } from "./use-layout-at";

export interface ColumnsProps extends Omit<ViewProps, "children"> {
  readonly children?: ReactNode;
  /** Each column's share of the row, in order: `[1.5, 1]` is D4's first row. Equal by default. */
  readonly ratios?: readonly number[] | undefined;
  /** Side by side from this window width (default `lg`, 1024); stacked below it. */
  readonly at?: LayoutAt | undefined;
  /** Between the columns, and between them stacked (default 4.5: the 18 between the mocks' panels). */
  readonly gap?: Gap | undefined;
  /** Side by side: `stretch` (default) gives every column the row's height. */
  readonly align?: Align | undefined;
  readonly className?: string;
}

/** A child's key from `Children.toArray`, or its place when it has none (text). */
function keyOf(child: ReturnType<typeof Children.toArray>[number], index: number) {
  return isValidElement(child) && child.key !== null ? child.key : index;
}

/**
 * Panels side by side in shares of the row, as the desktop artboards lay them (D2 1 : 1.1, D4 1.5 : 1
 * then 1 : 1 : 0.9, D6 1.6 : 1, T3 1.3 : 1), stacked in order on narrower windows. Each child is one
 * column; empty children (null, false) take none. The tree is the same at every width, so a column
 * keeps its state when the window crosses the breakpoint.
 *
 *   <Columns ratios={[1.5, 1]}>
 *     <HotelSearchCard />
 *     <PlanCard />
 *   </Columns>
 */
export function Columns({
  children,
  ratios,
  at = "lg",
  gap = 4.5,
  align = "stretch",
  className,
  ...rest
}: ColumnsProps) {
  const isRow = useLayoutAt(at);
  return (
    <View
      className={cn(
        isRow ? "flex-row" : "flex-col",
        gapClass[gap],
        isRow ? alignClass[align] : "items-stretch",
        className,
      )}
      {...rest}
    >
      {Children.toArray(children).map((child, index) => (
        <View
          key={keyOf(child, index)}
          // A column's share is a number the caller picks, so it is a style rather than a class.
          style={isRow ? { flexGrow: ratios?.[index] ?? 1, flexBasis: 0, minWidth: 0 } : undefined}
        >
          {child}
        </View>
      ))}
    </View>
  );
}
