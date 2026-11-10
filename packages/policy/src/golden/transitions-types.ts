import type { Actor } from "../matrix";
import type { StaffRole } from "../roles";
import type { ActorPrincipal } from "../statuses";

/**
 * A mover as the Who cell writes it: "PM (a)" on the user's weddings only, "SA" anywhere.
 *
 * @example
 * const mover: GoldenMover = "HL (a)";
 */
export type GoldenMover = StaffRole | `${StaffRole} (a)`;

/**
 * One §7 row: who moves the record from each From status to each To status.
 *
 * @example
 * TRANSITIONS_389_TO_429.find((row) => row.line === 422)?.movers; // ["SA"]
 */
export interface GoldenTransition {
  readonly line: number;
  readonly entity: string;
  readonly from: readonly string[];
  /** "previous" restores the status saved before the hold (line 422). */
  readonly to: readonly string[] | "previous";
  /** The record kind a parenthesised qualifier limits the row to ("answered (question)"). */
  readonly kind?: string;
  readonly movers?: readonly GoldenMover[];
  /** "Either CR": a representative of the record's wedding or account. */
  readonly client?: boolean;
  readonly system?: boolean;
  /** The record's people, with the principal types each may be (§6, §5.9). */
  readonly actors?: Readonly<Partial<Record<Actor, readonly ActorPrincipal[]>>>;
}
