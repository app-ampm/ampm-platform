import type { ReactNode } from "react";
import { View, type ViewProps } from "react-native";

import { cn } from "../../lib/cn";
import { gapClass, sidePanelWidthClass, type Gap, type SidePanelWidth } from "./layout.styles";
import { useLayoutAt, type LayoutAt } from "./use-layout-at";

export interface MasterDetailProps extends Omit<ViewProps, "children"> {
  /** The list: a queue of enquiries, a person's requests. */
  readonly list: ReactNode;
  /** The selected item, or nothing when none is selected. */
  readonly detail?: ReactNode;
  /** Side by side with nothing selected, what fills the detail pane (an `EmptyState`). */
  readonly placeholder?: ReactNode;
  /** The list column: lg 384 (D8's 380) · list 432 (T6's 430, default) · sm 288 · md 320. */
  readonly listWidth?: SidePanelWidth | undefined;
  /** Side by side from this window width (default `lg`, 1024). */
  readonly at?: LayoutAt | undefined;
  readonly gap?: Gap | undefined;
  readonly className?: string;
}

/**
 * A list beside the selected item, as D8 (enquiries, 380 + 1fr) and T6 (the enquiry queue, 430 + 1fr)
 * lay them. Narrower windows show one at a time: the detail when one is selected, else the list. The
 * app keeps the routing: its list route passes no detail, its detail route passes both.
 *
 *   <MasterDetail list={<EnquiryQueue selectedId={id} />} detail={<EnquiryDetail id={id} />} />
 */
export function MasterDetail({
  list,
  detail,
  placeholder,
  listWidth = "list",
  at = "lg",
  gap = 4.5,
  className,
  ...rest
}: MasterDetailProps) {
  const isRow = useLayoutAt(at);
  const hasDetail = detail !== undefined && detail !== null && detail !== false;
  // The list and the detail keep their slots at every width, so crossing the breakpoint (a tablet
  // rotating, a window resizing) never remounts them and loses what the person was typing.
  const showList = isRow || !hasDetail;
  const pane = hasDetail ? detail : isRow ? placeholder : null;
  return (
    <View
      className={cn(isRow ? "flex-row items-start" : "flex-col", gapClass[gap], className)}
      {...rest}
    >
      {showList ? (
        <View className={cn(isRow && cn("shrink-0", sidePanelWidthClass[listWidth]))}>{list}</View>
      ) : null}
      {pane ? <View className={cn(isRow && "min-w-0 flex-1")}>{pane}</View> : null}
    </View>
  );
}
