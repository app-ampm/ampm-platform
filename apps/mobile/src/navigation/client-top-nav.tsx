import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { MeResponse } from "@ampm/core";
import {
  Avatar,
  GlassPanel,
  Icon,
  Row,
  Text,
  cn,
  focusRingStyles,
  navRailItemStyles,
  tabBarLockedText,
  uiCopy,
} from "@ampm/ui";

import { activeClientArea, CLIENT_AREAS, type ClientArea } from "./client-areas";
import { useAreaNavigation } from "./use-area-navigation";

/** The portal's areas in the bar; More is the person's avatar at the end. */
const NAV_AREAS = CLIENT_AREAS.filter((area) => area.key !== "more");

const current = (active: boolean) => (active ? { "aria-current": "page" as const } : {});

interface NavItemProps {
  readonly area: ClientArea;
  readonly active: boolean;
  readonly onPress: () => void;
}

/** One area: a pill, peacock while its screen shows; a locked area is pearl 32% with a lock. */
function NavItem({ area, active, onPress }: NavItemProps) {
  const locked = area.href === null;
  const tone = active ? "onHighlight" : locked ? "inherit" : "body";
  return (
    <Pressable
      accessibilityRole={locked ? "button" : "link"}
      accessibilityLabel={locked ? `${area.label}, ${uiCopy.tabBar.locked}` : area.label}
      accessibilityState={{ selected: active }}
      {...current(active)}
      onPress={onPress}
      className={cn(navRailItemStyles({ active }), "gap-2 px-4.5")}
      testID={`client-top-nav-${area.key}`}
    >
      <Text variant="label" tone={tone} className={cn(locked && !active && tabBarLockedText)}>
        {area.label}
      </Text>
      {locked ? <Icon name="lock" size="sm" tone="primary" className="opacity-32" /> : null}
    </Pressable>
  );
}

interface AccountLinkProps {
  readonly name: string;
  readonly active: boolean;
  readonly onPress: () => void;
}

/** The person's avatar, opening their account (More on a phone). */
function AccountLink({ name, active, onPress }: AccountLinkProps) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Account, ${name}`}
      {...current(active)}
      onPress={onPress}
      className={cn(
        "h-touch w-touch items-center justify-center rounded-full border border-transparent",
        focusRingStyles,
      )}
      testID="client-top-nav-account"
    >
      {/* The link already says whose account it is. */}
      <Avatar
        name={name}
        tone="highlight"
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </Pressable>
  );
}

export interface ClientTopNavProps {
  /** Not there yet while `/me` loads: the bar keeps the avatar's place until it answers. */
  readonly me: MeResponse | undefined;
  readonly pathname: string;
}

/**
 * The client portal's navigation on windows 768 and wider (D4, D5): a glass pill bar with the
 * wordmark, Home and Hotels, My Wedding and Approvals locked until AMPM is appointed (a toast says
 * so), and the person's avatar opening their account. It sits above the screens, clear of the
 * status bar and the notch.
 */
export function ClientTopNav({ me, pathname }: ClientTopNavProps) {
  const insets = useSafeAreaInsets();
  const { open, explainLock } = useAreaNavigation();
  const active = activeClientArea(pathname)?.key;
  return (
    <View style={{ paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }}>
      {/* On windows wider than the mocks the bar keeps the 1440 frame, centred like the pages. */}
      <View className="w-full max-w-frame self-center">
        <GlassPanel
          role="navigation"
          accessibilityLabel="Portal navigation"
          className="mx-8 mt-5 flex-row items-center justify-between gap-4 rounded-full py-2.5 pl-6.5 pr-2.5"
          testID="client-top-nav"
        >
          <Text variant="wordmark">AMPM</Text>
          <Row gap={1}>
            {NAV_AREAS.map((area) => (
              <NavItem
                key={area.key}
                area={area}
                active={area.key === active}
                onPress={() => (area.href ? open(area.href) : explainLock())}
              />
            ))}
          </Row>
          {me ? (
            <AccountLink
              name={me.principal.name}
              active={active === "more"}
              onPress={() => open("/account")}
            />
          ) : (
            <View className="h-touch w-touch" />
          )}
        </GlassPanel>
      </View>
    </View>
  );
}
