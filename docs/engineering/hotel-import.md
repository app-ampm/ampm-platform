# Hotel import — the spreadsheet templates and how they load

**For:** AMPM (Eva and the hotel team) and the developer · **Feature:** Module C 9.1 (TW-25; AC-35.1) · **Status:** rewritten on 24 November 2026 for Slice 3 of the [hotel information form plan](../planning/hotel-information-form-plan.md) (D-178, D-181). There is one CSV template per kind, with fixed headers. A blank cell never clears a value. Import applies the preview you validated, by its job id. This page covers the **Hotels**, **Rooms** and **Venues** templates; Rates follow with Slice 4.

Eva loads the ~200 hotels from spreadsheets saved as **CSV**: first the hotels, one row per hotel, then their rooms and their venues, one row per room category or venue. On the import screen (TW-25):

1. Choose the kind and download its template.
2. Fill it in and save it as **CSV UTF-8**.
3. Upload the file and press **Validate**. The preview checks every row and reports what importing would do, without changing anything.
4. Press **Import** within 24 hours to load that preview.

Import the hotels before their rooms and venues: a Rooms or Venues row can only name a hotel that already exists.

Each template has an example file with the same header and synthetic rows for a fictitious hotel, `example-hills-retreat`. Use them to see the formats; do not import them.

- [`hotel-import-template.csv`](hotel-import-template.csv): Hotels.
- [`hotel-import-rooms-template.csv`](hotel-import-rooms-template.csv): Rooms.
- [`hotel-import-venues-template.csv`](hotel-import-venues-template.csv): Venues.

## How it loads

- **The file itself, after the checks.** The team app uploads the raw CSV (`application/octet-stream`, not a JSON copy) to the kind's route: `POST /hotels-admin/imports/hotels`, `/hotels-admin/imports/rooms` or `/hotels-admin/imports/venues`.
  - A file may be up to **5 MiB** and **2,000** data rows. A larger one is refused whole (413 for the size), so split it. A file with the header and no data rows is refused whole too.
  - The API reads the body only after the sign-in, rate-limit and permission checks have passed, through the shared post-guard reader ([architecture §6](../architecture.md)).
- **Every upload is a preview.** Every row is checked and planned, and the report gives each one an outcome: **create**, **update** (naming the columns that would change), **unchanged**, or **error** (naming the column and the reason).
  - The preview changes no hotel, room or venue. It records itself in `import_jobs` with its report, which names fields and never holds their values, and with its planned rows, values included, which are kept for the import and never shown.
  - The planned rows are kept only while they can be imported. They are cleared on import, when a newer preview replaces them, when an import finds the preview expired, and by a daily clean-up once they are more than 24 hours old; the job and its report stay.
  - Its counts say what importing would do, the images it would register included. A preview with no valid row cannot be imported.
  - For one release the team app's Validate sends `?dryRun=true`, and the API takes it as the same preview. Should the API be rolled back to the previous version, which imports a file sent without it, a Validate from this team app still changes nothing there. The previous version of the team app cannot read this API's answers at all (its checks of a result are strict), so reload the team app after a deploy. `dryRun=false`, the previous team app's import, is refused (400). Slice 4 removes the query from both.
- **Import applies the preview by its job id.** Import sends no file: `POST /hotels-admin/imports/<kind>/<jobId>/apply`, with an empty body, loads the rows the preview planned.
  - It answers with the preview's own job id, which is then `applied`; no second job is created.
  - Error rows never load; the valid rows still do (48 of 50 in the acceptance test).
- **Who may import a preview, and until when.**
  - Only the person who uploaded the file may import its preview, and only within **24 hours** (`HOTEL_IMPORT_PREVIEW_TTL_HOURS` in `packages/core`).
  - A newer preview of the same kind by the same person replaces the older ones.
  - The import checks the uploader's permissions again, as they are at that moment, so a role changed since the preview is honoured.
  - When the preview can no longer be imported, Import changes nothing, and the next step is always to validate the file again:
    - a preview that is another person's, of another kind, or does not exist answers 404;
    - a preview imported already answers 409, "This preview was already imported";
    - a preview older than 24 hours, or replaced by a newer one, answers 409, "This preview has expired; validate the file again";
    - an import that another change raced for a web address (a hotel or destination created meanwhile with one the file uses) writes nothing and answers 409, "Another change took one of these web addresses while the import ran; validate the file again".
