import { cssInterop } from "nativewind";
import { Animated } from "react-native";

// NativeWind registers the React Native primitives only. Without this, the classes on an
// Animated.View are dropped on the web (react-native-web renders it straight to a div): the TabBar's
// sliding pill lost its peacock fill and its absolute position, and the Skeleton shimmer and the Toast
// frame lost theirs.
cssInterop(Animated.View, { className: "style" });

/**
 * Animated.View that takes `className` like View does. Use it whenever an animated view carries
 * classes; the animated values stay in `style`.
 *
 *   <AnimatedView className="absolute inset-0 bg-primary/5" style={{ opacity }} />
 */
export const AnimatedView: typeof Animated.View = Animated.View;
