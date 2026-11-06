// Safe-area insets without a native host; the mock reports zero insets and a phone-sized frame.
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);

// css-interop registers no component under test (react-native-css-interop wrap-jsx), so a className
// stays a prop the tests can read. The library's Animated.View registration (src/lib/animated-view.ts)
// is skipped the same way.
jest.mock("./src/lib/animated-view", () => ({
  AnimatedView: require("react-native").Animated.View,
}));
