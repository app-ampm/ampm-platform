import type {
  HotelImportKind,
  HotelImportResult,
  HotelImportRowError,
  HotelImportRowReport,
} from "@ampm/core";

import { csvText } from "../admin/csv";
import { rateItemTypeCell } from "./hotel-import.rates";

/*
 * The per-row report of an import result as CSV (TW-25; D-181, D-184): one line per row of the file, in
 * line order, so staff fix the rejected rows in their spreadsheet. Each line has the row's line, its
 * hotel's web address, the cells that name its record in the kind's own columns, its outcome, the
 * columns it changes (never their values) and its errors. Cells are formula-guarded (`csvText`).
 */

/** The columns that name a row's record, between its hotel's address and its outcome, by kind. */
const NAMING_COLUMNS: Readonly<Record<HotelImportKind, readonly string[]>> = {
  hotels: [],
  rooms: ["name"],
  venues: ["name"],
  rates: ["cardName", "itemType", "room", "venue"],
};

/**
 * The cells under a kind's naming columns: a room's or venue's name; a rate's card, item type (spelled
 * as a cell reads it), room and venue. Blank for a rejected row the report does not list.
 */
function namingCells(kind: HotelImportKind, row: HotelImportRowReport | undefined): string[] {
  if (kind === "hotels") return [];
  const name = row?.name ?? "";
  if (kind !== "rates") return [name];
  const item = row?.item;
  return [
    name,
    item ? rateItemTypeCell(item.itemType) : "",
    item?.roomName ?? "",
    item?.venueName ?? "",
  ];
}

interface ReportLine {
  readonly line: number;
  /** The row as the result reports it; none for a rejected row the result does not list. */
  readonly row: HotelImportRowReport | undefined;
  readonly errors: string;
}

function errorsText(errors: HotelImportRowError["errors"]): string {
  return errors.map((e) => `${e.field}: ${e.message}`).join("; ");
}

function reportLines(result: HotelImportResult): ReportLine[] {
  const errorsByLine = new Map(result.rejected.map((row) => [row.line, row.errors]));
  const lines: ReportLine[] = result.rows.map((row) => ({
    line: row.line,
    row,
    errors: errorsText(errorsByLine.get(row.line) ?? []),
  }));
  // A rejected row the report does not list still belongs in the file.
  for (const rejected of result.rejected) {
    if (lines.some((line) => line.line === rejected.line)) continue;
    lines.push({ line: rejected.line, row: undefined, errors: errorsText(rejected.errors) });
  }
  return lines.sort((a, b) => a.line - b.line);
}

/**
 * The per-row report of a result as CSV, in its kind's columns: the hotels' web address as `slug`, the
 * other kinds' hotel as `hotelSlug` with the room's or venue's name, or the rate's card, item type, room
 * and venue.
 *
 * @example
 * importReportCsv(result); // "line,slug,outcome,changedFields,errors\r\n3,synthetic-lake-hotel,update,city,"
 */
export function importReportCsv(result: HotelImportResult): string {
  const { kind } = result;
  const header = [
    "line",
    kind === "hotels" ? "slug" : "hotelSlug",
    ...NAMING_COLUMNS[kind],
    "outcome",
    "changedFields",
    "errors",
  ];
  const body = reportLines(result).map(({ line, row, errors }) => [
    String(line),
    row?.slug ?? "",
    ...namingCells(kind, row),
    row?.outcome ?? "error",
    row?.changedFields.join(", ") ?? "",
    errors,
  ]);
  return csvText([header, ...body]);
}
