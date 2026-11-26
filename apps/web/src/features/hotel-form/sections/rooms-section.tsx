import type { HotelFormCaps } from "@ampm/core";
import {
  NumberUnitField,
  RepeatableFieldsets,
  SelectField,
  TextAreaField,
  TextField,
} from "@ampm/web-forms";

import { textField, withRow } from "./bindings";
import { PAIR_STYLES } from "./field-group";
import { emptyRoom, roomsId, type RoomRowFields, type RoomsFields } from "./rooms.form";
import { COMMON_FIELDS_COPY as COMMON, ROOM_FIELDS_COPY as COPY } from "./section-fields-copy";
import { AREA_UNITS, areaUnitOf } from "./units";
import type { SectionEditor } from "./use-section-editor";

type Editor = SectionEditor<RoomsFields>;
type RowText =
  "name" | "roomCount" | "unitType" | "maxOccupancy" | "viewLabel" | "bedConfiguration" | "notes";

interface RowProps {
  readonly editor: Editor;
  readonly row: RoomRowFields;
}

const UNIT_TYPES = Object.entries(COPY.unitTypes).map(([value, label]) => ({ value, label }));

/** The rows with one room category changed. */
const withRoom = (
  fields: RoomsFields,
  rowId: string,
  change: (row: RoomRowFields) => RoomRowFields,
): RoomsFields => ({ ...fields, rows: withRow(fields.rows, (row) => row.rowId === rowId, change) });

/** A text field's props for one of a room category's strings. */
const roomText = (editor: Editor, row: RoomRowFields, key: RowText) =>
  textField(editor, roomsId(row.rowId, key), row[key], (fields, value) =>
    withRoom(fields, row.rowId, (room) => ({ ...room, [key]: value })),
  );

/** A room's size, in sq ft or m². */
function RoomSize({ editor, row }: RowProps) {
  const id = roomsId(row.rowId, "size");
  const change = (patch: Partial<RoomRowFields>) =>
    editor.update((fields) => withRoom(fields, row.rowId, (room) => ({ ...room, ...patch })));
  return (
    <NumberUnitField
      id={id}
      label={COPY.size}
      value={row.sizeValue}
      unit={row.sizeUnit}
      units={AREA_UNITS}
      unitLabel={COMMON.unitOf(COPY.size)}
      error={editor.errorOf(id)}
      onChange={(event) => change({ sizeValue: event.target.value })}
      onUnitChange={(event) => change({ sizeUnit: areaUnitOf(event.target.value) })}
    />
  );
}

/** How many rooms, of what type, how big and for how many guests. */
function RoomFacts({ editor, row }: RowProps) {
  return (
    <>
      <TextField
        label={COPY.roomCount}
        {...roomText(editor, row, "roomCount")}
        inputMode="numeric"
      />
      <SelectField
        label={COPY.unitType}
        options={UNIT_TYPES}
        placeholder={COMMON.choose}
        {...roomText(editor, row, "unitType")}
      />
      <RoomSize editor={editor} row={row} />
      <TextField
        label={COPY.maxOccupancy}
        {...roomText(editor, row, "maxOccupancy")}
        inputMode="numeric"
      />
    </>
  );
}

/** One room category: its name, its facts, its view and beds, and notes. */
function RoomRow({ editor, row }: RowProps) {
  return (
    <>
      <TextField
        label={COPY.name}
        help={COPY.nameHelp}
        {...roomText(editor, row, "name")}
        maxLength={255}
      />
      <div className={PAIR_STYLES}>
        <RoomFacts editor={editor} row={row} />
        <TextField
          label={COPY.viewLabel}
          help={COPY.viewHelp}
          {...roomText(editor, row, "viewLabel")}
          maxLength={255}
        />
        <TextField
          label={COPY.bedConfiguration}
          help={COPY.bedHelp}
          {...roomText(editor, row, "bedConfiguration")}
          maxLength={255}
        />
      </div>
      <TextAreaField label={COPY.notes} rows={3} {...roomText(editor, row, "notes")} />
    </>
  );
}

/** The room categories as repeatable rows, each named by its name, up to the draft's cap. */
function RoomRows({ editor, max }: { readonly editor: Editor; readonly max: number }) {
  const add = () =>
    editor.update((fields) => ({ ...fields, rows: [...fields.rows, emptyRoom(editor.newKey())] }));
  const remove = (key: string) =>
    editor.update((fields) => ({
      ...fields,
      rows: fields.rows.filter((row) => row.rowId !== key),
    }));
  return (
    <RepeatableFieldsets
      id="hf-rooms-rows"
      legend={COPY.legend}
      help={COPY.help}
      rows={editor.fields.rows.map((row, index) => ({
        ...row,
        key: row.rowId,
        legend: row.name.trim() || COPY.row(index + 1),
      }))}
      renderRow={(row) => <RoomRow editor={editor} row={row} />}
      onAdd={add}
      onRemove={remove}
      addLabel={COPY.add}
      removeText={COMMON.remove}
      removeLabel={COMMON.removeNamed}
      removedText={COMMON.removed}
      max={max}
      capText={COPY.cap(max)}
      emptyText={COPY.empty}
    />
  );
}

/**
 * Rooms (plan §5.1: 2.1 and the room table; D-190 §2): the total, then each room category as a row
 * named by its name, with its size in sq ft or m²; up to the draft's cap.
 *
 *   <RoomsSection editor={editor} caps={draft.caps} />
 */
export function RoomsSection({
  editor,
  caps,
}: {
  readonly editor: Editor;
  readonly caps: HotelFormCaps;
}) {
  return (
    <>
      <TextField
        label={COPY.totalRooms}
        {...textField(
          editor,
          roomsId("totalRooms"),
          editor.fields.totalRooms,
          (fields, totalRooms) => ({
            ...fields,
            totalRooms,
          }),
        )}
        inputMode="numeric"
      />
      <RoomRows editor={editor} max={caps.roomRows} />
    </>
  );
}
