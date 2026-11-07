# Handoff: Peacock Night design system for the AMPM platform

## Overview

Peacock Night is the approved visual system for every AMPM surface: the public website, hotel discovery, the client wedding portal, the admin (team) workspace, the client app, the team app and the guest RSVP pages. It is a dark, royal, Indian-destination-wedding look: a midnight sky, peacock-blue and gold light, frosted glass panels and pearl type.

This package lets Claude Code reskin the existing AMPM monorepo (`app-ampm/ampm-platform`) to Peacock Night and build each screen to match the mocks. The screen inventory follows `docs/wireframes.md` (PUB, AUTH, DM, CP, TW and GR screen codes), and every mock is labelled with those codes.

## About the design files

The files in `designs/` are **design references built in HTML**: prototypes that show the intended look, layout and copy. They are **not production code to copy**. Recreate them inside the existing codebase with its established patterns:

- `packages/tokens`: the only place theme values live (replace the files listed under Design tokens).
- `packages/ui`: universal React Native components with NativeWind (restyle them, don't fork them).
- `apps/mobile`: Expo (client and team apps, plus the web export for the client portals).
- `apps/web`: Next.js (public website).

Follow `CLAUDE.md`, `.claude/rules/styling.md` and `docs/engineering/standards.md`. Semantic token names stay the same, so most components restyle simply by swapping the token files.

**Opening the mocks:** open `designs/AMPM Index.dc.html` in a browser. It links every surface. Each `.dc.html` file is a large board (pan and zoom) holding several artboards, each with a badge (W1, D3, T7…) and its wireframe code. `Peacock Night - Complete Package.html` is the same set as a paginated document for approval.

## Fidelity

**High-fidelity.** Colours, type, spacing, radii, glass recipes, copy and layout are final. Recreate them pixel-accurately using the codebase's components. The exceptions:

- **Images:** striped and tinted placeholders stand in for real photography (each one is labelled, e.g. "PALACE PHOTO · LAKE PICHOLA").
- **Sample data:** names, hotels, prices and dates are realistic samples. Real values come from the API.

## The one hard rule: four colours only

| Name | Hex | Role |
|---|---|---|
| Midnight | `#0E1534` | Canvas, glass fill, ink on gold and peacock |
| Peacock | `#138A85` | Highlight: active tab or segment, verified, done, ready, offline-safe, glow orb |
| Gold | `#DDB861` | Action: primary button, the one emphasised word, live, needs-you, focus ring |
| Pearl | `#F1EBDD` | All text and strokes |

- **Only these four.** No white, grey, green, red or blue anywhere. Every other value is one of the four at an opacity. The original `success`, `warning`, `danger` and `info` hues are retired; status is carried by the chip's word plus the treatment in the status table below.
- **Text strengths (pearl):** 100% for headings and values, 80% for body, 58% for labels and metadata, 45% for disabled.
- **Proportion on screen:** about midnight 72%, pearl 16%, peacock 8%, gold 4%. Gold is rare. A screen has one gold primary action.
- **Dark only:** there is no light scheme, so remove or ignore `SchemeToggle`.

## Design tokens

Replace these files in `packages/tokens/src/` with the versions in `tokens/`, then run `pnpm tokens:build`:

| Handoff file | Replaces | Notes |
|---|---|---|
| `tokens/colors.ts` | `colors.ts` | Same semantic names. Adds `body`, `highlight`, `highlight-ink`, `highlight-soft`. |
| `tokens/typography.ts` | `typography.ts` | Gilda Display, Manrope and Rozha One. `font-mono` is retired in favour of `tabular-nums`. |
| `tokens/shape-and-glass.ts` | `radii.ts`, `shadows.ts`; adds `glass.ts` | Split into three files. |
| `tokens/peacock-night.css` | — | Add to `apps/web` globals. Glass and orb utilities for the web. |

`scripts/contrast.ts` will fail on the status pairs. Update its pairs to match the status table below. Gold on midnight, peacock with midnight ink, and pearl text all pass AA.

### Spacing

Keep the existing 4px scale (`spacing.ts`, unchanged). Typical values in the mocks:

| Use | Value |
|---|---|
| Gaps inside cards | 8, 10, 12, 14, 16 |
| Card padding | 16–24 on mobile, 22–36 on desktop |
| Gap between panels | 14–18 |
| Desktop page padding | 32–72 |
| Phone side padding | 18 |

### Radii

| Element | Radius |
|---|---|
| Buttons, inputs, chips, tabs, segmented controls, nav and tab bars | full (pill) |
| Glass cards | 22 mobile, 24 desktop |
| Rows inside panels | 16 |
| Page containers | 28 |
| Checkboxes | 7 |
| Phone frame | 54 |
| Tablet frame | 40 |

### Elevation

There are no drop shadows. Depth comes from:
- **Glass:** blur 24 with saturate 150%.
- **Rim:** a 1px top rim, `inset 0 1px 0 rgba(241,235,221,0.12)`.
- **Glow orbs:** radial gradients of peacock at 55% and gold at 30%, fading to 0 at 66%, placed behind the content.

### Glass recipes

Only top-level panels blur. Nested items use flat tints.

| Recipe | Fill | Stroke | Rim | Use |
|---|---|---|---|---|
| Base | midnight 50% | pearl 16% | pearl 12% | Cards, panels, nav, tab bars |
| Peacock | peacock 30% | peacock 70% | pearl 20% | Selected, verified, offline banners |
| Gold | gold 14% | gold 50% | gold 35% | Live, needs-you, key callouts |

- **Internal-only panels** (cost, margin, internal notes) use a dashed gold 50% border on a gold 6% fill. They appear only on staff screens.
- **Native:** use `expo-blur` (`BlurView`, `tint="dark"`, intensity about 40) under the fill colour. Fall back to the opaque `fallback` colours in `glass.ts` on low-end Android or when reduce-transparency is on.

### Typography

| Style | Font | Size and line-height | Notes |
|---|---|---|---|
| Hero | Gilda Display 400 | 88–120 / 0.92–0.95 | Emphasised word in gold, roman or italic |
| Page title | Gilda Display | 40–64 / 1.0 | |
| Section heading | Gilda Display | 44 / 1.0 | |
| Card title | Gilda Display | 22–30 / 1.05 | |
| Big numbers (countdown, KPIs) | Gilda Display | 48–80 / 0.9 | Gold for the countdown |
| Interface label | Manrope 600 | 13–16 | |
| Body | Manrope 400 | 15 / 1.55–1.6 | Pearl 80% |
| Eyebrow label | Manrope 600, uppercase | 10–11 | Letter-spacing 0.16–0.22em, pearl 58% |
| Data (prices, dates, times, counts) | Manrope 600, `tabular-nums` | 11–15 | Dates often uppercase, e.g. `12–14 FEB 2027` |
| Greeting | Rozha One | 18–44 | Gold. Only for "शुभ विवाह" and similar greetings, never interface text |

- Load the fonts with `expo-font` under the face names in `typography.ts`. On the web use `next/font/google`.
- Set `font-synthesis: none`. Gilda Display has a single weight, so never let the browser fake a bold.

## Components (restyle `packages/ui`)

| Component | Peacock Night spec |
|---|---|
| **Button** primary | Gold fill, midnight text, Manrope 700 13–15, padding 12–17 × 20–28, pill. Pressed: gold at 85%. Disabled: transparent, pearl 45% text, 1px dashed pearl 26%. |
| **Button** secondary | Transparent, pearl text, 1px pearl 40% border, pill. |
| **Button** highlight | Peacock fill, midnight text. Use for confirm actions such as "Approve version 3" and "Mark cue done". |
| **Link** | Gold 700, often with " →". |
| **Input** | Pill, midnight 50% fill, 1px pearl 20% border, padding 14 × 18. Focus: 1px gold border plus `0 0 0 4px gold 18%`. Error: gold border with a gold helper line (no red exists). Prefix "+91" in pearl 60% with a right divider. |
| **OTP cells** | 46 × 54, radius 14. Filled: peacock 25% fill and peacock 70% border. Active: gold border plus halo. Empty: pearl 20% border. |
| **StatusChip** | Pill, 11–12 Manrope 700, padding 5–7 × 11–13. See the status table below. |
| **Segmented control and tabs** | Pill track (midnight 50%, pearl 16% border, 4px padding). Active segment: peacock fill, midnight text. |
| **Toggle** | 46 × 26 track. On: gold track with a midnight knob. Off: pearl 12% track with a pearl 45% knob. |
| **Checkbox** | 22, radius 7. Checked: peacock fill with a midnight ✓. Unchecked: 1px pearl 34% border. |
| **Card** | Base glass, radius 22–24, padding 16–24. |
| **Avatar** | Circle 32–54, initials in Manrope 700 or 800, gold or peacock fill with midnight text. Overlap −8px with a 2px midnight ring. |
| **Progress bar** | 4–8 tall, pearl 12% track, peacock fill, pill. |
| **OfflineState banner** | Peacock glass pill: "Offline · 3 updates queued" plus "They sync when signal returns." |
| **Internal panel** | Dashed gold. Label "INTERNAL · NEVER SENT TO CLIENTS". Staff only. |
| **MoneyText** | Manrope 600 `tabular-nums`, Indian grouping (`₹46,80,000`, `₹65–80 lakh`). |
| **Bottom tab bar** | Floating glass pill 14px from the sides and 26px from the bottom. Active tab: peacock pill with midnight label. Locked tabs at pearl 32%. |

### Status chip mapping

| Meaning | Treatment | Example copy |
|---|---|---|
| Verified, done, ready, confirmed | Peacock solid, midnight text | "● Verified 2 Nov", "Ready 10 / 10" |
| Indicative, submitted, neutral | Pearl 40% outline | "Indicative", "Submitted" |
| Waiting on someone else | Gold 16% fill, gold text | "Awaiting hotel", "Due 15 Dec" |
| Needs you, blocked | Gold solid, midnight text | "Needs approval", "2 blocked" |
| Stale, closed, inactive | Pearl 8% fill, pearl 62% text | "Stale · checked 3 Jun" |

Never show colour alone: the word always carries the meaning (an existing StatusChip rule).

## Screens

Every artboard below is in `designs/`. Layout notes give the structure; read exact values from the file.

### 01 Website: `Peacock Night 1 - Website.dc.html` (Next.js, 1440 desktop and 390 mobile)

**Shared chrome:**
- **Top bar:** a glass pill nav, 24px from the top and inset 40. It holds the AMPM wordmark (Gilda Display 22, letter-spacing 0.1em), five links (How it works, Destinations, Services, About, Contact), "Client sign-in" and a gold "Request a demo".
- **Footer:** a glass card.
- **Chat:** a floating "Chat with AMPM" pill at the bottom right.

**Screens:**
- **W1 Home (PUB-01).**
  - Hero: a 1.25fr / 1fr grid with a "Weddings, planned end to end." headline and two calls to action.
  - Then: a three-stage strip (glass, gold glass, peacock glass), a selected-work grid of three, a destinations grid of six, two testimonials, a final call-to-action card and the footer.
- **W2 How it works and plans (PUB-02, PUB-07).** Three stage panels, a comparison table (✓ cells as peacock circles), the demo explainer and an FAQ.
- **W3 Services (PUB-03).** Four alternating image and text panels.
- **W4 Destinations (PUB-04).** A filter pill bar, a grid of nine and a featured destination.
- **W5 About (PUB-05).** Principles and team portraits.
- **W6 Contact and demo request (PUB-06).**
  - Layout: a two-column form card.
  - Fields: an enquiry / demo segmented control, then name, mobile, email (optional), reply channel, dates, destination, guests and notes, then the consent checkboxes.
  - Validation: mobile or email is required, not both.
  - Rule: AMPM creates every account, so there is no sign-up form anywhere.
- **W7 Request received (PUB-09).**
- **W8 Home, mobile (390).**

### 02 Hotel discovery: `Peacock Night 2 - Hotel Discovery.dc.html` (client portal, browser)

- **D1 Mobile sign-in (AUTH-06).** Six-digit code, 0:42 resend countdown, "Remember this device" and privacy consent on first sign-in.
- **D2 Activation and payment (CP-11).**
  - Layout: a three-step progress bar, then a wedding-details card and a payment card.
  - Payment: ₹50,000 for one month, by UPI or card through Razorpay. Non-refundable.
- **D3 Demo (DM-01).** A gold demo banner, three destinations with one hotel each, a sample wedding, and "Book a Zoom call".
- **D4 Subscriber home (CP-01).** Search, the days-left meter, my selection, enquiries, and the locked My Wedding and Approvals entries.
- **D5 Search with map (CP-02).**
- **D6 Hotel page (CP-05).** Gallery, overview / rooms / venues / rates / menus / location tabs, venues table, veg and non-veg menu grids, rates with the verified date, package range, street view and facilities.
- **D7 Compare (CP-06).**
- **D8 Enquiries and proposal (CP-07 to CP-09).** A status stepper, a thread, and a proposal card with Accept / Request a revision / Decline.
- **D9 Expired (read-only).** Saved hotel names and enquiries stay readable. Nothing is deleted.

### 03 Client portal: `Peacock Night 3 - Client Portal.dc.html`

- **Navigation:** Home, Hotels, My Wedding, Approvals (with a count badge), More.
- **C1 Wedding home (CP-20).** A 98-day countdown in gold, "Waiting on you", programme, updates, team, and the chat / new request entry.
- **C2 My wedding (CP-21).** Function cards, venues, and the two family representatives (equal rights).
- **C3 Vendors (CP-27).** Category chips, six options, shortlist hearts and "Submit my choice".
- **C4 Approvals (CP-35).** One list for every decision.
- **C5 Approve a version.** Version timeline, render with numbered pins, comments, and the decision panel. Shared versions never change.
- **C6 Budget (CP-24).** Planned, approved, invoiced and paid amounts, category table, next milestone (bank transfer) and invoices. It shows client amounts only.
- **C7 Requests (CP-36, CP-37).** Status stepper, "what this changes" box and thread. Material changes are flagged.
- **C8 Live chat (CP-42).** Typing indicator, attachments and "Turn into a request".
- **C9 Guest summary (CP-31).** Read-only for the representatives.
- **C10 After the wedding (CP-38, CP-40, CP-41).** Read-only banner (three months), feedback form and documents (signed links that last 15 minutes).

### 04 Admin workspace: `Peacock Night 4 - Admin Workspace.dc.html` (desktop and tablet)

- **Rail:** a left glass rail, 232 wide, with the nine areas: Home, Leads & Clients, Hotels, Weddings, Guests, Vendors, Tasks & Operations, Finance & Reports, Settings.
  - Active item: peacock pill.
  - Rule: show an area only if the role grants it (`packages/policy`).
- **T1 Team home (TW-01).** Four KPIs (availability requests in gold glass), upcoming functions with readiness chips, open conversations and the stale-rates alert.
- **T2 Leads pipeline (TW-10).** Six-column board.
- **T3 Lead detail (TW-11).** Activity timeline, demo access and "Invite to hotel discovery".
- **T4 Hotel database (TW-20).** Freshness and media-rights chips, public toggle.
- **T5 Rate card (TW-21).** Client range next to the internal cost and margin (dashed internal cells), and verification.
- **T6 Enquiries (TW-25).** Queue with response deadlines, internal notes and a proposal draft.
- **T7 Wedding project (TW-31).**
- **T8 Run of show and readiness (TW-73, TW-74).** "Go live" stays disabled until every required check is done. Otherwise only a Super Admin can "Authorise exception"; a project manager sees "Request exception".
- **T9 Guests and RSVP (TW-50, TW-58).** Identity-document collection is off by default and never accepts Aadhaar.
- **T10 Vendor options and quotes (TW-60).**
- **T11 Finance (TW-80).**
- **T12 Roles and settings (TW-90, TW-95).**
- **T13 Chat console (TW-98).**

### 05 Client app: `Peacock Night 5 - Client App.dc.html` (Expo, 390 × 844)

- **Layout rule:** status bar, then content with 18px side padding, then a floating glass tab bar.
- **P1 Sign in**
- **P2 Subscriber home** (Wedding and Approvals locked)
- **P3 Search**
- **P4 Hotel page** (bottom sheet over the hero image, sticky price bar)
- **P5 Wedding home**
- **P6 Programme**
- **P7 Approvals**
- **P8 Approve a version** (decision sheet)
- **P9 Chat**
- **P10 More**

### 06 Team app: `Peacock Night 6 - Team App.dc.html` (Expo, phone and tablet)

- **Tabs:** Home, Weddings, Tasks, More.
- **Offline-capable screens:** M5 (tasks), M6 (live console), M7 (readiness) and M8 (arrivals).
  - They show "NO SIGNAL" in the status bar and a peacock offline banner.
  - Changes queue and sync later; on conflict, the server wins on status changes.
- **M1 Staff sign-in.** Password, then a code from an authenticator app.
- **M2 Today**
- **M3 My weddings** (assigned only)
- **M4 Wedding detail**
- **M5 Tasks**
- **M6 Live console.** Current cue highlighted in gold, "Mark cue done" (peacock), "Incident".
- **M7 Readiness**
- **M8 Arrivals**
- **M9 Raise an incident**
- **M10 More and sync**
- **M11 Tablet console** (1180 × 820)

### 07 Guest RSVP: `Peacock Night 7 - Guest RSVP.dc.html` (browser, mobile first)

- **Wizard:** seven steps with a segmented progress bar, no sign-in, and an EN / हिन्दी switch.
- **G1 Welcome and privacy notice**
- **G2 Find your household** (name and mobile)
- **G3 Who's coming** (per person, per function, children counted)
- **G4 Meals and allergies** (allergies go only to hospitality)
- **G5 Rooms and travel**
- **G6 Review** (locked after submit)
- **G7 Confirmed** (calendar and programme PDF)
- **G8 Request a correction**
- **G9 Desktop layout**
- **Rule:** a guest never sees another household or the guest list.

### 00 Design system: `Peacock Night 0 - Design System.dc.html`

Sections, in order:
1. Colour (roles, tint ramps, proportions)
2. Glass (the three materials)
3. Type
4. Components
5. In use: website hero, phone, components and invitation, admin

## Interactions and behaviour

- **Motion:** use the existing `motion.ts` durations. Glass panels fade and translate 8px in over 200ms (ease-out). Tabs and segments slide their pill. Respect reduced motion.
- **Hover (web):** links turn gold. Secondary buttons get a pearl 8% fill. Cards raise their stroke from pearl 16% to 24%. No scaling.
- **Focus:** a gold border plus a gold 18% halo on every focusable element.
- **Loading:** skeleton rows in pearl 6% with a pearl 10% shimmer.
- **Errors:** inline gold helper text that names the field, and the input keeps what the user typed.
- **Empty states:** say what creates the first row, and offer the action if the user has permission.
- **Approvals:** an approval locks the exact version. "Request a revision" requires a note.
- **Live chat vs requests:** chat never carries a decision. "Turn into a request" creates a tracked request with its own approval history.
- **Money:** client screens show client amounts only. Internal cost and margin never leave the server for client roles.

## Responsive behaviour

| Surface | Width | Layout |
|---|---|---|
| Website | 1440 | Reference desktop |
| Website | under 768 | The mobile layout in W8 |
| Admin workspace | 1200 and above | Rail, content and an optional side panel |
| Admin workspace | 768–1199 | Collapsible rail |
| Admin workspace | under 768 | The team app layout |
| Client portal (browser) | 768 and above | The desktop artboards |
| Client portal (browser) | below 768 | The client app layouts |
| Touch targets | all | At least 44px |

## State to wire (per `docs/user-flows.md`)

- **Subscription:** active, days left, or expired (read-only).
- **Locked modules:** My Wedding and Approvals until AMPM is appointed.
- **Approvals:** pending count. Per-version state: current, revision asked, approved or superseded.
- **Enquiries:** submitted → checking → available or not → proposal shared → decision.
- **Requests:** submitted → under review → accepted or rejected → implemented → closed. Material changes are flagged.
- **Team app:** sync state (synced, offline with a queued count, conflict resolved). Readiness: required checks done out of total, and whether an exception was recorded.
- **RSVP:** wizard step, household, and per-person, per-function attendance. Locked after submit.

## Assets

- **Fonts (Google Fonts, open licence):** Gilda Display, Manrope (400, 500, 600, 700, 800), Rozha One.
- **Icons:** none are drawn in the mocks. Text glyphs (→, ✓, ♥, ●) stand in. Use the existing `packages/ui` `Icon` set, recoloured to pearl, gold or peacock.
- **Images:** placeholders only. Hotel and wedding photos come from the media library with rights status (permission matrix).
- **Brand:** the "AMPM" wordmark is set in Gilda Display with 0.1em tracking. Replace it with a real logo when AMPM supplies one.

## Files

```
design_handoff_peacock_night/
  README.md                       this file
  tokens/
    colors.ts                     replaces packages/tokens/src/colors.ts
    typography.ts                 replaces packages/tokens/src/typography.ts
    shape-and-glass.ts            replaces radii.ts and shadows.ts; adds glass.ts
    peacock-night.css             web globals: glass, orbs, focus, fallbacks
  designs/
    AMPM Index.dc.html            start here: links every file
    Peacock Night 0 - Design System.dc.html
    Peacock Night 1 - Website.dc.html            W1–W8
    Peacock Night 2 - Hotel Discovery.dc.html    D1–D9
    Peacock Night 3 - Client Portal.dc.html      C1–C10
    Peacock Night 4 - Admin Workspace.dc.html    T1–T13
    Peacock Night 5 - Client App.dc.html         P1–P10
    Peacock Night 6 - Team App.dc.html           M1–M11
    Peacock Night 7 - Guest RSVP.dc.html         G1–G9
    Peacock Night - Complete Package.html         82-page approval document
    support.js, doc-page.js       runtime the HTML references need to open
```

## Suggested order for Claude Code

1. **Swap the tokens:** replace the token files and run `pnpm tokens:build`. Update `scripts/contrast.ts` pairs, then get `pnpm check` green.
2. **Load the fonts:** `expo-font` in `apps/mobile`, `next/font` in `apps/web`.
3. **Restyle `packages/ui`:** Button, Input, StatusChip, Card (glass), Sheet, Toast, OfflineState, MoneyText. Add GlassPanel, SegmentedControl, Toggle, Checkbox, Avatar, ProgressBar, TabBar and InternalPanel. Update the stories and the Gallery.
4. **Public website:** `apps/web`, W1 to W8.
5. **Client portal and app:** AUTH-06, CP-01 to CP-11, then CP-20 to CP-42.
6. **Team workspace and app:** the rail, then TW screens by area, then the offline console last.
7. **Guest RSVP wizard.**
