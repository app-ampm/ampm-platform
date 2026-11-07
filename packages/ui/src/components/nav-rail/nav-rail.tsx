import type { ReactNode } from "react";
import { ScrollView, View, type ViewProps } from "react-native";

import { uiCopy } from "../../copy";
import { cn } from "../../lib/cn";
import { GlassPanel } from "../glass-panel";
import { NavRailEntry, NavRailToggle, type NavRailItem } from "./nav-rail-item";
import { navRailFooterStyles, navRailHeaderStyles, navRailStyles } from "./nav-rail.styles";

export interface NavRailProps extends Omit<ViewProps, "children"> {
  /** The areas the person's role grants (packages/policy decides; the server still refuses the rest). */
  readonly items: ReadonlyArray<NavRailItem>;
  /** The key of the area whose screen is showing. */
  readonly activeKey: string;
  /** Called with the pressed area's key; the app navigates. */
  readonly onSelect: (key: string) => void;
  /** Above the areas: the AMPM wordmark (pass a compact mark when collapsed). */
  readonly header?: ReactNode;
  /** Below the areas, over a pearl rule: the signed-in person and sign-out. */
  readonly footer?: ReactNode;
  /** Icons only, 80 wide: the admin workspace between 768 and 1199 (the app decides, from useBreakpoint). */
  readonly collapsed?: boolean | undefined;
  /** Shows the collapse toggle; called when it is pressed. */
  readonly onToggleCollapsed?: (() => void) | undefined;
  /** Names the navigation landmark; defaults to "Workspace navigation". */
  readonly accessibilityLabel?: string | undefined;
  /** The toggle's spoken labels; default "Collapse navigation" and "Expand navigation". */
  readonly collapseLabel?: string | undefined;
  readonly expandLabel?: string | undefined;
  /** What a count sounds like after the area's label; defaults to "2 waiting". */
  readonly badgeLabel?: ((count: number) => string) | undefined;
  readonly className?: string;
}

function spokenLabel(item: NavRailItem, badgeLabel: (count: number) => string): string {
  const parts = [item.label];
  if (item.count !== undefined) parts.push(String(item.count));
  if (item.badge !== undefined && item.badge > 0) parts.push(badgeLabel(item.badge));
  return parts.join(", ");
}

function part(testID: string | undefined, name: string): string | undefined {
  return testID ? `${testID}-${name}` : undefined;
}

interface AreaListProps {
  readonly items: ReadonlyArray<NavRailItem>;
  readonly activeKey: string;
  readonly onSelect: (key: string) => void;
  readonly collapsed: boolean;
  readonly badgeLabel: (count: number) => string;
  readonly testID: string | undefined;
}

/**
 * The areas. The list grows to push the footer down in a full-height rail, shrinks and scrolls when
 * space runs out, and takes its content's height when the parent has none (flex-1 would collapse it).
 */
function AreaList({ items, activeKey, onSelect, collapsed, badgeLabel, testID }: AreaListProps) {
  return (
    <ScrollView className="shrink grow" contentContainerClassName="gap-0.5">
      {items.map((item) => (
        <NavRailEntry
          key={item.key}
          item={item}
          active={item.key === activeKey}
          collapsed={collapsed}
          spoken={spokenLabel(item, badgeLabel)}
          onSelect={onSelect}
          testID={part(testID, item.key)}
        />
      ))}
    </ScrollView>
  );
}

interface RailEndProps {
  readonly collapsed: boolean;
  readonly footer: ReactNode;
  readonly onToggleCollapsed: (() => void) | undefined;
  readonly collapseLabel: string;
  readonly expandLabel: string;
  readonly testID: string | undefined;
}

/** The collapse toggle (when the app handles it) and the footer over its pearl rule. */
function RailEnd({
  collapsed,
  footer,
  onToggleCollapsed,
  collapseLabel,
  expandLabel,
  testID,
}: RailEndProps) {
  return (
    <>
      {onToggleCollapsed ? (
        <NavRailToggle
          collapsed={collapsed}
          label={collapsed ? expandLabel : collapseLabel}
          onPress={onToggleCollapsed}
          testID={part(testID, "toggle")}
        />
      ) : null}
      {footer ? <View className={navRailFooterStyles({ collapsed })}>{footer}</View> : null}
    </>
  );
}

/**
 * The admin workspace's left rail: base glass, 232 wide, the wordmark on top, one pill per area (the
 * active one peacock with midnight text), and the signed-in person at the foot. Presentational: the
 * app passes the areas the role grants and navigates in `onSelect`. Collapsed it shows icons only;
 * the labels stay as each button's spoken name.
 *
 *   <NavRail
 *     header={<Text variant="wordmark">AMPM</Text>}
 *     items={[
 *       { key: "home", label: "Home", icon: "home" },
 *       { key: "leads", label: "Leads & Clients", icon: "users", count: 24 },
 *       { key: "tasks", label: "Tasks & Operations", icon: "list-checks", badge: 3 },
 *     ]}
 *     activeKey="home"
 *     onSelect={(key) => router.navigate(AREA_ROUTES[key])}
 *     collapsed={!isDesktop}
 *     footer={<SignedInPerson … />}
 *   />
 */
export function NavRail({
  items,
  activeKey,
  onSelect,
  header,
  footer,
  collapsed = false,
  onToggleCollapsed,
  accessibilityLabel = uiCopy.navRail.label,
  collapseLabel = uiCopy.navRail.collapse,
  expandLabel = uiCopy.navRail.expand,
  badgeLabel = uiCopy.navRail.badge,
  className,
  testID,
  ...rest
}: NavRailProps) {
  const list = { items, activeKey, onSelect, collapsed, badgeLabel, testID };
  const end = { collapsed, footer, onToggleCollapsed, collapseLabel, expandLabel, testID };
  return (
    <GlassPanel
      role="navigation"
      accessibilityLabel={accessibilityLabel}
      className={cn(navRailStyles({ collapsed }), className)}
      testID={testID}
      {...rest}
    >
      {header ? <View className={navRailHeaderStyles({ collapsed })}>{header}</View> : null}
      <AreaList {...list} />
      <RailEnd {...end} />
    </GlassPanel>
  );
}
