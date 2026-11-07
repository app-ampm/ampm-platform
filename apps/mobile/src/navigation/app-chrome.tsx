import { usePathname } from "expo-router";
import { useMemo, type ReactNode } from "react";
import { View } from "react-native";
import {
  SafeAreaInsetsContext,
  useSafeAreaInsets,
  type EdgeInsets,
} from "react-native-safe-area-context";

import { useMe } from "@ampm/api-client";

import { chromeAudience } from "./chrome-audience";
import { ClientTopNav } from "./client-top-nav";
import type { Audience } from "./routes";
import { StaffRail } from "./staff-rail";
import { useWindowClass } from "./use-window-class";

interface ScreenInsetsProps {
  readonly audience: Audience | null;
  readonly children: ReactNode;
}

/**
 * The safe-area edges the chrome already keeps clear are not kept clear again by the screens: the
 * rail sits along the left edge, the top navigation along the top. Always rendered, so the stack
 * keeps its place in the tree (and its screens their state) when the chrome comes and goes.
 */
function ScreenInsets({ audience, children }: ScreenInsetsProps) {
  const insets = useSafeAreaInsets();
  const value = useMemo<EdgeInsets>(
    () => ({
      ...insets,
      left: audience === "staff" ? 0 : insets.left,
      top: audience === "client" ? 0 : insets.top,
    }),
    [insets, audience],
  );
  return <SafeAreaInsetsContext.Provider value={value}>{children}</SafeAreaInsetsContext.Provider>;
}

/**
 * The navigation around the screens on windows 768 and wider (docs/design/peacock-night.md §7):
 * staff get the rail beside the stack (collapsed below 1200), clients the portal's top navigation
 * above it. Only signed in, on the routes of the person's audience; never on sign-in, the gallery or
 * the entry redirect. Phones get the tab bar from the screens instead. Colours come from classes, so
 * the web export decides none in JavaScript before hydration.
 *
 *   <AppChrome><Stack screenOptions={…} /></AppChrome>
 */
export function AppChrome({ children }: { readonly children: ReactNode }) {
  const me = useMe();
  const pathname = usePathname();
  const { isWide, isRailExpanded } = useWindowClass();
  const audience = isWide && me.data ? chromeAudience(pathname, me.data.principal.type) : null;
  return (
    <View className="flex-1 flex-row bg-surface">
      {audience === "staff" && me.data ? (
        <StaffRail me={me.data} pathname={pathname} collapsed={!isRailExpanded} />
      ) : null}
      <View className="flex-1">
        {audience === "client" && me.data ? (
          <ClientTopNav me={me.data} pathname={pathname} />
        ) : null}
        <ScreenInsets audience={audience}>{children}</ScreenInsets>
      </View>
    </View>
  );
}
