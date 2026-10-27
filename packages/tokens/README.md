# @ampm/tokens

The only place theme values exist (`.claude/rules/styling.md`). Plain TypeScript data in `src/`:
colours (light and dark), spacing, radii, type scale and fonts, shadows, motion, breakpoints,
stacking order.

```bash
pnpm tokens:build
```

writes `dist/` (not committed; `pnpm install` runs it through the root `prepare` script and Turborepo
runs it before any task that needs it):

- `tailwind.preset.cjs` — the Tailwind preset. Each app's Tailwind config is `presets: [preset]`
  plus `content` globs; NativeWind's own preset goes first in the mobile app.
- `tokens.css` — the CSS variables for both schemes, for the rare context without Tailwind.

Colours are semantic and map to CSS variables, so dark mode is a variable swap: the light values sit
on `:root`, the dark values on `.dark:root`, and the preset's plugin injects both. The build fails if
a text colour drops below 4.5:1 on any surface of its scheme.

```tsx
import { breakpoints, motionMs } from "@ampm/tokens";   // numbers for useBreakpoint() and Reanimated
<View className="bg-surface-elevated border border-subtle rounded-lg p-4" />
<Text className="text-primary text-lg font-semibold" />
```
