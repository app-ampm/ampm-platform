---
paths:
  - "packages/ui/**"
  - "packages/tokens/**"
  - "apps/*/src/**/*.tsx"
  - "**/tailwind.config.*"
  - "**/global.css"
---
# Styling rules: Tailwind everywhere

- One system: Tailwind on web, NativeWind on native, identical class names. One Tailwind major across the whole repo, the one NativeWind's stable release supports; check NativeWind's current docs, never mix majors.
- Theme values live only in `packages/tokens`. `pnpm tokens:build` generates `tailwind.preset.cjs` (Expo), `tailwind.preset.web.cjs` (the Next.js site) and `tokens.css` (the CSS variables). Each app's Tailwind config is `presets: [preset]` plus `content` globs and nothing else. Zero theme values in app configs or global.css.
- Colours are semantic, never raw: `bg-surface`, `bg-surface-elevated`, `text-primary`, `text-body`, `text-muted`, `border-subtle`, `bg-brand`, `bg-highlight`. They map to CSS variables. Palette names like `bg-blue-500` are forbidden outside `packages/tokens`.
- Peacock Night (`docs/design/peacock-night.md`) is the design system: four colours only (midnight, peacock, gold, pearl), dark only (no `dark:` classes, no scheme toggle). Tints are a token plus an opacity step from `packages/tokens/src/opacity.ts` (`bg-surface/50`, `border-primary/16`, `bg-brand/14`, `bg-highlight/30`); any other `/n` silently generates no CSS. Gold is action (one gold primary per screen), peacock is highlight (never small text), pearl is text at 100/80/58/45%.
- No drop shadows: depth is glass (`GlassPanel`, `glassStyles`), the rim and the glow orbs. Only top-level panels blur; nested items are flat tints. Internal amounts only inside `InternalPanel`, staff screens only.
- Composition: `cn()` from `packages/ui/src/lib/cn.ts` (clsx + tailwind-merge). Variants via `class-variance-authority` in `<name>.styles.ts` next to the component.
- No arbitrary values (`w-[137px]`, `bg-[#333]`). No `style={{}}` except truly dynamic numbers (measured widths, animation values). No hex, rgb or px literals anywhere else.
- Every Tailwind `content` glob includes `../../packages/ui/src/**/*.{ts,tsx}`. Shared packages ship source, not compiled CSS.
- Spacing on the 4px scale (`p-2`, `gap-4`), type via the `text-*` scale from tokens, radius via `rounded-*` tokens. Flex layout; absolute positioning needs a comment saying why.
- Responsive: mobile-first `md:` and `lg:` on web; on native use layout components and `useBreakpoint()` from `packages/ui`, with tablet layouts for both apps.
- Platform differences go in `.web.tsx` and `.native.tsx` files or NativeWind's `web:` and `native:` variants, never `Platform.OS` checks inside class strings.
- Fonts declared in tokens, loaded with `expo-font` (native) and `next/font` (web), used only via `font-*` classes: Gilda Display (`font-display`, one weight, never bolded), Manrope (`font-sans*`, data with `tabular-nums`), Rozha One (`font-devanagari`, greetings only). Motion durations and easings from tokens; Reanimated native, CSS transitions web; reduced motion respected.
- The Next.js site uses `@ampm/tokens/tailwind.preset.web` (next/font variables, the `web:` variant) and reuses the library's class recipes from `@ampm/ui/styles`; it never imports React Native.
