import { usePathname } from "expo-router";

import { useMe } from "@ampm/api-client";
import type { MeResponse } from "@ampm/core";
import { TabBar, type TabBarItem } from "@ampm/ui";

import { activeClientArea, CLIENT_AREAS } from "./client-areas";
import { audienceOf, isOnRoute } from "./routes";
import { activeStaffArea, staffAreasFor } from "./staff-areas";
import { useAreaNavigation } from "./use-area-navigation";
import { useWindowClass } from "./use-window-class";

const TEST_ID = "app-tab-bar";

const CLIENT_TABS: readonly TabBarItem[] = CLIENT_AREAS.map((area) => ({
  key: area.key,
  label: area.label,
  locked: area.href === null,
}));

interface StaffTabBarProps {
  readonly me: MeResponse;
  readonly pathname: string;
}

/** The team app's tabs: the areas the person's roles grant, under their short names (M artboards). */
function StaffTabBar({ me, pathname }: StaffTabBarProps) {
  const { open } = useAreaNavigation();
  const areas = staffAreasFor(me);
  const select = (key: string) => {
    const area = areas.find((candidate) => candidate.key === key);
    if (area) open(area.href);
  };
  return (
    <TabBar
      items={areas.map((area) => ({ key: area.key, label: area.tabLabel }))}
      activeKey={activeStaffArea(pathname)?.key ?? ""}
      onSelect={select}
      testID={TEST_ID}
    />
  );
}

/** The client app's tabs (P artboards); a locked tab explains itself instead of opening. */
function ClientTabBar({ pathname }: { readonly pathname: string }) {
  const { open, explainLock } = useAreaNavigation();
  const select = (key: string) => {
    const area = CLIENT_AREAS.find((candidate) => candidate.key === key);
    if (!area) return;
    if (area.href) open(area.href);
    else explainLock();
  };
  return (
    <TabBar
      items={CLIENT_TABS}
      activeKey={activeClientArea(pathname)?.key ?? ""}
      onSelect={select}
      testID={TEST_ID}
    />
  );
}

const FALLBACK_TABS: readonly TabBarItem[] = [{ key: "more", label: "More" }];

/**
 * When `/me` cannot be read, the person's areas are unknown and the layout draws no rail or top
 * navigation at any width, so the bar keeps one tab: More, the account screen, which retries `/me`
 * and keeps sign-out in reach. Without it a screen that still loads (a staff list) would be a dead end.
 */
function FallbackTabBar({ pathname }: { readonly pathname: string }) {
  const { open } = useAreaNavigation();
  return (
    <TabBar
      items={FALLBACK_TABS}
      activeKey={isOnRoute(pathname, "/account") ? "more" : ""}
      onSelect={() => open("/account")}
      testID={TEST_ID}
    />
  );
}

/**
 * The phone's tab bar for whoever is signed in. Route files hand it to their top-level screen
 * (`<HotelsScreen tabBar={<AppTabBar />} />`, which passes it to `Screen`): a client gets Home,
 * Hotels, My Wedding and Approvals (locked until AMPM is appointed) and More; a staff member the
 * areas their roles grant. The tab showing is read from the path. Nothing while /me loads; only More
 * when it fails (at any width); nothing on 768 and wider otherwise, where the layout draws the rail or
 * the top navigation instead.
 */
export function AppTabBar() {
  const me = useMe();
  const pathname = usePathname();
  const { isWide } = useWindowClass();
  if (!me.data) return me.isError ? <FallbackTabBar pathname={pathname} /> : null;
  if (isWide) return null;
  return audienceOf(me.data.principal.type) === "staff" ? (
    <StaffTabBar me={me.data} pathname={pathname} />
  ) : (
    <ClientTabBar pathname={pathname} />
  );
}
