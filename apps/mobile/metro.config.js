const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

// Expo's default config already handles the pnpm monorepo (workspace root watched, hoisted node_modules).
const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
  input: "./src/global.css",
  // Tokens are in rem on a 16px base; NativeWind would inline rem at 14 on native, which breaks the
  // 4px scale (`p-4` would be 14, not 16). 16 keeps web and native identical.
  inlineRem: 16,
});
