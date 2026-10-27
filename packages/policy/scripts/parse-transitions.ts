/**
 * Reads §7 of docs/permission-matrix.md into transition rules. Movers come only from the who-part of
 * each clause: the leading list of role codes, "Either CR", "System" and the record's people ("The
 * assignee", "The assigned staff member"); the rest of the clause is its condition. Statuses expand
 * against src/statuses.ts. An unknown heading, status, set or qualifier, or a clause that names no
 * mover and is not known to need none, stops the generator.
 */
import type { Actor, Transition } from "../src/matrix.ts";
import type { StaffRole } from "../src/roles.ts";
import { STATUS_MACHINES, type StatusMachine } from "../src/statuses.ts";
import { lookup } from "./lookup.ts";

interface Movers {
  readonly roles: { readonly role: StaffRole; readonly assigned: boolean }[];
  client: boolean;
  system: boolean;
  readonly actors: Actor[];
}

interface Clause {
  readonly movers: Movers;
  readonly condition: string;
}

interface StatusCell {
  readonly statuses: readonly string[];
  readonly restore: boolean;
  readonly kind: string | null;
}

const STAFF_CODES: readonly StaffRole[] = ["SA", "SM", "HT", "PM", "CD", "VC", "RG", "HL", "FA"];
const ROLE = /^(SA|SM|HT|PM|CD|VC|RG|HL|FA)\b(\s*\(a\))?/;
const SEPARATOR = /^(?:,\s*or\s+|,\s*|\s+or\s+)/;
const ACTORS: readonly [string, Actor][] = [
  ["The assigned staff member", "assignee"],
  ["The assignee", "assignee"],
  ["The owner", "owner"],
  ["The creator", "creator"],
  ["The requester", "requester"],
];
/** Clauses that name no mover but say how the move happens; they join the rules' conditions. */
const NO_MOVER_CLAUSES: readonly string[] = [
  "a client asks for cancellation through a client request",
  "approvals are paused",
  "a critical incident requires resolution notes",
  "New subscription row",
  "the old one is never reactivated",
  // §7 line 446: SA authorises the exception on a checklist item (§5.6 line 207, decide() on the
  // readiness exceptions row); readiness then follows from the items (data-model.md line 1838), so
  // the clause says who authorises, not who moves the status.
  "an exception needs SA, Eva's authorised personnel (P-8 changed by Q10)",
];
/** Who-cells under which nobody moves the record: the document says so. */
const NO_MOVER_ROWS: readonly string[] = ["New subscription row; the old one is never reactivated"];

/** One mover at the start of the text, applied to the movers; its length, or 0 when there is none. */
function readMover(text: string, movers: Movers): number {
  const role = ROLE.exec(text);
  const code = STAFF_CODES.find((candidate) => candidate === role?.[1]);
  if (role && code) {
    movers.roles.push({ role: code, assigned: Boolean(role[2]) });
    return role[0].length;
  }
  if (/^Either CR\b/.test(text)) {
    movers.client = true;
    return "Either CR".length;
  }
  if (/^System\b/.test(text)) {
    movers.system = true;
    return "System".length;
  }
  const actor = ACTORS.find(([words]) => new RegExp(`^${words}\\b`).test(text));
  if (!actor) return 0;
  movers.actors.push(actor[1]);
  return actor[0].length;
}

/** The leading list of movers of a clause and the condition after it. */
function parseMovers(clause: string): { movers: Movers; count: number; rest: string } {
  const movers: Movers = { roles: [], client: false, system: false, actors: [] };
  let rest = clause;
  let count = 0;
  for (let length = readMover(rest, movers); length > 0; length = readMover(rest, movers)) {
    count += 1;
    rest = rest.slice(length);
    const separator = SEPARATOR.exec(rest);
    const probe: Movers = { roles: [], client: false, system: false, actors: [] };
    if (!separator || readMover(rest.slice(separator[0].length), probe) === 0) break;
    rest = rest.slice(separator[0].length);
  }
  // "SA only, audited": "only" closes the list of movers; what follows is the condition.
  const condition = rest
    .replace(/^[\s,]+/, "")
    .replace(/^only,\s*/, "")
    .trim();
  return { movers, count, rest: condition };
}

/** Splits a Who cell into its mover clauses and the notes that name no mover. */
function parseWho(who: string): { clauses: Clause[]; notes: string[] } {
  const [first = "", ...later] = who.split(/\.\s+(?=[A-Z])/);
  const clauses: Clause[] = [];
  const notes: string[] = [];
  for (const part of first.split(/;\s*(?![^(]*\))/).map((text) => text.trim())) {
    const parsed = parseMovers(part);
    if (parsed.count > 0) {
      clauses.push({ movers: parsed.movers, condition: parsed.rest });
    } else if (NO_MOVER_CLAUSES.includes(part)) {
      notes.push(part);
    } else {
      throw new Error(`no mover in "${part}" (§7 Who "${who}")`);
    }
  }
  if (clauses.length === 0 && !NO_MOVER_ROWS.includes(who)) {
    throw new Error(`no mover in the §7 Who cell "${who}"`);
  }
  return { clauses, notes: [...notes, ...later] };
}

