/**
 * Parses one cell of the §5 or §6 matrix into grants. A cell is segments split by commas and
 * semicolons outside parentheses; a segment is runs of action letters, each with an optional (a) or
 * (o), followed by a note. A letterless segment continues the note before it, unless it is a §6 verb
 * ("comment"). Each note is looked up in scripts/notes.ts and becomes the grant's conditions; an
 * unknown note, a duplicate action or a cell that edits records its read does not reach stops the
 * generator, unless notes.ts confirms the cell.
 */
import type { Condition } from "../src/conditions.ts";
import type { Grant } from "../src/matrix.ts";
import { ACTION_LETTERS, type Action, type Scope } from "../src/roles.ts";
import { lookup } from "./lookup.ts";
import {
  EDITS_BEYOND_READ,
  NO_GRANT_CELLS,
  OTHER_NOTES,
  OTHER_PREFIXES,
  OTHER_VERBS,
  READINGS,
  STAFF_NOTES,
} from "./notes.ts";

/**
 * §5 staff cells or §6 client, guest and demo cells, which have their own notes and scope.
 *
 * @example
 * parseCell("CRUD own account", "others");
 */
export type CellKind = "staff" | "others";

interface Run {
  readonly actions: Action[];
  readonly qualifier: string | undefined;
}

interface Group {
  readonly runs: readonly Run[];
  note: string;
}

const RUN = /^([CRUDASX]+)(?![A-Za-z])(?:\s*\((a|o)\))?\s*/;
const LETTERS_INSIDE = /(?<![A-Za-z])[CRUDASX]+(?![A-Za-z])/;
const OWN_ALL: readonly Action[] = ["create", "read", "update", "delete"];

/** Splits on commas and semicolons outside parentheses, keeping the separator before each part. */
function splitSegments(text: string): { readonly text: string; readonly separator: string }[] {
  const parts: { text: string; separator: string }[] = [];
  let depth = 0;
  let current = "";
  let separator = "";
  for (const char of text) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if ((char === "," || char === ";") && depth === 0) {
      parts.push({ text: current.trim(), separator });
      current = "";
      separator = char;
    } else {
      current += char;
    }
  }
  parts.push({ text: current.trim(), separator });
  return parts.filter((part) => part.text !== "");
}

function readRuns(segment: string, cell: string): { runs: Run[]; rest: string } {
  const runs: Run[] = [];
  let rest = segment;
  for (let match = RUN.exec(rest); match; match = RUN.exec(rest)) {
    const actions = [...(match[1] ?? "")].flatMap((letter) => ACTION_LETTERS[letter] ?? []);
    runs.push({ actions, qualifier: match[2] });
    rest = rest.slice(match[0].length);
  }
  if (LETTERS_INSIDE.test(rest)) throw new Error(`action letters inside the note of "${cell}"`);
  return { runs, rest: rest.trim() };
}

function scopeOf(qualifier: string | undefined, kind: CellKind, cell: string): Scope {
  if (kind === "others") {
    // §6: "own" is the wedding or account the principal belongs to, for every client grant.
    if (qualifier !== undefined) throw new Error(`a scope qualifier in the §6 cell "${cell}"`);
    return "own";
  }
  return qualifier === "a" ? "assigned" : qualifier === "o" ? "own" : "all";
}

function noteConditions(note: string, kind: CellKind, cell: string): readonly Condition[] {
  if (note === "") return [];
  const found = lookup(kind === "staff" ? STAFF_NOTES : OTHER_NOTES, note);
  if (found === undefined) {
    throw new Error(`unknown note "${note}" in the cell "${cell}": give it a meaning in notes.ts`);
  }
  return found;
}

function splitPrefix(text: string, kind: CellKind, cell: string) {
  const match = /^([^:()]+):\s*(.+)$/.exec(text);
  if (!match) return { prefix: [], body: text };
  const prefix = kind === "others" ? lookup(OTHER_PREFIXES, (match[1] ?? "").trim()) : undefined;
  if (prefix === undefined) throw new Error(`unknown prefix "${match[1]}" in the cell "${cell}"`);
  return { prefix, body: match[2] ?? "" };
}

