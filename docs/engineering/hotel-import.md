# Hotel import — the spreadsheet template and how it loads

**For:** AMPM (Eva and the hotel team) and the developer · **Feature:** Module C 9.1 (TW-25; AC-35.1) · **Status:** the template is frozen for the week-8 "format agreed" commitment. Rooms, venues and rate cards extend it in feature 9.2.

Eva loads the ~200 hotels from a spreadsheet exported as **CSV** (one row per hotel). The frozen template, with two synthetic example rows, is [`hotel-import-template.csv`](hotel-import-template.csv). Fill it, export as CSV, and upload it through the team app (which posts it to `POST /hotels-admin/imports`). Always run a **dry run first** (it validates and reports without writing); then apply.

## How it loads

- **Validation, then apply.** Every row is validated; the invalid rows are reported by line and field and the valid rows still load (48 of 50 in the acceptance test). A dry run reports only.
- **Idempotent by `slug`.** A hotel is matched on its `slug`: a new slug is created, an existing one is updated. Re-uploading the same file changes nothing new, so a corrected file is safe to re-apply.
- **Destinations are resolved or created** by `destinationSlug`. A new destination is created `active` with `destinationName` (or a title-cased slug) as its name.
- **Every applied row is audited**, and the run is recorded in `import_jobs` with the counts and the error report.
- **Blank cells mean "unset"** (the column keeps its default); unknown columns in the spreadsheet are ignored.

## Columns

| Column | Required | Type | Notes |
|---|---|---|---|
| `destinationSlug` | **yes** | kebab-case | Resolves or creates the destination (e.g. `udaipur`). |
| `destinationName` | no | text | Used only when the destination is created on this import. |
| `slug` | no | kebab-case | The hotel's stable key; derived from `name` when blank. **Changing it later creates a new hotel.** |
| `name` | **yes** | text | The hotel's display name. |
| `brand` | no | text | |
| `starCategory` | no | text | e.g. `5`. |
| `address` | no | text | Quote it in CSV if it contains commas. |
| `latitude`, `longitude` | no | number | Decimal degrees. |
| `descriptionClient` | no | text | **Shown to clients.** |
| `website` | no | URL | Must be a full `https://…` URL. |
| `totalRooms` | no | whole number | |
| `demoVisible` | no | `true`/`false` | Whether the hotel appears in the demo (three locations, one hotel each). |
| `status` | no | `draft`/`active`/`inactive` | Defaults to `draft`; only `active` hotels appear in discovery. |
| `internalRating` | no | 1–5 | **RESTRICTED** — internal only, never shown to a client (R9). |
| `internalNotes` | no | text | **RESTRICTED** — internal only (R9). |
| `streetViewRef` | no | text | Map / street-view reference (Q9). |

Rooms, venues, contacts and verified rate cards (menus, per-plate and package pricing) are loaded separately once feature 9.2 extends this template; until then they are entered in the team app.

> **Which columns reach a client (R8/R9 defaults, locked by D-064/D-065):** `name`, `brand`, `starCategory`, `address`, `descriptionClient`, `website`, `totalRooms`, `streetViewRef` and the destination are client-visible on an `active` hotel; `internalRating` and `internalNotes` are never shown to a client. Prices and availability are a separate, verified step (feature 9.2), not this template.
