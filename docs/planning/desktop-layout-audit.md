# Desktop layout audit: every screen against its Peacock Night artboard

14 November 2026. This audit was triggered by `/sign-in`, which on a 1440 desktop shows one centred 448px card with everything stacked in it, so it looks like a phone screen in a box. Every built route (35 routes, signed in as a client, a prospect, Sales and an admin) was rendered at 1440×900, 768×1024 and 390×844 against the API with seed data, and compared with its mock artboard in `reference_docs/design/peacock-night/designs/`. The shared layout code and the navigation were also read against the same artboards.

**Verdict.** Tablet (768) and phone (390) are mostly fine. On a desktop, almost every screen keeps its phone composition:

- **Client screens** sit in a 672px column centred under a 1376px top bar.
- **Staff screens** stack full-width cards beside the rail.

The desktop artboards (D, T) use multi-column layouts: split panes, side columns, list beside detail. A few shared defects cause most of this, so fixing those first fixes most screens at once.

Severity: **S1** desktop structure wrong · **S2** a section missing, misplaced or in the wrong column arrangement · **S3** sizing, spacing or type detail.

**Status, 14 November 2026: the shared layer is built** (phase 1 of §7, decision D-123; guide §6, §7 and §10 amended).

| Root cause | State |
|---|---|
| R1, R2, R7 | Done. `Screen` reads its frame from `ScreenFrameProvider`. Beside the rail, `wide` fills the window with 18/30/30 gutters. Under the portal bar, `wide` uses 72 and `split` 32 inside the 1440 frame. The tab-bar room applies to phones only. Client screens still pass `content` until each one composes its artboard (phases 2 and 3). |
| R3 | Done: `Columns`, `SplitPane`, `MasterDetail` and `Grid` are in `@ampm/ui`. |
| R4 | Partly done: the spacing tokens `7.5` and `18`, sizes `list` and `frame`, and `ScreenHeader` titles at 44 from 1024. Card radius and padding are left to each screen. A global desktop step would override the screens' own `md:p-*`. |
| R5, R6 | Done: the rail and the bar float over the screens, so the glow shows through their glass, and the frame draws before `/me` answers. |
| R8 | Done: `/portal` loads and errors at the subscriber page's width. |
| R9 | Partly done: the `ScreenHeader` `hero` size is built. The shared split sign-in layout comes with D1 (phase 2); new glow placements wait on decision 3. |

The 390 renders are unchanged before and after. At 768 and 1440 the staff pages and the client `wide` pages take the new gutters.

**Status, 14 November 2026, later: the client screens are built** (phase 2 of §7). From 1024 each screen composes its D artboard; phones keep their layout apart from the listed fixes.

- **`/sign-in` (D1):** a two-column split shared by both sign-in screens (`SignInLayout` in `@ampm/ui`). Left: the 88px hero. Right: a 512 glass card with only the form; the development shortcuts sit under the card.
- **`/portal`:**
  - **Unpaid (D2):** `Columns` 1 : 1.1, with the steps and notices beside the payment card.
  - **Subscribed (D4):** a search card beside the plan card at 1.5 : 1, then My selection, Enquiries and Wedding at 1 : 1 : 0.9. My selection uses P2's compact rows, on the phone too.
- **`/account`:** a profile column beside memberships and entitlements. Sign-out is full width on phones only.
- **`/hotels` and destinations (D5):**
  - One search pill and one chip row, with the count on the right. Results are two per row until the map exists.
  - Destination tiles are three across.
  - Phone: a "Filters · n" pill and sheet replace the three cut-off selects.
- **`/hotels/[id]` (D6):** a `2 : 1 : 1` photo mosaic, then the title, facts and actions on the background, then `Columns` 1.6 : 1. Main: About, a venues table, Rooms. Side, always visible: Rates, Location, Facilities. The sticky price bar is for phones and tablets only.
- **`/hotels/saved` and `/hotels/compare` (D7):**
  - D7's side-by-side columns in one glass card, with display-size headers.
  - The compare table fills a desktop and scrolls on a phone. Covers are borrowed from the shortlist, because the compare view carries none.
  - Phone: saved hotel names no longer truncate.
- **`/portal/requests` (D8):** `MasterDetail`, a 384 list beside the open enquiry, with every section in one panel. On a desktop the list route replaces itself with the most recent enquiry's route, and a selection changes it in place (D-124, phase 3).

