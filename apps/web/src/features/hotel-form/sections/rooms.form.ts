import {
  hotelFormRoomRow,
  hotelFormRoomsDraft,
  type HotelFormAreaUnit,
  type HotelFormSectionAnswers,
} from "@ampm/core";

import {
  DEFAULT_AREA_UNIT,
  answerReader,
  areaInput,
  areaText,
  choiceInput,
  fieldId,
  isBlankRow,
  numberInput,
  numberText,
  textOf,
  type AnswerReader,
} from "./field-values";
import type { BuiltAnswers, SectionModel } from "./section-model";

/*
 * Rooms (plan §5.1: 2.1 and the room table; D-190 §2): the total and up to 60 room categories, each keyed
 * by the row id the page made when it was added (a UUID, kept while it is renamed), with its size in sq ft
 * or m². A refused field is sent as the row with that id was saved.
 */

type Answers = HotelFormSectionAnswers["rooms"];
type Row = NonNullable<Answers["rows"]>[number];

const SHAPE = hotelFormRoomsDraft.shape;
const ROW = hotelFormRoomRow.shape;

export interface RoomRowFields {
  readonly rowId: string;
  readonly name: string;
  readonly roomCount: string;
  /** One of the catalogue's room unit types, or "". */
  readonly unitType: string;
  readonly sizeValue: string;
  readonly sizeUnit: HotelFormAreaUnit;
  readonly maxOccupancy: string;
  readonly viewLabel: string;
  readonly bedConfiguration: string;
  readonly notes: string;
}

export interface RoomsFields {
  readonly totalRooms: string;
  readonly rows: readonly RoomRowFields[];
  readonly noLongerOffered: string;
}

/** A rooms field's id: the section's, or a row's field by the row's id. */
export const roomsId = (...parts: readonly string[]) => fieldId("rooms", ...parts);

/** A room category with nothing typed yet, under the id the page made for it. */
export const emptyRoom = (rowId: string): RoomRowFields => ({
  rowId,
  name: "",
  roomCount: "",
  unitType: "",
  sizeValue: "",
  sizeUnit: DEFAULT_AREA_UNIT,
  maxOccupancy: "",
  viewLabel: "",
  bedConfiguration: "",
  notes: "",
});

function rowFieldsOf(row: Row): RoomRowFields {
  const size = areaText(row.size);
  return {
    rowId: row.rowId,
    name: textOf(row.name),
    roomCount: numberText(row.roomCount),
    unitType: textOf(row.unitType),
    sizeValue: size.value,
    sizeUnit: size.unit,
    maxOccupancy: numberText(row.maxOccupancy),
    viewLabel: textOf(row.viewLabel),
    bedConfiguration: textOf(row.bedConfiguration),
    notes: textOf(row.notes),
  };
}

function fieldsOf(answers: Answers, newKey: () => string): RoomsFields {
  const rows = answers.rows ?? [];
  return {
    totalRooms: numberText(answers.totalRooms),
    rows: rows.length === 0 ? [emptyRoom(newKey())] : rows.map(rowFieldsOf),
    noLongerOffered: textOf(answers.noLongerOffered),
  };
}

/** A room category with nothing typed in it: not sent. */
const isBlankRoom = (row: RoomRowFields): boolean =>
  isBlankRow([
    row.name,
    row.roomCount,
    row.unitType,
    row.sizeValue,
    row.maxOccupancy,
    row.viewLabel,
    row.bedConfiguration,
    row.notes,
  ]);

function readRow(r: AnswerReader, row: RoomRowFields, saved: Row | undefined): Row {
  const id = (part: string) => roomsId(row.rowId, part);
  const size = { value: row.sizeValue, unit: row.sizeUnit };
  return {
    rowId: row.rowId,
    name: r.read(id("name"), ROW.name, row.name, saved?.name),
    roomCount: r.read(id("roomCount"), ROW.roomCount, numberInput(row.roomCount), saved?.roomCount),
    unitType: r.read(id("unitType"), ROW.unitType, choiceInput(row.unitType), saved?.unitType),
    size: r.read(id("size"), ROW.size, areaInput(size), saved?.size),
    maxOccupancy: r.read(
      id("maxOccupancy"),
      ROW.maxOccupancy,
      numberInput(row.maxOccupancy),
      saved?.maxOccupancy,
    ),
    viewLabel: r.read(id("viewLabel"), ROW.viewLabel, row.viewLabel, saved?.viewLabel),
    bedConfiguration: r.read(
      id("bedConfiguration"),
      ROW.bedConfiguration,
      row.bedConfiguration,
      saved?.bedConfiguration,
    ),
    notes: r.read(id("notes"), ROW.notes, row.notes, saved?.notes),
  };
}

function answersOf(fields: RoomsFields, saved: Answers): BuiltAnswers<"rooms"> {
  const r = answerReader();
  const savedRows = new Map((saved.rows ?? []).map((row) => [row.rowId, row]));
  const answers: Answers = {
    totalRooms: r.read(
      roomsId("totalRooms"),
      SHAPE.totalRooms,
      numberInput(fields.totalRooms),
      saved.totalRooms,
    ),
    rows: fields.rows
      .filter((row) => !isBlankRoom(row))
      .map((row) => readRow(r, row, savedRows.get(row.rowId))),
    noLongerOffered: r.read(
      roomsId("noLongerOffered"),
      SHAPE.noLongerOffered,
      fields.noLongerOffered,
      saved.noLongerOffered,
    ),
  };
  return { answers, errors: r.errors };
}

/**
 * The rooms section's fields and their reading.
 *
 * @example
 * const fields = ROOMS_MODEL.fieldsOf(draft.sections.rooms.answers, () => crypto.randomUUID());
 */
export const ROOMS_MODEL: SectionModel<"rooms", RoomsFields> = { fieldsOf, answersOf };
