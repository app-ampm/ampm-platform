/** @type {import("tailwindcss").Config} */
module.exports = {
  // NativeWind's preset first (React Native specifics), then AMPM's tokens: theme values live only there.
  presets: [require("nativewind/preset"), require("@ampm/tokens/tailwind.preset")],
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
};
