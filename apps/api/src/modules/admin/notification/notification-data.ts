import { z } from "zod";

/*
 * A notification row's server-only data (5.2, D-044): the render variables its caller attached (an
 * activation link, a hotel form link), and the reference its send gate compares at send time (D-188 §5).
 * All of it is held only while the row is `queued`, and cleared when the row leaves it.
 */

/** The render variables a caller may attach to a notification: all strings. */
const renderVariables = z.record(z.string(), z.string());

/**
 * The key that holds a notification's gate reference beside its render variables. A `$` never names a
 * template placeholder (core `renderString` reads letters, digits and `_`), and the key is taken out
 * before the message is rendered or handed to an adapter.
 */
export const NOTIFICATION_GATE_REF_KEY = "$gateRef";

/**
 * What a queued row stores as its data: the render variables, with the gate reference when one is given.
 *
 * @example
 * storedDataOf({ link }, "2"); // { link, $gateRef: "2" }
 */
export function storedDataOf(
  variables: Readonly<Record<string, string>> | undefined,
  gateRef: string | undefined,
): Readonly<Record<string, string>> | undefined {
  if (gateRef === undefined) return variables;
  return { ...variables, [NOTIFICATION_GATE_REF_KEY]: gateRef };
}

/** The render variables a row holds, without its gate reference; none when its data is unreadable. */
export function renderVariablesOf(data: unknown): Record<string, string> {
  const { [NOTIFICATION_GATE_REF_KEY]: _gateRef, ...variables } = renderVariables
    .catch({})
    .parse(data);
  return variables;
}

/** The gate reference a row was queued with; null when it has none. */
export function gateRefOf(data: unknown): string | null {
  return renderVariables.catch({}).parse(data)[NOTIFICATION_GATE_REF_KEY] ?? null;
}
