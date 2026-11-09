# Peacock Night: the AMPM design system

**Status:** adopted 7 November 2026. Peacock Night is the approved visual system for every AMPM surface:
the public website, hotel discovery, the client portal and app, the admin workspace, the team app and the
guest RSVP pages. This guide is how the codebase implements it; read it before building any screen.

- **Source of truth for the look:** the handoff in [`reference_docs/design/peacock-night/`](../../reference_docs/design/peacock-night/README.md).
  Open `designs/AMPM Index.dc.html` in a browser (serve the folder over HTTP; the boards need
  `support.js`). Every artboard carries a badge (W1, D3, T7…) and its wireframe code (PUB, AUTH, DM, CP,
  TW, GR in [`docs/wireframes.md`](../wireframes.md)). The mocks are high fidelity: colours, type, spacing,
  radii, glass, copy and layout are final; photos and sample data are placeholders.
- **Source of truth for values:** `packages/tokens` (the only place theme values live). The mocks were
  drawn by hand, so their alpha values wander (0.42, 0.55, 0.6…); the tokens quantise them to the
  recipes and steps below. When a mock and the tokens disagree, the tokens win.
- **Source of truth for components:** `packages/ui` (rendered by its `Gallery`, the `/gallery` route of
  the Expo app). The website (`apps/web`, plain Next.js) reuses the same class recipes through
  `@ampm/ui/styles`.

## 1. The one hard rule: four colours

| Name | Hex | Token | Role |
|---|---|---|---|
| Midnight | `#0E1534` | `surface`, `brand-ink`, `highlight-ink`, `overlay` | Canvas, glass fill, ink on gold and peacock |
| Peacock | `#138A85` | `highlight` (`success`) | Highlight: active tab or segment, verified, done, ready, offline-safe, glow orb |
| Gold | `#DDB861` | `brand` (`warning`, `danger`, `focus`) | Action: primary button, the one emphasised word, live, needs-you, focus |
| Pearl | `#F1EBDD` | `primary` (`info`) | All text and strokes |

- **Only these four.** No white, grey, green, red or blue anywhere. Every other value is one of the four
  at an opacity. The token tests fail if a colour token is anything else.
- **Pearl strengths:** 100% headings and values (`text-primary`), 80% body (`text-body`), 58% labels and
  metadata (`text-muted`), 45% disabled (`text-primary/45`).
- **Proportion:** about midnight 72%, pearl 16%, peacock 8%, gold 4%. Gold is rare: **one gold primary
  action per screen**, and at most one emphasised gold word in a heading.
- **Dark only.** There is no light scheme; both scheme slots in the tokens hold the same values and no
  screen offers a scheme switch.
- **Peacock is not a text colour.** Peacock on midnight is 4.25:1, so peacock text only appears at
  display size (24px and up) or as an icon. Small text on a peacock fill is midnight.
- **Status hues are retired.** `success`, `warning`, `danger` and `info` survive as names, but they now
  mean the four StatusChip treatments (§8). The word always carries the meaning.

### Open decision: midnight on peacock

Midnight text on solid peacock (the verified chip, the active tab and segment, the highlight button)
measures **4.25:1**, under the 4.5:1 that `docs/engineering/standards.md` asks for small text. It passes
WCAG AA for large text and UI components (3:1). The tokens keep the approved peacock and the contrast gate
records this one pair at 3:1 with the reason (`packages/tokens/src/colors.ts`, `contrastPairs`). The
alternative is `#148F8A`, visually the same peacock, which reaches 4.53:1; switching is a one-line token
change. AMPM decides (build decisions D-076 and D-077).

## 2. From tokens to classes

Colours are CSS variables holding RGB channels, so any token takes an opacity step from
`packages/tokens/src/opacity.ts` (the whole tint vocabulary; Tailwind v3 accepts no other modifier):

