import type { HotelFormCaps } from "@ampm/core";
import { NumberUnitField, RepeatableFieldsets } from "@ampm/web-forms";

import { COMMON_FIELDS_COPY as COMMON, VENUE_FIELDS_COPY as COPY } from "./section-fields-copy";
import { AREA_UNITS, areaUnitOf } from "./units";
import type { SectionEditor } from "./use-section-editor";
import { VenueRow } from "./venue-row";
import { emptyVenue, venuesId, type VenuesFields } from "./venues.form";

type Editor = SectionEditor<VenuesFields>;

/** The total event space, with its unit. */
function TotalSpace({ editor }: { readonly editor: Editor }) {
  const id = venuesId("totalEventSpace");
  const change = (patch: Partial<VenuesFields>) =>
    editor.update((fields) => ({ ...fields, ...patch }));
  return (
    <NumberUnitField
      id={id}
      label={COPY.totalEventSpace}
      value={editor.fields.totalSpaceValue}
      unit={editor.fields.totalSpaceUnit}
      units={AREA_UNITS}
      unitLabel={COMMON.unitOf(COPY.totalEventSpace)}
      error={editor.errorOf(id)}
      onChange={(event) => change({ totalSpaceValue: event.target.value })}
      onUnitChange={(event) => change({ totalSpaceUnit: areaUnitOf(event.target.value) })}
    />
  );
}

/** The venues as repeatable rows, each named by its name, up to the draft's cap. */
function VenueRows({ editor, caps }: { readonly editor: Editor; readonly caps: HotelFormCaps }) {
  const add = () =>
    editor.update((fields) => ({ ...fields, rows: [...fields.rows, emptyVenue(editor.newKey())] }));
  const remove = (key: string) =>
    editor.update((fields) => ({
      ...fields,
      rows: fields.rows.filter((row) => row.rowId !== key),
    }));
  return (
    <RepeatableFieldsets
      id="hf-venues-rows"
      legend={COPY.legend}
      help={COPY.help}
      rows={editor.fields.rows.map((row, index) => ({
        ...row,
        key: row.rowId,
        legend: row.name.trim() || COPY.row(index + 1),
      }))}
      renderRow={(row) => (
        <VenueRow editor={editor} row={row} layoutsMax={caps.otherLayoutsPerVenue} />
      )}
      onAdd={add}
      onRemove={remove}
      addLabel={COPY.add}
      removeText={COMMON.remove}
      removeLabel={COMMON.removeNamed}
      removedText={COMMON.removed}
      max={caps.venueRows}
      capText={COPY.cap(caps.venueRows)}
      emptyText={COPY.empty}
    />
  );
}

/**
 * Venues (plan §5.1: the venue table and the total event space; D-190 §2): the total, then each venue as
 * a row named by its name, up to the draft's cap.
 *
 *   <VenuesSection editor={editor} caps={draft.caps} />
 */
export function VenuesSection({
  editor,
  caps,
}: {
  readonly editor: Editor;
  readonly caps: HotelFormCaps;
}) {
  return (
    <>
      <TotalSpace editor={editor} />
      <VenueRows editor={editor} caps={caps} />
    </>
  );
}
