import type { ReactNode } from "react";
import { View, type ViewProps } from "react-native";

import { cn } from "../../lib/cn";
import {
  alignClass,
  gapClass,
  sidePanelWidthClass,
  type Align,
  type Gap,
  type SidePanelWidth,
} from "./layout.styles";
import { useLayoutAt, type LayoutAt } from "./use-layout-at";

export interface SplitPaneProps extends Omit<ViewProps, "children"> {
  /** The main column: it takes the room the side panel leaves. */
  readonly children?: ReactNode;
  /** The fixed-width side panel: verification, facts, filters. */
  readonly side: ReactNode;
  /** sm 288 (T5, T12's 300) · md 320 · lg 384 (D8's 380) · list 432 (T6's 430). Default sm. */
  readonly sideWidth?: SidePanelWidth | undefined;
  /** Side by side, the panel's side: `end` (default, at the right) or `start`. */
  readonly sidePosition?: "start" | "end" | undefined;
  /** Stacked, the panel comes after the main column unless this puts it first. */
  readonly sideFirstWhenStacked?: boolean | undefined;
  /** Side by side from this window width (default `lg`, 1024); stacked below it. */
  readonly at?: LayoutAt | undefined;
  readonly gap?: Gap | undefined;
  /** Side by side: `start` (default) keeps each column its own height. */
  readonly align?: Align | undefined;
  readonly className?: string;
}

/**
 * A main column beside a fixed-width side panel, as the workspace's detail pages lay them (T5 and
 * T12: `1fr 300px`), stacked on narrower windows. The children are the main column.
 *
 *   <SplitPane side={<VerificationCard />}>
 *     <RateTable />
 *   </SplitPane>
 */
export function SplitPane({
  children,
  side,
  sideWidth = "sm",
  sidePosition = "end",
  sideFirstWhenStacked = false,
  at = "lg",
  gap = 4.5,
  align = "start",
  className,
  ...rest
}: SplitPaneProps) {
  const isRow = useLayoutAt(at);
  const sideFirst = isRow ? sidePosition === "start" : sideFirstWhenStacked;
  const main = (
    <View key="main" className={cn(isRow && "min-w-0 flex-1")}>
      {children}
    </View>
  );
  const panel = (
    <View key="side" className={cn(isRow && cn("shrink-0", sidePanelWidthClass[sideWidth]))}>
      {side}
    </View>
  );
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
      {sideFirst ? [panel, main] : [main, panel]}
    </View>
  );
}