| Need | Class | Value |
|---|---|---|
| Page canvas | `bg-surface` | midnight |
| Glass fill | `bg-surface/50` | midnight 50% |
| Panel stroke, divider | `border-primary/16` | pearl 16% |
| Input stroke | `border-primary/20` | pearl 20% |
| Hovered card stroke | `border-primary/24` | pearl 24% |
| Outline button, checkbox | `border-primary/40`, `border-primary/34` | pearl 40%, 34% |
| Disabled dash | `border-dashed border-primary/26` | pearl 26% |
| Nested row, well | `bg-primary/6` (or `bg-surface-inset`) | pearl 6% (3%) |
| Stale chip, hover fill | `bg-primary/8` | pearl 8% |
| Toggle-off track, progress track, rim | `bg-primary/12` | pearl 12% |
| Gold glass, waiting chip | `bg-brand/14`, `bg-brand/16` | gold 14%, 16% |
| Pressed primary | `active:bg-brand/85` | gold 85% |
| Internal panel | `bg-brand/6 border-dashed border-brand/50` | gold 6%, gold 50% |
| Peacock glass | `bg-highlight/30 border-highlight/70` | peacock 30%, 70% |
| OTP filled cell | `bg-highlight/25 border-highlight/70` | peacock 25%, 70% |
| Scrim | `bg-overlay/70` | midnight 70% |

Opaque equivalents for native fallbacks and text: `surface-elevated` (pearl 6% on midnight, the base
glass fallback), `surface-inset` (pearl 3%), `highlight-soft` (peacock 30%), `brand-soft` (gold 16%),
`subtle` (pearl 16%), `strong` (pearl 40%), `body` (80%), `muted` (58%).

Never write a hex, `rgb()`, `px` or arbitrary value (`bg-[#…]`, `p-[13px]`) outside `packages/tokens`.
A missing step is added to the tokens.

Lint enforces the vocabulary: after ESLint, `packages/ui`, `apps/mobile` and `apps/web` run the class
audit (`packages/config/tailwind/class-audit.mjs`), which fails when a class is not generated on the web
or on native, such as a typo, a retired token or an opacity step missing from `opacity.ts`, all of which
Tailwind would otherwise drop without a word. A class meant for a single platform carries its variant
(`web:`, `native:`).

## 3. Glass, rims and glow

Depth comes from glass, a 1px rim along the top edge, and glow orbs behind the content. **There are no
drop shadows.**

| Recipe | Fill | Stroke | Rim | Use |
|---|---|---|---|---|
| `base` | midnight 50% | pearl 16% | pearl 12% | Cards, panels, nav, tab bars |
| `peacock` | peacock 30% | peacock 70% | pearl 20% | Selected, verified, offline banners |
| `gold` | gold 14% | gold 50% | gold 35% | Live, needs-you, key callouts |

- `GlassPanel` (`packages/ui`) draws a recipe. On the web it is one element with
  `backdrop-blur-glass backdrop-saturate-glass` (blur 24, saturate 150%) and the rim as an inset shadow
  (`shadow-rim`, `shadow-rim-peacock`, `shadow-rim-gold`). On iOS an expo-blur `BlurView` (tint dark,
  intensity 40) sits under the fill and the rim is a hairline. Android, Reduce Transparency and nested
  panels draw the opaque fallback (`useGlassBlur()`).
- **Only top-level panels blur.** A panel inside a panel is `blur={false}` or a flat tint
  (`flatTintStyles`: pearl 6% fill, pearl 12% stroke); rows inside panels have radius 16.
- **Internal-only panels** (cost, margin, internal notes) use `InternalPanel`: dashed gold 50% on gold
  6%, labelled "INTERNAL · NEVER SENT TO CLIENTS". Staff screens only; a client screen never renders one,
  and the server never sends a client those fields (`.claude/rules/security.md`).
- **Glow orbs** (`GlowBackdrop`): radial gradients of peacock at 55% and gold at 30%, fading to nothing
  at 66% of the radius, behind the content of every screen. Keep orbs behind headings and whitespace,
  not under small muted text.

## 4. Type

