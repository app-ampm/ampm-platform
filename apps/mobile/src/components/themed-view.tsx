import { View, type ViewProps } from "react-native";

import { type ThemeColor } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  type?: ThemeColor;
};

// Expo's template accepts lightColor and darkColor but never reads them; they are kept out of the
// View props until bootstrap step 4 replaces this component with packages/ui.
export function ThemedView({
  style,
  lightColor: _lightColor,
  darkColor: _darkColor,
  type,
  ...otherProps
}: ThemedViewProps) {
  const theme = useTheme();

  return <View style={[{ backgroundColor: theme[type ?? "background"] }, style]} {...otherProps} />;
}
