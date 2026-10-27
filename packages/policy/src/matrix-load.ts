import { VISIBILITY_CLASSES } from "./classes";
import {
  CHECKS,
  CONDITION_KINDS,
  FIELD_GROUPS,
  SIDES,
  SUBJECTS,
  VIEWS,
  type Condition,
} from "./conditions";
import { CLASS_ACTIONS, VERB_ACTIONS } from "./keys";
import type {
  Actor,
  Grant,
  Matrix,
  MatrixRow,
  ReportExclusion,
  RowAlias,
  Transition,
} from "./matrix";
import { ACTION_LETTERS, STAFF_ROLE_CODES } from "./roles";

/**
 * Reads the generated matrix from untyped JSON, checking every value against the types the engine
 * relies on. JSON imports carry no literal types, so this is where the data is narrowed: a value the
 * engine does not know (a new condition kind, a misspelt scope) stops the package at load.
 */
type Json = Readonly<Record<string, unknown>>;

const ACTIONS = Object.values(ACTION_LETTERS);
const SCOPES = ["all", "assigned", "own"] as const;
const ALIAS_ACTIONS = [...CLASS_ACTIONS, ...VERB_ACTIONS];
const ACTORS: readonly Actor[] = ["assignee", "owner", "creator", "requester"];

function fail(path: string, expected: string): never {
  throw new Error(`matrix.json: ${path} is not ${expected}; run pnpm authz:generate`);
}