| Style | Text variant | Font | Size / line height |
|---|---|---|---|
| Hero | `hero` | Gilda Display | 88 / 0.95 (`text-7xl`; 120 on wide desktop by class) |
| Page title | `display` | Gilda Display | 64 / 1.0 (`text-6xl`) |
| Screen title | `title` | Gilda Display | 36 (`text-4xl`); 40–44 by class on desktop |
| Section heading | `title` + `md:text-5xl` | Gilda Display | 44 / 1.0 |
| Card title | `heading` | Gilda Display | 24 / 1.05 (`text-2xl`; `text-3xl` for 28) |
| Big numbers | `stat` | Gilda Display | 64 / 0.9; countdowns in gold (`tone="brand"`) |
| Wordmark | `wordmark` | Gilda Display | 24, tracking 0.1em |
| Interface label | `label`, `subheading` | Manrope 600 | 13, 16 |
| Body | `body`, `bodySmall` | Manrope 400 | 15 / 1.6 in pearl 80%; 13 |
| Eyebrow | `eyebrow` | Manrope 600, uppercase | 10, tracking 0.22em, pearl 58% |
| Data | `data` | Manrope 600, tabular numerals | 13; dates often uppercase (`12–14 FEB 2027`) |
| Greeting | `greeting` | Rozha One | 24, gold. Only "शुभ विवाह" and similar greetings |

- Gilda Display has one weight: the Text component ignores `weight` on Gilda variants, and every web
  surface sets `font-synthesis: none` so the browser never fakes a bold.
- Emphasise one word of a heading in gold (`<Text tone="brand">palace.</Text>` nested in the heading).
- `font-mono` is retired; data uses the `data` variant (`tabular-nums`).
- Fonts load with expo-font in `apps/mobile/src/app/_layout.tsx` (faces named in `fontFaces`) and with
  next/font in `apps/web/src/app/fonts.ts` (variables named in `webFontVariables`).

## 5. Shape, spacing, motion, states

- **Radii:** pills (`rounded-full`) for buttons, inputs, chips, tabs, segmented controls, nav and tab
  bars; glass cards `rounded-lg` (22) on a phone and `md:rounded-xl` (24) on a desktop; rows inside panels
  `rounded` (16); page containers and sheets `rounded-2xl` (28); checkboxes `rounded-sm` (7).
- **Spacing:** the 4px scale plus the half steps the mocks use (`1.5` 6, `2.5` 10, `3.5` 14, `4.5` 18,
  `5.5` 22, `6.5` 26); `spacingPx` gives them in pixels for layout maths such as an inset plus a gap.
  Gaps inside cards 8–16, card padding 16–24 on a phone and 22–36 on a desktop, 14–18 between panels,
  page padding 32–72 on a desktop, **18 on a phone (`px-4.5`)**.
- **Motion:** `motion.ts` durations. Glass panels fade and rise 8px over 200ms (ease-out); tabs and
  segments slide their pill; reduced motion jumps to the end state.
- **Hover (web):** links turn gold; secondary buttons gain a pearl 8% fill; cards raise their stroke
  from pearl 16% to 24%. No scaling.
- **Focus:** every focusable element shows a gold border plus a gold 18% halo (`focusRingStyles`,
  `shadow-halo`).
- **Loading:** skeleton rows in pearl 6% with a pearl 10% shimmer; loading never changes a size.
- **Errors:** inline gold helper text that names the field; the input keeps what was typed. There is no
  red.
- **Empty states:** say what creates the first row and offer that action if the person may take it.
- **Touch targets:** at least 44px everywhere.

## 6. Components (`packages/ui`)

Every component is a folder with its test and stories; the Gallery shows every variant and state.

