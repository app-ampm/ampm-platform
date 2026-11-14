import { usePathname } from "expo-router";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import {
  SafeAreaInsetsContext,
  useSafeAreaInsets,
  type EdgeInsets,
} from "react-native-safe-area-context";

import { useMe } from "@ampm/api-client";
import { sizes, spacingPx } from "@ampm/tokens";
import { ScreenFrameProvider, type ScreenFrame } from "@ampm/ui";

import { useIsSignedIn } from "@/lib/session";

import { chromeAudience, isAudienceRoute, routeAudience } from "./chrome-audience";
import { ClientTopNav } from "./client-top-nav";
import type { Audience } from "./routes";
import { StaffRail } from "./staff-rail";
import { useWindowClass } from "./use-window-class";

const remPx = (rem: string) => Number.parseFloat(rem) * 16;

/** The rail's room before it is measured: 16 from the edge, then the rail (232, or 80 folded). */
const railRoom = (collapsed: boolean) =>
  spacingPx["4"] + (collapsed ? spacingPx["20"] : remPx(sizes.rail));

/** The top navigation's room before it is measured: 20 above the bar, its 10 + 10 and a 44 target. */
const TOP_NAV_ROOM = spacingPx["5"] + 2 * spacingPx["2.5"] + remPx(sizes.touch);

const FRAME: Record<Audience, ScreenFrame> = { staff: "rail", client: "topNav" };

interface ScreenInsetsProps {
  readonly audience: Audience | null;
  /** What the navigation floating over the screens takes: the rail's width, the bar's height. */
  readonly navRoom: number;
  readonly children: ReactNode;
}

/**
 * The navigation floats over the screens, so a screen's canvas and glow run under the glass (D4, T2)
 * while its content keeps clear of it: the rail's width is the screens' left inset, the bar's height
 * their top one; each already holds the device's inset on that side. Always rendered, so the stack
 * keeps its place in the tree (and its screens their state) when the chrome comes and goes.
 */
function ScreenInsets({ audience, navRoom, children }: ScreenInsetsProps) {
  const insets = useSafeAreaInsets();
  const value = useMemo<EdgeInsets>(
    () => ({
      ...insets,
      left: audience === "staff" ? navRoom : insets.left,
      top: audience === "client" ? navRoom : insets.top,
    }),
    [insets, audience, navRoom],
  );
  return <SafeAreaInsetsContext.Provider value={value}>{children}</SafeAreaInsetsContext.Provider>;
}

/**
 * Which navigation the window draws: from `/me` once it answers; before that, the frame of the one
 * audience whose routes hold the path, so the bar or the rail is there from the first paint and the
 * screens never shift when `/me` arrives. None on a phone, without a session, or where it fails.
 */
function useChromeAudience(hasSession: boolean, pathname: string, isWide: boolean) {
  const asks = hasSession && isWide && isAudienceRoute(pathname);
  const me = useMe({ enabled: asks });
  if (!isWide) return { audience: null, me: undefined };
  if (me.data) return { audience: chromeAudience(pathname, me.data.principal.type), me: me.data };
  return { audience: asks && me.isPending ? routeAudience(pathname) : null, me: undefined };
}

/** The room the floating navigation takes, measured once drawn and estimated from the tokens before. */
function useNavRoom(audience: Audience | null, collapsed: boolean) {
  const insets = useSafeAreaInsets();
  const [measured, setMeasured] = useState<{ audience: Audience; room: number } | null>(null);
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (!audience) return;
      const { width, height } = event.nativeEvent.layout;
      setMeasured({ audience, room: audience === "staff" ? width : height });
    },
    [audience],
  );
  const estimate =
    audience === "staff" ? insets.left + railRoom(collapsed) : insets.top + TOP_NAV_ROOM;
  const room = measured && measured.audience === audience ? measured.room : estimate;
  return { room, onLayout };
}

/**
 * The navigation around the screens on windows 768 and wider (docs/design/peacock-night.md §7):
 * staff get the rail along the left (collapsed below 1200), clients the portal's top navigation. Only
 * signed in, on the routes of the person's audience; never on sign-in, the gallery or the entry
 * redirect. Phones get the tab bar from the screens instead. The navigation floats over the screens
 * (`ScreenInsets` keeps their content clear of it) and names its frame to them, so `Screen`'s `wide`
 * and `split` pages take the artboards' gutters. Colours come from classes, so the web export decides
 * none in JavaScript before hydration.
 *
 * `/me` is asked only where the chrome can draw: with a session, on a window 768 or wider, on a
 * workspace or portal route. The chrome stays mounted on sign-in, where the question could only be
 * refused (the entry route sends a person there with a refused token still held), and refused again
 * on every window focus; on a phone, the gallery or the entry redirect the answer would go unused.
 * Signing in or out renders the chrome again (`useIsSignedIn`), and so does each navigation.
 *
 *   <AppChrome><Stack screenOptions={…} /></AppChrome>
 */
export function AppChrome({ children }: { readonly children: ReactNode }) {
  const hasSession = useIsSignedIn();
  const pathname = usePathname();
  const { isWide, isRailExpanded } = useWindowClass();
  const { audience, me } = useChromeAudience(hasSession, pathname, isWide);
  const nav = useNavRoom(audience, !isRailExpanded);
  return (
    <View className="flex-1 bg-surface">
      <ScreenFrameProvider frame={audience ? FRAME[audience] : "none"}>
        <ScreenInsets audience={audience} navRoom={nav.room}>
          {children}
        </ScreenInsets>
      </ScreenFrameProvider>
      {/* Absolute: the rail and the bar float over the screens, whose glow shows through their glass. */}
      {audience === "staff" ? (
        <View className="absolute bottom-0 left-0 top-0" onLayout={nav.onLayout}>
          <StaffRail me={me} pathname={pathname} collapsed={!isRailExpanded} />
        </View>
      ) : null}
      {audience === "client" ? (
        <View className="absolute left-0 right-0 top-0" onLayout={nav.onLayout}>
          <ClientTopNav me={me} pathname={pathname} />
        </View>
      ) : null}
    </View>
  );
}