function isJson(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function object(value: unknown, path: string): Json {
  return isJson(value) ? value : fail(path, "an object");
}

function list(value: unknown, path: string): readonly unknown[] {
  return Array.isArray(value) ? value : fail(path, "a list");
}

function text(value: unknown, path: string): string {
  return typeof value === "string" ? value : fail(path, "a string");
}

function flag(value: unknown, path: string): boolean {
  return typeof value === "boolean" ? value : fail(path, "a boolean");
}

function oneOf<T extends string>(value: unknown, options: readonly T[], path: string): T {
  const found = options.find((option) => option === value);
  return found ?? fail(path, `one of ${options.join(", ")}`);
}

function each<T extends string>(value: unknown, options: readonly T[], path: string): T[] {
  return list(value, path).map((item, index) => oneOf(item, options, `${path}[${index}]`));
}

function readCondition(value: unknown, path: string): Condition {
  const condition = object(value, path);
  const kind = oneOf(condition["kind"], CONDITION_KINDS, `${path}.kind`);
  switch (kind) {
    case "side":
      return { kind, anyOf: each(condition["anyOf"], SIDES, `${path}.anyOf`) };
    case "subject":
      return { kind, anyOf: each(condition["anyOf"], SUBJECTS, `${path}.anyOf`) };
    case "fields":
      return { kind, only: each(condition["only"], FIELD_GROUPS, `${path}.only`) };
    case "check":
      return { kind, check: oneOf(condition["check"], CHECKS, `${path}.check`) };
    case "view":
      return { kind, view: oneOf(condition["view"], VIEWS, `${path}.view`) };
    case "explicit_grant":
      return { kind };
  }
}

function readGrant(value: unknown, path: string): Grant {
  const grant = object(value, path);
  return {
    actions: each(grant["actions"], ACTIONS, `${path}.actions`),
    scope: oneOf(grant["scope"], SCOPES, `${path}.scope`),
    conditions: list(grant["conditions"], `${path}.conditions`).map((condition, index) =>
      readCondition(condition, `${path}.conditions[${index}]`),
    ),
  };
}

function readAlias(value: unknown, path: string): RowAlias {
  const alias = object(value, path);
  return {
    resource: text(alias["resource"], `${path}.resource`),
    action: oneOf(alias["action"], ALIAS_ACTIONS, `${path}.action`),
    as: oneOf(alias["as"], ACTIONS, `${path}.as`),
  };
}

function readExclusion(value: unknown, path: string): ReportExclusion {
  const exclusion = object(value, path);
  if (oneOf(exclusion["kind"], ["class", "variant"], `${path}.kind`) === "class") {
    return {
      kind: "class",
      class: oneOf(exclusion["class"], VISIBILITY_CLASSES, `${path}.class`),
      unlessRoles: each(exclusion["unlessRoles"], STAFF_ROLE_CODES, `${path}.unlessRoles`),
    };
  }
  return {
    kind: "variant",
    variant: text(exclusion["variant"], `${path}.variant`),
    onlyFields: list(exclusion["onlyFields"], `${path}.onlyFields`).map((field, index) =>
      text(field, `${path}.onlyFields[${index}]`),
    ),
    audited: flag(exclusion["audited"], `${path}.audited`),
  };
}

function readRecord<T>(value: unknown, path: string, read: (item: unknown, at: string) => T) {
  const entries = Object.entries(object(value, path)).map(
    ([key, item]) => [key, read(item, `${path}.${key}`)] as const,
  );
  return Object.fromEntries(entries);
}

function readRow(value: unknown, path: string): MatrixRow {
  const row = object(value, path);
  const grantList = (item: unknown, at: string) =>
    list(item, at).map((grant, index) => readGrant(grant, `${at}[${index}]`));
  return {
    section: text(row["section"], `${path}.section`),
    module: text(row["module"], `${path}.module`),
    resource: text(row["resource"], `${path}.resource`),
    label: text(row["label"], `${path}.label`),
    provisional: flag(row["provisional"], `${path}.provisional`),
    cells: readRecord(row["cells"], `${path}.cells`, text),
    grants: readRecord(row["grants"], `${path}.grants`, grantList),
    aliases: list(row["aliases"], `${path}.aliases`).map((alias, index) =>
      readAlias(alias, `${path}.aliases[${index}]`),
    ),
    exclusions: list(row["exclusions"], `${path}.exclusions`).map((exclusion, index) =>
      readExclusion(exclusion, `${path}.exclusions[${index}]`),
    ),
  };
}

function readMover(value: unknown, path: string) {
  const mover = object(value, path);
  return {
    role: oneOf(mover["role"], STAFF_ROLE_CODES, `${path}.role`),
    assigned: flag(mover["assigned"], `${path}.assigned`),
  };
}

function readTransition(value: unknown, path: string): Transition {
  const rule = object(value, path);
  const kind = rule["kind"];
  const condition = rule["condition"];
  return {
    entity: text(rule["entity"], `${path}.entity`),
    from: list(rule["from"], `${path}.from`).map((s, i) => text(s, `${path}.from[${i}]`)),
    to: list(rule["to"], `${path}.to`).map((s, i) => text(s, `${path}.to[${i}]`)),
    restore: flag(rule["restore"], `${path}.restore`),
    kind: kind === null ? null : text(kind, `${path}.kind`),
    roles: list(rule["roles"], `${path}.roles`).map((m, i) => readMover(m, `${path}.roles[${i}]`)),
    client: flag(rule["client"], `${path}.client`),
    system: flag(rule["system"], `${path}.system`),
    actors: each(rule["actors"], ACTORS, `${path}.actors`),
    who: text(rule["who"], `${path}.who`),
    condition: condition === null ? null : text(condition, `${path}.condition`),
  };
}

/**
 * Checks the generated JSON and returns it typed.
 *
 * @example
 * const matrix = readMatrix(JSON.parse(readFileSync("matrix.json", "utf8")));
 */
export function readMatrix(raw: unknown): Matrix {
  const matrix = object(raw, "matrix");
  const rows = (key: string) =>
    list(matrix[key], key).map((row, index) => readRow(row, `${key}[${index}]`));
  return {
    source: text(matrix["source"], "source"),
    staff: rows("staff"),
    others: rows("others"),
    transitions: list(matrix["transitions"], "transitions").map((rule, index) =>
      readTransition(rule, `transitions[${index}]`),
    ),
  };
}
