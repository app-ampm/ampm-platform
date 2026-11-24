# Hotel Information Form and the hotel catalogue: integration plan

> **Status:** agreed plan, 23 November 2026. Nothing here is built yet.
> The developer answered the questions in §3 on 23 November 2026, relaying AMPM's answers where the question was AMPM's; three points stay open (§14). The whole feature is built in one go, and real hotels get links once it is complete.

**Inputs**

- AMPM's "Hotel Information Form" (PDF, sections 1 to 7).
- The developer's brief:
  - A public, shareable link is sent to each hotel by email or a messaging app.
  - Hotel staff give their name, designation and a mobile number verified with a one-time code before they fill in the form.
  - There are three separate upload fields: Property Fact Sheet (PDF or PPT), Food Menu (PDF or Excel) and Liquor & Beverage Menu (PDF or Excel).
  - After submission the hotel is held as a draft, and AMPM merges the details field by field, whether the hotel is already in the catalogue or new.
- Six real hotel fact sheets, used only as a reference for the fields a hotel can have. Their contents are not copied into this plan, and must never be copied into tests.
- The code at `origin/main` 926dc5d.

**How the plan was made**

1. A read-only audit covered the catalogue, the public building blocks, the UI kit, AMPM's requirement documents and the fact sheets.
2. Three independent designs were drafted: catalogue-first, security-first and journey-first.
3. Two judges scored them, and the designs were merged into one plan.
4. Three adversarial checks tested that plan: its claims against the code, its security and policy, and its completeness against the form and the fact sheets.

The checks found 1 blocker and 26 major problems. This version fixes all of them (Appendix B), except that while codes are shown on screen the blocker's fix cannot hold (§9.1). The developer's answers to the open questions (§3) then simplified the identity step and the delivery.

**Identifiers**

| Identifier | Meaning |
| --- | --- |
| HF-01 to HF-08 | The public form pages |
| TW-99 and TW-100 | The new staff screens |
| AC-39 and AC-40 | The new acceptance tests |
| Flow 13 | The new user flow |
| `HIR-2026-0001` | Request references |
| HF-G1 to HF-G14 | Go-live gates |
| Slices 0 to 14 | Delivery steps (Slice 1 is done; Slice 13, SMS, waits for a provider; Slice 15 was dropped) |
| RSVP G1 to G9 | The Guest RSVP boards (a design precedent) |

