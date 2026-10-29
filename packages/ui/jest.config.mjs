// Component tests run on the native renderer (jest-expo/ios). React Native Testing Library drives host
// components, not the DOM, so the react-native-web side is checked in the gallery and, later, by
// Playwright on the Expo web export (ui.md: behaviour and states, no snapshots).
/** @type {import("jest").Config} */
export default {
  preset: "jest-expo/ios",
  // jest-expo's native renderer warms up inside the first test; on a cold CI runner that can push an
  // otherwise-sub-second test past Jest's 5s default (seen on @ampm/ui input.test.tsx). A higher ceiling
  // absorbs the warmup without masking a genuinely slow test.
  testTimeout: 15000,
  rootDir: ".",
  testMatch: ["<rootDir>/src/**/*.test.{ts,tsx}"],
  setupFiles: ["<rootDir>/jest.setup.cjs"],
  moduleNameMapper: {
    // Lucide's `react-native` export condition points at its ESM build; Jest takes the CommonJS one instead.
    "^lucide-react-native$":
      "<rootDir>/../../node_modules/lucide-react-native/dist/cjs/lucide-react-native.js",
  },
};
