# Hotel import — the spreadsheet template and how it loads

**For:** AMPM (Eva and the hotel team) and the developer · **Feature:** Module C 9.1 (TW-25; AC-35.1) · **Status:** rewritten on 24 November 2026 for the safe import (D-181): one CSV template per kind, fixed headers, and a blank cell that never clears a value. This page covers the **Hotels** template. The Rooms and Venues templates follow with Slice 3 of the [hotel information form plan](../planning/hotel-information-form-plan.md), and Rates with Slice 4.

Eva loads the ~200 hotels from a spreadsheet saved as **CSV**, one row per hotel. Download the template from the import screen (TW-25), fill it in, save it as **CSV UTF-8**, and upload the file. Always **validate first**: the dry run checks every row and reports what it would do, without changing any hotel. Then import the same file.

[`hotel-import-template.csv`](hotel-import-template.csv) is the same header with two synthetic example rows, a fictitious hotel in a fictitious destination. Use it to see the formats; do not import it.

## How it loads

- **The file itself, after the checks.** The team app uploads the raw CSV (`application/octet-stream`, not a JSON copy) to `POST /hotels-admin/imports/hotels`: `?dryRun=true` validates, and `dryRun=false`, the default, imports. A file may be up to **5 MiB** and **2,000** data rows; a larger one is refused whole (413 for the size), so split it. The API reads the body only after the sign-in, rate-limit and permission checks have passed, through the shared post-guard reader ([architecture §6](../architecture.md)).
- **Validate, then import.** Every row is checked, and the report gives each one an outcome: **create**, **update** (naming the columns that would change), **unchanged**, or **error** (naming the column and the reason). Error rows never load; the valid rows still do (48 of 50 in the acceptance test). A dry run writes no hotel: it records the run in `import_jobs` with its report, and its counts say what importing would do.
- **Import sends the file again.** For now, Import uploads the same file and the server checks and plans it afresh, so what loads is what the file says at that moment. From Slice 3 the import will run the dry run's own plan by its job id, and refuse a row whose hotel changed after the preview.
- **Matched by web address.** A hotel is matched on its `slug`, its web address: a new slug creates a hotel, an existing one updates it. Re-importing a file that is already loaded reports its rows as unchanged, and the import then says nothing was imported (the result's `applied` is false when a run writes nothing).
- **Moving a hotel takes its slug.** A row whose `destinationSlug` differs from its hotel's moves the hotel there, but only when the row's `slug` cell names the hotel. A row with a blank `slug` takes its web address from `name`, and properties of one brand in two cities often share a name, so when that address belongs to a hotel filed under another destination the row is an error: give it its own slug, or that hotel's slug to move it. A move checks the postal code the hotel keeps against the new destination's country unless the row gives a new one.
- **A blank cell leaves the value unchanged.** On an existing hotel an empty cell never clears or resets anything; to clear a value, edit the hotel in the team app. `status`, `demoVisible` and `publicShowcase` change only when their cell is filled. When a row creates a hotel, a blank `status` makes it a draft, blank flags keep it out of the demo and off the website, and the other blank cells stay empty.
- **A deleted hotel's web address is a row error.** A web address is never reused, so a row whose slug, given or derived from `name`, belongs to a deleted hotel is reported on its line, and the rest of the file still loads.
- **Destinations are resolved or created** by `destinationSlug`. A new destination is created `active`, in India, with `destinationName` (or a title-cased slug) as its name, and audited as the Destinations screen's create is.
- **Permissions are checked row by row**, each on the key the dedicated screen asks. Uploading needs `hotels.hotel_profiles_client_fields.create`. A row that changes an existing hotel (its cells, its destination or its images) also needs `hotels.hotel_profiles_client_fields.update`; a row that names a destination that does not exist yet needs `hotels.destinations.create`; a filled `imageRef` needs `hotels.hotel_media_rights_status.create`; and a filled `internalRating` or `internalNotes` cell needs `hotels.hotel_internal_rating_notes.update` (D-171). A row the uploader may not write is an error row; the other rows still load. The Hotel team and the Super Admin hold every one of these keys, so the row checks matter for custom roles.
- **A dry run compares only what the uploader may read.** A cell is compared with the stored profile only for a holder of `hotels.hotel_profiles_client_fields.read`, and with the internal rating and notes only for a holder of `hotels.hotel_internal_rating_notes.read`; for anyone else a filled cell counts as a change, so the report never tells them whether a guess matches a value they cannot see.
- **Every created or updated hotel is audited**, and the run is recorded in `import_jobs` with the counts and the report. A row that changes nothing writes no hotel change and no audit event.
- **Images by reference.** A filled `imageRef` registers a pending, internal gallery image for the hotel once the import has committed; the reference is kept in the image's audit event, never as a caption. It is registered once per hotel and reference, so a re-import adds none. Images are counted apart from the rows (`mediaRegistered`): a row whose cells all match stays unchanged though it adds an image.

## Filling in the file

- **Headers are fixed.** Use the template's header names exactly; there is no column mapping. A header the template does not have refuses the whole file, so delete extra columns (notes, helper formulas) before saving. A file may carry any subset of the columns, but it must have `destinationSlug` and `name`.
- **Save as CSV UTF-8** (in Excel: *Save As*, then *CSV UTF-8 (Comma delimited)*). The byte-order mark Excel writes at the start is fine. Another encoding garbles names with accents or in Indic scripts.
- **Lists** (`nameAliases`, `facilities`, `cuisines`) keep their entries in one cell, separated by `|`, for example `Pool|Spa|Gym`. A line break inside the cell (Alt+Enter in Excel) separates entries too, and a comma never does, so `Spa, salon and gym` is one facility. The team app's editor reads its one-per-line lists by the same rule, so a list saved by either reads back the same through the other.
- **Yes-or-no columns** take `true` or `false`; `yes`, `no`, `1` and `0` work too, in any case. On a new hotel a blank food fact means the hotel has not said, and a blank `demoVisible` or `publicShowcase` means no; on an existing hotel a blank cell leaves any of them unchanged.
- **Numbers** are plain: no thousands separators and no units (`25833`, not `25,833 sq ft`). Distances take at most one decimal place; coordinates are kept to six.
- **Quote a cell that contains a comma**, as spreadsheets do when they save CSV (`"1 Example Road, Old Town"`).

## Columns

The column list is `HOTEL_IMPORT_COLUMNS` in `packages/core/src/schemas/hotel-import.ts`. The server's header check and the app's template download both read it, so the two cannot drift; the table follows its order.

| Column | Required | Type | Notes |
|---|---|---|---|
| `destinationSlug` | **yes** | kebab-case | Resolves or creates the destination (e.g. `example-hills`). |
| `destinationName` | no | text | Used only when this import creates the destination. |
| `slug` | no | kebab-case | The hotel's web address and stable key; derived from `name` when blank. **Changing it later creates a new hotel.** |
| `name` | **yes** | text | The hotel's display name. |
| `brand` | no | text | |
| `parentGroup` | no | text | The owning group, besides the brand. |
| `nameAliases` | no | list | Other names the hotel goes by: up to 20, none repeated. **INTERNAL**: staff only. |
| `starCategory` | no | text | e.g. `5`. |
| `status` | no | `draft`/`active`/`inactive` | Changes only when filled; a new hotel is a `draft`. Only `active` hotels appear in discovery. |
| `demoVisible` | no | yes/no | Whether the hotel appears in the demo (three locations, one hotel each). Changes only when filled; a new hotel is left out. |
| `publicShowcase` | no | yes/no | Whether the public website may show the hotel's name, destination and hero image. Changes only when filled; a new hotel is not shown. |
| `address` | no | text | The street address. |
| `locality` | no | text | |
| `city` | no | text | |
| `state` | no | text | |
| `postalCode` | no | text | When the destination is in India, a PIN: 6 digits, not starting with 0 (spaces are ignored). A row that moves a hotel without one checks the code the hotel keeps. |
| `latitude`, `longitude` | no | number | Decimal degrees, kept to 6 places. **INTERNAL**: staff only. |
| `mapsUrl` | no | URL | An https Google Maps link (`google.com/maps` or `google.co.in/maps`, with or without `www.`; `maps.google.com` or `maps.google.co.in`, at its root or under `/maps`; `maps.app.goo.gl`; `goo.gl/maps`), up to 2,048 characters. A path a browser would rewrite (a `..` segment, a backslash) is refused, so a link can never lead out to Google's redirector. Stored as given; AMPM's server never opens it. |
| `streetViewRef` | no | text | Map or street-view reference (Q9). |
| `website` | no | URL | A full URL, e.g. `https://…`. |
| `descriptionClient` | no | text | **Shown to clients.** |
| `totalRooms` | no | whole number | 0 to 100,000. |
| `facilities` | no | list | The hotel's amenities, e.g. `Pool\|Spa\|Gym`: up to 100 labels of up to 120 characters. |
| `airportName` | no | text | |
| `airportDistanceKm` | no | number | 0 to 999.9 km, at most one decimal place. |
| `airportDriveMinutes` | no | whole number | 0 to 600. |
| `railwayStationName` | no | text | |
| `railwayDistanceKm` | no | number | As the airport distance. |
| `railwayDriveMinutes` | no | whole number | 0 to 600. |
| `cityCentreDistanceKm` | no | number | As the airport distance. |
| `cityCentreDriveMinutes` | no | whole number | 0 to 600. |
| `accessNotes` | no | text | Highways and landmarks. |
| `totalEventSpaceSqm` | no | whole number | m², 0 to 1,000,000. |
| `totalEventSpaceSqft` | no | whole number | sq ft as the hotel published it, 0 to 10,000,000. |
| `weddingBuyoutPolicy` | no | `not_required`/`required`/`depends` | Whether weddings need a full buyout. **INTERNAL** booking term. |
| `minRoomsWithoutBuyout` | no | whole number | The fewest rooms a wedding must book when it does not buy out the hotel, 0 to 10,000. **INTERNAL** booking term. |
| `minNights` | no | whole number | 1 to 60. **INTERNAL** booking term. |
| `parallelFunctions` | no | `allowed`/`not_allowed`/`depends` | Whether several functions can run at once or on the same day. **INTERNAL** booking term. |
| `bookingNotes` | no | text | **INTERNAL** booking term. |
| `cuisines` | no | list | Labels from the configured cuisine options (configuration `hotel.cuisine_options`, e.g. `Indian\|Continental`), or `Other`; up to 30. |
| `isPureVegetarian` | no | yes/no | Blank: the hotel has not said. |
| `hasSeparateVegKitchen` | no | yes/no | Blank: the hotel has not said. |
| `servesAlcohol` | no | yes/no | Blank: the hotel has not said. |
| `internalRating` | no | 1–5 | **RESTRICTED**: internal only, never shown to a client (R9). Needs the internal rating and notes permission. |
| `internalNotes` | no | text | **RESTRICTED**: internal only (R9). Needs the internal rating and notes permission. |
| `imageRef` | no | text | A URL or file name for the hotel's lead image, up to 255 characters, registered as a pending gallery image. Needs the media permission, and on an existing hotel the update permission too. |

Rooms, venues, contacts and rate cards (menus, per-plate and package pricing) are not in this template. Rooms and venues get their own templates with Slice 3, and rates with Slice 4; until then they are entered in the team app.

## The report and the downloads (TW-25)

- **Download template** saves the header row of every column, built in the app from the core column list.
- **Validate** shows the counts (to create, to update, unchanged, rejected), then the rows that would create or update a hotel (line, web address and the columns that would change, never their values) and the rejected rows (line, column and reason), up to 20 of each. Unchanged rows are only counted.
- **Download error report** (named **Download report** when no row is rejected) saves the whole report as a CSV, every row included: each row's line, web address, outcome, the columns that change, and its errors. A cell that starts with `=`, `+`, `-` or `@` is saved as text, so a spreadsheet never runs it as a formula.
- **Import** loads the valid rows and shows the same report for what was done; a run that changed nothing says so.

> **Which columns reach a client (R8/R9 defaults, locked by D-064/D-065):** on an `active` hotel, clients see `name`, `brand`, `starCategory`, `address`, `descriptionClient`, `website`, `totalRooms`, `facilities`, `streetViewRef` and the destination. `parentGroup`, `mapsUrl` and the location, access, event-space and food columns are client data too, but the client screens show them only from Slice 12 of the hotel information form plan; until then only staff see them. `nameAliases`, the five booking terms, `latitude` and `longitude` are staff-only (INTERNAL, D-178), and `internalRating` and `internalNotes` are never shown to a client. Prices and availability are a separate, verified step, not this template.
