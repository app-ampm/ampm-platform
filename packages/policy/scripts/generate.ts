/**
 * authz:generate — reads docs/permission-matrix.md and writes src/generated/matrix.json:
 *   staff   §5  every row × role as actions with their scope (a = assigned, o = own) and note
 *   others  §6  the client representative, guest and demo columns, parsed the same way
 *   transitions §7 every From → To with who may trigger it
 * The engine (src/engine.ts) and the generated authorisation suite read this file, so the document
 * stays the source of truth and CI fails when the committed file drifts from it.
 * Node type stripping, erasable TypeScript only.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ACTION_LETTERS, type Action, type Scope } from "../src/roles.ts";
import { MODULES, RESOURCES, slugify } from "../src/resources.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const doc = readFileSync(join(root, "docs", "permission-matrix.md"), "utf8");

const STAFF = ["SA", "SM", "HT", "PM", "CD", "VC", "RG", "HL", "FA"] as const;
const OTHERS = ["CR", "GU", "DP"] as const;

export interface Grant {
  readonly actions: Action[];
  readonly scope: Scope;
  readonly note: string | null;
}

export interface MatrixRow {
  readonly section: string;
  readonly module: string;
  readonly resource: string;
  readonly label: string;
  readonly provisional: boolean;
  readonly cells: Record<string, string>;
  readonly grants: Record<string, Grant[]>;
}

export interface Transition {
  readonly entity: string;
  readonly from: string;
  readonly to: string;
  readonly who: string;
  readonly roles: { role: string; assigned: boolean }[];
  readonly system: boolean;
  readonly actors: string[];
  readonly condition: string | null;
}

function section(from: string, to: string): string {
  const start = doc.indexOf(from);
  const end = doc.indexOf(to, start + 1);
  if (start < 0 || end < 0) throw new Error(`permission-matrix.md: cannot find ${from}`);
  return doc.slice(start, end);
}

/** "CR (a) UD (o) guests" → create/read on assigned, update/delete on own, note "guests". */
export function parseCell(cell: string): Grant[] {
  const text = cell.replace(/\*\*/g, "").trim();
  if (text === "" || text === "—" || text.startsWith("—") || /^to confirm/i.test(text)) return [];
  const grants: Grant[] = [];
  const pattern = /(?<![A-Za-z])([CRUDASX]+)(?![a-z])(?:\s*\((a|o)\))?/g;
  let note = text;
  for (const match of text.matchAll(pattern)) {
    const letters = match[1] ?? "";
    const actions = [...letters]
      .map((letter) => ACTION_LETTERS[letter])
      .filter((a): a is Action => a !== undefined);
    if (actions.length === 0) continue;
    const qualifier = match[2];
    const scope: Scope =
      qualifier === "a"
        ? "assigned"
        : qualifier === "o"
          ? "own"
          : /\bown\b/i.test(text)
            ? "own"
            : "all";
    grants.push({ actions, scope, note: null });
    note = note.replace(match[0], " ");
  }
  const cleaned = note
    .replace(/\bown\b/gi, " ")
    .replace(/[,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return grants.map((grant) => ({ ...grant, note: cleaned === "" ? null : cleaned }));
}

function parseMatrix(block: string, sectionId: string, columns: readonly string[]): MatrixRow[] {
  const rows: MatrixRow[] = [];
  let current = sectionId;
  for (const line of block.split("\n")) {
    const heading = /^### (\d+\.\d+)/.exec(line);
    if (heading) current = heading[1] ?? current;
    if (!line.startsWith("|") || /^\|\s*-+/.test(line) || /^\|\s*Resource/.test(line)) continue;
    const cells = line
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((cell) => cell.trim());
    const label = cells[0] ?? "";
    if (cells.length !== columns.length + 1) continue; // a table with another layout (§5.16 report tables)
    const curated = RESOURCES[current]?.[label];
    const resource = curated ?? slugify(label);
    const grants: Record<string, Grant[]> = {};
    const raw: Record<string, string> = {};
    columns.forEach((column, index) => {
      raw[column] = cells[index + 1] ?? "";
      grants[column] = parseCell(raw[column] ?? "");
    });
    rows.push({
      section: current,
      module: MODULES[current] ?? current,
      resource,
      label,
      provisional: !curated,
      cells: raw,
      grants,
    });
  }
  return rows;
}

const ROLE_CODES = /\b(SA|SM|HT|PM|CD|VC|RG|HL|FA|CR)\b(\s*\(a\))?/g;

function parseTransitions(block: string): Transition[] {
  const out: Transition[] = [];
  let entity = "";
  for (const line of block.split("\n")) {
    const heading = /^### (.+)$/.exec(line);
    if (heading) entity = slugify(heading[1] ?? "");
    if (!line.startsWith("|") || /^\|\s*-+/.test(line) || /^\|\s*From/.test(line)) continue;
    const [from = "", to = "", who = ""] = line
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((cell) => cell.trim());
    const roles = [...who.matchAll(ROLE_CODES)].map((m) => ({
      role: m[1] ?? "",
      assigned: Boolean(m[2]),
    }));
    const actors = ["assignee", "owner", "creator", "requester"].filter((actor) =>
      new RegExp(`\\bthe ${actor}\\b`, "i").test(who),
    );
    const system = /\bsystem\b/i.test(who);
    const conditionMatch = /,\s*(when|only when|with|at|per|on)\b(.*)$/i.exec(who);
    out.push({
      entity,
      from,
      to,
      who,
      roles,
      system,
      actors,
      condition: conditionMatch ? `${conditionMatch[1]}${conditionMatch[2]}`.trim() : null,
    });
  }
  return out;
}

const staff = parseMatrix(
  section("## 5. Permission matrix: staff roles", "## 6. Permission matrix"),
  "5.1",
  STAFF,
);
const others = parseMatrix(
  section("## 6. Permission matrix", "## 7. Status transitions"),
  "6",
  OTHERS,
);
const transitions = parseTransitions(section("## 7. Status transitions", "## 8. Automation"));

const output = { source: "docs/permission-matrix.md", staff, others, transitions };
const target = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "generated",
  "matrix.json",
);
writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`);
const provisional = staff.filter((row) => row.provisional).length;
console.log(
  `policy: ${staff.length} staff rows (${provisional} provisional names), ${others.length} client/guest/demo rows, ${transitions.length} transitions -> src/generated/matrix.json`,
);