| Component | Peacock Night spec |
|---|---|
| `Button` | Pill, Manrope 700. `primary` gold fill, midnight text, pressed gold 85%. `secondary` transparent, pearl text, pearl 40% stroke, hover pearl 8%. `highlight` peacock fill, midnight text, for confirm actions ("Approve version 3", "Mark cue done"). `glass` base glass, pearl text (over photos, floating actions). `ghost` text only. `destructive` gold outline (no red). Disabled: transparent, pearl 45% text, dashed pearl 26%. Icon-only buttons are circles. |
| `Link` | Gold, Manrope 700, often with " →"; nav links pearl that turn gold on hover. |
| `Input` | Pill, midnight 50% fill, pearl 20% stroke, padding 14 × 18. Focus: gold stroke plus halo. Error: gold stroke and a gold helper line. `prefix` ("+91" in pearl 60% with a divider). Multiline inputs use radius 22. |
| `OtpInput` | Six cells 48 × 56 (the mocks' 46 × 54 on the 4px scale), radius 16. Filled: peacock 25% fill, peacock 70% stroke. Active: gold stroke plus halo. Empty: pearl 20% stroke. |
| `SegmentedControl` | Pill track (midnight 50%, pearl 16% stroke, 4px padding); the active segment is a peacock pill with midnight text. Also the tab strip (hotel page tabs), scrollable. |
| `FilterChip` | Selectable pill: pearl 30% outline; selected is peacock with midnight text. |
| `Toggle` | 48 × 28 track. On: gold track, midnight knob. Off: pearl 12% track, pearl 45% knob. |
| `Checkbox` | 22, radius 7. Checked: peacock fill with a midnight ✓. Unchecked: pearl 34% stroke. |
| `StatusChip` | Pill, Manrope 700 11–12, padding 5–7 × 11–13; the five treatments in §8; optional leading dot. |
| `Badge` | Count badge (Approvals 2): gold with midnight numerals. |
| `Card` | Base glass, radius 22 (24 desktop), padding 16–24. Tones `glass`, `peacock`, `gold`, `flat` (nested), `internal`. Pressable cards raise their stroke on hover. |
| `GlassPanel` | The raw material (§3). |
| `InternalPanel` | Dashed gold, "INTERNAL · NEVER SENT TO CLIENTS". Staff only. |
| `ListItem` | A row inside a panel: flat tint, radius 16, title, subtitle, leading thumbnail or avatar, trailing chip or chevron. |
| `Avatar`, `AvatarGroup` | Circle 32–56, initials Manrope 700/800, gold or peacock fill with midnight text; groups overlap 8px with a 2px midnight ring. |
| `ProgressBar` | 4–8 tall, pearl 12% track, peacock fill, pill; `steps` draws the RSVP wizard's segmented bar. |
| `Stepper` | Status stepper (enquiries, requests): done peacock ✓, current gold ring, upcoming pearl 26%. |
| `Stat` | Eyebrow label, big Gilda number (gold for countdowns), caption: days left, KPIs. |
| `MoneyText` | Manrope 600 `tabular-nums`, Indian grouping (`₹46,80,000`, `₹65–80 lakh`). Client amounts only. |
| `Callout` | The recurring notices in glass: indicative (base), requested and awaiting (gold), verified (peacock), offline and pending sync (peacock). |
| `OfflineBanner` | Peacock glass pill: "Offline · 3 updates queued", "They sync when signal returns." |
| `OfflineState`, `EmptyState`, `ErrorState` | Full-area states on glass; error accents are gold. |
| `Skeleton` | Pearl 6% with a pearl 10% shimmer. |
| `Sheet`, `Toast` | Glass on a midnight 70% scrim; sheets radius 28. A `Sheet` slides up from the bottom edge on a phone and is a centred dialog (max 512) on a desktop — a desktop has no edge to reach for. Every create, add or edit is a `Sheet`, so it is a modal on both; `ConfirmSheet` too. |
| `PhotoPlaceholder` | Striped, tinted stand-in for photography with its label ("PALACE PHOTO · LAKE PICHOLA"). |
| `GlowBackdrop` | The orbs behind a screen. |
| `Screen` | The screen scaffold: midnight canvas, orbs, safe areas, the 18px phone gutter, room for a floating tab bar or a sticky footer. `width` bounds the content column on a desktop — `full` (edge to edge), `content` (768, reading and forms) or `wide` (1152, dashboards and tables), both centred. |
| `ScreenHeader` | Back button, eyebrow, Gilda title, subtitle, trailing action. |
| `TabBar` | Floating glass pill 14 from the sides and 26 from the bottom; the active tab is a peacock pill with a midnight label; locked tabs at pearl 32%. |
| `NavRail` | The admin workspace rail: glass, 232 wide, active item a peacock pill; collapses to icons between 768 and 1199. |
| `Icon` | Lucide through the shared registry, in pearl, gold or peacock (or midnight on a fill). |

## 7. Layout and navigation

| Surface | Width | Layout |
|---|---|---|
| Website | 1440 | The desktop artboards (W1–W7) |
| Website | under 768 | The mobile layout (W8) |
| Admin workspace | 1200 and up | `NavRail`, content, optional side panel |
| Admin workspace | 768–1199 | Collapsed rail |
| Admin workspace | under 768 | The team app layout: `TabBar` |
| Client portal (browser) | 768 and up | The desktop artboards (D, C) |
| Client portal (browser) | under 768 | The client app layouts (P): `TabBar` |

- The client app's tabs are Home, Hotels, Wedding, Approvals (count badge), More (the portal's top bar
  says My Wedding). Wedding and Approvals stay locked until AMPM is appointed.
