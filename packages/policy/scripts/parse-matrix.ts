/**
 * Reads the §5 and §6 tables of docs/permission-matrix.md into matrix rows. Each table must have a
 * known layout (the role grid, the §5.16 reports table, the client, guest and demo grid) and each
 * row exactly its table's cells, or the generator stops: a row is never skipped silently.
 */
import type { Grant, MatrixRow, ReportExclusion } from "../src/matrix.ts";
import { MODULES, RESOURCES, slugify } from "../src/resources.ts";
import type { Action, Scope, StaffRole } from "../src/roles.ts";
import { lookup } from "./lookup.ts";
import { REPORT_EXCLUSIONS } from "./notes.ts";
import { parseCell, type CellKind } from "./parse-cells.ts";

const STAFF: readonly StaffRole[] = ["SA", "SM", "HT", "PM", "CD", "VC", "RG", "HL", "FA"];
const OTHERS = ["CR", "GU", "DP"] as const;
const REPORT_COLUMNS = ["May run", "May export", "Excluded from the export"] as const;

interface Table {
  readonly section: string;
  readonly header: readonly string[];
  readonly rows: (readonly string[])[];
}

interface Layout {
  readonly kind: CellKind;
  readonly header: readonly string[];
  readonly row: (section: string, cells: readonly string[]) => MatrixRow;
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
}

/** The tables of a block, each with the §5 subsection it sits under. */
function readTables(block: string, firstSection: string): Table[] {
  const tables: Table[] = [];
  let section = firstSection;
  let table: { section: string; header: string[]; rows: string[][] } | null = null;
  for (const line of block.split("\n")) {
    const heading = /^### (\d+\.\d+)/.exec(line);
    if (heading) section = heading[1] ?? section;
    if (!line.startsWith("|")) {
      table = null;
    } else if (/^\|\s*-/.test(line)) {
      continue;
    } else if (table === null) {
      table = { section, header: splitRow(line), rows: [] };
      tables.push(table);
    } else {
      table.rows.push(splitRow(line));
    }
  }
  return tables;
}

function moduleOf(section: string): string {
  const module = MODULES[section];
  if (module === undefined) throw new Error(`permission-matrix.md: no module for §${section}`);
  return module;
}

function rowBase(section: string, label: string) {
  const curated = RESOURCES[section]?.[label];
  const resource = curated ?? slugify(label);
  return { section, module: moduleOf(section), resource, label, provisional: !curated };
}

function cellRow(
  section: string,
  cells: readonly string[],
  columns: readonly string[],
  kind: CellKind,
) {
  const label = cells[0] ?? "";
  const cell = (index: number) => cells[index + 1] ?? "";
  const grants = columns.map((column, index): [string, Grant[]] => {
    try {
      return [column, parseCell(cell(index), kind)];
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`permission-matrix.md §${section} "${label}", ${column}: ${reason}`, {
        cause: error,
      });
    }
  });
  const row: MatrixRow = {
    ...rowBase(section, label),
    cells: Object.fromEntries(columns.map((column, index) => [column, cell(index)])),
    grants: Object.fromEntries(grants),
    exclusions: [],
  };
  return row;
}

/** "SA, HT, SM, PM (a)" → the scope the list gives the role, or null when it is not listed. */
function listedScope(list: string, role: StaffRole, label: string): Scope | null {
  let scope: Scope | null = null;
  for (const item of list.split(",").map((part) => part.trim())) {
    const match = /^(SA|SM|HT|PM|CD|VC|RG|HL|FA)( \(a\))?$/.exec(item);
    if (!match) throw new Error(`unknown role "${item}" in the §5.16 report "${label}"`);
    if (match[1] === role) scope = match[2] ? "assigned" : "all";
  }
  return scope;
}

function reportGrants(role: StaffRole, run: string, exported: string, label: string): Grant[] {
  const runs = listedScope(run, role, label);
  const exports = listedScope(exported, role, label);
  if (runs !== null && runs === exports) {
    return [{ actions: ["read", "export"], scope: runs, conditions: [] }];
  }
  const grant = (action: Action, scope: Scope | null): Grant[] =>
    scope === null ? [] : [{ actions: [action], scope, conditions: [] }];
  return [...grant("read", runs), ...grant("export", exports)];
}

function exclusionsOf(text: string, label: string): ReportExclusion[] {
  if (text === "—") return [];
  return text.split(";").map((part) => {
    const exclusion = lookup(REPORT_EXCLUSIONS, part.trim());
    if (!exclusion) throw new Error(`unknown exclusion "${part.trim()}" in the report "${label}"`);
    return exclusion;
  });
}

/** §5.16: "May run" becomes `reports.<report>.read`, "May export" `reports.<report>.export`. */
function reportRow(section: string, cells: readonly string[]): MatrixRow {
  const [label = "", run = "", exported = "", excluded = ""] = cells;
  return {
    ...rowBase(section, label),
    cells: Object.fromEntries(
      REPORT_COLUMNS.map((column, index) => [column, cells[index + 1] ?? ""]),
    ),
    grants: Object.fromEntries(
      STAFF.map((role) => [role, reportGrants(role, run, exported, label)]),
    ),
    exclusions: exclusionsOf(excluded, label),
  };
}

const LAYOUTS: readonly Layout[] = [
  {
    kind: "staff",
    header: ["Resource", ...STAFF],
    row: (section, cells) => cellRow(section, cells, STAFF, "staff"),
  },
  { kind: "staff", header: ["Report (SPEC §9)", ...REPORT_COLUMNS], row: reportRow },
  {
    kind: "others",
    header: ["Resource", "CR (both representatives)", "GU", "DP"],
    row: (section, cells) => cellRow(section, cells, OTHERS, "others"),
  },
];

function tableRows(table: Table, kind: CellKind): MatrixRow[] {
  const sameHeader = (layout: Layout) => layout.header.join("|") === table.header.join("|");
  const layout = LAYOUTS.find((candidate) => candidate.kind === kind && sameHeader(candidate));
  if (!layout) {
    throw new Error(`unknown table layout "${table.header.join(" | ")}" under §${table.section}`);
  }
  return table.rows.map((cells) => {
    if (cells.length !== layout.header.length) {
      const label = cells[0] ?? "";
      throw new Error(
        `§${table.section} "${label}" has ${cells.length} cells, not ${layout.header.length}`,
      );
    }
    return layout.row(table.section, cells);
  });
}

function checkUnique(rows: readonly MatrixRow[]): void {
  const seen = new Set<string>();
  for (const row of rows) {
    const id = `${row.module}.${row.resource}`;
    if (seen.has(id)) {
      throw new Error(`two rows share the resource ${id}: curate one in resources.ts`);
    }
    seen.add(id);
  }
}

/**
 * The rows of §5 (kind "staff", every subsection including §5.16) or §6 (kind "others").
 *
 * @example
 * const staff = parseMatrix(section5, "staff");
 * staff.find((row) => row.resource === "audit_log")?.grants["FA"];
 */
export function parseMatrix(block: string, kind: CellKind): MatrixRow[] {
  const tables = readTables(block, kind === "staff" ? "5.1" : "6");
  const rows = tables.flatMap((table) => tableRows(table, kind));
  checkUnique(rows);
  return rows;
}
