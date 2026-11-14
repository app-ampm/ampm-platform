// Two projects. `native` runs every component test on the native renderer (jest-expo/ios): React Native
// Testing Library drives host components (ui.md: behaviour and states, no snapshots). `web` renders the
// `*.web.test.tsx` files through react-native-web into jsdom, for what only the browser sees: the ARIA
// attributes react-native-web writes (it drops accessibilityState and accessibilityValue), keyboard
// handling and the web's live region. Playwright on the Expo web export covers whole flows later.

// Lucide's `react-native` export condition points at its ESM build; Jest takes the CommonJS one instead.
const lucide = "<rootDir>/../../node_modules/lucide-react-native/dist/cjs/lucide-react-native.js";

/** @type {import("jest").Config} */
export default {
  // jest-expo's native renderer warms up inside the first test; on a cold CI runner that can push an
  // otherwise-sub-second test past Jest's 5s default (seen on @ampm/ui input.test.tsx). A higher ceiling
  // absorbs the warmup without masking a genuinely slow test.
  testTimeout: 15000,
  projects: [
    {
      displayName: "native",
      preset: "jest-expo/ios",
      rootDir: ".",
      testMatch: ["<rootDir>/src/**/*.test.{ts,tsx}"],
      testPathIgnorePatterns: ["/node_modules/", "\\.web\\.test\\.tsx?$"],
      setupFiles: ["<rootDir>/jest.setup.cjs"],
      // Testing Library's async wait limit (findBy*, waitFor): set after the framework, see the file.
      setupFilesAfterEnv: ["<rootDir>/jest.after-env.cjs"],
      moduleNameMapper: { "^lucide-react-native$": lucide },
    },
    {
      displayName: "web",
      preset: "jest-expo/web",
      rootDir: ".",
      testMatch: ["<rootDir>/src/**/*.web.test.{ts,tsx}"],
      setupFiles: ["<rootDir>/jest.setup.cjs"],
      moduleNameMapper: {
        // First, so it wins over the preset's own `^react-native($|/.*)` mapping to React Native.
        "^react-native$": "react-native-web",
        // React Native 0.87 dropped this module; Expo's Metro sends it to react-native-web's registry
        // on the web (expo/cli withMetroMultiPlatform), and react-native-svg's web build imports it.
        "^@react-native/assets-registry/registry(\\.js)?$": "react-native-web/asset-registry",
        "^lucide-react-native$": lucide,
      },
    },
  ],
};