- The rail shows only the areas the person's role grants (`packages/policy`); a hidden area is still
  refused by the server.
- Screens use `Screen` and `ScreenHeader`, never a hand-rolled `ScrollView` with padding and insets.
- Every staff rail area passes `Screen` `width="wide"` — Leads & Clients, Hotel enquiries, Tasks &
  Operations (field notes), Hotel catalogue, Admin console and Settings (the shared account screen) — so
  the header and the content share one centred 1152 column at every window and the console reads as one
  width, never a mix of full-bleed and narrow pages. `wide` only caps the column on a tablet or desktop;
  a phone is full-width either way, so the mobile layout is unchanged. The client portal's own browsing
  and reading screens (hotels, consultancy, portal home) stay `content` (768), their mobile-first design.

## 8. Status chips

| Meaning | `tone` | Treatment | Example copy |
|---|---|---|---|
| Verified, done, ready, confirmed | `success` | Peacock solid, midnight text | "● Verified 2 Nov", "Ready 10 / 10" |
| Indicative, submitted, neutral | `info` | Pearl 40% outline, pearl text | "Indicative", "Submitted" |
| Waiting on someone else | `warning` | Gold 16% fill, gold text | "Awaiting hotel", "Due 15 Dec" |
| Needs you, blocked | `danger` | Gold solid, midnight text | "Needs approval", "2 blocked" |
| Stale, closed, inactive | `neutral` | Pearl 8% fill, pearl 62% text | "Stale · checked 3 Jun" |
| Selected, featured (a highlight, not a status) | `brand` | Peacock glass, pearl text | "5-star", "Featured" |

Never show colour alone: the word carries the meaning.

## 9. Screens: built, and next

The mocks cover 82 artboards. This table maps them to the code: **reskinned** screens exist and wear
Peacock Night; **next** screens belong to features not built yet and are built from these components when
their sprint comes.

| Mock | Code | Route / file | State |
|---|---|---|---|
| W1–W8 website | PUB-01…09 | `apps/web/src/app/*` | Built in Peacock Night |
| D1 / P1 sign-in | AUTH-06 | `/sign-in` (development sign-in until Cognito) | Reskinned |
| D2 activation and payment | CP-11 | `/portal` | Reskinned |
| D4 / P2 subscriber home | CP-01 | `/portal` | Reskinned |
| D5 / P3 search | CP-02 | `/hotels` | Reskinned |
| D6 / P4 hotel page | CP-05 | `/hotels/[id]` | Reskinned |
| D7 my selection | CP-06 | `/hotels/saved` | Reskinned |
| D8 enquiries and proposal | CP-07…09 | `/portal/requests…` | Reskinned |
| T2 leads pipeline, T3 lead detail | TW-10, TW-11 | `/leads`, `/leads/[id]` | Reskinned |
| T6 enquiries | TW-25 | `/enquiries`, `/enquiries/[id]` | Reskinned |
| P10 / M10 more | — | `/account` | Reskinned |
| M5 tasks (offline spike) | — | `/field-notes` | Reskinned |
| D3 demo, D9 expired | DM-01 | — | Next |
| C1–C10 client portal | CP-20…42 | — | Next |
| T1, T4, T5, T7–T13 admin | TW-01…98 | — | Next |
| P5–P10 client app | CP-20… | — | Next |
| M1–M9, M11 team app | — | — | Next |
| G1–G9 guest RSVP | GR | — | Next |

## 10. Building a new screen

1. Find the artboard (badge and wireframe code) and read its exact values from the HTML.
2. Compose `Screen`, `ScreenHeader` and the components above; add a variant before adding a component,
   and a token before adding a value.
3. One gold primary action. Peacock for what is selected, verified or done. Pearl strengths for text.
4. Top-level panels are glass, nested items are flat; internal amounts only inside `InternalPanel` on
   staff screens.
5. Loading, empty, error and offline states with the shared components; 44px targets; focus halos.
6. Phone, tablet and desktop: check the layout at 390, 768 and 1440.
