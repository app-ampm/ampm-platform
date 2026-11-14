// Mobile component/screen tests on the same jest-expo native renderer packages/ui uses (ui.md:
// behaviour and states, no snapshots). React Native Testing Library drives host components, not the
// DOM; the react-native-web side is exercised later by Playwright on the Expo web export.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/**
 * The preset's Babel transform with the React Compiler on, for the code the app ships compiled.
 * app.json turns the compiler on (experiments.reactCompiler), and Expo's Metro transformer then asks
 * babel-preset-expo for it on every file outside node_modules: the app, and the workspace packages,
 * which resolve to their real paths. jest-expo's own transform never asks, so without this the tests
 * would run code that does not ship (a value read during render that the compiled component keeps
 * from its first render, say). node_modules keeps the preset's entry, as in Metro.
 */
function metroCompiledTransform() {
  const preset = require("jest-expo/ios/jest-preset");
  const entry = Object.values(preset.transform).find(
    (candidate) => Array.isArray(candidate) && String(candidate[0]).includes("babel-jest"),
  );
  if (!entry) throw new Error("jest-expo/ios no longer transforms through babel-jest");
  const [transformer, options] = entry;
  return [transformer, { ...options, caller: { ...options.caller, supportsReactCompiler: true } }];
}

/** @type {import("jest").Config} */
export default {
  preset: "jest-expo/ios",
  // First, so it wins over the preset's own entry for every file outside node_modules.
  transform: { "^(?!.*/node_modules/).+\\.[jt]sx?$": metroCompiledTransform() },
  // jest-expo's native renderer warms up inside the first test; on a cold CI runner that can push an
  // otherwise-sub-second test past Jest's 5s default. A higher ceiling absorbs the warmup without
  // masking a genuinely slow test.
  testTimeout: 15000,
  rootDir: ".",
  testMatch: ["<rootDir>/src/**/*.test.{ts,tsx}"],
  setupFiles: ["<rootDir>/jest.setup.cjs"],
  // Testing Library's async wait limit (findBy*, waitFor): set after the framework, see the file.
  setupFilesAfterEnv: ["<rootDir>/jest.after-env.cjs"],
  moduleNameMapper: {
    // The app's `@/` path alias (tsconfig paths), so a screen under test resolves its own imports.
    "^@/assets/(.*)$": "<rootDir>/assets/$1",
    "^@/(.*)$": "<rootDir>/src/$1",
    // Lucide's `react-native` export condition points at its ESM build; Jest takes the CommonJS one.
    "^lucide-react-native$":
      "<rootDir>/../../node_modules/lucide-react-native/dist/cjs/lucide-react-native.js",
  },
};