/** Groups of runs with their notes, and the verb grants, in the order of the cell. */
function collect(body: string, kind: CellKind, cell: string): (Group | Grant)[] {
  const parts: (Group | Grant)[] = [];
  for (const segment of splitSegments(body)) {
    const { runs, rest } = readRuns(segment.text, cell);
    if (runs.length > 0) {
      parts.push({ runs, note: rest });
      continue;
    }
    const verb = kind === "others" ? lookup(OTHER_VERBS, segment.text) : undefined;
    if (verb !== undefined) {
      if (verb !== null) {
        parts.push({ actions: [...verb.actions], scope: "own", conditions: verb.conditions });
      }
      continue;
    }
    const last = parts.at(-1);
    if (!last || !("runs" in last)) {
      throw new Error(`no action letters before "${segment.text}" in the cell "${cell}"`);
    }
    // "RU (a) theme, dress code": the comma splits one note, which belongs to the letters before it.
    last.note =
      last.note === "" ? segment.text : `${last.note}${segment.separator} ${segment.text}`;
  }
  return parts;
}

/** An edit at this scope reaches records a read at that scope does not; assigned and own differ. */
function scopeBeyond(edit: Scope, read: Scope): boolean {
  return read !== "all" && edit !== read;
}

/**
 * The edit reaches records the read does not: a wider scope, or a condition of the read ("hotel",
 * "theme, dress code") the edit lacks. Conditions compare whole, so a narrower one stops the
 * generator too, for a reading in notes.ts.
 */
function reachesBeyond(edit: Grant, read: Grant): boolean {
  const carried = new Set(edit.conditions.map((condition) => JSON.stringify(condition)));
  return (
    scopeBeyond(edit.scope, read.scope) ||
    read.conditions.some((condition) => !carried.has(JSON.stringify(condition)))
  );
}

/** Each action once, and no update or delete beyond the cell's read unless notes.ts says so. */
function checkCell(grants: readonly Grant[], reading: string, cell: string): void {
  const actions = grants.flatMap((grant) => grant.actions);
  const twice = actions.find((action, index) => actions.indexOf(action) !== index);
  if (twice) throw new Error(`"${twice}" twice in the cell "${cell}"`);
  if (EDITS_BEYOND_READ.includes(reading)) return;
  const reads = grants.filter((grant) => grant.actions.includes("read"));
  const edits = grants.filter((grant) =>
    grant.actions.some((a) => a === "update" || a === "delete"),
  );
  if (edits.length > 0 && reads.length === 0) {
    throw new Error(`the cell "${cell}" edits records it does not read: confirm it in notes.ts`);
  }
  if (edits.some((edit) => reads.some((read) => reachesBeyond(edit, read)))) {
    throw new Error(`the cell "${cell}" edits wider than its read: add a reading to notes.ts`);
  }
}

/**
 * The grants of one cell.
 *
 * @example
 * parseCell("RU (a) theme, dress code", "staff");
 * // → [{ actions: ["read", "update"], scope: "assigned",
 * //      conditions: [{ kind: "fields", only: ["theme", "dress_code"] }] }]
 */
export function parseCell(cell: string, kind: CellKind): Grant[] {
  const text = cell.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
  const reading = lookup(READINGS, text) ?? text;
  if (NO_GRANT_CELLS.includes(reading)) return [];
  if (kind === "others" && reading === "own") {
    return [{ actions: [...OWN_ALL], scope: "own", conditions: [] }];
  }
  const { prefix, body } = splitPrefix(reading, kind, cell);
  const grants = collect(body, kind, cell).flatMap((part): Grant[] => {
    if (!("runs" in part)) return [{ ...part, conditions: [...prefix, ...part.conditions] }];
    const conditions = [...prefix, ...noteConditions(part.note, kind, cell)];
    return part.runs.map((run) => ({
      actions: run.actions,
      scope: scopeOf(run.qualifier, kind, cell),
      conditions,
    }));
  });
  checkCell(grants, reading, cell);
  return grants;
}
