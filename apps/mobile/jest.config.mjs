// Mobile component/screen tests on the same jest-expo native renderer packages/ui uses (ui.md:
// behaviour and states, no snapshots). React Native Testing Library drives host components, not the
// DOM; the react-native-web side is exercised later by Playwright on the Expo web export.
/** @type {import("jest").Config} */
export default {
  preset: "jest-expo/ios",
  // jest-expo's native renderer warms up inside the first test; on a cold CI runner that can push an
  // otherwise-sub-second test past Jest's 5s default. A higher ceiling absorbs the warmup without
  // masking a genuinely slow test.
  testTimeout: 15000,
  rootDir: ".",
  testMatch: ["<rootDir>/src/**/*.test.{ts,tsx}"],
  setupFiles: ["<rootDir>/jest.setup.cjs"],
  moduleNameMapper: {
    // The app's `@/` path alias (tsconfig paths), so a screen under test resolves its own imports.
    "^@/assets/(.*)$": "<rootDir>/assets/$1",
    "^@/(.*)$": "<rootDir>/src/$1",
    // Lucide's `react-native` export condition points at its ESM build; Jest takes the CommonJS one.
    "^lucide-react-native$":
      "<rootDir>/../../node_modules/lucide-react-native/dist/cjs/lucide-react-native.js",
  },
};