- **Changed since preview.** Import locks the hotels the file touches and plans each stored row again against the catalogue as it is at that moment. It refuses a row, with "Changed since preview; validate the file again" on its `row` field, and counts it among the rejected rows, when:
  - a value the import compares changed on the row's hotel, room or venue after the preview;
  - the hotel, room or venue the row was to create now exists;
  - the one the row was to update has been deleted or renamed, or its hotel deleted, even when the row could not create a new one instead (a venue row without a type, say).

  The other rows still load, so an import never overwrites what staff changed after the preview. Validate the file again to see the change and load the refused rows.
- **What counts as changed.** A change is a new value in a column the import compares:
  - **Hotels:** every template column except `slug`, `destinationName` and `imageRef`; `destinationSlug` compares the hotel's destination. The internal rating and notes count only for an uploader who reads them, or on a row that fills `internalRating` or `internalNotes` (only such a row could write over them), so an edit of the notes never refuses another row, and never tells an uploader who cannot read the notes that they changed.
  - **Rooms and Venues:** every template column except `hotelSlug` and `name`.

  Each check is exactly as fine as its kind's comparison. Rooms and Venues compare text with its spacing evened out, so an edit only in spacing is not a change. The Hotels template compares text trimmed only, and links and list entries exactly, so on a hotel any stored edit counts, spacing and a link's case included. The check is a version token, a hash of those values taken at the preview, not the time of the last edit. Recording a verification, or editing what the template does not carry (contacts, media, rate cards, another room), is therefore not a change.
- **A blank cell leaves the value unchanged.** On an existing hotel, room or venue an empty cell never clears or resets anything; to clear a value, edit it in the team app. A row that creates something leaves its blank cells empty, apart from the defaults the Hotels section gives.
- **Permissions are checked row by row**, each on the key the dedicated screen asks; a row the uploader may not write is an error row, and the other rows still load. Each kind's section lists its keys. The Hotel team and the Super Admin hold every one of them, so the row checks matter for custom roles.
- **Audited, and recorded.** Every hotel, room or venue an import creates or updates writes an audit event. The job keeps the counts and the import's report. A row that changes nothing writes nothing and no audit event, and an import that writes nothing says nothing was imported (the result's `applied` is false).

## Filling in the file

- **Headers are fixed.** Use the template's header names exactly; there is no column mapping. A header the template does not have refuses the whole file, so delete extra columns (notes, helper formulas) before saving. A file may carry any subset of the columns, but it must have the kind's required columns: `destinationSlug` and `name` for Hotels, `hotelSlug` and `name` for Rooms and Venues.
- **Save as CSV UTF-8** (in Excel: *Save As*, then *CSV UTF-8 (Comma delimited)*). The byte-order mark Excel writes at the start is fine. Another encoding garbles names with accents or in Indic scripts.
- **Lists** (`nameAliases`, `facilities`, `cuisines`) keep their entries in one cell, separated by `|`, for example `Pool|Spa|Gym`. A line break inside the cell (Alt+Enter in Excel) separates entries too, and a comma never does, so `Spa, salon and gym` is one facility. The team app's editor reads its one-per-line lists by the same rule, so a list saved by either reads back the same through the other.
- **Option cells.**
  - In the Rooms and Venues templates (`unitType`, `venueType`, `setting`), an option cell takes its value in any case, with spaces and hyphens read as underscores: `Meeting room`, `meeting-room` and `MEETING_ROOM` all read as `meeting_room`, and `Semi-open` as `semi_open`.
  - The Hotels template's option cells (`status`, `weddingBuyoutPolicy`, `parallelFunctions`) take the exact value its table shows.
