import { View, type ViewProps } from "react-native";

import { cn } from "../../lib/cn";
import { dividerStyles, type DividerOrientation } from "./layout.styles";

export interface DividerProps extends Omit<ViewProps, "children"> {
  /** `horizontal` between stacked items (the default), `vertical` between items in a row. */
  readonly orientation?: DividerOrientation | undefined;
  /** Leave a gap at both ends: 16 on a horizontal rule, 8 on a vertical one. */
  readonly inset?: boolean | undefined;
  readonly className?: string;
}

/**
 * A pearl 16% hairline between items: sections in a card, fields in a search pill, columns of
 * figures. Decorative, so screen readers skip it; it stretches across the parent's cross axis.
 *
 *   <Stack gap={3}><Text>Rooms</Text><Divider /><Text>Venues</Text></Stack>
 *   <Row gap={3}><Text>Udaipur</Text><Divider orientation="vertical" /><Text>300 guests</Text></Row>
 */
export function Divider({
  orientation = "horizontal",
  inset = false,
  className,
  ...rest
}: DividerProps) {
  return (
    <View
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={cn(dividerStyles({ orientation, inset }), className)}
      {...rest}
    />
  );
}
