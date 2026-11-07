import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { MeResponse } from "@ampm/core";
import { STAFF_ROLES } from "@ampm/policy";
import { Avatar, Button, NavRail, Row, Stack, Text } from "@ampm/ui";

import { useSignOut } from "./sign-out";
import { activeStaffArea, staffAreasFor } from "./staff-areas";
import { useAreaNavigation } from "./use-area-navigation";

export interface StaffRailProps {
  readonly me: MeResponse;
  readonly pathname: string;
  /** Icons only: windows from 768 to 1199. */
  readonly collapsed: boolean;
}

interface PersonProps {
  readonly me: MeResponse;
  readonly collapsed: boolean;
}

/** The signed-in person at the foot of the rail, with sign-out; collapsed, the avatar and an icon. */
function RailPerson({ me, collapsed }: PersonProps) {
  const signOut = useSignOut();
  const { name } = me.principal;
  if (collapsed) {
    return (
      <Stack gap={2} align="center">
        <Avatar name={name} size="sm" tone="highlight" />
        <Button variant="ghost" icon="log-out" accessibilityLabel="Sign out" onPress={signOut} />
      </Stack>
    );
  }
  const roles = me.roles.map((role) => STAFF_ROLES[role].name).join(", ");
  return (
    <Stack gap={2}>
      <Row gap={2.5}>
        <Avatar name={name} size="sm" tone="highlight" />
        <Stack gap={0} className="min-w-0 flex-1">
          <Text variant="label" numberOfLines={1}>
            {name}
          </Text>
          {roles ? (
            <Text variant="caption" numberOfLines={2}>
              {roles}
            </Text>
          ) : null}
        </Stack>
      </Row>
      <Button variant="ghost" size="sm" icon="log-out" onPress={signOut}>
        Sign out
      </Button>
    </Stack>
  );
}

/**
 * The admin workspace's rail on windows 768 and wider (T artboards): the wordmark, the areas the
 * person's roles grant (packages/policy; the server still refuses the rest), the area showing in
 * peacock, and the person with sign-out at the foot. It runs the window's height, clear of the
 * status bar, the home indicator and a landscape notch.
 */
export function StaffRail({ me, pathname, collapsed }: StaffRailProps) {
  const insets = useSafeAreaInsets();
  const { open } = useAreaNavigation();
  const areas = staffAreasFor(me);
  const select = (key: string) => {
    const area = areas.find((candidate) => candidate.key === key);
    if (area) open(area.href);
  };
  return (
    <View
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left }}
    >
      <NavRail
        items={areas.map(({ key, label, icon }) => ({ key, label, icon }))}
        activeKey={activeStaffArea(pathname)?.key ?? ""}
        onSelect={select}
        collapsed={collapsed}
        header={
          <Text variant="wordmark" accessibilityLabel="AMPM">
            {collapsed ? "A" : "AMPM"}
          </Text>
        }
        footer={<RailPerson me={me} collapsed={collapsed} />}
        className="flex-1"
        testID="staff-rail"
      />
    </View>
  );
}
