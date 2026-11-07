import type { Config } from "tailwindcss";

import preset from "@ampm/tokens/tailwind.preset.web";

// Theme values live only in @ampm/tokens (styling.md): the site's preset plus content globs, nothing else.
export default {
  presets: [preset],
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
} satisfies Config;
