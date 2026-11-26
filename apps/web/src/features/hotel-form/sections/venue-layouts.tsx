import { VENUE_OTHER_LAYOUT_NAME_MAX } from "@ampm/core";
import { RepeatableFieldsets, TextField } from "@ampm/web-forms";

import { textField, withRow } from "./bindings";
import { PAIR_STYLES } from "./field-group";
import { COMMON_FIELDS_COPY as COMMON, VENUE_FIELDS_COPY as COPY } from "./section-fields-copy";
import type { SectionEditor } from "./use-section-editor";
import { venuesId, type LayoutFields, type VenueRowFields, type VenuesFields } from "./venues.form";

type Editor = SectionEditor<VenuesFields>;

interface LayoutsProps {
  readonly editor: Editor;
  readonly venue: VenueRowFields;
}

/** The venues with one venue's layouts changed. */
function withLayouts(
  fields: VenuesFields,
  rowId: string,
  change: (layouts: readonly LayoutFields[]) => readonly LayoutFields[],
): VenuesFields {
  const rows = withRow(
    fields.rows,
    (row) => row.rowId === rowId,
    (row) => ({ ...row, layouts: change(row.layouts) }),
  );
  return { ...fields, rows };
}

/** One layout: its name and its guests (a number, or a range). */
function LayoutRow({ editor, venue, layout }: LayoutsProps & { readonly layout: LayoutFields }) {
  const part = (key: "layout" | "guests") =>
    textField(
      editor,
      venuesId(venue.rowId, "layouts", layout.key, key),
      layout[key],
      (fields, value) =>
        withLayouts(fields, venue.rowId, (layouts) =>
          withRow(
            layouts,
            (entry) => entry.key === layout.key,
            (entry) => ({ ...entry, [key]: value }),
          ),
        ),
    );
  return (
    <div className={PAIR_STYLES}>
      <TextField
        label={COPY.layoutName}
        {...part("layout")}
        maxLength={VENUE_OTHER_LAYOUT_NAME_MAX}
      />
      <TextField
        label={COPY.layoutGuests}
        help={COPY.layoutGuestsHelp}
        {...part("guests")}
        inputMode="numeric"
      />
    </div>
  );
}

/** Add and Remove for a venue's layouts. */
function layoutPresses({ editor, venue }: LayoutsProps) {
  const change = (next: (layouts: readonly LayoutFields[]) => readonly LayoutFields[]) =>
    editor.update((fields) => withLayouts(fields, venue.rowId, next));
  return {
    add: () => change((layouts) => [...layouts, { key: editor.newKey(), layout: "", guests: "" }]),
    remove: (key: string) => change((layouts) => layouts.filter((entry) => entry.key !== key)),
  };
}

/**
 * A venue's other layouts (D-190 §2: classroom, U-shape, boardroom…), nested rows of their own, up to the
 * draft's cap; a layout the page cannot read is marked on its field and the venue keeps its saved ones.
 *
 *   <VenueLayouts editor={editor} venue={row} max={draft.caps.otherLayoutsPerVenue} />
 */
export function VenueLayouts({ editor, venue, max }: LayoutsProps & { readonly max: number }) {
  const { add, remove } = layoutPresses({ editor, venue });
  const id = venuesId(venue.rowId, "layouts");
  return (
    <RepeatableFieldsets
      id={id}
      legend={COPY.layouts}
      help={COPY.layoutsHelp}
      rows={venue.layouts.map((layout, index) => ({
        ...layout,
        legend: layout.layout.trim() || COPY.layoutRow(index + 1),
      }))}
      renderRow={(layout) => <LayoutRow editor={editor} venue={venue} layout={layout} />}
      onAdd={add}
      onRemove={remove}
      addLabel={COPY.addLayout}
      removeText={COMMON.remove}
      removeLabel={COMMON.removeNamed}
      removedText={COMMON.removed}
      max={max}
      capText={COPY.layoutsCap(max)}
      error={editor.errorOf(id, true)}
    />
  );
}
