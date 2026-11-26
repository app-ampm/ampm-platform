import {
  ChoiceSegments,
  NumberUnitField,
  SelectField,
  TextAreaField,
  TextField,
} from "@ampm/web-forms";

import { choiceField, textField, withRow } from "./bindings";
import { PAIR_STYLES, TRIO_STYLES } from "./field-group";
import { COMMON_FIELDS_COPY as COMMON, VENUE_FIELDS_COPY as COPY } from "./section-fields-copy";
import { AREA_UNITS, areaUnitOf } from "./units";
import type { SectionEditor } from "./use-section-editor";
import { VenueLayouts } from "./venue-layouts";
import { venuesId, type VenueRowFields, type VenuesFields } from "./venues.form";

type Editor = SectionEditor<VenuesFields>;
type RowText =
  | "name"
  | "venueType"
  | "seated"
  | "floating"
  | "theatre"
  | "lengthM"
  | "widthM"
  | "ceilingHeightM"
  | "notes";

interface RowProps {
  readonly editor: Editor;
  readonly row: VenueRowFields;
}

const SETTINGS = Object.entries(COPY.settings).map(([value, label]) => ({ value, label }));
const VENUE_TYPES = Object.entries(COPY.venueTypes).map(([value, label]) => ({ value, label }));

/** The two areas a venue gives, each a number and its unit, by their fields. */
const AREAS = {
  area: { id: "area", value: "areaValue", unit: "areaUnit", label: COPY.area, help: undefined },
  prefunction: {
    id: "prefunctionArea",
    value: "prefunctionValue",
    unit: "prefunctionUnit",
    label: COPY.prefunctionArea,
    help: COPY.prefunctionHelp,
  },
} as const;

/** The venues with one venue changed. */
const withVenue = (
  fields: VenuesFields,
  rowId: string,
  change: (row: VenueRowFields) => VenueRowFields,
): VenuesFields => ({
  ...fields,
  rows: withRow(fields.rows, (row) => row.rowId === rowId, change),
});

/** A venue's change, from the field that made it. */
const changeVenue = (editor: Editor, row: VenueRowFields, patch: Partial<VenueRowFields>) =>
  editor.update((fields) => withVenue(fields, row.rowId, (venue) => ({ ...venue, ...patch })));

/** A text field's props for one of the venue's strings. */
const venueText = (editor: Editor, row: VenueRowFields, key: RowText) =>
  textField(editor, venuesId(row.rowId, key), row[key], (fields, value) =>
    withVenue(fields, row.rowId, (venue) => ({ ...venue, [key]: value })),
  );

/** An area of the venue (its area, its pre-function area) with its unit. */
function AreaOf({ editor, row, area }: RowProps & { readonly area: keyof typeof AREAS }) {
  const { id: part, value, unit, label, help } = AREAS[area];
  const id = venuesId(row.rowId, part);
  return (
    <NumberUnitField
      id={id}
      label={label}
      help={help}
      value={row[value]}
      unit={row[unit]}
      units={AREA_UNITS}
      unitLabel={COMMON.unitOf(label)}
      error={editor.errorOf(id)}
      onChange={(event) => changeVenue(editor, row, { [value]: event.target.value })}
      onUnitChange={(event) => changeVenue(editor, row, { [unit]: areaUnitOf(event.target.value) })}
    />
  );
}

/** How many guests the venue takes, and its length, width and ceiling height in metres. */
function Sizes({ editor, row }: RowProps) {
  return (
    <>
      <div className={TRIO_STYLES}>
        <TextField
          label={COPY.seated}
          help={COPY.capacityHelp}
          {...venueText(editor, row, "seated")}
          inputMode="numeric"
        />
        <TextField
          label={COPY.floating}
          help={COPY.capacityHelp}
          {...venueText(editor, row, "floating")}
          inputMode="numeric"
        />
        <TextField
          label={COPY.theatre}
          {...venueText(editor, row, "theatre")}
          inputMode="numeric"
        />
      </div>
      <div className={TRIO_STYLES}>
        <TextField
          label={COPY.lengthM}
          {...venueText(editor, row, "lengthM")}
          inputMode="decimal"
        />
        <TextField label={COPY.widthM} {...venueText(editor, row, "widthM")} inputMode="decimal" />
        <TextField
          label={COPY.ceilingHeightM}
          {...venueText(editor, row, "ceilingHeightM")}
          inputMode="decimal"
        />
      </div>
    </>
  );
}

/** What the venue is: its name, setting (which can be cleared), type and area. */
function Basics({ editor, row }: RowProps) {
  return (
    <>
      <TextField label={COPY.name} {...venueText(editor, row, "name")} maxLength={255} />
      <ChoiceSegments
        legend={COPY.setting}
        options={SETTINGS}
        look="soft"
        clearLabel={COMMON.clear}
        {...choiceField(editor, venuesId(row.rowId, "setting"), row.setting, (fields, setting) =>
          withVenue(fields, row.rowId, (venue) => ({ ...venue, setting })),
        )}
      />
      <div className={PAIR_STYLES}>
        <SelectField
          label={COPY.venueType}
          options={VENUE_TYPES}
          placeholder={COMMON.choose}
          {...venueText(editor, row, "venueType")}
        />
        <AreaOf editor={editor} row={row} area="area" />
      </div>
    </>
  );
}

/**
 * One venue (plan §5.1's venue table and the new questions; D-190 §2): its name, setting, type, area,
 * capacities (seated and floating each a number or a range), other layouts, dimensions, pre-function area
 * and notes.
 *
 *   <VenueRow editor={editor} row={row} layoutsMax={draft.caps.otherLayoutsPerVenue} />
 */
export function VenueRow({ editor, row, layoutsMax }: RowProps & { readonly layoutsMax: number }) {
  return (
    <>
      <Basics editor={editor} row={row} />
      <Sizes editor={editor} row={row} />
      <VenueLayouts editor={editor} venue={row} max={layoutsMax} />
      <AreaOf editor={editor} row={row} area="prefunction" />
      <TextAreaField label={COPY.notes} rows={3} {...venueText(editor, row, "notes")} />
    </>
  );
}
