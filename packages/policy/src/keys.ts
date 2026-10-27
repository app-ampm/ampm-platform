import { ACTION_LETTERS, type Action, type Scope } from "./roles";

/**
 * The §10 key vocabulary: `module.resource.action` with an optional `:assigned` or `:own` suffix.
 * Besides the seven actions of the §5 legend, §10 names class-specific reads (`read_internal_cost`
 * on budget lines) and two decisions (`create_on_behalf`, `authorise_exception`). §5 records each of
 * those as a row of its own, so decide() resolves such a key to that row (the row's `aliases`).
 *
 * @example
 * decide(principal, "budget.budget_lines_client_facing.read_internal_cost", { projectId });
 */
export const CLASS_ACTIONS = [
  "read_internal_cost",
  "read_internal_amount",
  "read_internal_notes",
  "read_contacts",
  "read_sensitive",
  "read_identity",
] as const;
/** @example const action: ClassAction = "read_contacts"; */
export type ClassAction = (typeof CLASS_ACTIONS)[number];

/**
 * The decisions §10 names as verbs of their own.
 *
 * @example
 * VERB_ACTIONS.includes("create_on_behalf"); // true
 */
export const VERB_ACTIONS = ["create_on_behalf", "authorise_exception"] as const;
/** @example const action: VerbAction = "authorise_exception"; */
export type VerbAction = (typeof VERB_ACTIONS)[number];

/** Any action a key may name. @example const action: KeyAction = "read_identity"; */
export type KeyAction = Action | ClassAction | VerbAction;

const ACTIONS: readonly Action[] = Object.values(ACTION_LETTERS);
const KEY_ACTIONS: readonly KeyAction[] = [...ACTIONS, ...CLASS_ACTIONS, ...VERB_ACTIONS];

/**
 * Whether a key's action is one of the seven of the §5 legend rather than a §10 alias.
 *
 * @example
 * isAction("read"); // true
 * isAction("read_internal_cost"); // false
 */
export function isAction(action: KeyAction): action is Action {
  return ACTIONS.some((candidate) => candidate === action);
}

/**
 * `module.resource.action` with an optional `:assigned` or `:own` suffix (permission-matrix §10).
 *
 * @example
 * const key: PermissionKey = "guests.identity_documents.read:assigned";
 */
export type PermissionKey =
  `${string}.${string}.${KeyAction}` | `${string}.${string}.${KeyAction}:${Exclude<Scope, "all">}`;

/**
 * A key's parts.
 *
 * @example
 * const { module, resource, action } = parsePermissionKey("admin.roles.update") ?? fallback;
 */
export interface ParsedKey {
  readonly module: string;
  readonly resource: string;
  readonly action: KeyAction;
  readonly scope: Scope;
}

/**
 * Composes a key.
 *
 * @example
 * permissionKey("projects", "members", "update", "assigned"); // "projects.members.update:assigned"
 */
export function permissionKey(
  module: string,
  resource: string,
  action: KeyAction,
  scope: Scope = "all",
): PermissionKey {
  const base = `${module}.${resource}.${action}` as const;
  if (scope === "all") return base;
  return `${base}:${scope}` as const;
}

function toKeyAction(value: string): KeyAction | undefined {
  return KEY_ACTIONS.find((action) => action === value);
}

/**
 * Splits a key into its parts, or null when it is not a key of the §10 vocabulary.
 *
 * @example
 * parsePermissionKey("budget.lines.read_internal_cost:assigned");
 * // → { module: "budget", resource: "lines", action: "read_internal_cost", scope: "assigned" }
 */
export function parsePermissionKey(key: string): ParsedKey | null {
  const match = /^([a-z0-9_]+)\.([a-z0-9_]+)\.([a-z_]+)(?::(assigned|own))?$/.exec(key);
  const action = toKeyAction(match?.[3] ?? "");
  if (!match || action === undefined) return null;
  const suffix = match[4];
  return {
    module: match[1] ?? "",
    resource: match[2] ?? "",
    action,
    scope: suffix === "assigned" || suffix === "own" ? suffix : "all",
  };
}
