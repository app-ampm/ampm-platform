// One formatter for the repository; the Tailwind plugin sorts class names (standards §2.3). The hook
// .claude/hooks/check-file.sh and lefthook run it on every file written or staged.
/** @type {import("prettier").Config} */
export default {
  printWidth: 100,
  singleQuote: false,
  trailingComma: "all",
  plugins: ["prettier-plugin-tailwindcss"],
  // Either app's config resolves to the same class set (the tokens preset); the mobile one also knows NativeWind's.
  tailwindConfig: "./apps/mobile/tailwind.config.js",
  tailwindFunctions: ["cn", "cva", "variants"],
  tailwindAttributes: ["className", "contentContainerClassName"],
};
