import { View, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { spacingPx } from "@ampm/tokens";

import { uiCopy } from "../../copy";
import { useTabIndicator, type TabIndicator } from "../../hooks/use-tab-indicator";
import { AnimatedView } from "../../lib/animated-view";
import { cn } from "../../lib/cn";
import { GlassPanel } from "../glass-panel";
import { TabBarTab, type TabBarItem } from "./tab-bar-item";
import { tabBarIndicatorStyles, tabBarRowStyles, tabBarStyles } from "./tab-bar.styles";

/** The floating bar's gap above the bottom safe-area inset (peacock-night.md §6: 26 from the bottom). */
const FLOATING_GAP = spacingPx["6.5"];

export interface TabBarProps extends Omit<ViewProps, "children"> {
  readonly items: ReadonlyArray<TabBarItem>;
  /** The key of the tab whose screen is showing. */
  readonly activeKey: string;
  /** Called with the pressed tab's key, locked tabs included; the app navigates (or explains the lock). */
  readonly onSelect: (key: string) => void;
  /** Names the tab list for screen readers; defaults to "Main navigation". */
  readonly accessibilityLabel?: string | undefined;
  /**
   * `true` (default): floats over the screen, 14 from the sides and 26 above the bottom safe area, so the
   * screen leaves room for it. `false`: an ordinary block in the layout (a tablet header, a story).
   */
  readonly floating?: boolean | undefined;
  /** The word added to a locked tab's spoken label; defaults to "Locked". */
  readonly lockedLabel?: string | undefined;
  /** What a count sounds like after the tab's label; defaults to "2 waiting". */
  readonly badgeLabel?: ((count: number) => string) | undefined;
  readonly className?: string;
}

function spokenLabel(
  item: TabBarItem,
  lockedLabel: string,
  badgeLabel: (count: number) => string,
): string {
  const parts = [item.label];
  if (item.locked) parts.push(lockedLabel);
  else if (item.badge !== undefined && item.badge > 0) parts.push(badgeLabel(item.badge));
  return parts.join(", ");
}

function Indicator({ indicator, testID }: { indicator: TabIndicator; testID: string | undefined }) {
  return (
    <AnimatedView
      pointerEvents="none"
      className={tabBarIndicatorStyles}
      // Measured width and an animated offset: both are run-time numbers.
      style={{ width: indicator.width, transform: [{ translateX: indicator.translateX }] }}
      testID={testID}
    />
  );
}

interface TabRowProps {
  readonly items: ReadonlyArray<TabBarItem>;
  readonly activeKey: string;
  readonly onSelect: (key: string) => void;
  readonly lockedLabel: string;
  readonly badgeLabel: (count: number) => string;
  readonly testID: string | undefined;
}

/** The tabs and the sliding pill behind the active one, in the row the pill is measured against. */
function TabRow({ items, activeKey, onSelect, lockedLabel, badgeLabel, testID }: TabRowProps) {
  const indicator = useTabIndicator(activeKey);
  const withIcons = items.some((item) => item.icon !== undefined);
  return (
    <View className={tabBarRowStyles}>
      {indicator.ready ? (
        <Indicator indicator={indicator} testID={testID ? `${testID}-indicator` : undefined} />
      ) : null}
      {items.map((item) => (
        <TabBarTab
          key={item.key}
          item={item}
          active={item.key === activeKey}
          filled={item.key === activeKey && !indicator.ready}
          compact={items.length > 4}
          withIcons={withIcons}
          spoken={spokenLabel(item, lockedLabel, badgeLabel)}
          onSelect={onSelect}
          onTabLayout={indicator.onTabLayout}
          testID={testID ? `${testID}-${item.key}` : undefined}
        />
      ))}
    </View>
  );
}

/**
 * The floating glass tab bar of the client app (Home, Hotels, My Wedding, Approvals, More) and the
 * team app (Home, Weddings, Tasks, More). Presentational: it shows `activeKey` and reports presses; the
 * app owns navigation. The active tab is a peacock pill that slides between tabs (it jumps under
 * reduced motion); locked tabs stay pressable at pearl 32% with a lock; counts are gold.
 *
 *   <TabBar
 *     activeKey="home"
 *     onSelect={(key) => router.navigate(TAB_ROUTES[key])}
 *     items={[
 *       { key: "home", label: "Home" },
 *       { key: "hotels", label: "Hotels" },
 *       { key: "wedding", label: "My Wedding", locked: !appointed },
 *       { key: "approvals", label: "Approvals", locked: !appointed, badge: pending },
 *       { key: "more", label: "More" },
 *     ]}
 *   />
 */
export function TabBar({
  items,
  activeKey,
  onSelect,
  accessibilityLabel = uiCopy.tabBar.label,
  floating = true,
  lockedLabel = uiCopy.tabBar.locked,
  badgeLabel = uiCopy.tabBar.badge,
  className,
  style,
  testID,
  ...rest
}: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <GlassPanel
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      className={cn(tabBarStyles({ floating }), className)}
      style={[floating ? { bottom: insets.bottom + FLOATING_GAP } : null, style]}
      testID={testID}
      {...rest}
    >
      <TabRow
        items={items}
        activeKey={activeKey}
        onSelect={onSelect}
        lockedLabel={lockedLabel}
        badgeLabel={badgeLabel}
        testID={testID}
      />
    </GlassPanel>
  );
}
