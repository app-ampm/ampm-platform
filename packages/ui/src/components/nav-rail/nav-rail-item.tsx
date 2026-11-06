import { Pressable, View } from "react-native";

import { Badge } from "../badge";
import { Icon, type IconName } from "../icon";
import { Text } from "../text";
import {
  navRailCollapsedBadgeStyles,
  navRailItemStyles,
  navRailToggleStyles,
} from "./nav-rail.styles";

export interface NavRailItem {
  /** Stable identity, handed back to `onSelect`. */
  readonly key: string;
  readonly label: string;
  /** Always given: the collapsed rail shows icons only. */
  readonly icon: IconName;
  /** A needs-you count in a gold Badge ("Approvals 2"); keep gold for what needs the person. */
  readonly badge?: number | undefined;
  /** A quiet total at the end of the row, as the T artboards draw it ("Hotels 200"); hidden when collapsed. */
  readonly count?: number | undefined;
}

export interface NavRailEntryProps {
  readonly item: NavRailItem;
  readonly active: boolean;
  readonly collapsed: boolean;
  readonly spoken: string;
  readonly onSelect: (key: string) => void;
  readonly testID: string | undefined;
}

function hasBadge(item: NavRailItem): boolean {
  return item.badge !== undefined && item.badge > 0;
}

/** The Badge for the eye only: the item's spoken label already says the count. */
function DrawnBadge({ count, className }: { count: number | undefined; className: string }) {
  return (
    <View
      className={className}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    >
      <Badge count={count} />
    </View>
  );
}

function CollapsedIcon({ item, active }: { item: NavRailItem; active: boolean }) {
  return (
    <View className="relative">
      <Icon name={item.icon} size="md" tone={active ? "onHighlight" : "body"} />
      {/* Absolute: the count rides the icon's corner inside the 44 circle. */}
      {hasBadge(item) ? (
        <DrawnBadge count={item.badge} className={navRailCollapsedBadgeStyles} />
      ) : null}
    </View>
  );
}

function ExpandedContent({ item, active }: { item: NavRailItem; active: boolean }) {
  return (
    <>
      <Icon name={item.icon} size="sm" tone={active ? "onHighlight" : "body"} />
      <Text
        variant="label"
        tone={active ? "onHighlight" : "body"}
        numberOfLines={1}
        className="flex-1"
      >
        {item.label}
      </Text>
      {item.count !== undefined ? (
        <Text variant="caption" tone={active ? "onHighlight" : "muted"} className="tabular-nums">
          {String(item.count)}
        </Text>
      ) : null}
      {hasBadge(item) ? <DrawnBadge count={item.badge} className="self-center" /> : null}
    </>
  );
}

/**
 * One area of the NavRail: a button read as its label plus any count, the current one marked for
 * screen readers (selected on iOS and Android; aria-current="page" on the web, where
 * react-native-web drops accessibilityState and navigation marks the current item that way). The
 * Badge and count inside are drawn for the eye; the spoken label carries them. Internal to the NavRail.
 */
export function NavRailEntry({
  item,
  active,
  collapsed,
  spoken,
  onSelect,
  testID,
}: NavRailEntryProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityState={{ selected: active }}
      {...(active ? { "aria-current": "page" as const } : {})}
      onPress={() => onSelect(item.key)}
      className={navRailItemStyles({ active, collapsed })}
      testID={testID}
    >
      {collapsed ? (
        <CollapsedIcon item={item} active={active} />
      ) : (
        <ExpandedContent item={item} active={active} />
      )}
    </Pressable>
  );
}

export interface NavRailToggleProps {
  readonly collapsed: boolean;
  readonly label: string;
  readonly onPress: () => void;
  readonly testID: string | undefined;
}

/**
 * Collapses the rail to icons or expands it again; says which, and whether the rail is expanded
 * (aria-expanded, which React Native maps to the native state and react-native-web writes).
 */
export function NavRailToggle({ collapsed, label, onPress, testID }: NavRailToggleProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-expanded={!collapsed}
      onPress={onPress}
      className={navRailToggleStyles({ collapsed })}
      testID={testID}
    >
      <Icon name={collapsed ? "chevron-right" : "chevron-left"} size="md" tone="muted" />
    </Pressable>
  );
}
