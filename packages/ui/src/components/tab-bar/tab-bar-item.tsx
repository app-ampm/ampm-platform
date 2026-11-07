import type { ReactNode } from "react";
import { Pressable, View, type LayoutChangeEvent } from "react-native";

import { cn } from "../../lib/cn";
import { spacePress } from "../../lib/space-press";
import { Badge } from "../badge";
import { Icon, type IconName } from "../icon";
import { Text } from "../text";
import {
  tabBarItemStyles,
  tabBarLabelTone,
  tabBarLockMarkerStyles,
  tabBarLockedIcon,
  tabBarLockedText,
  tabBarMarkerStyles,
  type TabBarItemState,
} from "./tab-bar.styles";

export interface TabBarItem {
  /** Stable identity, handed back to `onSelect`. */
  readonly key: string;
  readonly label: string;
  /** Optional: the mocks show labels only; with icons, every tab gets the same icon row. */
  readonly icon?: IconName | undefined;
  /**
   * Shown but not open yet (My Wedding and Approvals until AMPM is appointed). Still pressable, so the
   * app can explain the lock; screen readers hear "locked".
   */
  readonly locked?: boolean | undefined;
  /** A needs-you count, drawn as a gold Badge on the tab's corner ("Approvals 2"). */
  readonly badge?: number | undefined;
}

export interface TabBarTabProps {
  readonly item: TabBarItem;
  readonly active: boolean;
  /** Paint the peacock pill on the tab itself (before the sliding pill is ready). */
  readonly filled: boolean;
  /** Five or more tabs: 11px labels, so "Approvals" fits a 360-wide phone. */
  readonly compact: boolean;
  /** Whether the bar has an icon row (any tab has an icon). */
  readonly withIcons: boolean;
  readonly spoken: string;
  readonly onSelect: (key: string) => void;
  readonly onTabLayout: (key: string, event: LayoutChangeEvent) => void;
  readonly testID: string | undefined;
}

type MarkerPlace = keyof typeof tabBarMarkerStyles;

function Marked({
  at,
  marker,
  children,
}: {
  at: MarkerPlace;
  marker: ReactNode;
  children: ReactNode;
}) {
  return (
    <View className="relative">
      {children}
      {marker ? (
        // The tab's spoken label already carries the count or the lock. aria-hidden hides it on the
        // web too, which ignores the two native props.
        <View
          className={tabBarMarkerStyles[at]}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          aria-hidden
        >
          {marker}
        </View>
      ) : null}
    </View>
  );
}

function LockGlyph({ active, small }: { active: boolean; small: boolean }) {
  return (
    <Icon
      name="lock"
      size="sm"
      tone={active ? "onHighlight" : "primary"}
      className={cn(!active && tabBarLockedIcon, small && tabBarLockMarkerStyles)}
    />
  );
}

function stateOf(item: TabBarItem, active: boolean): TabBarItemState {
  if (active) return "active";
  return item.locked ? "locked" : "inactive";
}

function TabIcon({ item, active }: { item: TabBarItem; active: boolean }) {
  if (item.locked) return <LockGlyph active={active} small={false} />;
  if (!item.icon) return <View className="h-4 w-4" />;
  return <Icon name={item.icon} size="sm" tone={active ? "onHighlight" : "body"} />;
}

function TabLabel({
  item,
  active,
  compact,
}: {
  item: TabBarItem;
  active: boolean;
  compact: boolean;
}) {
  const state = stateOf(item, active);
  return (
    <Text
      variant={compact ? "caption" : "label"}
      weight={active ? "bold" : "medium"}
      tone={tabBarLabelTone[state]}
      className={cn(state === "locked" && tabBarLockedText)}
      numberOfLines={1}
      // Tab labels share a fixed bar: they scale with the system text size, but only so far.
      maxFontSizeMultiplier={1.3}
    >
      {item.label}
    </Text>
  );
}

/**
 * One tab of the TabBar: role tab with its selected state, the label (and icon), and a corner marker
 * for a count or a lock. The state is aria-selected, which React Native maps to the native state and
 * react-native-web writes for the browser (it drops accessibilityState); Space selects on the web as
 * Enter does. Internal to the TabBar.
 */
export function TabBarTab({
  item,
  active,
  filled,
  compact,
  withIcons,
  spoken,
  onSelect,
  onTabLayout,
  testID,
}: TabBarTabProps) {
  const count = !item.locked && item.badge !== undefined ? item.badge : 0;
  const badge = count > 0 ? <Badge count={count} /> : null;
  const lock = item.locked && !withIcons ? <LockGlyph active={active} small /> : null;
  const select = () => onSelect(item.key);
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={spoken}
      aria-selected={active}
      {...spacePress(select)}
      onPress={select}
      onLayout={(event) => onTabLayout(item.key, event)}
      className={tabBarItemStyles({ state: stateOf(item, active), filled })}
      testID={testID}
    >
      {withIcons ? (
        <Marked at="badgeOnIcon" marker={badge}>
          <TabIcon item={item} active={active} />
        </Marked>
      ) : null}
      <Marked
        at={lock ? "lockOnLabel" : "badgeOnLabel"}
        marker={withIcons ? null : (badge ?? lock)}
      >
        <TabLabel item={item} active={active} compact={compact} />
      </Marked>
    </Pressable>
  );
}
