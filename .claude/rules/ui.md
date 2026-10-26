---
paths:
  - "packages/ui/**"
  - "packages/tokens/**"
---
# UI library rules

- A component is a folder: `src/components/button/{button.tsx, button.test.tsx, button.stories.tsx, index.ts}`. Platform-specific files (`button.native.tsx`, `button.web.tsx`) only when unavoidable, sharing one `button.types.ts` so props are identical on both platforms.
- Build on React Native primitives (View, Text, Pressable, TextInput) styled with NativeWind token classes only. Arbitrary values (`bg-[#1a1a1a]`, `p-[13px]`) are forbidden; add a token instead.
- Props: a typed `<Name>Props` interface; `variant` and `size` as string unions, never booleans like `isPrimary`; `className` passthrough; `testID`; `...rest` forwarded to the root primitive; `forwardRef` on anything focusable.
- States are mandatory where applicable: default, hover (web), pressed, focus-visible, disabled, loading, error. Loading never changes the component's size.
- Layouts: phone and tablet through `useBreakpoint()` and the layout components, never screen-width conditionals in components.
- Accessibility: `accessibilityRole` and `accessibilityLabel`; keyboard operable; focus trapped in modals and sheets; errors announced to screen readers.
- No business logic, data fetching, navigation or app imports. If a component needs an app concept (a wedding, a user), it takes it as props.
- Icons only via the shared `Icon`; images only via the shared `Image` (expo-image native, next/image web); links only via the shared `Link` (expo-router native, next/link web).
- AMPM's recurring elements are shared components, not per-screen markup: `StatusChip` (text label, never colour alone), `Callout` (indicative, requested, verified, awaiting confirmation; offline; pending sync), `OfflineState`, `MoneyText` (client-facing amounts only; it never receives an internal amount).
- Tokens change only in `packages/tokens/src/*.ts`; run `pnpm tokens:build` to regenerate the Tailwind preset and CSS variables. Never edit generated output.
- Before adding a component, confirm an existing one with a new variant cannot do the job.
- The stories file documents every variant and state; it is the living catalogue of the design system.