- **Yes-or-no columns** (Hotels only) take `true` or `false`; `yes`, `no`, `1` and `0` work too, in any case. On a new hotel a blank food fact means the hotel has not said, and a blank `demoVisible` or `publicShowcase` means no; on an existing hotel a blank cell leaves any of them unchanged.
- **Numbers** are plain: no thousands separators and no units (`25833`, not `25,833 sq ft`). Distances take at most one decimal place, and lengths, widths and ceiling heights two; coordinates are kept to six.
- **Quote a cell that contains a comma**, as spreadsheets do when they save CSV (`"1 Example Road, Old Town"`). A quote opens a quoted cell only at the start of the cell; anywhere else it is text, so `55" TV` needs no quoting. A cell that opens a quote must close it: a quote that never closes refuses the file, naming its line, rather than swallow the rows below it.
- **Line endings** may be those of any spreadsheet: CRLF (Windows), LF, or CR alone (Excel for Mac's older CSV). Blank rows are skipped, above the header too, and a row's line in the report is its place in the file.
- **No null characters.** Text pasted from a PDF can carry an invisible null character, and a file saved as UTF-16 is full of them; the database cannot store one, so such a file is refused whole.

## Sizes and areas: square feet and square metres

Hotels publish sizes in square feet or in square metres. The catalogue keeps the figure the hotel published and works out the other. Square metres stay canonical, because the client filters read them.

- **Fill in the unit the hotel used.** The `…Sqft` columns take square feet: `sizeSqft`, `areaSqft`, `prefunctionAreaSqft`, and the Hotels template's `totalEventSpaceSqft`. The `…Sqm` columns take square metres.
- **Square feet win.** A filled sq ft cell stores the m² worked out from it, round(sq ft × 0.09290304), with the converter the team app uses (`sqmFromSqft` in `packages/core`). An m² cell filled in the same row is replaced by the worked-out figure. So `850` sq ft is stored with 79 m², and `5000` with 465 m².
- **Square metres alone restate the size.** An m² cell filled without its sq ft cell, for a room, venue or hotel that has a sq ft figure stored, makes the m² the published figure and clears the stored sq ft. The report names both columns as changed.
- **Blank cells leave both figures as they are.**
- **Metres only for lengths.** Lengths, widths and ceiling heights are in metres, with at most two decimal places (`30.5`, `15.25`). A figure carrying a spreadsheet's rounding noise, such as `30.000000000000004`, is read as the column keeps it, `30`, so importing the file again changes nothing.

## The Hotels template

One row per hotel. The column list is `HOTEL_IMPORT_COLUMNS` in `packages/core/src/schemas/hotel-import.ts`, which `HOTEL_IMPORT_TEMPLATES.hotels` carries. The server's header check and the app's template download both read it, so the two cannot drift; the table follows its order.

- **Matched by web address.** A hotel is matched on its `slug`, its web address: a new slug creates a hotel, an existing one updates it. Re-importing a file that is already loaded reports its rows as unchanged.
- **Moving a hotel takes its slug.** A row whose `destinationSlug` differs from its hotel's moves the hotel there, but only when the row's `slug` cell names the hotel.
  - A row with a blank `slug` takes its web address from `name`. Properties of one brand in two cities often share a name, so when that address belongs to a hotel filed under another destination, the row is an error: give it its own slug, or that hotel's slug to move it.
  - A move checks the postal code the hotel keeps against the new destination's country, unless the row gives a new one.
- **Flags change only when filled.** `status`, `demoVisible` and `publicShowcase` change only when their cell is filled. A row that creates a hotel makes it a draft when `status` is blank, and blank flags keep it out of the demo and off the website; its other blank cells stay empty.
- **A deleted hotel's web address is a row error.** A web address is never reused, so a row whose slug, given or derived from `name`, belongs to a deleted hotel is reported on its line, and the rest of the file still loads.
- **Destinations are resolved or created** by `destinationSlug`. A new destination is created `active`, in India, with `destinationName` (or a title-cased slug) as its name, and audited as the Destinations screen's create is.
- **Keys, row by row.**
  - Uploading, and a row that creates a hotel, need `hotels.hotel_profiles_client_fields.create`.
  - A row that changes an existing hotel (its cells, its destination or its images) also needs `hotels.hotel_profiles_client_fields.update`.
  - A row that names a destination that does not exist yet needs `hotels.destinations.create`.
  - A filled `imageRef` needs `hotels.hotel_media_rights_status.create`.
  - A filled `internalRating` or `internalNotes` cell needs `hotels.hotel_internal_rating_notes.update` (D-171).
- **A preview compares only what the uploader may read.**
  - A row that names an existing hotel also needs `hotels.hotel_profiles_client_fields.read`. Without it the row is an error with one reason ("you cannot read existing hotels"), whatever its destination or cells, so the report never tells the uploader where a hotel is filed or what it holds.
  - A cell is compared with the internal rating and notes only for a holder of `hotels.hotel_internal_rating_notes.read`. For anyone else a filled notes cell counts as a change, so the report never tells them whether a guess matches a value they cannot see.
- **The audit event** keeps the hotel's name, status and demo and website flags before and after, as an edit in the team app does, and names the other fields the row changed without their values.
- **Images by reference.** A filled `imageRef` registers a pending, internal gallery image for the hotel once the import has committed; the reference is kept in the image's audit event, never as a caption. It is registered once per hotel and reference, so a re-import adds none. Images are counted apart from the rows (`mediaRegistered`): a row whose cells all match stays unchanged though it adds an image. A preview counts the images importing would register, leaving out those already registered, so a file that only adds images to hotels whose cells match can still be imported.

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
| `totalEventSpaceSqm` | no | whole number | m², 0 to 1,000,000. Worked out from `totalEventSpaceSqft` when that is filled. |
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

## Rooms and venues: how a row finds its room or venue

A Rooms or Venues row names its hotel by web address in `hotelSlug`, and its room category or venue by `name`.

- **The hotel must exist.** A web address that names no hotel, or a deleted one, is a row error on `hotelSlug`.
- **Matched by name within the hotel.** A row matches the hotel's room or venue of the same name, ignoring case and spacing: `example  hillside VILLA` finds `Example Hillside Villa`. How an accent is encoded does not count either: a name copied from a PDF with a combining accent finds the same name typed in the team app, since the import reads the file and the stored names in one composed form (Unicode NFC). Any other difference is a different name, so `Example Hill-side Villa` would create a new room.
- **No renames.** A matched row updates the room or venue in place and keeps its stored name. To rename one, use the team app.
- **No deletes.** An import never deletes or recreates a room or venue, because rate items point at them. A room or venue the file leaves out stays as it is.
- **A deleted name is free again.** A row with the name of a deleted room or venue creates a new one.
- **Two rooms or venues sharing a name.** When two rooms of the hotel share a name, ignoring case and spacing, a row with that name cannot tell them apart. It is a row error ("Two rooms are named …; rename one in the staff app first", and the same for venues); rename one in the team app, then validate again.
- **The same name twice in one file**, for the same hotel, is a row error on the second line.
- **Keys, row by row.** Uploading a Rooms or Venues file needs `hotels.room_categories_venues.create`. A row that creates a room or venue needs that key, and a row that changes one needs `hotels.room_categories_venues.update`.
- **A preview compares only what the uploader may read.** A row that names an existing room or venue also needs `hotels.room_categories_venues.read`, even with the update key. Without it the row is an error with one reason ("A room already has this name, and you cannot read rooms", and the same for venues), so the report never tells the uploader whether a cell matches a row they cannot read.
- **Contacts are not imported.** They are RESTRICTED-CONTACT, staff-only data: add them on the hotel's Contacts tab (TW-22).

## The Rooms template

One row per room category. The column list is `ROOM_IMPORT_COLUMNS` in `packages/core/src/schemas/hotel-import-rooms-venues.ts`, which `HOTEL_IMPORT_TEMPLATES.rooms` carries; the table follows its order.

| Column | Required | Type | Notes |
|---|---|---|---|
| `hotelSlug` | **yes** | kebab-case | The hotel's web address, e.g. `example-hills-retreat`. |
| `name` | **yes** | text | The room category's name, up to 255 characters. It finds the room (see above) and is never changed by an import. |
| `roomCount` | no | whole number | Rooms in this category, 0 to 100,000. |
| `unitType` | no | option | `room`, `suite`, `villa`, `cottage`, `tent`, `tent_suite`, `apartment` or `other`, in any case (`Tent suite` reads as `tent_suite`). |
| `viewLabel` | no | text | e.g. `Valley view`, up to 255 characters. |
| `bedConfiguration` | no | text | e.g. `One king bed`, up to 255 characters. |
| `maxOccupancy` | no | whole number | Guests per room, 1 to 100. |
| `sizeSqm` | no | whole number | m², 0 to 100,000. Worked out from `sizeSqft` when that is filled. |
| `sizeSqft` | no | whole number | sq ft as the hotel published it, 0 to 1,000,000. |
| `facilities` | no | list | e.g. `Balcony\|Bath tub`. |
| `description` | no | text | **Shown to clients.** |

## The Venues template

One row per venue. The column list is `VENUE_IMPORT_COLUMNS` in the same file, which `HOTEL_IMPORT_TEMPLATES.venues` carries; the table follows its order.

| Column | Required | Type | Notes |
|---|---|---|---|
| `hotelSlug` | **yes** | kebab-case | The hotel's web address. |
| `name` | **yes** | text | The venue's name, up to 255 characters. It finds the venue (see above) and is never changed by an import. |
| `venueType` | **for a new venue** | option | `ballroom`, `lawn`, `poolside`, `rooftop`, `courtyard`, `beach`, `terrace`, `garden`, `amphitheatre`, `meeting_room`, `lounge` or `other`, in any case (`Meeting room` reads as `meeting_room`). A row that creates a venue without it is a row error. |
| `setting` | **for a new venue** | option | `indoor`, `outdoor` or `semi_open` (covered or semi-open), in any case (`Semi-open` reads as `semi_open`). A row that creates a venue without it is a row error. |
| `areaSqm` | no | whole number | m², 0 to 1,000,000. Worked out from `areaSqft` when that is filled. |
| `areaSqft` | no | whole number | sq ft as the hotel published it, 0 to 10,000,000. |
| `lengthM`, `widthM` | no | number | Metres, 0 to 2,000, at most two decimal places. |
| `ceilingHeightM` | no | number | Metres, 0 to 100, at most two decimal places. |
| `capacityBanquet` | no | whole number | **Seated (dinner at round tables)**, 0 to 100,000. One number. |
| `capacityTheatre` | no | whole number | **Theatre (rows of chairs)**, 0 to 100,000. One number. |
| `capacityReception` | no | whole number | **Floating (standing reception or cocktails)**, 0 to 100,000. One number. |
| `otherLayouts` | no | layouts | Up to 12 more layouts (see below). |
| `prefunctionAreaSqm` | no | whole number | The pre-function area in m², 0 to 1,000,000. Worked out from `prefunctionAreaSqft` when that is filled. |
| `prefunctionAreaSqft` | no | whole number | The pre-function area in sq ft as the hotel published it, 0 to 10,000,000. |
| `capacityNotes` | no | text | Up to 1,000 characters: a range the hotel gives (`Floating 400 to 450`) or any other note on capacity. |
| `facilities` | no | list | e.g. `Stage\|Dance floor`. |
| `description` | no | text | **Shown to clients.** |

- **What the capacities mean** (decision 11 of the plan, AMPM agreed): `capacityBanquet` is seated, dinner at round tables; `capacityReception` is floating, a standing reception or cocktails; `capacityTheatre` is rows of chairs. The team app shows them with these labels.
- **One number per capacity.** A capacity cell takes the maximum alone. A range such as `600-700` or `600 to 700` is a row error: "Use one number; put the range in capacityNotes". Put `700` in the capacity and the range in `capacityNotes`.
- **Other layouts** sit in one cell, entries separated by `|` (or line breaks), each `Name: max` or `Name: min-max`: `Classroom: 120 | U-shape: 30-40`.
  - Up to 12 layouts, each name up to 60 characters and given once, ignoring case.
  - Numbers are whole, 1 to 100,000, and a minimum is no larger than its maximum.
  - An entry that does not read that way is a row error on `otherLayouts`: "Write each layout as Name: max or Name: min-max, for example Classroom: 120 | U-shape: 30-40".
- **Setting and indoor.** The setting decides whether the venue counts as indoor: only `indoor` does. Clients see indoor or outdoor until Slice 12, so a semi-open venue shows to them as outdoor.

## The report and the downloads (TW-25)

- **Choose the kind** first: Hotels, Rooms or Venues. The picker offers only the kinds you may import.
- **Download template** saves the chosen kind's header row, built in the app from the core template; the screen shows the kind's column help beside the button. The file starts with the byte-order mark that tells Excel the file is UTF-8, so Excel opens it, and saves it again, as CSV UTF-8 rather than turning ₹ or an Indic name into `?`.
- **Validate** runs the preview and shows:
  - the counts: to create, to update, unchanged, rejected, and for Hotels any new destinations (in its toast too) and images importing would add;
  - the rows that would create or update, up to 20: each row's line, the hotel's web address and, for Rooms and Venues, the room or venue name, with the columns that would change (never their values);
  - the rejected rows, up to 20: line, column and reason.

  Unchanged rows are only counted. The screen notes that a preview can be imported for 24 hours.
- **Import is locked** until a fresh preview is on screen. It locks after a change of kind, an edit to the CSV (the report stays on screen, marked as the report of the CSV as it was) or a finished import, until Validate runs again. Import is disabled when the preview would create, update or register nothing. The kind cannot change while a preview or an import is under way.
- **Import** imports the preview and shows the same report for what was done. Rows changed since the preview are among the rejected; a run that changed nothing says so. When the preview can no longer be imported (expired, replaced, already imported or not found), or another change raced the import for a web address, the screen clears it and says why: validate the file again.
- **Download error report** (named **Download report** when no row is rejected) saves the whole report as a CSV, every row included, with its outcome, the columns that change and its errors. A cell that starts with `=`, `+`, `-` or `@` is saved as text, so a spreadsheet never runs it as a formula.

> **Which columns reach a client (R8/R9 defaults, locked by D-064/D-065):**
>
> - **Hotels.** On an `active` hotel, clients see `name`, `brand`, `starCategory`, `address`, `descriptionClient`, `website`, `totalRooms`, `facilities`, `streetViewRef` and the destination. `parentGroup`, `mapsUrl` and the location, access, event-space and food columns are client data too, but the client screens show them only from Slice 12 of the hotel information form plan; until then only staff see them. `nameAliases`, the five booking terms, `latitude` and `longitude` are staff-only (INTERNAL, D-178), and `internalRating` and `internalNotes` are never shown to a client.
> - **Rooms.** Clients see the name, `roomCount`, `maxOccupancy`, the size in m², `facilities` and `description`.
> - **Venues.** Clients see the name, `venueType` (the five new types included), indoor or outdoor (from `setting`), the area in m², the three capacities, `facilities` and `description`.
> - **The other room and venue columns** (`unitType`, `viewLabel`, `bedConfiguration`, the sq ft figures, the dimensions, the pre-function area, `otherLayouts`, `capacityNotes` and the setting itself) are client data too, shown to clients only from Slice 12.
> - **Never in these templates.** Contacts are never imported and never reach a client. Prices and availability are a separate, verified step (Rates with Slice 4).
