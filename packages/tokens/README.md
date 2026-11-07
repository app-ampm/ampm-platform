# @ampm/tokens

The only place theme values exist (`.claude/rules/styling.md`). The values are **Peacock Night**, the
approved AMPM visual system (`docs/design/peacock-night.md`): four colours (midnight, peacock, gold,
pearl), frosted glass, Gilda Display with Manrope. Plain TypeScript data in `src/`: colours and the
contrast pairs, opacity steps, glass recipes and glow orbs, spacing, radii, type scale and fonts,
shadows (rims and the focus halo), motion, breakpoints, stacking order.

```bash
pnpm tokens:build
```

writes `dist/` (not committed; `pnpm install` runs it through the root `prepare` script and Turborepo
runs it before any task that needs it):

- `tailwind.preset.cjs` — the Expo app's preset (NativeWind's own preset goes first).
- `tailwind.preset.web.cjs` — the Next.js site's preset: the same theme, every font family pointed at
  its next/font variable (`webFontVariables`), and the `web:` variant so classes shared with
  `packages/ui` mean the same on the site as on Expo's web export.
- `tokens.css` — the CSS variables, for the rare context without Tailwind.

Colours are semantic CSS variables holding RGB channels, so any token takes an opacity step:
`bg-surface/50` (midnight), `border-primary/16` (pearl), `bg-brand/14` (gold), `bg-highlight/30`
(peacock). The steps in `opacity.ts` are the whole tint vocabulary. Peacock Night is dark only: both
schemes hold the same values. The build fails if a pair in `contrastPairs` drops below its minimum
(4.5:1, except the documented midnight-on-peacock pair at 3:1, pending AMPM's decision).

```tsx
import { breakpoints, glass, motionMs } from "@ampm/tokens"; // numbers and colours for JavaScript
<View className="rounded-lg border border-primary/16 bg-surface/50 p-5" />
<Text className="font-display text-4xl text-primary" />
<Text className="font-sans-semibold text-2xs uppercase tracking-eyebrow text-muted" />
```
