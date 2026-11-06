// Safe-area insets without a native host; the mock reports zero insets and a phone-sized frame.
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
