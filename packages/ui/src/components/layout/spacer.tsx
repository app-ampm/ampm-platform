import { View } from "react-native";

import { spacerClass, type Gap } from "./layout.styles";

export interface SpacerProps {
  /** A fixed step; without it the spacer takes the free space. */
  readonly size?: Exclude<Gap, 0> | undefined;
  readonly axis?: "vertical" | "horizontal" | undefined;
  readonly testID?: string | undefined;
}

/** Empty space: `<Spacer />` pushes siblings apart, `<Spacer size={4} />` is a fixed 16px step. */
export function Spacer({ size, axis = "vertical", testID }: SpacerProps) {
  return <View className={size ? spacerClass[size][axis] : "flex-1"} testID={testID} />;
}
