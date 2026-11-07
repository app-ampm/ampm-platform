import { Stack } from "expo-router";

import { colors } from "@ampm/tokens";
import { useTheme } from "@ampm/ui";

import { AppChrome } from "./app-chrome";

/**
 * Native: the screen container takes the surface colour of the current scheme from the tokens; on a
 * tablet the chrome (staff rail or client top navigation) sits around the stack.
 */
export function AppStack() {
  const { resolved } = useTheme();
  return (
    <AppChrome>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surface[resolved] },
        }}
      />
    </AppChrome>
  );
}
