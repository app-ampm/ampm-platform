import { View, type ViewProps } from "react-native";

import { cn } from "../../lib/cn";
import {
  alignClass,
  gapClass,
  justifyClass,
  type Align,
  type Gap,
  type Justify,
} from "./layout.styles";

export interface RowProps extends ViewProps {
  readonly gap?: Gap | undefined;
  readonly align?: Align | undefined;
  readonly justify?: Justify | undefined;
  /** Let children wrap onto the next line instead of shrinking. */
  readonly wrap?: boolean | undefined;
  readonly className?: string;
}

/** Horizontal flow, centred on the cross axis by default: `<Row gap={2} justify="between">`. */
export function Row({
  gap = 2,
  align = "center",
  justify = "start",
  wrap = false,
  className,
  ...rest
}: RowProps) {
  return (
    <View
      className={cn(
        "flex-row",
        wrap && "flex-wrap",
        gapClass[gap],
        alignClass[align],
        justifyClass[justify],
        className,
      )}
      {...rest}
    />
  );
}
