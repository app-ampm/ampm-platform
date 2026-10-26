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
- Theme values live only in `packages/tokens`. `pnpm tokens:build` generates `tailwind.preset.js` and `tokens.css` (CSS variables for light and dark). Each app's Tailwind config is `presets: [preset]` plus `content` globs and nothing else. Zero theme values in app configs or global.css.
- Colours are semantic, never raw: `bg-surface`, `bg-surface-elevated`, `text-primary`, `text-muted`, `border-subtle`, `bg-brand`, `text-danger`. They map to CSS variables, so dark mode is a variable swap, not duplicated `dark:` classes. Palette names like `bg-blue-500` are forbidden outside `packages/tokens`.
- Composition: `cn()` from `packages/ui/src/lib/cn.ts` (clsx + tailwind-merge). Variants via `class-variance-authority` in `<name>.styles.ts` next to the component.
- No arbitrary values (`w-[137px]`, `bg-[#333]`). No `style={{}}` except truly dynamic numbers (measured widths, animation values). No hex, rgb or px literals anywhere else.
- Every Tailwind `content` glob includes `../../packages/ui/src/**/*.{ts,tsx}`. Shared packages ship source, not compiled CSS.
- Spacing on the 4px scale (`p-2`, `gap-4`), type via the `text-*` scale from tokens, radius via `rounded-*` tokens. Flex layout; absolute positioning needs a comment saying why.
- Responsive: mobile-first `md:` and `lg:` on web; on native use layout components and `useBreakpoint()` from `packages/ui`, with tablet layouts for both apps.
- Platform differences go in `.web.tsx` and `.native.tsx` files or NativeWind's `web:` and `native:` variants, never `Platform.OS` checks inside class strings.
- Fonts declared in tokens, loaded with `expo-font` (native) and `next/font` (web), used only via `font-*` classes. Motion durations and easings from tokens; Reanimated native, CSS transitions web; reduced motion respected.
