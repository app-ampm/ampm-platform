import type { Config } from "tailwindcss";

import preset from "@ampm/tokens/tailwind.preset";

// Theme values live only in @ampm/tokens (styling.md): the preset plus content globs, nothing else.
export default {
  presets: [preset],
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
} satisfies Config;