/** A status cell read against one machine, or the reason it does not fit. */
function readStatuses(
  cell: string,
  machine: StatusMachine,
  side: "from" | "to",
): StatusCell | string {
  let text = cell.replace(/[`*]/g, "").trim();
  const prefix = /^([a-z_]+):\s*/.exec(text);
  if (prefix && prefix[1] !== machine.prefix) return `unknown prefix in "${cell}"`;
  if (prefix) text = text.slice(prefix[0].length);
  let kind: string | null = null;
  const qualified = /^(.*?)\s*\(([^)]+)\)$/.exec(text);
  if (qualified) {
    const found = lookup(machine.kinds, qualified[2] ?? "");
    if (found === undefined) return `unknown qualifier "(${qualified[2]})" in "${cell}"`;
    kind = found;
    text = qualified[1] ?? "";
  }
  if (side === "to" && text === "previous status") return { statuses: [], restore: true, kind };
  // A plain "any" leaves the outcomes alone: only a row that names a terminal status moves out of it.
  if (text === "any") {
    const open = machine.statuses.filter((status) => !machine.terminal.includes(status));
    return { statuses: open, restore: false, kind };
  }
  const setName = side === "to" && text === "derived" ? text : /^any (.+)$/.exec(text)?.[1];
  if (setName !== undefined) {
    const set = lookup(machine.sets, setName);
    return set
      ? { statuses: set, restore: false, kind }
      : `unknown status set "${text}" in "${cell}"`;
  }
  const names = text.split(/\s*,\s*|\s+or\s+/);
  const unknown = names.filter((name) => !machine.statuses.includes(name));
  if (unknown.length > 0) return `unknown status "${unknown.join(", ")}" in "${cell}"`;
  return { statuses: names, restore: false, kind };
}

/** The one machine of the heading whose enumeration reads both cells. */
function machineFor(heading: string, from: string, to: string) {
  const candidates = Object.entries(STATUS_MACHINES).filter(
    ([, machine]) => machine.heading === heading,
  );
  if (candidates.length === 0) {
    throw new Error(`unknown §7 heading "${heading}": add it to statuses.ts`);
  }
  const read = candidates.map(([entity, machine]) => ({
    entity,
    machine,
    from: readStatuses(from, machine, "from"),
    to: readStatuses(to, machine, "to"),
  }));
  const fits = read.filter((r) => typeof r.from !== "string" && typeof r.to !== "string");
  const [fit] = fits;
  if (fits.length !== 1 || !fit || typeof fit.from === "string" || typeof fit.to === "string") {
    const reasons = read.flatMap((r) => [r.from, r.to]).filter((r) => typeof r === "string");
    throw new Error(
      `§7 ${heading} "${from} → ${to}": ${reasons.join("; ") || "ambiguous machine"}`,
    );
  }
  return { entity: fit.entity, machine: fit.machine, from: fit.from, to: fit.to };
}

const NOBODY = { roles: [], client: false, system: false, actors: [] } as const;

function joined(parts: readonly string[]): string | null {
  const text = parts.filter((part) => part !== "").join("; ");
  return text === "" ? null : text;
}

type RuleBase = Pick<Transition, "entity" | "from" | "to" | "restore" | "kind" | "who">;

function rowRules(heading: string, cells: readonly string[]): Transition[] {
  const [fromCell = "", toCell = "", who = ""] = cells;
  const { entity, from, to } = machineFor(heading, fromCell, toCell);
  const { clauses, notes } = parseWho(who);
  if (from.kind !== null && to.kind !== null && from.kind !== to.kind) {
    throw new Error(`§7 ${heading} "${fromCell} → ${toCell}": two qualifiers`);
  }
  // "any" reaches every other status: moving to the status the record already has is no move.
  const set = /^any\b/.test(fromCell.trim());
  const base: RuleBase = {
    entity,
    from: set ? from.statuses.filter((status) => !to.statuses.includes(status)) : from.statuses,
    to: to.statuses,
    restore: to.restore,
    kind: from.kind ?? to.kind,
    who,
  };
  if (clauses.length === 0) return [{ ...base, ...NOBODY, condition: joined(notes) }];
  return clauses.map((clause): Transition => ({
    ...base,
    ...clause.movers,
    condition: joined([clause.condition, ...notes]),
  }));
}

/**
 * The rules of §7, one per mover clause of each row.
 *
 * @example
 * parseTransitions(section7).filter((rule) => rule.entity === "incident");
 */
export function parseTransitions(block: string): Transition[] {
  const rules: Transition[] = [];
  let heading = "";
  for (const line of block.split("\n")) {
    const match = /^### (.+)$/.exec(line);
    if (match) heading = (match[1] ?? "").trim();
    if (!line.startsWith("|") || /^\|\s*-/.test(line) || /^\|\s*From\s*\|/.test(line)) continue;
    const cells = line
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((cell) => cell.trim());
    if (cells.length !== 3) throw new Error(`§7 ${heading}: a row with ${cells.length} cells`);
    rules.push(...rowRules(heading, cells));
  }
  return rules;
}