**Still open:**
- **Data or API:**
  - wedding details on `/me` (D2's panel, D4's search fields);
  - a plan expiry (the days-left meter);
  - destination photos;
  - a cover on the compare view;
  - project-role labels and a project name (the account page still shows the raw role key and ID).
- **Features not built:** the D5 map, live chat (B24), menus, "Weddings here", street view, D1's remember-device and privacy checkbox.
- **`packages/ui` limits:**
  - `Input` and `Select` heights differ, so the D5 pill's labels sit about 6px apart.
  - `SectionError` has no `blur` prop.
  - `RequestRow` has no `tone` prop.
  - The tokens have no 31 or 36 radius.
  - Panels cannot fill the window height.
  - New glow placements wait on decision 3.

**Status, 14 November 2026, later still: the staff screens are built** (phase 3 of §7). Beside the rail, from 1024, each screen composes its T artboard; phones keep their layout apart from the listed changes.

- **Shared layer additions:**
  - `ScreenHeader` takes `actions` (at the right of the header from 768, wrapping under it on a phone), a `badge` read after the title, and `variant="panel"` (T3's record header).
  - `SegmentedControl` takes `variant="underline"` (T3, T5).
  - `DataTable` lost its header fill and gained desktop row padding (T4).
- **`/leads` (T2):** stage columns share the width; a Board / List switch from 768; Funnel and Clients in the header actions (fixes the §4 phone overflow).
  - **Interim call on decision 4, to confirm:** the board shows every stage through Converted. Closed leads appear when a "Closed · n" chip is on. Phones list every lead.
- **`/leads/[id]` (T3):** a panel header (name, stage chip, facts, Log activity and Advance), then `Columns` 1.3 : 1: Activity beside Demo, Invite, Manage and Contact. The phone order now follows the same tree.
- **`/leads/funnel`:** a T1-style KPI card, with By stage beside By source.
- **`/leads/accounts` and `[accountId]`:**
  - A `DataTable` from 768.
  - A panel header, then `Columns` 1.3 : 1: Contacts and Subscriptions beside Details and Payments.
- **`/enquiries` (T6):** the 432 queue beside the open enquiry (`SplitPane`). The open enquiry is the route's (D-124): on a desktop the list route replaces itself with the first enquiry's, and a selection changes it in place. The open card says "Viewing". The queue titles cards from its own data, with no per-card requests. The detail leads with the thread switch and activity, then proposals, the status moves, agreements, visits and milestones, in one order at every width.
- **`/hotels-admin` (T4):**
  - Import and New hotel are in the header actions, which fixes the §4 clipping.
  - A `DataTable`: Hotel, Status and Rooms on a tablet; also Last verified, Public and Demo from 1024.
- **Hotel record (T5):** one header for the media, details and rates routes: the hotel's name, "Hotels · city", and an underline strip with Rooms, venues & contacts / Rate cards / Media.
  - Rates: verification and media rights in a 288 side column.
  - Details: contacts in the side column.
  - Media: tiles three or four across.
  - Import: the CSV beside the hint and the result.
- **Settings (T12):** a section strip (Users, Roles, Notifications, Templates, Configuration, Audit log) on every settings page.
  - `/admin` is a card grid from 768.
  - Users are a `DataTable`; a user's page has a panel header beside `Columns`.
  - The selected role opens in a 288 side column from 1024.
  - The audit filters and Export share one row.
- **`/field-notes` (M11):** the notes list beside the composer and sync status, from 1024.
- **State across 1024:** every place a composition changes with the width has a resize test, using the notifying window mock, and each test fails without its fix. Covered: typed drafts in sheets and forms, the open record, the chosen view or tab, the selected role, and filters.
- **Review fixes:**
  - A tablet header's actions wrap, so the title keeps 224.
  - The lead detail keeps its actions above the activity on a phone.
  - The roles table marks the open role (`DataTable selectedKey`).
  - Record payment shows only with `crm.subscriptions.update`.
  - **Open question:** should Finance record manual payments? The matrix refuses it today.

**Still open after phase 3:**
- **Data or API:**
  - hotel and client names on the staff enquiry view (the queue fetches them per card today);
  - an enquiry reference and due time (T6's "ENQ-0418" and SLA line);
  - the destination name on the staff hotel list;
  - who verified a rate card;
  - counts for T4's status chips;
  - the lead list's Owner and Source chips (the endpoint already filters by both);
  - a staff create-lead flow (T2's New lead).
- **Not built:** T3's tabs (Account, Agreements, History have no data); T5's Overview, Menus and single-section tabs; M11's cue sheet, Now card and incidents.
- **`packages/ui` limits:**
  - `ScreenHeader`'s actions can't shrink, so a long title beside the settings strip wraps to two lines between 1024 and about 1300.
  - `DataTable` has no selected-row state.
  - The back button is a glass circle, not T5's "← HOTELS · CITY" eyebrow link.

## 1. Root causes: fix once

| # | Sev | Cause | Where | Fix |
|---|---|---|---|---|
| R1 | S1 | **Client pages are capped at 768px, counting the gutters, so about 672px of content.** Every client screen except portal home uses `Screen width="content"`. The guide requires it (§7: browsing and reading screens "stay `content` (768), their mobile-first design"), which contradicts its own table at §7 ("Client portal (browser), 768 and up → the desktop artboards (D, C)"). No D or C artboard uses 768. They run 1296 wide (72px gutters: D2, D4, D7, D9, D6 body) or 1376 wide (32px gutters: D5, D6 mosaic, D8, C-series). The rule came in with PR #98, not a decision record. | `packages/ui/src/components/screen/screen.styles.ts:6-13`, `docs/design/peacock-night.md:213-217` | Amend the guide (with a D-record) so client desktop pages follow the D and C artboards. Give `Screen` client widths: full with 72px gutters for reading and hero pages, and 32px for list and split pages. |
| R2 | S2 | **Staff pages are capped at 1152 and centred**, with 48px gutters: 1056px of content starting 68px from the rail, and the gap grows on wider monitors. The T artboards fill the space beside the rail with 18 left / 30 right / 30 top, about 1144px. | `screen.styles.ts:12,22` | A `workspace` width: no centring, gutters matched to the rail. |
| R3 | S1 | **No shared multi-column layout pieces.** Only `Row` and `Stack` exist, so each screen hand-rolls `lg:flex-row` (`lead-detail-screen.tsx:40-51`, `subscriber-home.tsx:47-55`). The artboards need ratio columns (D4 1.5fr/1fr, D6 1.6fr/1fr, T3 1.3fr/1fr), a fixed side panel (T5/T12 1fr + 300px), and list beside detail (D8 380 + 1fr, T6 430 + 1fr). | `packages/ui/src/components/layout/` | Add `Columns` (ratios, stacked below `lg`), `SplitPane` (fixed side + fluid, side optionally sticky on web) and `MasterDetail` (list beside detail at `lg`, two pages on a phone), plus a responsive grid in place of manual `rowsOf` chunking (`hotel-sections.tsx:205-234`). |
| R4 | S3 | **Primitives use phone sizes on desktop.** Page title is 36 everywhere (T: 39; D/C: 41–68; `ScreenHeader size="display"` exists but no page uses it). Eyebrows are 10px (artboards: 11). Cards use radius 22–24 and padding 20 (desktop panels: radius 26–34, padding 22–44; callers patch with `md:p-5.5 … md:p-9`). The spacing scale can't express 72px or 30px. | `text.styles.ts:15,25`, `card.styles.ts:12,37`, `packages/tokens/src/spacing.ts` | Desktop steps inside the primitives (`lg:` title 44, eyebrow 11, card radius and padding). Add spacing tokens `18` (72px) and `7.5` (30px). |
| R5 | S2 | **Shell, layout shift on load.** The top bar and rail only draw once `/me` loads, so desktop content shifts down 84px (client) or right 248px (staff) after first paint. | `apps/mobile/src/navigation/app-chrome.tsx:62-63`, `app-tab-bar.tsx:100-103` | Draw an empty bar or rail straight away, chosen by route; fill in the items when `/me` arrives. |
| R6 | S2 | **Shell, flat navigation glass.** The glow is drawn per `Screen` on an opaque background beside or under the navigation, so the glass bar and rail have nothing to blur and read as flat strips. In D4 and T2 the glow sits behind the bar and the rail. | `app-chrome.tsx:65`, `screen.styles.ts:4`, `screen.tsx:265-266` | Draw the glow once at window level in `AppChrome`; make `Screen` see-through inside the navigation. |
| R7 | S3 | **Tab-bar space wasted on desktop.** `Screen` keeps 112px at the bottom whenever a `tabBar` prop is passed, but `AppTabBar` renders nothing at 768 and up. If `/me` fails, a one-tab "More" phone bar floats at 1440. | `screen.tsx:159-160`, `app-tab-bar.tsx:73-83,101` | Drop the space at `md` and up, or have the bar report whether it is visible. |
| R8 | S3 | **Width jumps while `/portal` loads.** The loading and error states render in `content` (768), then the subscribed page switches to `wide`. | `portal-screen.tsx:31,38` | Use one width for every state of a screen. |
| R9 | S3 | **Missing kit pieces for hero pages.** The two sign-in screens hand-roll the same desktop branch. `ScreenHeader` has no hero size (D1 86px, with an 18px subtitle; the subtitle is fixed at `mt-1.5`). No glow variant puts gold behind a left column (D1) or gold top-right with peacock bottom-left (D2, D4, P1). | `sign-in-screen.tsx:94-104`, `cognito-sign-in-screen.tsx:246-256`, `screen-header.styles.ts`, `glow-backdrop.styles.ts` | A shared split sign-in layout in `packages/ui` (hero, form-card and footer slots); a `hero` `ScreenHeader` size; new glow placements (tie to decision 3). |

## 2. Client screens (D artboards)

| Route | Artboard | Verdict | What the artboard has, and what is wrong | Fix sketch |
|---|---|---|---|---|
| `/sign-in` | D1, P1 | S1 phone-in-a-box | **D1:** 1440×900 `grid 1fr 1fr`. Left column (padding 56/72, `justify-between`): wordmark (23px); a stack with gap 22 holding "Welcome *back.*" (86px Gilda, line-height 0.94) and an 18px subtitle at pearl 74% (max-width 460); a footer eyebrow "NO SIGN-UP · AMPM INVITES EVERY CLIENT" (11px, 0.16em). Right column (padding 56, centred): a 520px glass card (padding 44, radius 36, gap 24) holding only a 36px "Enter your code" title and the OTP form. Gold orb (900px) behind the headline, peacock orb (800px) bottom-right. **Code:** from 768, one `Card` `max-w-md md:p-9` (448 wide, padding 36) holding the header, OTP form, email form, two quick-sign-in cards and the gallery link (`sign-in-screen.tsx:94-104`); `cognito-sign-in-screen.tsx:246-256` repeats it. `glow="top"` has no variant with gold behind the left column. | Split at `lg` (keep the card from 768 to 1023, where two 384 columns are too narrow). Left: `lg:flex-1 justify-between lg:py-14 lg:px-18`, headline via a new `ScreenHeader` `hero` size (88). Right: `lg:flex-1 items-center justify-center lg:p-14`, card `max-w-lg` (512) `lg:p-11`, with the dev email form and quick sign-ins below the card. One shared layout for both sign-in screens. A new split glow variant. Radius 36 needs a `3xl` radius token if it must be exact. |
| `/portal`, unpaid | D2 | S1 phone-in-a-box | **D2:** frame padding 40/72; `grid 1fr 1.1fr`, gap 24. Left: a "Your wedding" glass panel (padding 36, radius 31). Right: the payment card (53px price, features, UPI/Card switch, Pay). The stepper (48px connectors) sits in the top bar in place of the portal navigation. **Code:** `Screen width="content"` (672 of content) stacking header, `ActivationSteps` stretched to 672, Callout, `PlanList` and the enquiries entry (`activation-view.tsx:24-42`). `/me` has no wedding details yet (`packages/core` meResponse), so the left panel has no data. | `wide` + `Columns 1:1.1` at `lg`: header, steps, Callout and Enquiries left; `PlanList` right; the wedding summary joins the left once a contract exists. S3: price `text-5xl` (44) against 53. Moving the stepper into the top bar is a product call. |
| `/portal`, subscribed | D4, P2 | S2 partial | Already `wide` with some `lg:` rows (`subscriber-home.tsx:46-55`). **D4 row 1**, `1.5fr 1fr`, gap 18, equal heights: a glass search card (padding 32/36, radius 31) with the greeting eyebrow and a 47px "Where shall we look today?" inside it, above a four-field search pill; beside it the plan card (days left). **D4 row 2**, `1fr 1fr 0.9fr`, gap 18: My selection (compact rows: 56×44 thumbnail, radius 11, 14px name, 12px place, status chip, "Compare →"), Enquiries (three rows with chips), and the locked wedding card over the Chat card. **Code:** a 36px "Find your venue" header above a bare search pill; row 1 is `lg:items-center`, so the two cards sit at different heights (L47); up to four full `HotelCard`s stacked across 1056 (L52, `saved-preview.tsx:42-56`); then Enquiries and the locked card two-up (L53-56). Without hotel assistance, the locked card stretches alone across 1056. `EnquiriesPanel` is a single entry row. | Row 1: the header and pill inside a `Card lg:px-9 lg:py-8`, `ScreenHeader size="display"`, `lg:items-stretch`. Row 2: one `Columns 1:1:0.9`; My selection as `ListItem` rows with a thumbnail `leading` (P2 uses the same rows at 48×40); list the enquiries with `useHotelEnquiries` + `RequestRow`. The days-left meter and Chat are data gaps or live chat (B24), not layout. |
| `/hotels` | D5 | S1 phone-in-a-box | **D5:** full-width search pill (Destination, Dates, Guests, Room rate + gold Search); one chip row with the count right-aligned; `grid 1.15fr 1fr`, list beside a map panel. **Code:** a 672 column with four or five stacked filter rows and one card stack (`hotels-screen.tsx:49,105-118`, `hotel-filters.tsx:48-83`, `hotel-results.tsx:122-171`). The map isn't built. | One-row filter pill + one chip row at `lg`. Results two per row until the map exists (see decisions). |
| `/hotels/destinations`, `/[id]` | none | S2 | A single list card in a 672 column; `[id]` reuses the `/hotels` results, so it has the same S1. | 3-column tile grid at `lg` (D3 tile pattern). |
| `/hotels/[id]` | D6 | S1 phone-in-a-box | **D6:** `2fr 1fr 1fr` photo mosaic over 1376; title block on the background (68px name, facts, Saved/Compare/gold Check availability on the right); tab pill; `1.6fr 1fr` columns: main (venues table, menus, weddings here), side (Rates card always visible, street view, facilities). **Code:** a 672×384 hero and one card holding title, tabs and one section (`hotel-hero.tsx:37`, `hotel-panel.tsx:26-43`). The P4 sticky price bar shows at every width (`hotel-footer.tsx:16-27`). | Mosaic from `galleryImages`; `Columns` main + side; footer only below `lg`; title at `display` size; venues as a `DataTable` at `lg`. |
| `/hotels/saved`, `/hotels/compare` | D7 | S1 | **D7:** header with a 53px "Side by side" title and the guests and dates on the right; a glass card over 1296 with `1.1fr 1fr 1fr 1fr` columns (130px photo + 23px name heading each hotel; RATES row with freshness chips). **Code:** saved is a single list card in 672 (`saved-hotels-screen.tsx:44-47,155-181`). The compare table has fixed cell widths (`hotel-compare-table.tsx:46-49,90,105`), so four hotels (736px) scroll sideways even at 1440. | Compare cells `flex-1` with a minimum width, wrapped in a card on a wide `Screen`; saved shows the D7 side by side at `lg`. |
| `/portal/requests`, `/[id]` | D8 | S1 | **D8:** one page, `380px 1fr`: a list panel (28px title, enquiry cards) beside the selected enquiry (36px name, facts, status, horizontal stepper). **Code:** two separate 672 pages (`requests-list-screen.tsx:28-31`, `request-detail-screen.tsx:25-28`). The message thread is live chat (B24), out of scope. | `MasterDetail` at `lg`. |
| `/portal/requests/new` | none | S3 | A 768 form width is fine. The guide (§6) says create flows are a Sheet (a centred dialog on desktop). | Optional: move to a Sheet. |
| `/account` (client and staff) | P10, M10 | S2 stretched | No desktop artboard. P10/M10 open with a profile card (54px peacock avatar beside a 23px Gilda name, role line, phone), with no "More" title. **Code:** `width="wide"` stacks profile, access, link rows and sign-out across 1056 (`account-screen.tsx:41`, `account-details.tsx:159-167`); sign-out is a 1056px pill (`sign-out-button.tsx:15` `fullWidth`); the header avatar duplicates the one in the top nav. The client also sees the raw role key `client_representative` and a project UUID (a content issue). | Split at `lg`: profile, links and sign-out in a `w-96` column; memberships and entitlements beside it. Sign-out `fullWidth` below `md` only; hide the header avatar when wide, as `HomeHeader` does; hide internal identifiers. |

## 3. Staff screens (T artboards)

| Route | Artboard | Verdict | What the artboard has, and what is wrong | Fix sketch |
|---|---|---|---|---|
| `/leads` | T2 | S2 partial | **T2:** six glass stage columns sharing the width (`flex:1`, about 183px each), full height; Board/List switch + gold New lead; filter-chip row. **Code:** fixed 224px columns for all 8 statuses in a sideways scroll (`leads-board.tsx:41,75-80`): about 1862px in 1056, so Converted and Closed are always off-screen. | `flex-1` columns with a minimum width; Converted/Closed behind a filter or the List view (decision). |
| `/leads/[id]` | T3 | S2 partial | **T3:** a glass header panel (24×28, radius 26): name at 38px + status chip, a meta line, and Log activity / gold Create account and invite on the right; `1.3fr 1fr` columns. **Code:** a plain header; facts in a "Details" card; actions buried in cards; `flex-1` + fixed `w-96` (`lead-detail-screen.tsx:41-46,102-111`). | Detail header panel; `Columns 1.3fr/1fr`. |
| `/leads/funnel` | none (T1 KPI pattern) | S2 stretched | Bars about 1000px long in one column (`lead-funnel-screen.tsx:97-103`). | Glass KPI card; By stage and By source side by side. |
| `/leads/accounts` | none | S2 stretched | Phone `ListItem` rows in a 1056 card (`accounts-list.tsx:21-45`). | `DataTable`. |
| `/leads/accounts/[accountId]` | none (T3 pattern) | S2 stretched | Five stacked sections; the name appears twice (`account-detail-screen.tsx:53,120-136,186-190`). | Detail header + `Columns`. |
| `/enquiries`, `/[id]` | T6 | S1 stretched | **T6:** a 430px queue beside the selected enquiry, which leads with the All / Client-visible / Internal thread switch. **Code:** the queue alone at 1056 (`enquiries-list-screen.tsx:73-83`); the detail is a separate page with seven stacked sections, the activity thread last (`enquiry-detail-screen.tsx:83-91`). | `MasterDetail` at `lg`. Inside the detail: main (activity, proposals) + side (details, status, agreement, visits, milestones). |
| `/hotels-admin` | T4 | S2 partial | **T4:** an 8-column table + filter chips + a 260px filter field. **Code:** 3 columns; the Hotel column stretches to about 830px (`hotels-list-screen.tsx:28-59`). | Add Last verified, Public and Demo columns (already in `HotelStaffView`); Destination needs its name on the list view. |
| `/hotels-admin/[hotelId]` (media), `/details`, `/rates` | T5 | S1 stretched | **T5:** a record header (back eyebrow "← HOTELS · CITY", 39px hotel name, "Last changed by…") + a tab strip (Overview, Rooms, Venues, Rate cards, Menus, Media, Contacts) + `1fr 300px`: rate table on the left; verification, package range and media rights on the right. **Code:** the title is "Media"; the other pages are reached through two full-width 1056px pill buttons (`hotel-media-screen.tsx:219,237,271`); details and rates stack full-width cards (`hotel-details-screen.tsx:38`, `hotel-rates-screen.tsx:63-66`). | Shared hotel-record header + tab strip for all three routes; `SplitPane` with a 300 side column; media as a 3–4 column thumbnail grid. |
| `/hotels-admin/import` | none | S2 stretched | One 1056 column (`hotel-import-screen.tsx:199-227`). | `SplitPane`: textarea + actions on the left, column hint + result on the right. |
| `/admin` | T12 | S2 stretched | A phone settings menu: six `ListItem`s at 1056 (`admin-console-screen.tsx:22-72`). T12 puts the sections in a header pill strip on every settings page. Sub-pages have no back button or section navigation (only `staff-user-detail-screen.tsx:108` has `onBack`). | A section tab strip in the header at `lg`; `/admin` redirects to the first section, or becomes a card grid. |
| `/admin/users` | none (T12) | S2 stretched | `ListItem` rows, while sibling admin screens use `DataTable` (`staff-users-list.tsx:51-66`). | `DataTable`. |
| `/admin/users/[userId]` | none (T3 pattern) | S2 stretched | Three stacked cards (`staff-user-detail-screen.tsx:88-92`). | `Columns`: account facts main; roles + actions side. |
| `/admin/roles`, `/configuration`, `/audit` | T12 | S3 partial | One column grows to about 770–840px. Audit filters are each `flex-1` (about 520px) with Export on its own row (`roles-screen.tsx:28-58`, `configuration-screen.tsx:40-57`, `audit-log-screen.tsx:202-229`). | Role detail in a 300 side column; fixed-width filters + Export on one row. |
| `/admin/notifications`, `/notification-templates` | none | matches | Only missing the section navigation above. | none |
| `/field-notes` | M11 (tablet), M5 (phone) | S2 stretched | M11 is `1.3fr 1fr` (list + action cards). The code stacks the composer and the list at 1056 (`field-notes-screen.tsx:51-67`). | `Columns` at `lg`. |

## 4. Phone (390) and tablet (768)

The tablet layouts are fine. Phone bugs:

- **S3 `/sign-in` (P1):** nothing broken. P1's title is 49px (code: 36), it pins the gold Verify button and "Need help?" to the bottom, and its orbs are gold top-right and peacock bottom-left (code: reversed).
- **S2 `/hotels`:** the three filter Selects share one row, about 112px each, so every value truncates to "Any …" (`hotel-filters.tsx:49-73`, `select.tsx:94`). P3 uses one "Filters · 2" pill that opens a sheet.
- **S2 `/hotels-admin`:** the header actions overflow, and "New hotel" is cut off at the right edge.
- **S3 `/leads`:** the Funnel and Clients buttons run to the screen edge.
- **S3 `DataTable` on phones** (notifications, configuration, audit log): columns run off the right edge, and only part of the table shows. Consider a stacked-row variant below `md`.
- **S3 `/hotels/saved`:** hotel names truncate ("Rose Fort P…") because the chip and two icon buttons share the row.
- **S3 floating tab bar on the web:** the content underneath (for example the "Live chat" row on `/account`) is readable through the glass.

## 5. Shell and smaller visual details (S3)

- **Client top bar:** More is missing from the items (`client-top-nav.tsx:22`). Locked items show a lock icon where the mock shows a LOCKED label. No Chat chip. The wordmark is 24 (mock: 20).
- **Staff rail:** radius 28 (mock: 26). Items have icons (mock: text with counts). The sections differ from the mock (`staff-areas.ts:31-84`); that's a product call.
- **`DataTable`:** the header row has a fill and 12×10 cells. The mocks have no header fill, 10px uppercase headers and 14–16px row padding.
- **Sheets:** chosen by platform, not width, so a narrow browser window gets the dialog. Inside, they use the 18px phone padding (`sheet.tsx:28,42,139`).
- **Breakpoints measure the window, not the content area,** so beside the rail the content is 96–248px narrower than the breakpoint assumes.
- **No phone-layout flash on load.** `web.output` is `single`, so `useIsClient()` is true on the first render.

## 6. Decisions needed before or while fixing

1. **Amend guide §7:** client desktop pages follow the D and C artboards, not 768. This needs a D-record.
2. **D5 map panel:** the map isn't built. Until it is, either show results two per row at full width, or reserve the right column with a placeholder.
3. **Glow tones:** the DS Glass sheet (peacock 55%, gold 30%) and the screen artboards (gold about 50% near the top, peacock about 29%) disagree. Pick one before changing tokens.
4. **Lead pipeline:** where Converted and Closed go (a filter or the List view).
5. **Staff rail sections:** whether to match the mock's grouping now.

## 7. Suggested order (one developer, one branch, phased commits)

1. **Shared layer:** R1–R9 (`Screen` widths and gutters, the `Columns`, `SplitPane` and `MasterDetail` layouts, a grid, desktop sizes in the primitives, navigation drawn immediately, window-level glow), the guide amendment and the D-record. Re-render every route to confirm nothing regresses at 390 and 768.
2. **Client D screens:** sign-in (D1), activation (D2), portal home (D4), hotels (D5), hotel detail (D6), saved and compare (D7), requests (D8).
3. **Staff T screens:** the T5 hotel record (header + tabs + side column), T6 enquiries master-detail, the T3 detail header on leads, accounts and users, the T12 admin section strip, then the stretched lists moved to `DataTable`.
4. **Phone fixes** from §4, and the §5 details that need no decision.

Check each screen at 390, 768 and 1440 (guide §10) against its artboard.
