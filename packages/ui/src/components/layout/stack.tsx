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

export interface StackProps extends ViewProps {
  readonly gap?: Gap | undefined;
  readonly align?: Align | undefined;
  readonly justify?: Justify | undefined;
  readonly className?: string;
}

/** Vertical flow with a spacing step between children: `<Stack gap={4}>`. */
export function Stack({
  gap = 2,
  align = "stretch",
  justify = "start",
  className,
  ...rest
}: StackProps) {
  return (
    <View
      className={cn("flex-col", gapClass[gap], alignClass[align], justifyClass[justify], className)}
      {...rest}
    />
  );
}