D-172 onward are proposed decision numbers (D-171 went to the staff over-read fix, PR #189). Confirm the next free number when you create them with `docs/tools/new_decision.py` from the main checkout.

---

## 1. The plan in one page

- **AMPM starts every request; there is one per hotel.** The Hotel team starts every information request from the staff app:
  - for a hotel AMPM already has, "Request details from the hotel" on its record;
  - for a new hotel, "Invite a new hotel" with a name, an existing destination and a proposed web address, checked against every hotel, deleted ones included.

  There is no generic link, so no submission ever has to be matched to a hotel by guesswork.
- **One link per request.** AMPM sends the hotel's management one link, `https://site.ampmverse.com/hotel-form#k=…`, by email from the app or pasted into WhatsApp. The hotel shares it with the colleagues who help. The secret sits after the `#`, so it never reaches AMPM's server logs. AMPM can cancel the link or send a new one, and it expires after 30 days unless AMPM extends it.
- **Name, designation and a mobile code.** Before the form, each person gives their name, designation and mobile number, and enters a one-time code.
  - Until an SMS provider is wired (to be chosen later), the code is shown on screen, as client sign-in does today. The developer accepted that in this mode the code proves nothing: the link is the key, and AMPM's review is the safety net. The review screen marks these mobiles "not checked".
  - Once the provider is wired, the code goes by text message and is never shown.
- **A shared draft that saves as you go.** Colleagues at the hotel (sales, banqueting, food and beverage) each enter their own mobile code, then fill in different sections of one draft. Each section saves automatically. Submitting locks the answers and shows a reference number.
- **Three separate upload fields**, plus floor plans and photos per property, room category and venue:
  - Property Fact Sheet: PDF or PowerPoint (.pptx, or the older .ppt).
  - Food Menu: PDF, Excel (.xlsx, or the older .xls) or photos.
  - Liquor & Beverage Menu: PDF, Excel or photos.

  Every file is checked by its content and scanned for viruses, and an unsafe file is refused with a plain reason. AMPM opens Office files only as downloads.
- **"Saved as draft" means staged.** A submission is held on its request, and the catalogue is not touched until a Hotel-team reviewer merges it.
  - New hotel: the reviewer's first "Apply changes" creates it as a DRAFT hotel, invisible to clients, and staff activate it when it is ready.
  - Existing hotel: only the fields and rows the reviewer accepts change, and the hotel keeps its status.
- **A field-by-field merge.** For every field the reviewer sees what AMPM has and what the hotel says, and chooses Keep, Use the hotel's or Edit.
  - Differing values have no default.
  - Identity fields and contact channels are never accepted in bulk.
  - Some fields are never written by a merge.

  The merge is all-or-nothing and will not overwrite a staff edit made meanwhile. It logs every field it changes with the values before and after. It records verifications dated to the evidence, never for rates, and clients see "Verified on <date> by AMPM" for them, as for AMPM's own checks.
- **Prices stay with AMPM.** The form has no price fields. Menus and liquor lists arrive as files and are filed as internal documents. Staff turn their prices into draft rate cards, which reach clients only after a rates verification (D-170).
- **One planner for imports and the form.** The staff spreadsheet import for rooms, venues and rates (TW-25, one template per kind) and the form's merge share one pure planner in `packages/core`. It normalises values, compares them and matches rows, and a blank never clears a value. The imports come first, because staff are loading fact-sheet hotels now (§4.8).
- **Built in one go:** about 57 developer-days over Slices 0 to 14, plus about 15% contingency, so about 65. The staff over-read fix (Slice 1) is already live, and SMS codes (Slice 13) add about one day once a provider is chosen. Everything is built first, and real hotels get links once the whole feature is complete, at about day 57.
- **Before release:**
  - AMPM's confirmation that this is not a hotel login, given on 23 November 2026, is recorded (Slice 0);
  - the privacy and declaration wording is approved;
  - body limits are set at the box's edge;
  - media backups are hard-link snapshots, with the free-disk guard and alert live;
  - a production test run passes.

---

## 2. What exists today (audit at 926dc5d)

### 2.1 The catalogue

**Hotels**

- Has:
  - name and slug (the web address: unique across all rows, deleted ones included, and never changed);
  - brand, star category (free text), address (free text), client description, website, total rooms, facilities;
  - `street_view_ref` (255 characters);
  - demo and showcase flags, status (draft, active or inactive), internal rating and notes;
  - a required destination, and `last_verified_at`.
  - Latitude and longitude exist but are staff-only and not editable in the staff app.
- Missing:
  - city, state, PIN and locality;
  - a Maps link that fits (Google links exceed 255 characters);
  - parent group and name variants;
  - distances;
  - booking rules;
  - food and beverage facts and cuisines.

**Room categories**

- Has: name, room count, size in whole square metres, maximum occupancy (0 is allowed), facilities and description.
- Missing: unit type (villa, tent, suite), view, bed configuration, and the square feet the hotel published.

**Venues**

- Has:
  - name;
  - a required venue type (ballroom, lawn, poolside, rooftop, courtyard, beach or other) and a required indoor flag;
  - area in whole square metres;
  - banquet, theatre and reception capacities, whose meanings are not defined.
- Missing: covered or semi-open spaces, more venue types, dimensions, ceiling height, pre-function areas, other layouts, capacity ranges, and the published square feet.

**Contacts** (RESTRICTED-CONTACT)

- Has: name, role title, phone (free text), email and a primary flag.
- Problems: several contacts can be primary, and phones are not normalised to E.164.

**Media and documents**

- A photo can belong only to a hotel. It has no purpose (property, room, venue, dining or floor plan) and no link to a room or venue.
- Documents accept PDF, JPEG or PNG up to 20 MiB. A `menu` type exists. There is no fact sheet, beverage menu or floor plan type, and no hotel documents screen.

**Verifications**

- The sources are phone, email, site visit, website and contract.
- Recording a verification neither refreshes `last_verified_at` nor computes the next due date.

**Visibility and history**

- Only the hotel row has a draft state. Profile fields, rooms and venues written to an active hotel are visible to clients at once. Contacts are never visible to clients.
- There is no per-field history. Audit images are thin, and for hotel records only the Super Admin can read the audit log.

**Production state:** the catalogue has been empty since 23 November 2026 (D-166), and the team is creating hotels from fact sheets.

### 2.2 Public building blocks

**The existing public form.** `POST /crm/enquiries` on site.ampmverse.com has:

- a Turnstile bot check;
- consent capture with a notice version;
- a duplicate flag;
- an in-app notice to Sales.

It is the template for the new public routes.

**One-time codes**

- `apps/api/src/identity/one-time-code.ts` can bind a code to any id.
- Client sign-in codes, auth tokens, sign-in grants and sessions all need a `users` row, and hotel staff must not become users. Q22, A-22 and P-11 rule that out, as does "No self-registration anywhere" in `.claude/rules/security.md`.

**Messaging**

- SMS is not live: production uses the console provider and shows client sign-in codes on screen (D-147). Only the sign-in DLT template is mapped.
- Email through Resend works. The recorded plan is the free one: 100 emails a day and 3,000 a month (D-143), shared with every other email AMPM sends.
- WhatsApp has no adapter.
- Notifications can only address users.

**Uploads**

- There are four staff-only `application/octet-stream` routes.
- The API buffers up to 26 MB of the body on those paths before any guard runs, even for anonymous callers.
- There is no PowerPoint or Excel detection.
- Photos are re-encoded; documents keep their bytes as uploaded, image metadata included.
- ClamAV is live and fails closed.

**Storage**

- Files sit on the shared box's local disk, which had about 32 GB free when measured on 23 November 2026. (An earlier estimate of 10 GB was wrong.) Docker's build cache held 27 GB of it, 19 GB reclaimable.
- The nightly media backup keeps 15 full archives on the same disk, so each stored GB costs about 16 GB.
- Deploys refuse to run under 8 GB free.
- Neither Plesk's nginx (which terminates TLS) nor Apache behind it limits request bodies.

**Hosting**

| | site.ampmverse.com | app.ampmverse.com |
| --- | --- | --- |
| Built with | Next.js | Expo web export |
| Content Security Policy | Enforced nonce CSP | Report-Only |
| Bot check | Turnstile | No Turnstile |
| Scripts | Small per-route bundles | One 5.8 MB script |
| Tokens on the origin | No staff or client tokens | Staff and client tokens in localStorage |

**Route rules**

- Every public route carries a rate limit with an explicit fail mode and an audit decorator. Architecture tests enforce both (D-149).
- CORS allows only the `authorization`, `content-type` and `x-request-id` request headers, and exposes only `x-request-id`.

### 2.3 Defects found during the audit (fix whether or not the form is built)

1. **Staff over-read.** `GET /hotels-admin/hotels/:hotelId` needs only `hotels.hotel_profiles_client_fields.read`, which CD, VC, RG, HL and FA hold. It nevertheless returns contacts and the internal rating and notes, which the permission matrix denies those roles (HL may read contacts only under its condition). Fixed in Slice 1: PR #189 (D-171), live since 23 November 2026.
2. **The hotel CSV import overwrites.**
   - A blank cell clears the value.
   - Status falls back to draft.
   - The showcase flag is forced off.

   So re-importing a curated hotel damages it. A clash with a soft-deleted slug fails the whole file with a 500, and the 100 KB JSON body cap limits file size. Fix all of this in Slice 2.
3. **Verifications do not refresh freshness.** Recording one does not refresh `last_verified_at` or compute `next_due_at` (AC-04.3). Fix in Slice 2.
4. **Contacts.** Several contacts can be primary, and phones are free text. Fix in Slice 3.
5. **Rate items.** Nothing checks that a rate item's room or venue belongs to the card's hotel. Fix in Slice 4.
6. **Pre-guard buffering.** The four existing upload routes buffer anonymous bodies before authentication. Fix in Slice 6.
7. **No pixel limit on images.** The image pipeline sets no explicit pixel limit (sharp's default is about 268 megapixels), so one crafted image could take down the 1 GB API container. Fix in Slice 6.

---

## 3. Decisions (answered 23 November 2026)

The developer answered these on 23 November 2026. Where a question was AMPM's, the developer relayed AMPM's answer. Slice 0 records every answer in `docs/decisions.json`; the D-records in §12.1 carry the ones that shape the build.

| # | Decision | Answer | What it means |
| --- | --- | --- | --- |
| 1 | Is a contributor with a link and a code, and no account, a "hotel login"? | No. AMPM has agreed | Record AMPM's confirmation in `docs/decisions.json` (Q22, A-22, P-11) in Slice 0 |
| 2 | When a new hotel's draft row is created | At the reviewer's first "Apply changes" | No rows or web addresses are left behind by invites that never answer; there is one merge path |
| 3 | Order of work | Build everything in one go, and release when complete | The slices still land as separate pull requests in dependency order, but no hotel gets a link until the whole feature is done (§10) |
| 4 | Checking the mobile before an SMS provider is wired | A one-time code shown on screen, as client sign-in does today, until the provider is wired | No email code, and no call-back to check a contributor's mobile before merging. (The call to confirm a changed contact channel on an existing hotel, §4.6, is a separate anti-fraud check and stays.) In this mode the code proves nothing: the link is the key, and AMPM's review is the safety net. The review screen marks these mobiles "not checked". The developer accepted this for real hotels, which departs from D-148's rule for clients |
| 5 | SMS provider and DLT template | Decided later | The proposed template stands: "{#var#} is your AMPM verification code for the hotel information form. It is valid for 5 minutes. Do not share it. -AMPM" |
| 6 | Who may take part | Anyone with the hotel's link who gives a name, designation and mobile, and enters the code | No email step and no invite list. At most 10 people per request. AMPM can remove a person, but while codes are on screen only reissuing the link keeps someone out |
| 7 | Link defaults | One link per request, valid 30 days, extendable by up to 60 more | Reissuing ends the sessions opened with the old link |
| 8 | Email budget | The free plan is enough | The form sends no codes by email: only the link, staff notices, a few notes to the address AMPM entered, and notices to contacts a reviewer adopts or replaces (§4.6, §9.3) |
| 9 | Disk and backups | Hard-link snapshot backups only; no disk upgrade yet | The box had about 32 GB free on 23 November 2026, so the planned upload caps stand (250 MiB, 80 photos, 20 documents per request). Add disk or online storage when the free-disk alert says so |
| 10 | Accepted files | Also the older .ppt and .xls | Served to AMPM only as downloads; refused when encrypted or when the scanner finds macros |
| 11 | Capacity meanings | Seated is banquet, floating is reception, theatre stays theatre | A range keeps its maximum in the column and the range in the notes. AMPM agreed |
| 12 | Booking terms for clients | Internal for now | Showing them later is an additive change |
| 13 | What a "No" to 7.5 means | Internal use only, and no photos | The merge may go into draft or inactive hotels and internal fields; a live hotel's client fields change, and a hotel holding them goes live, only with a recorded reason; no photo is shown. 7.5 is reworded to promise only what AMPM shows |
| 14 | Verification label for clients | "Verified on <date> by AMPM" for both | Reviewed hotel-form data moves the client-facing date like AMPM's own checks; staff still see the source |
| 15 | The question set | Approved as planned (§5.3) | Every added question stays optional |
| 16 | Prefill for seasonal refreshes | Not asked; the recommendation stands | None by default |
| 17 | Where the form lives | Not asked; the recommendation stands | `site.ampmverse.com/hotel-form` on apps/web, with `packages/web-forms` |
| 18 | Browser test tooling | Add `@playwright/test` and `@axe-core/playwright` | apps/web dev dependencies, recorded in a D-record |
| 19 | Import shape | One template per kind | Record the AC-35.1 change, and update the build plan's G1 pack |
| 20 | Retention | The proposal is approved | See below. Nothing is deleted automatically |
| 21 | Reply-to mailbox and help contact | AMPM's existing admin mailbox for now | Kept in a setting, so it can change later |
| 22 | Extra topics: wedding rules, indicative prices, dining outlets | None | Dining outlets (the former Slice 15) are out of scope |

The approved retention periods:

- code challenges, IP addresses and user agents: kept 12 months;
- people on requests that expired unsubmitted: 12 months after expiry;
- rejected or revoked requests and declined files: 12 months;
- contributors' personal data on merged requests: masked after 24 months.

Every clean-up needs Super Admin approval (A-17, T-9). A lawyer confirms the legal minimums for logs (CERT-In; DPDP Rules) before the first one.

---

## 4. How it works

### 4.1 Existing and new hotels: one request, one merge

| | Existing hotel | New hotel |
| --- | --- | --- |
| Started from | The hotel's record: "Request details from the hotel" | The Hotels list: "Invite a new hotel" (name, existing destination, proposed web address; duplicate hints shown) |
| Bound to | The hotel | A proposed identity held on the request; no catalogue row yet |
| On submit | Answers locked and staged | Answers locked and staged |
| Review target | That hotel | "Create as a new draft hotel" by default, or "Merge into an existing hotel" when a duplicate surfaces |
| Result of the merge | The accepted fields and rows change; the status does not | The hotel is created as DRAFT with the accepted fields, in the same transaction; staff activate it with the activation checklist |
| Seen by clients | At once, for the client fields of an active hotel (the reviewer is warned) | Not until staff activate it |

**Rules**

- **One live request at a time:** per hotel, and per proposed web address for new hotels (partial unique indexes).
- **Duplicate hints when inviting:**
  - the normalised name, checked against every hotel and its name variants;
  - the web address, checked against every row, deleted ones included (with the reason);
  - the website host, flagged as weak evidence when it is a brand's shared domain.
- **Hotels staff already created** from a fact sheet use the existing-hotel path.
- **Deleted hotels:** deleting a hotel revokes its live request in the same transaction, and its link then shows "not active". An inactive hotel can still be refreshed.

### 4.2 Requests and links

**What a request is.** One round (first onboarding or a seasonal refresh), with one link, one shared draft and one review.

**The link**

- Each request has one secret: 32 random bytes, written `hfl_` plus base64url and stored only as a SHA-256 hash.
- The URL is `https://site.ampmverse.com/hotel-form#k=<secret>`. The page moves the secret out of the address bar (`history.replaceState`), keeps it in sessionStorage and sends it only in POST bodies.
- Staff see the link once, when they create or reissue it. In the same sheet they can tick "Email it", which sends it to the hotel contact they entered through Resend, with click and open tracking off. Or they can copy it for WhatsApp, by plain copy or the phone's share sheet. Never use a `wa.me?text=` link, which hands the whole link to a third-party redirect.
- The hotel's management shares the link with the colleagues who help.

**Reissue and revoke**

- Reissuing rotates the secret and ends every session opened with the old one. Every copy the hotel forwarded stops working too, so the sheet warns about it. The draft is kept.
- Revoking the request ends the link.

**Validity**

- A link is valid for 30 days, extendable by up to 60 more. Opening it spends nothing.
- After a merge the request is status-only for 7 days. Contributors can see the status and send a correction message, but cannot edit or add people. After that the link expires, and later corrections go through Reopen or a new refresh request.
- Seasonal updates (about three a year) get a new refresh request per hotel, never a permanent link. Bulk creation comes in Slice 14.

**What the `#` protects**

- It keeps the secret out of AMPM's nginx and Apache logs, request URLs and Referer headers.
- It does not keep the secret from the hotel's mail system, mail-security link scanners (Microsoft Safe Links, Proofpoint, Mimecast) or anyone the email is forwarded to.

While codes are shown on screen (§4.3), the link is the only key to the form: anyone who gets it can take part. Share it only with the hotel's management, and reissue it if it may have leaked.

**Counting opens.** Mail scanners open links too, so "opened" is recorded only after a human step (asking for a code). The chase filters use "code requested" and "verified".

### 4.3 Who may take part, and how they prove it

**Who may take part**

- Anyone who has the hotel's link may take part. They give their name, a designation (from a list, or Other) and a mobile number (+91), accept the versioned privacy notice, and enter a one-time code. There is no email step and no invite list (decision 6).
- At most 10 verified people per request. Unverified attempts do not count.
- AMPM can remove a person: their sessions end, and their place among the 10 is freed. While codes are shown on screen this cannot keep them out, because they can come back with another mobile; reissue the link instead.

**The identity step** (it replaces form questions 7.1 to 7.3)

- The details stay on the code challenge until the code is entered. Only then is the person created (or, for someone returning, found by their mobile) and the notice consent recorded. Nothing a stranger types before entering a code can change anyone's record.
- Someone returning enters their mobile and a new code.
- A verified person's name and designation change only inside a session. A new mobile needs a new code.
- Here "verified" means "entered a correct code". Only an SMS code checks the mobile. While codes are shown on screen, anyone with the link can type a colleague's mobile and act as that colleague (§9.1).

**Codes**

| | On-screen mode (until an SMS provider is wired) | SMS mode (once wired) |
| --- | --- | --- |
| Delivery | Returned to the page and shown, as client sign-in does today (D-147) | Sent by text message to Indian mobiles only, through a separate DLT template |
| Length and life | 6 digits, valid 5 minutes | 6 digits, valid 5 minutes |
| What it proves | Nothing: the link is the key | That the person holds that mobile |
| On the review screen | "Mobile not checked" | "Mobile checked by SMS" |

- Each code is bound to the challenge id with an HMAC under its own key (HKDF label `ampm/hotel-form-code`), reusing `one-time-code.ts`. No users, auth tokens or sign-in sessions are created.
- Each code allows 5 tries, reserved atomically. After 3 burned codes the mobile is locked for an hour.
- On-screen mode is not a manual setting. It is on exactly while the hotel form cannot send its own SMS: no SMS provider is configured, or `SMS_HOTEL_FORM_TEMPLATE` is not mapped. It turns off by itself once both are in place, even if client sign-in wired the provider first. Tests check that no response, log or stored notification carries a code when it is off, and that adding the provider and the template turns it off with no other change.
- On 23 November 2026 the developer accepted that real hotels use the form in on-screen mode (decision 4). This departs from D-148's rule for clients and is recorded in the D-record.

**Limits**

All limits fail closed under `hotel_form:*` keys, never the client sign-in keys.

| Scope | Limit |
| --- | --- |
| Every code request | A Turnstile pass, checked for hostname and action, with a 5-second timeout |
| Per network | 10 code requests a minute, 60 a day |
| Per mobile | A 30-second pause, then 5 an hour and 10 a day |
| Per request | 20 code requests an hour, 50 a day; at most 10 verified people |
| All requests, SMS | 300 a day by default (SMS mode) |

When the global SMS cap trips, the code routes answer 503 "try later", and the Super Admin and the Hotel team get one in-app alert a day (§4.10). The per-network, per-mobile and per-request limits answer as every other rate-limited route does (D-149), with no alert.

**Sessions**

- A correct code returns an opaque session token (`hfs_…`, stored as SHA-256). The page keeps it in sessionStorage and sends it as a Bearer header, which CORS already allows.
- No cookies are used, so there is no CSRF surface.
- A session expires after 2 hours idle or 12 hours in all. A person can hold at most 3.

On every call the server re-checks:

- the link's generation;
- the request's status and expiry;
- that neither the request nor the bound hotel is deleted;
- that the person is not removed;
- the kill switch.

On a 401 the page asks for a new code in place and keeps unsaved input.

The `/_api/hotel-form` paths must stay outside every Basic-Auth curtain. On 16 November a Bearer header sent to a Basic-gated path made Plesk's fail2ban ban the sender's IP, and a hotel office shares one IP.

### 4.4 The form itself

**Where it lives**

The form lives on the public website (apps/web) at:

- `/hotel-form`
- `/hotel-form/overview`
- `/hotel-form/sections/[section]`
- `/hotel-form/review`
- `/hotel-form/status`

`docs/architecture.md` keeps public forms and the guest portal "separate from the authenticated app so guests and visitors never reach staff or client code paths". The site also already has:

- an enforced nonce CSP and Turnstile;
- small pages, which matters on 4G;
- no staff or client token on its origin.

The portal would let us reuse OtpInput and Sheet. But it loads a 5.8 MB script with a Report-Only CSP, on the origin that holds staff tokens.

**Shape.** It follows the Guest RSVP boards (RSVP G1 to G9), adapted for several sittings and several people:

- HF-01 Welcome and privacy notice
- HF-02 Your details
- HF-03 Enter your code
- HF-04 The hub: AMPM's label and note; "Quick start: upload your fact sheet and menus first"; seven sections with their status; who else is helping
- HF-05 Section pages
- HF-06 Review and submit
- HF-07 Submitted, with status and corrections
- HF-08 One page for any link that is not active

**The seven sections**

1. Property and location
2. Contact for weddings and events
3. Rooms
4. Venues
5. Booking terms
6. Food and beverage (with upload fields 2 and 3)
7. Fact sheet, photos and floor plans (with upload field 1)

**Saving**

- Each section saves automatically: 1.5 seconds after typing stops, on leaving a field, and when the page is hidden. It shows "Saved", "Saving" or "Not saved – retry".
- Each section has a version. If a colleague saved the same section meanwhile, the person chooses which version to keep.
- Unchanged content is not rewritten.
- A section is capped at 32 KB (96 KB for rooms and venues), and the number of rows is capped too.

**Required to submit:** the hotel name, city, state, at least one contact with an email or mobile, and both declarations. Empty sections give a warning; they do not block. Every question AMPM's PDF does not ask is optional.

**Submitting**

The review page shows a summary with Edit links, then:

1. 7.4 (accuracy) as a required tick.
2. 7.5 (display authorisation) as an explicit Yes or No, never pre-ticked.
3. Turnstile, then Submit.

Then:

- The answers lock.
- An immutable submission revision is written, holding every answer plus each file's id and SHA-256.
- Both declarations are recorded against that revision's hash.
- The page shows the reference (`HIR-…`), and AMPM's Hotel team is notified.

**After submitting**, the status page shows the reference and the status. It offers "Request a correction", which sends a message that staff read only in the app, and "Withdraw my consent / remove my details".

**Working with colleagues**

- Before submitting, the page warns if a colleague saved in the last few minutes.
- After a refused save on a locked request, it says who submitted and keeps the unsaved text.

**Refresh requests**

- They say "fill in only what changed; blanks leave our records unchanged".
- They offer "No changes since last time" per section.
- They ask, per section, "Anything no longer offered or renamed?"

**Language.** English only for now, with every string in one copy module so other languages can follow (Q16 made English the primary language).

**Headers.** Pages under `/hotel-form` send:

- noindex, nofollow, noarchive;
- `Referrer-Policy: no-referrer`;
- `Cache-Control: no-store`;
- the enforced CSP, with the API origin added to `img-src` for signed thumbnails.

Link previews show generic text and nothing about the hotel. The site's `.htaccess` sets X-Robots-Tag and Referrer-Policy with `Header always set`, which would send a second value next to the page's own. Switch those two lines to `Header setifempty`, or exclude `/hotel-form`, and check the result by GET.

**Field kit**

The plain-HTML fields live in a new presentational package, `packages/web-forms`, shared with the website's contact form (reuse rule 2):

- text and select;
- number with unit;
- Yes / No / Depends radios;
- repeatable row fieldsets with legends;
- code input;
- file field and photo uploader.

`packages/ui` is not the place, because it is built on React Native primitives and audited for native classes. The kit holds no fetching or upload logic: that stays in apps/web hooks and `packages/api-client`. The house form pattern stays: `useState`, pure `*.form` helpers and Zod schemas from `packages/core`, with no react-hook-form or Zustand.

### 4.5 The three uploads, floor plans and photos

**Slots and types**

Types are detected by content, never by file name or declared type.

| Slot | Accepted | Size cap | Count |
| --- | --- | --- | --- |
| Upload field 1: Property Fact Sheet | PDF; PowerPoint PPTX, PPSX and templates, or the older .ppt. The page also asks "When was it last updated?" (month) | PDF 20 MiB; PowerPoint 25 MiB | 2 live files (for example a fact sheet and a capacity chart), each replaceable |
| Upload field 2: Food Menu | PDF, Excel XLSX or the older .xls, or JPEG or PNG photos of menu cards | PDF and photos 20 MiB; Excel 10 MiB | 3 |
| Upload field 3: Liquor & Beverage Menu | As the food menu | As the food menu | 3 |
| Floor plans | PDF, JPEG or PNG, never downscaled | 20 MiB | 10 |
| Photos | JPEG, PNG or WebP, downscaled in the browser to 2,560 px | 20 MiB before downscaling | 20 property, 6 dining, 6 per room or venue row |

**Budgets**

- Per request: 80 photos, 20 documents and 250 MiB.
- The 250 MiB counts every retained byte, removed and replaced files included. The 80 photos and 20 documents count live files only.
- At most 20 removals or replacements per request a day, and at most 150 MiB per person.

**Refused**

Each refusal comes with a reason the hotel can act on:

- any Word file (.doc or .docx): "save as PDF";
- macro-enabled files (.pptm, .xlsm and the like), and older .ppt or .xls files in which a macro is found;
- macros, ActiveX, OLE objects, external templates, external links, DDE, data connections or program actions;
- password-protected or encrypted files;
- PDFs with JavaScript, launch actions, embedded files or rich media: "save as a plain PDF";
- archive tricks:
  - ZIP64;
  - more than 5,000 entries;
  - expansion over 200:1, measured while inflating rather than from declared sizes;
  - duplicate or path-traversing names;
  - local headers that do not match the central directory;
  - content before the first header or after the end record;
- any file that matches two types (a polyglot);
- malware.

**The OOXML check**

It is hand-written in `apps/api/src/modules/documents/ooxml.ts`, with no new dependency. It:

1. reads the central directory under a byte bound;
2. inflates `[Content_Types].xml` and every `.rels` part with `node:zlib`, with capped output;
3. compares part names after OPC normalisation (case and percent-encoding);
4. decides by relationship type and content type, not by file names.

Its tests use real exports from PowerPoint, Excel, Google Slides and Sheets, LibreOffice, WPS, Strict OOXML and PPSX slide shows, plus one malicious fixture for each refusal.

**The older .ppt and .xls** (decision 10) are compound files. A small hand-written reader checks the compound-file signature and its directory under a byte bound, and tells PowerPoint from Excel by the main stream (`PowerPoint Document` or `Workbook`). It refuses encrypted files and files with a macro storage, and ClamAV's macro alert is a second check. AMPM gets these files only as downloads.

**Transport**

This also fixes the pre-guard buffering on every upload route, not just the form's.

1. **Register.** The page registers the file: a client UUID v7, the slot, the room or venue row, the name and the size. The server checks the type list, size cap, slot count, request and person budgets, and free disk; it refuses when under 9 GiB is free. A registered file that is never uploaded expires after 30 minutes and stops counting.
2. **Send the content** to `POST /hotel-form/files/:id/content` as `application/octet-stream`.
   - **Guards first.** The global raw body parser is removed. Every upload route uses one shared reader that runs after the guards: the four staff routes, hotel documents, the CSV imports and this one. Authentication (or the form session), the fail-closed rate limit and the session's write window therefore all run before the API reads any byte.
   - **Body rules.** Content-Length must equal the registered size, and chunked bodies are refused.
   - **Byte counter and deadline.** The reader counts bytes as it reads, with a 60-second deadline. A deploy may cut an upload in flight; the page then retries it.
   - **Concurrency.** At most 2 uploads at a time per session, 2 per request and 4 per API process.
   - **Busy answers.** When it is busy the route answers 503 with the retry time in the error body. `retry-after` is also added to the CORS exposed headers.
3. **Check and store.**
   - Content detection, then ClamAV, which fails closed.
   - Photos go through sharp, one at a time per process behind their own semaphore. The settings are a 25-megapixel input limit, `sharp.cache(false)`, concurrency 1 and `failOn: "error"`. The image is rotated and all metadata is stripped.
   - Images in document slots (menu photos and floor plans) are re-encoded without metadata but never downscaled.
   - Each file is written under a temporary name and renamed on success. A sweep removes orphans.
   - Files are owned by the request (media owner type `hotel_info_request`; documents with that owner type), internal, and never seen by clients until a reviewer adopts them.

**At the edge**

- Plesk's nginx keeps `client_max_body_size 1m` site-wide, and raises it to 32m only in a location block for the upload paths.
- nginx also gets `client_body_timeout 30s`, request buffering on, and `limit_conn` and `limit_req` zones on the upload paths.
- Apache's limits go in the domain's "Additional Apache directives" (vhost context, under `<Location /_api>`), not in `.htaccess`.
- The disk check watches nginx's client-body temporary directory.

**Serving outsiders' files**

For the first time, files come from outside AMPM, onto the origin where the portal keeps staff and client tokens. So:

- Files are always served with the detected type, never the declared one, plus `X-Content-Type-Options: nosniff`.
- Document links and media blobs get `Content-Security-Policy: default-src 'none'` and `Cross-Origin-Resource-Policy: same-site`.
- They also get `sandbox` wherever it does not break the browser's PDF viewer (checked per browser in HF-G11). A PDF that cannot be sandboxed is served as an attachment.
- Everything except PDFs and raster images is served with `Content-Disposition: attachment`.

Two separate tasks are worth scheduling: a separate files origin before more upload types are added, and switching the portal CSP from Report-Only to enforced.

**ClamAV**

These settings are set through the image's `CLAMD_CONF_*` variables:

- `StreamMaxLength 32M`;
- `AlertOLE2Macros yes`;
- `AlertExceedsMax yes`, with explicit `MaxScanSize`, `MaxFileSize`, `MaxRecursion` and `MaxFiles`;
- `AlertEncryptedArchive yes` and `AlertEncryptedDoc yes`.

**Disk**

Before any public upload (decision 9: smarter backups, no disk upgrade yet):

1. Media backups move to 14 daily hard-link snapshots (`rsync --link-dest`), with the provider's daily off-box disk backup as the second layer.
2. Free space is measured. The upload guard refuses new files below 9 GiB free, 1 GiB above the 8 GB deploy floor, so release needs at least 2 GB of headroom above the guard. Clear old build caches if it is short.
3. A worker job checks free space on the storage volume every 15 minutes, and alerts the Super Admin and the Hotel team in-app and by email.

On 23 November 2026 the box had about 32 GB free (§2.2), so about 23 GB sits above the guard. Every write to the media store replaces the file with a new one, written beside it and renamed over the key (D-185), so the snapshots can hard-link to the live files and keep the version they linked, and a stored file then costs about its own size once. That headroom holds about 90 requests at the full 250 MiB, first onboardings and refreshes together. If the snapshots only link to each other, each file costs twice its size and that halves to about 45. Real requests will mostly be far below the cap. Track the real bytes per request from the files table, and add disk or move to online storage when the alert says so.

### 4.6 Review and merge

**TW-100** (staff app). Opening a submitted request claims it ("in review"), and "Release" hands it back. The header chips show:

- "Mobile checked by SMS", or "Mobile not checked" while codes are shown on screen;
- the official website staff entered at invite, as AMPM's own reference (never a value the hotel typed);
- the answer to 7.5.

**The planner.** `HotelChangeSet` in `packages/core` is pure and shared with the imports. It:

- normalises both sides (whitespace, units, E.164 phones, https URLs);
- compares them field by field;
- suggests row matches.

**Fields**

Each field shows four columns: what AMPM has now, what the hotel says, Keep / Use the hotel's / Edit, and the final value.

- Where the catalogue is empty, the default is the hotel's value. A blank answer never clears a value.
- Where the values differ there is no default, and Apply stays disabled until each one is decided.
- Identity fields (name, address, destination, website, Maps link) and contact channels need a decision each. A bulk "Use the hotel's" skips them.
- A merge never writes the web address, status, demo or showcase flags, or internal rating and notes. A destination can only be chosen from existing ones.
- Client free text (description, access notes, capacity notes, room and venue notes, photo captions) is edit-only. Values that contain a phone number, an email address or a URL are flagged and kept out of bulk accept, because they would put contact details in front of clients.

The reviewer is warned when:

- venue area and length × width differ by more than 5%;
- area per seated guest falls outside 0.8 to 20 m²;
- seated capacity is above floating;
- distance and drive time imply under 5 or over 100 km/h;
- total rooms differs from the sum of the categories;
- occupancy is above 12;
- minimum nights is above 7;
- the fact sheet is older than 12 months.

**Rows**

- Rooms and venues match by normalised name: exact matches are pre-selected and similar names suggested. Contacts match by email, then E.164 phone, then name.
- Each row is updated, added or skipped. A merge never deletes or recreates a row, because rate items point at rooms and venues.
- A venue type must be chosen before Apply; the screen suggests one from the venue's name.
- A separate "Retire row" action, outside the merge, soft-deletes a room or venue the hotel says is gone, after checking its rate items.

**Contacts on an existing hotel are identity decisions**

These changes would let an impostor redirect enquiries and payments:

- a change to an existing contact's phone or email;
- a new primary contact;
- demoting the current primary.

Each needs its own decision, with no bulk accept and no default. The screen shows which contributor supplied the value. A recorded out-of-band confirmation is required before Apply: a call to the existing contact, or to the independently sourced switchboard. After the change, the previous address is told.

New contacts on a new draft hotel follow the lighter rule. Only one contact can be primary.

**Files**

- The reviewer adopts or declines each file.
- Documents are filed on the hotel. A fact sheet is titled "Fact sheet (as of <month year>)", using the date the hotel gave. Menus and floor plans stay internal.
- Photos get a purpose and a room or venue.
- "Show to clients" (rights: licensed) is offered only for a photo whose SHA-256 is in a submitted revision where 7.5 was Yes.
- Brand imagery, renders and photos of identifiable guests stay `consent_required`.

**If 7.5 is No**

- The request can still be merged into a draft or inactive hotel, along with internal fields, documents and contacts.
- Writing the client fields of an active hotel needs a reviewer override, with the reason recorded in the change log.
- Switching on (or back on) a hotel whose client fields came only from a revision with a No needs the same recorded reason, unless AMPM has since confirmed those fields itself (for example, with its own website or site-visit check). The change log identifies the fields.
- No photo can be shown to clients.

**Resubmission**

- Each decision is stored with the revision and a hash of the submitted value it was made on.
- When the hotel resubmits (after Request changes or Reopen), decisions whose value changed go back to undecided.
- The plan hash includes the revision and the answer hashes, so merge-preview and merge answer 409 if any decision no longer matches.

**Apply**

Apply runs as one transaction with a 30-second timeout:

1. Lock the request row and, for an existing hotel, the hotel row.
2. For a new hotel, re-check the web address and create the hotel as draft (`insertHotel(tx)`, audited inside the transaction).
3. Re-plan from the current catalogue and compare against the seen tokens:
   - a hash of the hotel's fields;
   - each child row's `updated_at`, compared at millisecond precision;
   - the set of rows.

   If a staff edit landed since the review opened, the answer is 409 naming the entries. The screen refreshes them and the reviewer decides them again.
4. Update child rows only where the id, the hotel and `updated_at` still match (`updateMany`; the count must be 1).
5. Re-own adopted documents and media, only if the request still owns them.
6. Record a verification for each field group the reviewer ticks:
   - source `hotel_form`;
   - dated to the evidence, no later than the submission;
   - `next_due_at` computed;
   - never for rates or availability.

   Then recompute `last_verified_at`. Clients see "Verified on <date> by AMPM" for these, as for AMPM's own checks (decision 14), and staff screens show the source.
7. Write one audit event per entity: ids, the names of the changed fields, masked values, and the request reference as the source. Write one change-log row per field with the values before and after; this is the Hotel team's history and a manual way to revert.
8. Mark the request merged, with the plan hash and a summary. Repeating the same plan returns the stored summary.

The service checks every catalogue permission key it writes, because custom roles are live.

**Then**

- A ConfirmSheet warns "These changes are visible to clients at once" for an active hotel.
- A new draft hotel shows an activation checklist:
  - a client description;
  - an active destination;
  - at least one room or venue;
  - at least one client-visible photo;
  - no client field taken only from a revision with a No to 7.5, unless a reason is recorded.
- The hotel gets a thank-you email at the address AMPM entered, with no text the hotel typed.

**Other actions**

- **Request changes:** a note is required. The draft unlocks. The hotel is emailed at the address AMPM entered that changes were requested; the note itself is shown only in the form.
- **Reject:** the reason is internal. HF-07 shows a neutral "AMPM has closed this request", and no email is sent by default.
- **Reopen** a merged request: answers 409 if another request for the hotel is live.
- **Release** a claim.

### 4.7 Rates, menus and liquor lists

- The form has no price fields; prices are commercial (A-4). Questions 5.3 and 5.4 ask for menus and liquor lists "with rates", and those arrive inside the uploaded files.
- Menus and liquor lists are filed as internal documents (`menu` and `beverage_menu`), with no client read path in version 1.
- Staff transcribe per-plate prices and beverage packages into a draft rate card, with hidden, unverified items. "Start draft F&B card" from a menu document comes with the documents library (Slice 6).
- A card reaches clients only through D-170: a current rates verification by phone, email, site visit, website or contract. A merge never records a rates verification, and `hotel_form` is refused as a source for rates.

### 4.8 The staff spreadsheet import: rooms, venues and rates (TW-25)

**Templates**

- One CSV template per kind: Hotels (profile), Rooms, Venues and Rates. Each downloads from TW-25 with the new columns.
- Rows are keyed by the hotel's web address. Rooms and venues are matched by name within the hotel, and rate rows by card name plus item.
- Headers are fixed, with no column mapping; an unknown header is an error.
- The file is uploaded as raw CSV (octet-stream through the shared reader), so the 100 KB JSON cap no longer applies. The new cap is 5 MB.

**Dry run first**

- The dry run gives a per-row report: create, update (listing the fields that change), unchanged, or error with the reason. It can be downloaded as an error report.
- In Slice 2, apply sends the same file again and the server plans it afresh. From Slice 3 the dry run stores its planned rows on the job, and apply runs by the job's id.
- From Slice 3, a row whose target changed since the dry run is refused at apply with "changed since preview".
- The template and the error report are built in the browser, from the core column list and the dry-run report; the API answers JSON only.

**Semantics**

- On update, a blank cell means "leave unchanged".
- Status, the demo and showcase flags and internal fields change only when the cell is filled, or on create.
- A clash with a deleted hotel's web address is a row error, not a 500.
- Rates rows become draft rate cards with hidden, unverified items, checked to belong to the hotel. Nothing reaches clients without the D-170 rates verification.
- Every applied row writes an audit event, and the job keeps its report.

**Shared with the form.** The import and the form share `HotelChangeSet`: normalisers, units, row matching, and blanks that never clear. The form's merge adds decisions, locks and seen tokens on top.

**Effect on AC-35.1.** AC-35.1 expected one template carrying hotels, rooms, venues and rates, with column mapping. Record the change as a decision and update the build plan's G1 pack.

### 4.9 Emails and notices

**Recipients outside AMPM**

- A new recipient type, `external`. `recipient_id` holds the request's id, and `recipient_address` holds the address the email goes to: the one AMPM entered for the hotel, a named contact a reviewer adopted, or a replaced contact's previous address (RESTRICTED-CONTACT).
- The address is cleared with the render data after sending or final failure, in both advance paths and in `failPermanently()`.
- User-facing notification lists show only recipients of type `user`.

**Who gets what**

- To the hotel, only at the address AMPM entered when sending the request: the link (when created or reissued), "changes requested", the reminder (Slice 14) and the thank-you after a merge. Two notices go elsewhere: a named contact gets the §9.3 notice once a reviewer adopts their details, and a replaced contact's previous address is told of the change (§4.6). Nothing else is emailed to an address typed into the form.
- To the people who fill it in: nothing by email or text message. They see the reference and the status on the page.
- To staff: email and in-app notices to active Hotel-team users on submit, on a correction request, and on cap or disk alerts. The Hotels list shows "Requests · N to review".

**What emails contain.** No email carries text a hotel typed. Emails carry only the reference, the catalogue's hotel name or the staff label, counts, and a link into the app or the form. Staff read correction messages in the app, as plain text.

**Sending**

- Hotel-form email goes out through Resend with click and open tracking off. The volume is small, so the free plan is enough (decision 8).
- The reply-to address is AMPM's existing admin mailbox for now (decision 21), kept in a setting.
- A separate sending subdomain, and bounce and complaint handling, wait for later hardening if the volume grows.

**Templates.** These are entries in the `notification.templates` configuration value, with code defaults.

**Kill switch.** Mode off also makes the worker drop any queued hotel-form emails.

### 4.10 Testing on the production box, and monitoring

**The form's mode**

There has been no staging since D-144: production is the only hosted environment, and nothing is deleted automatically. So the form has a mode in configuration:

- **off:** every public route answers 404;
- **test_only:** only requests marked as tests work;
- **on.**

The mode is read without the five-minute configuration cache, and a Super Admin switches it.

**Testing**

- Develop and run end-to-end tests locally, with the stub bot check and console email.
- On production, keep one synthetic draft hotel, "AMPM Test Property (internal)", in a draft destination, and never activate it.
- Test requests (Super Admin only) go only to that hotel. They are hidden from the inbox by default and left out of metrics.
- Test the new-hotel path once. It creates a second draft test hotel, whose web address stays taken.

**The production check (HF-G12)**

- the Turnstile hostname;
- headers, checked by GET;
- link previews in WhatsApp, Gmail and Outlook Safe Links;
- email delivery to Gmail and Microsoft 365;
- a 40 MB upload refused at the edge;
- an anonymous 26 MB POST to every upload route refused before the API reads it;
- EICAR and every malicious fixture refused;
- a merge into the test hotel.

**Monitoring**

The box's monitoring profile is off and the API has no `/metrics`. So:

- The worker alerts the Super Admin and the Hotel team in-app, and by email when quota allows, when:
  - a global cap trips;
  - the scanner is unavailable;
  - upload refusals spike;
  - free disk crosses the alert line.
- The worker sends a daily digest built from request events.
- db-metrics textfile counters and alert rules are added, so they work once the monitoring profile is turned on.

**After release: success measures** (the first hotels, starting with the six whose fact sheets AMPM has)

All five should hold:

- at least 4 of the 6 hotels submit within 14 days of first verifying;
- median active completion time is under 60 minutes;
- reviewer time is at most 60 minutes per hotel;
- disk stays within budget;
- no security incident occurs.

These are measured from request events and the change log.

---

## 5. Fields: what we have and what we need

### 5.1 The form, question by question

"New" marks a question AMPM's PDF does not ask; each one is optional. "Today" describes the catalogue at 926dc5d.

| PDF item | How the form asks it | Catalogue home | Today | Merge rule | Visibility |
| --- | --- | --- | --- | --- | --- |
| 7.1 to 7.3 Submitter (asked first, as identity) | Name, designation and mobile, with a one-time code before the form (shown on screen until SMS is wired) | None by default; the reviewer may "Add as hotel contact" | Missing (codes need a users row) | An explicit reviewer action only | RESTRICTED-CONTACT |
| 1.1 Hotel name | Text | `hotels.name`, plus new `name_aliases_json` | Have | Identity field; a kept, differing name can be saved as a name variant; the web address never changes | CLIENT (variants INTERNAL) |
| 1.2 Chain or group | Yes or No, plus the name | `brand`, or new `parent_group` (the reviewer can split the value) | Brand only | Empty: take it; different: decide | CLIENT |
| 1.3 Complete address | Street, locality, PIN | `address`, plus new `locality` and `postal_code` | Address only | Identity field | CLIENT |
| 1.4 City and state | City; state from a list | New `city` and `state`. The destination changes only if the reviewer picks another existing one | Missing | Warning when the city does not fit the destination | CLIENT |
| 1.5 Google Maps link | https Google Maps links only, with pinned paths | New `maps_url`; latitude and longitude suggested from it | `street_view_ref` (255 characters); coordinates not editable | Identity field; coordinates are an opt-in suggestion; short links are never fetched | Link CLIENT; coordinates staff |
| 1.6 Official website | https | `website` | Have | Identity field; a brand domain shared by two or more hotels is flagged | CLIENT |
| 1.7 and 1.8 Contact person, number and email | Up to 3 contacts, with "Same as me" | `hotel_contacts` | Have; phone is free text and several contacts can be primary | Row match; on an existing hotel, channels are identity decisions with out-of-band confirmation | RESTRICTED-CONTACT |
| 1.9 Airport distance | Airport name, km, drive minutes | New `airport_name`, `airport_distance_km`, `airport_drive_minutes` | Missing | Field rule; speed warning | CLIENT |
| 1.10 Railway station distance | Station name, km, drive minutes | New `railway_station_name`, `railway_distance_km`, `railway_drive_minutes` | Missing | Field rule | CLIENT |
| New: city centre and other access | km and minutes; notes on highways and landmarks | New `city_centre_distance_km`, `city_centre_drive_minutes`, `access_notes` | Missing | Field rule; notes edit-only | CLIENT |
| New: star category, description, facilities | Star category from a list; up to 600 characters; facility chips | `star_category`, `description_client`, `facilities_json` | Have | Description edit-only; facilities offered as a union the reviewer trims | CLIENT |
| 2.1 Total rooms | Number | `total_rooms` | Have | Warning when it differs from the sum of the categories | CLIENT |
| 2.2 Number of room categories | Not asked: counted from the rows | n/a | n/a | Shown to the reviewer | n/a |
| Room table: category, number of rooms, size (sq ft), maximum occupancy | Unlimited, renameable rows; size in sq ft or m² | `hotel_room_categories`: `name`, `room_count`, `max_occupancy` (at least 1), `size_sqm`, plus new `size_sqft` | Partial (whole m² only) | Row match | CLIENT |
| New: room unit type, view, bed configuration, notes | Villa, tent, suite and so on; text | New `unit_type`, `view_label`, `bed_configuration`; `description` | Missing | Field rule; notes edit-only | CLIENT |
| 2.3 and 4.1 Minimum rooms without a full buyout (the PDF asks it twice) | Asked once, under Booking terms: "Do weddings need a full buyout? Yes / No / Depends", then the minimum rooms | New `wedding_buyout_policy`, `min_rooms_without_buyout` | Missing | Field rule | INTERNAL (decision 12) |
| 3.1 Number of venues; 3.2 both indoor and outdoor | Not asked: worked out from the rows | n/a | n/a | Shown to the reviewer | n/a |
| Venue table: name, indoor or outdoor, area (sq ft), floating capacity, seating capacity | Unlimited rows. Setting: indoor, outdoor, or covered and semi-open. Area with its unit. "Seated (dinner at round tables)" and "Floating (standing reception or cocktails)"; a range is allowed | `hotel_venues`: `name`, new `setting` (with `is_indoor` kept in step), `area_sqm` plus new `area_sqft`, `capacity_banquet`, `capacity_reception`; ranges in new `capacity_notes` | Partial | Row match; venue type required at merge | CLIENT |
| New: venue type, theatre, other layouts, dimensions, ceiling height, pre-function area, notes | Optional per row | `venue_type`, `capacity_theatre`, plus new `other_layouts_json`, `length_m`, `width_m`, `ceiling_height_m`, `prefunction_area_sqm` and `prefunction_area_sqft` | Partial | Field rules and warnings | CLIENT |
| New: total event space | Number with unit | New `total_event_space_sqm` and `total_event_space_sqft` | Missing | Field rule | CLIENT |
| 4.2 Minimum nights | Number | New `min_nights` | Missing | Field rule; warning above 7 | INTERNAL (decision 12) |
| 4.3 Several functions at once or on the same day | Allowed, not allowed, or depends; notes | New `parallel_functions`, `booking_notes` | Missing | Field rule; notes edit-only | INTERNAL (decision 12) |
| 5.1 Complete food menu | Upload field 2 | `documents` of type `menu`, filed on the hotel | The type exists, but there are no hotel documents | File it or decline it; prices go only into draft cards | INTERNAL |
| 5.2 Menu categories | Cuisine chips (Indian, Continental, Asian, Italian and more; Jain food on request; other) | New `cuisines_json` | Missing | Offered as a union the reviewer edits | CLIENT |
| New: pure vegetarian, separate vegetarian kitchen, alcohol served | Yes or No each | New `is_pure_vegetarian`, `has_separate_veg_kitchen`, `serves_alcohol` | Missing | Field rule | CLIENT |
| 5.3 Food menu with rates | Inside upload field 2 | A staff draft rate card | Partial (rate cards, D-170) | Staff transcribe; verified the D-170 way | INTERNAL until verified |
| 5.4 and 5.5 Liquor and beverage list with rates; mocktails and soft drinks | Upload field 3 | `documents` of new type `beverage_menu`; prices into draft cards | Missing | As the food menu | INTERNAL |
| 6.1 Property photographs | Photo slots: property (20) and new dining (6) | `media_assets` with new `purpose` property or dining | Partial (no purpose) | Adopt or decline; shown to clients only with a Yes to 7.5 | INTERNAL; CLIENT when shown |
| 6.2 and 6.3 Room and venue photographs | Photos on each row (6 per row) | `media_assets` with purpose room or venue, plus new `subject_id` (the row) | Missing (no link to a row) | As 6.1 | As 6.1 |
| 6.4 Layouts or floor plans | PDF or image, optionally on a venue row | `documents` of new type `floor_plan` | Missing | File it or decline it | INTERNAL |
| 6.5 and 6.6 Menu and liquor list (asked again) | The same two upload fields | As 5.1 and 5.4 | n/a | n/a | n/a |
| Upload field 1: Property Fact Sheet | PDF or PowerPoint, including the older .ppt; "When was it last updated?" | `documents` of new type `fact_sheet`, titled "as of <month year>" | Partial (PDF only, no type) | File it or decline it; opened beside the review, never auto-extracted | INTERNAL |
| 7.4 Accuracy confirmation | A required tick, with versioned wording | A consent row bound to the revision's hash | Missing | Evidence only; never makes a value verified | INTERNAL |
| 7.5 Display authorisation | An explicit Yes or No, with versioned wording | A consent row bound to the revision's hash | Missing | The basis for showing photos; a No limits the merge (§4.6) | INTERNAL |

### 5.2 What the fact sheets carry beyond the form

The six sheets disagree with themselves at times. One gives its railway station as both 14 km and 4 km. One gives a lawn as both 35,000 and 40,000 sq ft. One has areas that do not match its length × width. Two are image-only PDFs. So the reviewer settles every value with the sheet open, and nothing is extracted automatically.

| Fact | Sheets | Today | Planned home |
| --- | --- | --- | --- |
| Name variants (three or four per hotel) | 2 of 6 | Missing | `name_aliases_json` (INTERNAL) |
| Parent group, besides the brand | 3 of 6 | Brand only | `parent_group` |
| City, state, PIN | 6 of 6 | Missing | `city`, `state`, `postal_code` |
| Locality | 2 of 6 | Missing | `locality` |
| Airport km, name, drive time | km 6 of 6; name 4; time 3 | Missing | The airport columns |
| Railway and city-centre distances | 3 of 6 | Missing | The railway and city-centre columns |
| Highway, landmarks | 2 of 6 | Missing | `access_notes` |
| Loyalty programme, affiliations, property type | 2 to 3 of 6 | Missing | Not modelled; the description or internal notes |
| Room unit type (villa, tent, suite), view, bed | 4 of 6 | Missing | `unit_type`, `view_label`, `bed_configuration` |
| Room size in sq ft or m² | sq ft 2 of 6; m² 1 | Whole m² only | `size_sqft` beside `size_sqm`, through one converter |
| Balcony, private pool, room amenities | 2 to 4 of 6 | Partial | Room `facilities_json` and the description |
| Wings, suite counts | 1 of 6 | Missing | The description |
| Venue rows (5 to 12 per sheet) | 6 of 6 | Have | Row merge |
| Venue kinds: terrace, garden, amphitheatre, meeting room, lounge | 3 of 6 | 7-value type | 5 new venue types |
| Covered or rooftop spaces | Some | Indoor flag only | `setting` = semi_open |
| Up to nine layouts (classroom, U-shape, boardroom, cluster, sit-down buffet, hollow square, exhibit and more) | 2 to 4 of 6 | Banquet, theatre and reception only | `other_layouts_json` |
| Capacity ranges ("600 to 700") | 2 of 6 | Missing | The maximum in the column; the range in `capacity_notes` |
| Length × width × height | 2 of 6 | Missing | `length_m`, `width_m`, `ceiling_height_m` |
| Pre-function areas and foyers | 5 of 6 | Missing | `prefunction_area_sqm` and `_sqft`, on the venue a foyer serves |
| Sub-divisible halls, pillarless halls | Some | Missing | `capacity_notes`; `facilities_json` |
| Total event space | 3 of 6 | Missing | `total_event_space_sqm` and `_sqft` |
| Dining outlets: name, cuisine, covers, bar, vegetarian-only kitchen | 6 of 6 | Missing | Hotel-level food facts only; an outlet list is out of scope (decision 22) |
| Amenities (pool, spa, gym, salon, sports) | 3 to 4 of 6 | Have | `facilities_json`, offered as a union |
| Switchboard, role mailboxes, sales offices | 4 of 6 | Partial | Contact rows (role title Switchboard or Sales; E.164); never primary by default |
| The sheet's date | 2 of 6 printed; others only in the PDF's metadata | Missing | Asked on the form; the document title "as of <month year>"; a warning when over 12 months old |
| Brand logos, CGI renders, copyright lines | Several | n/a | Declined or kept internal; brand imagery stays `consent_required` |

### 5.3 Changes against AMPM's PDF (approved, decision 15)

**Removed, merged or derived**

- 7.1 to 7.3 become the verified identity step at the start.
- 2.3 and 4.1 (the same question) are asked once.
- 2.2, 3.1 and 3.2 are worked out from the rows.

**Split or tightened**

- The address becomes street, locality, city, state (from a list) and PIN.
- Distances are in decimal km, with optional drive minutes and the airport's or station's name.
- 1.5 accepts only Google Maps links, and 1.6 only https websites.
- Contacts move to a "Contact for weddings and events" section, with "Same as me" and up to 3 contacts.
- Room and venue tables become unlimited rows that can be renamed, with sizes in sq ft or m².
- The capacity labels become "Seated (dinner at round tables)" and "Floating (standing reception or cocktails)".

**Uploads**

- Upload field 1 is the Property Fact Sheet.
- Upload fields 2 and 3 are the Food Menu and the Liquor & Beverage Menu. They cover 5.1, 5.3, 5.4, 5.5, 6.5 and 6.6.
- Photos sit where they belong: property, each room row, each venue row, and dining.
- Floor plans take PDF or images.

**Added, all optional**

- star category, short description, facilities;
- city centre and access notes;
- room unit type, view and bed;
- venue type, theatre, other layouts, dimensions, pre-function area and notes;
- total event space;
- pure vegetarian, separate vegetarian kitchen, alcohol served;
- the fact sheet's date.

**Declarations**

- 7.4 is a required tick.
- 7.5 is an explicit Yes or No, never pre-ticked, reworded to promise only what AMPM will show (decision 13).

---

## 6. Data model

### 6.1 New tables (Module C)

Every table gets UUID v7 keys, the standard audit columns and soft delete, an index on every foreign key, and the retention class `hotel_intake`.

| Table | Purpose | Key columns |
| --- | --- | --- |
| `hotel_info_requests` | One round for one hotel (existing) or one proposed hotel (new) | See below |
| `hotel_info_request_people` | Each person who entered a correct code; never a `users` row | `full_name`, `designation`, `phone` (E.164) (RESTRICTED-CONTACT); `code_entered_at`; `phone_verified_at` (set only by an SMS code); `code_delivery` (`sms` or `screen`); removed time and who; `last_seen_at`. Partial unique on request and phone. Created only after a correct code |
| `hotel_info_request_challenges` | Code challenges, and the session each one opens | See below |
| `hotel_info_request_consents` | Append-only consent evidence | `person_id`; `kind` (privacy_notice, accuracy_attestation, display_authorisation); `text_version`; `granted`; `revision_hash` (7.4 and 7.5); `recorded_at`; `ip_address`; withdrawn time, source (contributor or staff) and who |
| `hotel_info_request_sections` | The shared draft | `section_key` (7 values); `schema_version`; `answers_json`; `content_hash`; `version`; `is_complete`; `no_changes`; last editor and time. Unique on request and section |
| `hotel_info_request_revisions` | An immutable snapshot at each submit | `revision`; `answers_json` (all sections); `answers_hash`; `files_json` (ids and SHA-256); who submitted and when |
| `hotel_info_request_files` | Every uploaded file | See below |
| `hotel_info_request_events` | The history the Hotel team can read (only the Super Admin reads the audit log for hotel records); drives chase filters and success measures | Event type; actor kind (staff, hotel person or system); actor ids; masked detail |
| `hotel_info_request_changes` | The merge's per-field change log | `revision`; `hotel_id`; entity type and id; `field`; `decision` (take, edit, keep, create, adopt, decline, record or override); `before_json`; `after_json`; `override_reason`; applied time and who |

**`hotel_info_requests` columns**

- `reference` (`HIR-2026-0001`, from a sequence);
- `kind` (onboarding or refresh);
- `target` (existing or new);
- `hotel_id` (null for a new hotel until it is merged);
- the proposed name, destination and web address;
- the official website, the switchboard and its source (all entered by staff);
- `is_test`;
- `status`;
- `expires_at`, `status_only_until`;
- the display label and staff note;
- the link: `token_hash` (unique, SECRET), `token_generation`, when it was issued and emailed, and the recipient's name and email as AMPM entered them (RESTRICTED-CONTACT);
- `prefill_mode` (always `none` in version 1, decision 16: while codes are shown on screen the form shows nothing from the catalogue);
- `revision`;
- submission, review, merge and revoke fields;
- `merge_plan_hash`.

Its indexes:

- partial unique on `hotel_id` while live;
- partial unique on the proposed web address while live, for new hotels;
- status with expiry;
- status with submission time.

**`hotel_info_request_challenges` columns**

- `link_generation`;
- the claimed name, designation and mobile, and the notice version, all held only until the code is entered;
- `delivery` (`sms` or `screen`);
- `destination_hash` (HMAC of the mobile under HKDF `ampm/hotel-form-address`);
- `code_hmac`, its expiry, and `attempts` (at most 5);
- used and retired times;
- `person_id` (set on verify);
- `session_token_hash` (unique), the session's expiry, last seen and end;
- `ip_address`, `user_agent`.

**`hotel_info_request_files` columns**

- `slot` (fact_sheet, food_menu, beverage_menu, floor_plan, photo_property, photo_room, photo_venue or photo_dining);
- the row reference;
- `original_name`: shown on screen only, never logged or audited;
- the declared size and type;
- `detected_type`, `size_bytes`, `sha256`;
- `status` (registered, stored, rejected or removed) and the rejection reason;
- `replaces_file_id`;
- `document_id` or `media_id`;
- the caption and the uploader;
- the review decision, who decided and when;
- `fact_sheet_as_of`;
- `adopted_at`.

### 6.2 Changes to existing tables and code

All migrations expand only. Each change updates `docs/data-model.md` and the field matrix in the same pull request.

**`hotels`**

- `locality`, `city`, `state`, `postal_code` (6 digits not starting with 0 in India);
- `maps_url` (2,048 characters; https on Google Maps hosts with pinned paths; never fetched by the server);
- `parent_group`;
- `name_aliases_json` (INTERNAL);
- airport, railway and city-centre names, distances and drive minutes, plus `access_notes`;
- `total_event_space_sqm` and `_sqft`;
- booking terms: `wedding_buyout_policy`, `min_rooms_without_buyout`, `min_nights`, `parallel_functions`, `booking_notes` (INTERNAL, decision 12);
- `cuisines_json`, `is_pure_vegetarian`, `has_separate_veg_kitchen`, `serves_alcohol`.

Staff can now edit latitude and longitude.

**`hotel_room_categories`**

- `unit_type` (room, suite, villa, cottage, tent, tent_suite, apartment or other);
- `view_label`, `bed_configuration`, `size_sqft`;
- `max_occupancy` at least 1 when set.

**`hotel_venues`**

- `setting` (indoor, outdoor or semi_open; `is_indoor` kept in step);
- `area_sqft`, `length_m`, `width_m`, `ceiling_height_m`;
- `prefunction_area_sqm` and `_sqft`;
- `other_layouts_json` (up to 12 entries of layout, maximum and optional minimum);
- `capacity_notes`.

The venue type gains terrace, garden, amphitheatre, meeting_room and lounge. That is a client contract change: update the core enum and both `VENUE_TYPE_LABEL` maps in apps/mobile (`features/hotels` and `features/hotels-admin`), and deploy back to back.

**Units and capacities**

- Square metres stay canonical for filters.
- When a hotel states square feet, the sq ft figure is kept and the m² derived by one converter in `packages/core`: round(sq ft × 0.09290304).
- Clients see the figure the hotel published first.
- The capacity meanings (decision 11) go into a D-record, `field_rules.py` and the form's labels.

**`hotel_contacts`** (service only): one primary at a time, and E.164 phones.

**`media_assets`**

- New owner type `hotel_info_request`.
- `purpose` (property, room, venue, dining, floor_plan, amenity or other), `subject_type` and `subject_id`.
- `uploaded_by` becomes nullable, guarded by `CHECK (uploaded_by IS NOT NULL OR intake_file_id IS NOT NULL)`.

**`documents`**

- New types `fact_sheet`, `beverage_menu` and `floor_plan`; `menu` means the food menu.
- OOXML types, and the per-type rules in `DOCUMENT_TYPE_RULES`.
- `uploaded_by` nullable under the same check.
- New `listByOwner` and `reassignOwner(tx)`.

**`hotel_verifications`**

- New source `hotel_form`, `request_id`, and a `policies` field group.
- `next_due_at` is computed, and `last_verified_at` recomputed, on the staff route too.
- `hotel_form` is refused on the staff route and for the rates and availability groups.

**`notifications`**: recipient type `external`, and `recipient_address`.

**Audit**

- The request context gains an external actor (request id and person id).
- With no principal, AuditService writes `actor_type` `guest_token` (an existing, unused value), with a guest reference in explicit, allow-listed images.
- The audit-log view labels these rows "Hotel form contributor".

**Logging**

- `REDACTED_KEYS` gains the new names: `mobile`, `onetimecode`, `linktoken`, `formsessiontoken`, `sessiontoken`, `bottoken`, `codehmac`, `destinationhash`, `recipientaddress`, `recipientemail`, `recipientname`, `fullname`, `designation`, `useragent`, `originalname` and `tokenhash`. Alternatively, add suffix rules for these entities.
- Add the `hfl_` and `hfs_` patterns to `scan_secrets.py` and `redact_secrets.py`, then re-run the global memory-hook installer.
- Tests check that `redact()` masks synthetic request, person, challenge, file and contact rows.
- Request bodies call the code `oneTimeCode`, never `code`, which would mask error codes.

**Repositories**

- Transaction parameters on room, venue, contact, verification and media writes. `insertHotel(tx)` already takes one.
- Conditional child updates.
- A 30-second timeout on the merge transaction.
- Hotel DELETE revokes the live request inside its transaction.

**Configuration**

`hotel_form.policy` holds:

- the mode;
- link lifetime and extension;
- the status-only days;
- session lifetimes;
- maximum people and sessions;
- code lifetimes;
- the SMS cap;
- the free-disk floor;
- the reply-to address and the help contact shown on HF-01 and HF-08 (decision 21).

Its Zod schema bounds every value, for example a disk floor of at least 9 GiB.

Also add `hotel_form.upload_limits`, `hotel.cuisine_options` and `hotel_form.options` (designations and facilities). Notice versions are constants in `packages/core`.

**Permissions**

- Add §5.3 rows:
  - "Hotel information requests": SA CRUA, HT CRUA, SM R (summary), PM R (summary);
  - "Hotel documents": SA CRUD, HT CRUD, SM R, PM R.
- Name both in `RESOURCES["5.3"]` in `packages/policy/src/resources.ts`, so the keys come out as `hotels.info_requests.*` and `hotels.hotel_documents.*`. Without that, the generator would make `hotel_information_requests`.
- Issuing a link is U, with the audit action `share`; the matrix's S means "share with the client".
- Amend §5.14 and §1 rule 5 so hotel documents follow the §5.3 row.
- Add a §5.1 row for the Super Admin's contributor-privacy tool, and a §2 note on the account-less contributor.
- Then run `pnpm authz:generate` and update the golden tests.

**§7 status machine "Hotel information request"**

- open → submitted (System, when a verified contributor submits through the hotel form);
- submitted → in_review (claim), and back (release);
- in_review or submitted → changes_requested (note) → submitted (System, on resubmission);
- in_review → merged;
- submitted or in_review → rejected (reason);
- open or changes_requested → revoked (staff, or System when the hotel is deleted);
- merged → changes_requested (reopen; refused while another request is live).

Hotel-driven moves are written as System movers, because the transitions generator knows no hotel actor. Notes go in the Who conditions, never in the From or To cells. Expiry is worked out from `expires_at`, not stored as a status.

---

## 7. API

### 7.1 Public routes (the site calls the API)

**Rules for every route**

- All are `@Public`.
- Every limit fails closed, except sign-out, which D-149 keeps open. The open reads D-149 allows are made fail-closed here, and that deviation is recorded.
- Routes that spend codes, files or staff attention are listed in COSTLY.
- A controller rule in `rate-limit-coverage.spec.ts` enforces all of this.
- Routes marked "session" need a valid form session from `HotelFormSessionGuard`.

| Route | Guards and limits | Does |
| --- | --- | --- |
| `POST /hotel-form/open` | 30 a minute per network; `@AuditExempt` (no change) | Takes the link token. Returns the state (ready, locked, status_only or not_active), the expiry and AMPM's help contact; nothing about the hotel |
| `POST /hotel-form/codes` | 10 a minute per network; Turnstile action `hf_code`; every cap; `@SelfAudited` as an unverified claimant identified by the challenge id | Takes the link token, name, designation, mobile, notice version and bot token. Holds the claimant's details on the challenge, and creates or changes no person. Sends the code by SMS, or in on-screen mode returns it for the page to show. Returns the challenge id, a masked mobile and timers |
| `POST /hotel-form/codes/verify` | 20 a minute; 5 tries reserved atomically; `@SelfAudited` | Takes the link token, challenge id and `oneTimeCode`. Creates or finds the person and records the notice consent. Returns the session token, the label and note, and the status |
| `GET /hotel-form/draft` | Session; 120 a minute per network plus a per-session window | Sections; files with status and signed thumbnails; contributors (name and designation); the staff note and any changes note; limits. Never catalogue data |
| `PUT /hotel-form/draft/sections/:sectionKey` | Session; 30 a minute per session plus an hourly window per request; `@AuditExempt` (autosave of a staged draft) | Takes the answers, the expected version and the "no changes" switch. Returns the version and completeness. 409 on a conflict or a locked request. Skips unchanged content |
| `PATCH /hotel-form/me` | Session; `@SelfAudited` | Changes your own name or designation. A new mobile needs a new code |
| `POST /hotel-form/files` | Session; quotas; free disk; `@AuditExempt` (a reservation) | Registers a file (id, slot, row, name, type, size). Idempotent per request |
| `POST /hotel-form/files/:fileId/content` | Session; the shared post-guard reader; octet-stream only; slot shares; `@SelfAudited` | Detects the type, scans, normalises and stores. Returns the file, or a refusal with a named reason |
| `PATCH` and `DELETE /hotel-form/files/:fileId` | Session; looked up by id and request (404 otherwise); removal caps; `@SelfAudited` | Changes the caption or row, or removes the file (its bytes are kept for retention review) |
| `POST /hotel-form/submit` | Session; Turnstile action `hf_submit`; `@SelfAudited` | Takes both declarations with their versions and a bot token. Strict check; revision snapshot; consents bound to its hash; lock; notices. Idempotent |
| `POST /hotel-form/corrections` | Session; Turnstile; 5 per request a day | Takes a message of up to 2,000 characters, shown to staff only in the app |
| `POST /hotel-form/consent-withdrawal` | Session; `@SelfAudited` | Withdraws consent or asks for removal, and queues a Super Admin review. Withdrawing 7.5 flags the photos shown under it |
| `POST /hotel-form/sign-out` | Session; fails open | Ends the session |

### 7.2 Staff routes (the staff app calls the API)

| Route | Permission | Does |
| --- | --- | --- |
| `GET /hotels-admin/hotel-duplicate-hints` | `hotels.info_requests.create` | Name, name-variant, web-address (deleted rows included, with the reason) and website-host hints. The path avoids `hotels/:hotelId`, which would otherwise capture it |
| `POST /hotels-admin/info-requests` | `info_requests.create`; `@SelfAudited` (never the token); test requests for the Super Admin only | Creates a request for an existing or new hotel, with the official website, switchboard, kind, label, note and recipient. Returns the link once and can email it. 409 when a live request exists |
| `POST …/:id/reissue` | `info_requests.update` (audit `share`) | Rotates the secret and ends the sessions opened with the old link |
| `POST …/:id/share-record` | `info_requests.update` (audit `share`) | Records a WhatsApp or other share |
| `POST …/:id/remind` | `info_requests.update` | Sends the reminder email now, without changing the link (TW-99 Remind) |
| `GET /hotels-admin/info-requests`; `GET /hotels-admin/hotels/:hotelId/info-requests` | `info_requests.read` | The inbox (cursor; filters) and each hotel's history |
| `GET /hotels-admin/info-requests/:id` | `info_requests.read` | One response model per audience: a summary for SM and PM; the full view (people, consents, IPs, answers, diff, seen tokens) for HT and SA |
| `PATCH /hotels-admin/info-requests/:id` | `info_requests.update` | Extend; label; note; recipient |
| `POST …/:id/{claim, release, request-changes, reopen, revoke}` | `info_requests.update` | §7 transitions |
| `POST …/:id/reject` | `info_requests.approve` | Rejects with an internal reason |
| `POST …/:id/people/:personId/revoke` | `info_requests.update` | Removes a contributor; their sessions end |
| `POST …/:id/contacts/:rowRef/confirm-channel` | `info_requests.update` | Records the out-of-band confirmation of a contact-channel change |
| `POST …/:id/files/:fileId/link` | `info_requests.read` | A 15-minute link, served as an attachment except for PDFs and images |
| `PUT …/:id/review-draft` | `info_requests.update` | Saves decisions with their revision and value hashes, checked against the review version |
| `POST …/:id/merge-preview` | `info_requests.read` | Returns the operations, warnings, blockers and plan hash |
| `POST …/:id/merge` | `info_requests.approve`, plus every catalogue key it writes | One transaction. 409 on stale entries; a repeat returns the stored summary |
| `GET`, `POST`, `DELETE /hotels-admin/hotels/:hotelId/documents[/:documentId[/link]]` | `hotels.hotel_documents.*` | The documents library (Slice 6) |
| `PATCH /hotels-admin/hotels/:hotelId/media/:mediaId/subject` | `hotels.hotel_media_rights_status.update` | Sets a photo's purpose and room or venue (Slice 11) |
| `POST /hotels-admin/hotels/:hotelId/{rooms, venues}/:id/retire` | `hotels.room_categories_venues.delete` | Soft-deletes the row after checking its rate items (Slice 11) |
| `POST /hotels-admin/hotels/:hotelId/verifications` (changed) | `hotels.verifications.create` | Refuses `hotel_form`, computes `next_due_at` and recomputes `last_verified_at` (Slice 2) |
| `POST /hotels-admin/imports/:kind` (Slice 2; its `dryRun` query removed in Slice 4); `POST /hotels-admin/imports/:kind/:jobId/apply` (Slice 3) | Per-kind keys; the shared reader | Imports for hotels, rooms, venues and rates (Slices 2 to 4). The template and error-report downloads are built in TW-25 from the core column list |
| `GET /hotels-admin/cuisine-options` | `hotels.hotel_profiles_client_fields.read` | The cuisine choices from configuration `hotel.cuisine_options`, plus "Other", for the staff editor (Slice 2) |
| `POST /hotels-admin/info-requests/bulk` | `info_requests.create` | Refresh requests for many hotels at once (Slice 14) |
| `GET` and `POST /admin/hotel-intake/{contributors, retention-candidates}` | A Super-Admin-only key | Find, export, correct or mask a contributor; approve retention (Slice 14) |

---

## 8. Screens

There are no mock artboards for these. Build them from the Peacock Night kit, add the new patterns to `docs/design/peacock-night.md` (repeatable fieldsets, file chips with scan states, save status, merge rows), and check each at 390, 768 and 1440 wide.

| Screen | App and route | Purpose |
| --- | --- | --- |
| HF-01 Welcome and privacy notice | apps/web, `/hotel-form` | What AMPM asks and why; about 20 minutes; resume and colleagues; the notice; a hint for in-app browsers. Nothing about the hotel |
| HF-02 Your details | apps/web, `/hotel-form` (step) | Name, designation, mobile, notice tick, Turnstile |
| HF-03 Enter your code | apps/web, `/hotel-form` (step) | Masked mobile, code input, resend countdown, Change. In on-screen mode the code appears in a callout, as client sign-in does; in SMS mode it is never shown |
| HF-04 Overview | apps/web, `/hotel-form/overview` | Staff label and note, Quick start uploads, the seven sections and their status, contributors, a changes-requested banner, Review and submit |
| HF-05 Section pages | apps/web, `/hotel-form/sections/[section]` | The seven sections, with repeatable rows, units, chips, per-row photos, save status, and "No changes since last time" on refreshes |
| HF-06 Review and submit | apps/web, `/hotel-form/review` | Summary with Edit links, missing required items, 7.4, 7.5, Turnstile, Submit |
| HF-07 Submitted | apps/web, `/hotel-form/status` | Reference, read-only answers, status, Request a correction, Withdraw consent |
| HF-08 Link not active | apps/web, `/hotel-form` (state) | One page for unknown, expired, revoked or deleted-hotel links, with AMPM's support contact |
| TW-99 Information requests | Staff app, `/hotels-admin/requests` | Queue with chase filters (no code requested after N days, in progress, submitted, changes requested, expiring soon, expired), last activity, sections done, expiry, Remind, Reissue. Test requests hidden by default |
| TW-100 Review and merge | Staff app, `/hotels-admin/requests/[requestId]` | Chips, claim and release; section tabs with counts; merge rows; row matching; photo triage grid; document filing; verifications; channel confirmations; Request changes, Reject, Reopen, Apply with a ConfirmSheet; stale refresh |
| Send request / Invite a new hotel | Staff app, sheets on `/hotels-admin` and `/hotels-admin/[hotelId]` | Recipient, label, note, kind, validity, official website, switchboard. The link is shown once with Copy, Email and Share. Duplicate hints for a new hotel |
| Hotel record additions | Staff app, `/hotels-admin/[hotelId]` and `/documents` | Request panel; documents library (versions, 15-minute links, "Start draft F&B card"); history from the change log; activation checklist for drafts |
| Profile, room and venue editors | Staff app sheets | Location and access, Maps link with coordinates, parent group, name variants; booking terms in an Internal panel; food facts and cuisines; room type, view and bed; venue setting, types, dimensions, layouts, notes and pre-function area; both units shown |
| Hotels list | Staff app, `/hotels-admin` | "Requests · N to review", Invite a new hotel, a status filter (drafts included); bulk "Request updates" in Slice 14 |
| TW-25 Import | Staff app, `/hotels-admin/import` | Template downloads per kind, dry-run report, error report download, apply by job |
| CP-05 hotel detail | Client portal, `apps/mobile/src/app/hotels/[id].tsx` | Getting there; food (cuisines, pure vegetarian, alcohol); rooms in the published unit with type and view; venue setting, dimensions, layouts and notes; photos grouped by room and venue; the verification label from decision 14. Booking terms are not shown (decision 12) |

---

## 9. Security and privacy

### 9.1 Threat model

The link must be assumed known to third parties: mail scanners, forwarding and in-app browsers. While codes are shown on screen, the link is the only key. So the controls that matter are expiry and reissue, the caps, showing nothing from the catalogue, and AMPM's review.

| Attacker's goal | Controls |
| --- | --- |
| Use a forwarded or leaked link (while codes are on screen) | Expiry, revoke and reissue; nothing from the catalogue is ever shown; the draft holds only what this hotel's people typed; AMPM's review before anything is applied; the change log; the "Mobile not checked" chip. The developer accepted this risk until SMS is wired (decision 4). Such a link exposes the whole shared draft, including the named contacts' details and the colleagues' names and designations, and the privacy notice says so |
| Pose as hotel staff to plant false data or redirect payments | AMPM's review; contact-channel changes as identity decisions with out-of-band confirmation; no automatic merge |
| Read AMPM's or another hotel's data | Nothing from the catalogue is ever shown on the form; one staff response model per audience |
| Take over or impersonate a contributor | In SMS mode: the claimant's details stay on the challenge until a code is entered; identity fields change only inside a session; a new mobile needs a new code. In on-screen mode none of this holds: anyone with the link who types a colleague's mobile gets that colleague's session, a removed person can come back with another mobile, and made-up mobiles can fill the 10 places. Who supplied a value, or answered 7.5, is then only a claim, shown with "Mobile not checked". The request's events record every entry, and reissuing the link is the way to shut someone out (accepted with decision 4) |
| Flood the form or spend AMPM's SMS | Turnstile; layered caps; a global SMS cap; the kill switch |
| Exhaust memory, disk or the database | Guards before bytes; edge limits; quotas that count retained bytes; the disk guard; write windows; section size caps; image pixel limits and one-at-a-time processing |
| Smuggle active content | Content detection; Office and PDF refusals; ClamAV with strict limits and its macro alert; restrictive serving headers; Office files only as downloads; detected types only |
| Leak secrets through logs | The `#` fragment; hashed tokens; redaction keys; scan patterns; no file names or request bodies in logs |
| Reach a forgotten link later | Expiry; the status-only period after a merge; revoke and reissue; checks on every call |

### 9.2 Visibility

| Class | Covers |
| --- | --- |
| RESTRICTED-CONTACT | People, recipient addresses, IP addresses, answers and review drafts |
| SECRET | Token, code and address hashes |
| INTERNAL | Files, menus and booking terms |
| As in the catalogue | Merged fields take their catalogue class |

Fixtures are synthetic only: fictitious hotels, example.com addresses and reserved number ranges, never the fact sheets' contents.

### 9.3 Privacy (DPDP)

**New data principals.** The people who fill in the form, and the contacts they name, are new data principals for AMPM.

**Notices**

- Contributors accept a privacy notice before a code is issued. It is versioned, and a stale version is refused with "the form was updated, reload". It tells them that anyone who has the hotel's link can see what they enter.
- Each named contact gets a short notice by email when the reviewer adopts their details. They can reply to object; staff act on the objection, which blocks or removes the adoption.
- Counsel confirms the lawful basis for named contacts (HF-G2).
- The notice lists every processor: Resend, Cloudflare (Turnstile), the SMS provider, the VPS host and its off-box backup service.
- The notice says whether contributors may be kept as hotel contacts. Otherwise the contributor opts in.

**Withdrawal** is as easy as giving consent: a session-gated action on the status page. Withdrawing 7.5 flags the photos shown under it, and staff set them back to internal.

**Retention** follows decision 20; nothing is deleted automatically. A Super Admin tool finds, exports, corrects or masks a contributor. Masking reaches people, consents (with their IP addresses), challenges and the change log. Audit images hold no personal values, so masking is complete.

**Language.** The notice is in English, with other languages available on request.

**Breaches.** The breach runbook covers this data.

---

## 10. Delivery for one developer

### 10.1 Slices

The developer chose to build everything in one go (decision 3). The slices still land as separate pull requests, in this order, but the public form stays off, or test-only, until Slice 14 is done and HF-G1 to HF-G13 pass. Then real hotels get links. Slice 13 (SMS) follows whenever a provider is chosen, and never holds back the release. Each slice is one pull request unless it says otherwise. Days are developer-days.

| Slice | Delivers | Deploy | Days | Needs |
| --- | --- | --- | --- | --- |
| 0 Decisions and long-lead operations | D-records from the main checkout (D-172 onward). The answered questions in `docs/decisions.json`, including AMPM's confirmations. The notice, declaration and authorisation wording for counsel's review and AMPM's approval. Measure free disk. Confirm who applies the Plesk directives, and that the domain allows them. Record the AC-35.1 change and update the build plan | Docs only | 1 | — |
| 1 Close the staff over-read | Done: PR #189 (`807cb2b`, D-171), live since 23 November 2026 | Done | 0 | — |
| 2 Catalogue I: hotel fields and a safe profile import | The hotel columns of §6.2; staff contracts and profile panels. The shared post-guard body reader, introduced with the import route. The safe import (raw CSV; blank means unchanged; flags only when filled; deleted-web-address row errors; a per-field dry run; template and report downloads). The cuisine-options route. Facilities become an import column. Apply re-sends the file. Verifications compute `next_due_at` and recompute `last_verified_at` | API first, then `deploy-web.sh` straight after (a staff contract change: the strict staff views gain the new columns, and the import route moves to `imports/:kind`) | 3 | 0 |
| 3 Catalogue II: rooms, venues, units, and their import | Room and venue columns and the new venue types (a client contract change, deployed back to back). The unit converter; one primary contact and E.164; staff room and venue sheets. `HotelChangeSet` in `packages/core`. The Rooms and Venues CSV import. Apply by the dry run's job id, refusing rows changed since the preview, for every kind | API first, then `deploy-web.sh` straight after | 4 | 2 |
| 4 Rates import | Rates CSV into draft cards with hidden, unverified items; the same-hotel check on rate items; AC-35.1 updated | API first, then `deploy-web.sh` | 2 | 3 |
| 5 Box prerequisites | Hard-link media snapshots and the off-box layer. Free space measured, with build caches cleared if short. nginx and Apache limits through Plesk, written back to `deploy/`. ClamAV settings. A check that `req.ip` gives one bucket per client. The worker's disk-check job | Box operations, plus a production redeploy (no migration) | 1.5 | 0 |
| 6 Safe uploads everywhere, and the documents library | Every upload route on the shared post-guard reader; the global raw parser and its path bypass removed. New document types; `ooxml.ts`, the compound-file reader for the older .ppt and .xls, and the PDF checks, with fixtures. Images in documents re-encoded without metadata. sharp limits and one-at-a-time processing in the existing media pipeline. Restrictive serving headers. The hotel documents routes, the §5.3 row and the §5.14 amendment. The Documents tab; "Start draft F&B card" | API first, then `deploy-web.sh` | 6 | 5 |
| 7a The request and its link (staff) | Request and event tables. The §5.3 row with curated keys; the §7 machine and its golden tests. External recipients. Staff create (existing or new), reissue, revoke, extend and record a share. Send and Invite sheets with duplicate hints; the request panel; the TW-99 skeleton. Hotel DELETE revokes. Mode off, read uncached. `PUBLIC_SITE_URL`, with production checks | API first, then `deploy-web.sh` | 3.5 | 6 |
| 7b The identity step on the site | People, challenge and consent tables; HKDF keys. The code service, with SMS and on-screen delivery and every cap. The bot check moved to common, with hostname, action and timeout. Public open, codes, verify, `me` and sign-out. The session guard, with its re-checks and write windows. The `guest_token` actor with allow-listed images. Redaction keys and scan patterns, with tests. The coverage rule; CORS exposes `retry-after`. `packages/web-forms`, with the contact form's fields moved in. HF-01, HF-02, HF-03 and HF-08. The `/hotel-form` headers and the site's `.htaccess` fix | API first (`redeploy-prod.sh` also rebuilds the site), then `deploy-web.sh` | 4 | 7a |
| 8 Sections, submit, and a read-only staff review (two PRs) | Section and revision tables. Section schemas: lenient but strict-object drafts with caps, a strict submit check, https and Maps checks. Draft, section, submit, correction and consent-withdrawal routes. Consents bound to the revision hash. The on-page reference and staff notices. HF-04 to HF-07; autosave with conflicts. TW-99 filters. TW-100 read-only, one model per audience, with claim, release, request changes, reject, reopen and remove contributor. Playwright and axe set up (decision 18) | API first, then `deploy-web.sh` | 9 | 7b |
| 9 Uploads on the form | The files table. Register, content, edit and remove. Quotas on retained bytes, removal caps, per-person budgets, expiry of registered rows; temporary names and the orphan sweep; per-request upload shares. Request-owned media and documents, the nullable uploader and its CHECK; floor plans as documents. FileField and PhotoUploader, with browser downscaling and progress; `upload()` in api-client with a token and progress. The TW-100 file list and thumbnails. A load test as a plain Node script: ten parallel uploads of PNGs at the pixel cap, peak memory against 1 GB | API first, then `deploy-web.sh`. Mode test_only | 6.5 | 8 |
| 10 Merge I | The review draft with value hashes. Merge preview and merge: locks, plan hash, seen tokens at millisecond precision, conditional updates, 30 s timeout, idempotent. A new hotel created inside the merge. Field rules, identity decisions, the never-write list, flags on client free text. Contact-channel decisions, with out-of-band confirmation and a notice to the previous address. Named-contact notices. The 7.5 No rule and the override reason. Document adoption. Verifications with source `hotel_form`, dated to the evidence. The change log; per-key permission checks. ConfirmSheet; activation checklist; thank-you email; the status-only period | API first, then `deploy-web.sh` | 5.5 | 9 |
| 11 Merge II | Room and venue row matching; units; venue type; conditional updates through transaction-aware repositories. Media purpose and subject; `reassignToHotel(tx)` with rights. Photo triage: "Show to clients" only when the photo's SHA-256 is in a revision with a Yes to 7.5. Retire row | API first, then `deploy-web.sh` | 5 | 10 |
| 12 Client display | Client view additions (strict views, deployed back to back): access, food, room and venue attributes in the published unit, setting, dimensions, layouts, notes, photos by room and venue, the Maps link, and "Verified on <date> by AMPM" (decision 14). Booking terms stay internal (decision 12) | API first, then `deploy-web.sh` straight after | 2 | 11 |
| 14 Refresh and housekeeping | Bulk refresh requests. A reminder job, by email to the address AMPM entered: day 7 if no code was requested, and 3 days before expiry. The reminder never changes the link, because the hotel may have forwarded it: it gives the date the link was sent, and asks the hotel to ask AMPM for a new one if it was lost (TW-99 Reissue warns that every forwarded copy stops working). The "Changed only" review filter. No prefill in version 1 (decision 16). Contributor find, export, correct and mask. Retention candidates with Super Admin approval. The daily digest. db-metrics counters and alert rules | API first, then `deploy-web.sh` | 3.5 | 11 |
| — | **Release: real hotels get links once Slices 0 to 12 and 14 are done and HF-G1 to HF-G13 pass** | | | |
| 13 SMS codes | When the provider is chosen: its adapter (unless client sign-in has added it by then), the DLT template mapping, site copy, a contract test against the provider's sandbox, checks on Jio, Airtel, Vi and BSNL, and the "Wiring SMS" runbook. On-screen mode then turns off by itself, and the privacy notice gets a new version that names the provider. Done when the template is approved and mapped, delivery is checked on four operators, and tests show no code in any response, log or stored notification | API first | 1 | 7b, and a provider with DLT approval |

**Totals.** Slices 0, 2 to 12 and 14 come to 56.5 days, about 57, or about 65 with about 15% contingency. SMS (Slice 13) adds 1 more when the provider is chosen (about 66 in all). Dining outlets (the former Slice 15) are out of scope (decision 22).

| About day | What is true |
| --- | --- |
| 10 | Staff can store what fact sheets carry, and import hotels, rooms, venues and rates safely |
| 18 | Every upload route runs its guards before reading bytes; fact sheets and menus can be filed on hotels |
| 25 | Staff can send requests, and the identity step works end to end for test requests on the synthetic hotel |
| 34 | Hotels can fill in and submit their answers; staff can read submissions |
| 41 | Uploads work |
| 51 | The merge is complete |
| 53 | Clients see the new fields |
| 57 | Refresh and housekeeping are done; real hotels get links once the gates pass |

### 10.2 Deploy checklist for every slice

1. Add new environment keys to `deploy/app-ampmverse/compose.production-box.example.yml` and to the box's `compose.box.yml` before shipping. In production, `env.ts` refuses a localhost `PUBLIC_SITE_URL` or an empty list of bot-check hostnames. The `redeploy-prod.sh` preflight checks both, as it already checks the antivirus settings.
2. Check `ps` for another deploy, and read the box's `.deployed-commit`: another session's work may be live.
3. Cut the branch fresh from `origin/main` with `git switch --no-track -c`, and keep `graphify-out/cache` out of staging. Run `pnpm check` and `pnpm format:check`. End the pull request with a `Monday: hotels progress …` trailer.
4. Ship with `deploy/ship-source.sh`, then run `redeploy-prod.sh` on the box under `nohup setsid` with a log. It also rebuilds the website container.
5. Check the `/hotel-form` headers with GET, and run the test_only smoke test on the synthetic test hotel.
6. Then run `deploy-web.sh` for the portal, built from merged main.
7. Contract changes deploy back to back: the staff views and import route of Slice 2; the staff room, venue and contact views, the import routes and the client venue types of Slice 3; and the client views of Slice 12. A staff tab still on the old bundle shows errors until it reloads, yet a write it sends still lands behind the error, because the client reads an answer only after the server has written it. So staff reload before editing again, rather than press Save twice. The API and the portal bundle go back together, in both directions: an API rollback of such a slice takes the bundle back with it, and a portal-only rollback past it is not supported (roll the API back too, with item 8, or fix forward). `deploy-web.sh` keeps no copy of `httpdocs`, so take one by hand before deploying. Once clients are live, ship new keys in the bundle one release ahead.
8. A migration that only adds still limits a rollback once the new release has written values the previous image cannot read. After Slice 3, the previous image answers 500 for any hotel with a venue of the five new types, and for a second primary contact or a room occupancy of 0. Before redeploying it, stop this release's api and worker and remap those venues, keeping their types, or fix forward. That image also writes what this release reads differently: a venue's `is_indoor` without its `setting`, and a room's or venue's m² without its sq ft. So when this release comes back, restore the kept types and reconcile those rows. The SQL for both directions is in the Module C notes of `docs/data-model.md` ("Rolling back past this migration" and "Rolling forward again"), and the box steps are in `deploy/app-ampmverse/production-setup.md` ("Rolling back a release by hand").

---

## 11. Go-live gates

| Gate | Passes when |
| --- | --- |
| HF-G1 | AMPM's confirmation, given on 23 November 2026 and relayed by the developer, is recorded in `docs/decisions.json`, and the D-records are merged |
| HF-G2 | Counsel has reviewed, and AMPM has approved, the wording: the privacy notice for contributors and named contacts (purpose, every processor, retention, grievance contact, languages on request, and that anyone with the link sees what is entered), the declaration, the reworded authorisation, and the lawful basis for named contacts. Version constants are set, and stale versions are refused |
| HF-G3 | Codes: on-screen mode works as client sign-in does (decision 4), and the review screen marks those mobiles "not checked". A test shows that on-screen mode turns off by itself once an SMS provider and the hotel-form template are configured, with no code in any response, log or stored notification after that. Delivery on four operators is checked in Slice 13 |
| HF-G4 | nginx and Apache limits are set on the box and in `deploy/`. A 40 MB upload gets a 413 at the edge. An anonymous 26 MB POST to every upload route is refused before the API reads it |
| HF-G5 | Hard-link snapshots are live. The 9 GiB upload guard is proven by a test that lowers the threshold. The worker's disk alert works, and the WAL archive and pgBackRest repository are counted |
| HF-G6 | The ClamAV settings are live. These are all refused: EICAR, a renamed .xlsm, an OOXML file with a macro part reached by relationship, an external-template file, a DDE workbook, a polyglot, a PDF with JavaScript, a zip bomb, an older .xls with a macro and an encrypted .ppt. These are accepted: real exports from five office suites, and a plain older .ppt and .xls. A ClamAV restart mid-upload gives a 503, and the retry works |
| HF-G7 | The API checks the bot token's hostname and action, with a 5-second timeout. A token from another host or action is refused. siteverify is configured in production |
| HF-G8 | Handlers fail closed (sign-out open), sit in COSTLY and fall under the controller rule. `req.ip` gives one bucket per client network on the box. Caps, write windows and the kill switch are tested with production configuration. `/_api/hotel-form` is outside every Basic-Auth curtain: a Bearer request from a test IP draws no fail2ban strike |
| HF-G9 | The link email reaches Gmail and Microsoft 365 inboxes, and replies reach the admin mailbox (decision 21) |
| HF-G10 | `/hotel-form` sends the enforced nonce CSP with the API origin in `img-src`, plus noindex/nofollow/noarchive, no-referrer and no-store, with no duplicate site-wide values (checked by GET). Previews show generic text, and the link still works after a preview |
| HF-G11 | The flow passes in Safari on iOS, Chrome on Android, the WhatsApp and Gmail in-app browsers, and desktop browsers, and with VoiceOver and TalkBack. axe is clean. Route JavaScript is at most 250 KB gzipped, and the page is interactive in under 3 s on throttled 4G. Sandboxed PDFs open in each browser, or are served as attachments |
| HF-G12 | A production run in test_only mode on the synthetic test hotel completes end to end, from the request through submission, review and merge, with test rows filtered out |
| HF-G13 | Runbooks exist for link support, abuse and the kill switch, a scanner outage, the disk alert, DPDP requests and a breach |
| HF-G14 | Release: real hotels get links once Slices 0 to 12 and 14 are done (Slice 13 is not needed) and HF-G1 to HF-G13 pass. The success measures in §4.10 are then watched for the first hotels |

---

## 12. Records and documents to update

### 12.1 Decision records (proposed numbers; confirm at creation)

| Record | Decides |
| --- | --- |
| D-171 | Taken: one staff hotel response model per audience (the over-read fix, PR #189) |
| D-172 | Hotels supply information through a staff-started request link and a one-time mobile code. This is not a login and creates no principal; AMPM agreed on 23 November 2026. It names, with reasons and mitigations, the deviations from security.md (guest tokens exchanged once; no self-registration) and from api.md (the principal model) |
| D-173 | The request and its link: one secret per request in the URL fragment (with the threat model of §4.2), shown once and rotated on reissue; anyone with the link may take part with a mobile code; a shared draft with section versions and revision snapshots; the status-only period; new hotels created as drafts at the first "Apply changes"; no prefill in version 1 (decision 16) |
| D-174 | Mobile codes for people without an account: shown on screen until an SMS provider is wired, which the developer accepted for real hotels although it departs from D-148's rule for clients; then sent by SMS through a separate DLT template. Also the caps, external notification recipients, the admin mailbox as reply-to for now, and the free email plan, with a sending subdomain and bounce handling deferred (decision 8) |
| D-175 | The public form lives on apps/web; `packages/web-forms`; the house form pattern; `@playwright/test` and `@axe-core/playwright` as apps/web dev dependencies |
| D-176 | Uploads: one post-guard reader for every upload route and no global raw parser; content detection with hand-written OOXML and compound-file readers and PDF checks; the older .ppt and .xls accepted and served only as downloads; the refusals; image limits; restrictive serving; quotas on retained bytes; the disk guard |
| D-177 | Media backups become hard-link snapshots, plus the provider's off-box backup; no disk upgrade yet, so upload caps are tighter |
| D-178 | Catalogue extensions, published units kept beside canonical m², capacity meanings (AMPM agreed), and booking terms kept internal (decision 12) |
| D-179 | The merge: the allow-list; no defaults for differing values; identity and contact-channel decisions; the 7.5 rules, including switching on a hotel that holds fields from a No; decisions bound to revisions; locks, seen tokens and conditional child updates; the change log; verification source `hotel_form`, dated to the evidence and never used for rates; "Verified on <date> by AMPM" shown to clients for it too |
| D-180 | Outside contributors are audited as `guest_token` with allow-listed images; files may have no uploading user (a provenance CHECK); request-owned files are re-owned at merge; the approved retention periods (decision 20), each clean-up approved by the Super Admin |
| D-181 | Imports: one CSV template per kind, keyed by web address, with fixed headers; a blank means unchanged; rates become draft cards. Replaces AC-35.1's single template and column mapping |
| D-182 | Production-only testing (mode off, test_only or on; the synthetic test hotel; test rows filtered out), and alerts through the worker while monitoring is off |

### 12.2 Documents

Update each in the same pull request as the slice that needs it.

- `docs/data-model.md`: Modules C, N and A, the ER diagram, and notes on staging and the merge.
- `docs/tools/field_rules.py`, then `field_matrix_build.py` for the field matrix. Also align E.164, `max_occupancy` and `is_indoor`.
- `docs/permission-matrix.md`:
  - the §5.3 rows;
  - §5.14 and §1 rule 5;
  - the §5.1 privacy row and the §2 note;
  - the §7 machine, the §9 audit lines and the §10 keys.

  Then run `pnpm authz:generate` and update the golden tests.
- `docs/wireframes.md`: HF-01 to HF-08, TW-99 and TW-100; updates to TW-21, TW-22, TW-25 and CP-05.
- `docs/user-flows.md`: Flow 13, cross-referenced from Flow 11.
- `docs/test-cases.md`: AC-39 (the public form) and AC-40 (the merge); update AC-35.1 and AC-04.3.
- `docs/review/build-plan.md`: the new scope, and the change to the G1 pack for AC-35.1.
- `docs/architecture.md`: the public intake on web-public, external recipients, the `guest_token` actor, the post-guard reader, the OOXML reader, disk and backups.
- `.claude/rules/security.md` and `.claude/rules/api.md`: the request-scoped contributor, so that hooks and reviews read it as intended.
- `docs/README.md`: the identifier schemes HF-, HIR- and HF-G.
- `docs/engineering/hotel-import.md`: the blank-cell change and the per-kind templates.
- `deploy/`:
  - the `.htaccess` examples (the site header fix);
  - Plesk nginx and Apache directive examples;
  - the ClamAV settings;
  - `backup-media.sh`;
  - the compose environment (`PUBLIC_SITE_URL`, `SMS_HOTEL_FORM_TEMPLATE`);
  - "Wiring SMS" in `production-setup.md`.
- `docs/planning/production-readiness.md`: the HF-G gates.
- `docs/decisions.json`: the open items, then the decision-log generators.
- `docs/design/peacock-night.md`: the new patterns.
- `graphify-out`: refresh after the document changes, running `graph_labels.py` first.

---

## 13. Risks

| Risk | What reduces it |
| --- | --- |
| **Scope.** About 57 days, built in one go, competes with other go-live work, and nothing reaches hotels until the end | Each slice still lands and is tested on its own. The staff tools (Slices 2 to 4) are usable as soon as they land |
| **On-screen codes prove nothing.** Until SMS is wired, anyone with a forwarded link can take part | Expiry, revoke and reissue; nothing from the catalogue is shown; AMPM's review before anything is applied; the change log; the "Mobile not checked" chip; SMS as soon as a provider is chosen |
| **A merge bug on an active hotel** publishes at once, with no undo | The allow-list; no defaults for differing values; the never-write list; locks and conditional updates; the per-field change log for manual reverts; new hotels are merged as drafts |
| **Email.** The link email may land in spam | Copy the link into WhatsApp instead; click tracking off; the admin mailbox is watched |
| **Disk.** With no upgrade, uploads, snapshots and the database share the box's disk (about 32 GB free on 23 November 2026) | Hard-link snapshots; the 250 MiB cap per request; the 9 GiB guard and alerts; Docker's build cache (19 GB reclaimable) can be pruned; more disk or online storage when the alert says so |
| **The hand-written readers** (OOXML and the older compound files) may refuse real files, or let a crafted one through | Fixtures from five office suites and older files; ClamAV with strict settings and its macro alert; Office files only as downloads; restrictive serving headers |
| **Memory.** Uploads and image decoding share a 1 GB container | Concurrency caps; one image at a time; a 25-megapixel cap; the load test. The fallback is streaming to temporary files, which needs stream variants of the scanner and storage seams |
| **Strict client views.** A contract change breaks the old portal bundle until it is rebuilt | Deploy back to back now; once clients are live, ship new keys one release ahead |
| **Units and capacity meanings** could skew the client capacity filter | One converter; the published units kept; labels that explain each figure; warnings |
| **Contradictory or old fact sheets** | The reviewer settles each value with the sheet open; a warning for sheets over 12 months old; verifications ticked per field group |
| **Photo rights.** Brand imagery, renders and photos of past weddings | Photos stay internal by default; "Show to clients" is decided per photo, only under a Yes to 7.5; GP-20 still applies |
| **Privacy.** New data principals while the notice is a placeholder | Release waits for approved wording (HF-G2); masking and retention go through a Super Admin |
| **In-app browsers** (WhatsApp, Gmail) may lose sessionStorage or the file picker | The browser matrix; an "open in your browser" hint; resuming takes one code |
| **Outages.** Turnstile or the limiter failing blocks code requests and submits (fail closed) | Retry messages; autosaved drafts; alerts |
| **Duplicates.** Name variants may produce duplicate hotels | Duplicate hints with name variants and deleted web addresses; "Merge into an existing hotel" at review |

---

## 14. Open questions

The developer answered the open questions on 23 November 2026 (§3). These are still open:

1. Which SMS provider, and who registers the DLT entity, the sender header and the second template (decision 5)? Codes stay on screen until then.
2. Which mailbox becomes the permanent reply-to and help contact? The admin mailbox is used for now (decision 21).
3. Who acts as counsel before release: reviewing the privacy notice, the declaration wording and the lawful basis for named contacts (HF-G2), and confirming the retention minimums?

---

## Appendix A. Alternatives considered and rejected

| Alternative | Why not |
| --- | --- |
| One generic link, with submissions matched to hotels afterwards | Invites spam and guesswork; binding at invite is the cheapest reliable key |
| The secret in the URL path or query | Logged at the edge (nginx and Apache) |
| A sealed copy of the link staff can re-display | A reversible secret at rest; reissuing works instead (the D-137 pattern) |
| A single-use link | Burned by link previews and mail scanners; no resuming |
| A permanent link per hotel | The leak window never closes |
| One draft per person | Blocks colleagues from working together |
| An email code and an invite list of allowed addresses | Proposed by the checks; replaced by the developer's choice of a mobile code only (decisions 4 and 6) |
| Waiting for DLT before release | Would hold the release for 2 to 4 weeks; codes are shown on screen until SMS is wired (decision 4) |
| WhatsApp verification | No adapter, plus 2 to 6 weeks of onboarding with Meta |
| Hosting the form in the portal | A 5.8 MB first load, a Report-Only CSP and staff tokens on the same origin |
| Creating the draft hotel at submit | Public input would create rows, and web addresses would be burned for rejected submissions |
| Creating the draft hotel at invite | Leaves rows, and web addresses taken for good, behind for invites that never answer (decision 2) |
| Writing straight into the catalogue | Publishes unreviewed data |
| Accepting everything at merge | Carries contradictions from the sheets into the catalogue |
| Using the existing CSV import as the merge | It overwrites |
| A zip library | A new dependency; the bounded reader covers what is needed |
| Prefill on by default | Shows catalogue data to whoever holds a link |

## Appendix B. What the checks changed

These are the blocker and the major findings, and how this plan answers each.

Some of these answers were later replaced by the developer's decisions of 23 November 2026 (§3): the email code and the invite list (decision 6), the call-back to check a contributor's mobile (decision 4), per-recipient links (decision 7), the form's 30% share of the email quota, the separate sending subdomain and bounce handling (decision 8, deferred), creating the draft hotel at invite as a variant (decision 2), and the client label (decision 14). While codes are shown on screen, the blocker's fix cannot hold either (decision 4, §9.1). The rows below are the record of what the checks found.

| Finding | Change |
| --- | --- |
| **Blocker:** sending a code created or updated the person and recorded consent before anything was proven, so a link holder could rewrite a colleague's identity and later take over their session | The claimant's details stay on the challenge until the code verifies. Identity fields change only inside a session. A new mobile becomes unverified. Only verified people count towards the limit |
| The `#` was said to hide the link from mail scanners | Threat model corrected (§4.2). The link alone is never enough; tracking is off; "opened" counts only after a human step |
| "Anyone verified" access and the recipient's brand domain as the default | Invited only by default. Domains only when staff confirm them, never webmail, brand-wide or AMPM's own. A daily budget of failed tries, 8-digit email codes, and join emails |
| Sessions outlived reissues, access changes and merges | Sessions record the link generation; reissue ends them; access changes re-check people; a status-only period after merge; re-checks on every call |
| Reviewer checks used the hotel's own data | The call-back goes to an independently sourced number; domains are compared with the website staff entered; AMPM's own addresses are refused; the client verification label is AMPM's decision |
| Contact channels could be redirected by a merge | Contact-channel changes on existing hotels are identity decisions, with out-of-band confirmation and a notice to the previous address |
| Removed files escaped the disk quotas | Quotas count every retained byte; removal caps and per-person budgets |
| Autosave could churn the database and its backups | Per-session and per-request write windows; section size caps; unchanged content skipped; WAL and backups counted in the disk alert |
| Staff upload routes and the edge still buffered anonymous bodies | One post-guard reader for every upload route; the global raw parser removed; nginx limits per location, with connection and request zones |
| The email cap exceeded the free plan, on a channel shared with sign-in mail | The form gets at most 30% of the quota; a separate sending subdomain; bounce and complaint suppression; alerts in-app |
| Personal data would reach the append-only audit log | Allow-listed audit images; more redaction keys, with tests; no file names in logs |
| Office and PDF active content, polyglots, and ClamAV's limits | A fuller OOXML check (relationships, external targets, DDE, actions, OPC names, header consistency); PDF checks; polyglot refusal; strict ClamAV settings |
| Outsiders' files served from the origin that holds the tokens | Detected types only; restrictive CSP and CORP; attachments; a separate files origin planned |
| Staff over-read of contacts and internal notes (existing) | Slice 1; one response model per audience for requests too |
| Declarations were not bound to what was declared | Immutable revision snapshots; consents bound to the revision hash; photos shown only from a revision with a Yes to 7.5 |
| Named contacts and withdrawal | A notice to named contacts with an objection route; withdrawal on the status page; the lawful basis confirmed by counsel |
| Image decoding could exhaust memory | A 25-megapixel cap; one image at a time; sharp settings; floor plans never downscaled; a load test with decoding |
| Draft hotels created at invite had no lifecycle | New hotels are created at the reviewer's first "Apply changes" (decision 2); creation at invite was rejected |
| A No to 7.5 changed nothing | It limits the merge, and 7.5 is reworded |
| Resubmission could apply values nobody had seen | Decisions are bound to revisions and value hashes; 409 on a mismatch |
| The TW-25 and AC-35.1 import came late and was reshaped silently | Moved to Slices 2 to 4, with template and report downloads; the AC-35.1 change recorded |
| Deploy steps left out box configuration | The deploy checklist (§10.2), with production checks on `PUBLIC_SITE_URL` and the bot-check hostnames |
| The revised form had no sign-off | Decision 15, with the diff in §5.3 |
| Permission keys would not generate as named | Curated `RESOURCES["5.3"]` entries |
| The status machine named an actor the generator rejects | Hotel-driven moves written as System movers |
