import type { BookingMilestoneStatus } from "@ampm/core";

/**
 * A booking milestone's status machine (feature 10.5), governing the MANUAL staff moves. Hand-rolled in
 * the module (not a packages/policy STATUS_MACHINE §7, which carries no milestone rows): the staff routes
 * move pending → done | cancelled and overdue → done | cancelled; done and cancelled are terminal.
 * `overdue` is reached ONLY by the worker sweep's own compare-and-swap (markOverdue), never this machine —
 * so it is absent from `pending`'s manual targets, and a manual PATCH to `overdue` is an undefined move.
 */

export const TERMINAL_MILESTONE_STATUSES: readonly BookingMilestoneStatus[] = ["done", "cancelled"];

const MILESTONE_TRANSITIONS: Record<BookingMilestoneStatus, readonly BookingMilestoneStatus[]> = {
  pending: ["done", "cancelled"],
  overdue: ["done", "cancelled"],
  done: [],
  cancelled: [],
};

export function isTerminalMilestone(status: BookingMilestoneStatus): boolean {
  return TERMINAL_MILESTONE_STATUSES.includes(status);
}

export function isMilestoneTransitionAllowed(
  from: BookingMilestoneStatus,
  to: BookingMilestoneStatus,
): boolean {
  return MILESTONE_TRANSITIONS[from].includes(to);
}
