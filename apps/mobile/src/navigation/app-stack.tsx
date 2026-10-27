import { Stack } from "expo-router";

import { colors } from "@ampm/tokens";
import { useTheme } from "@ampm/ui";

/** Native: the screen container takes the surface colour of the current scheme from the tokens. */
export function AppStack() {
  const { resolved } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface[resolved] },
      }}
    />
  );
}
