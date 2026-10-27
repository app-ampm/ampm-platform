/**
 * Pure change-queue logic for the team app's offline writes (.claude/rules/offline.md), validated by
 * the sprint 2 offline spike (docs/review/build-plan.md §11.4). No React, no I/O (code.md): the same
 * functions run inside the app's local store and in the Vitest suite, and the idempotency key is
 * defined ONCE here so the client and the API agree on it. The mobile store adds only the SQLite
 * persistence and the network send around these.
 */
import type { FieldNoteStatus, FieldNoteUpsert } from "../schemas/field-note";

/** One write waiting in the local queue; `sequence` is the device's monotonic enqueue order. */
export interface QueuedMutation {
  readonly sequence: number;
  /** The record's client-generated UUID v7. */
  readonly recordId: string;
  /** The version the edit was based on. */
  readonly baseVersion: number;
  readonly body: string;
  readonly status: FieldNoteStatus;
  /** The device's original time of the edit (ISO 8601, UTC). */
  readonly clientTimestamp: string;
}

/** The server's idempotency key: the client id plus the base version (offline.md). */
export function idempotencyKey(mutation: Pick<QueuedMutation, "recordId" | "baseVersion">): string {
  return `${mutation.recordId}:${mutation.baseVersion}`;
}

/** Replay order: the device's enqueue order, oldest first (offline.md: "replays ... in order"). */
export function orderForReplay(mutations: readonly QueuedMutation[]): QueuedMutation[] {
  return [...mutations].sort((a, b) => a.sequence - b.sequence);
}

/**
 * Collapse an accidental double-enqueue: one send per idempotency key, keeping the earliest. A
 * genuine second edit of the same record carries the next `baseVersion`, so it has a different key
 * and survives.
 */
export function dedupeByIdempotency(mutations: readonly QueuedMutation[]): QueuedMutation[] {
  const byKey = new Map<string, QueuedMutation>();
  for (const mutation of orderForReplay(mutations)) {
    const key = idempotencyKey(mutation);
    if (!byKey.has(key)) byKey.set(key, mutation);
  }
  return [...byKey.values()];
}

/** The request body for one queued mutation (the API validates it with `fieldNoteUpsert`). */
export function toUpsertBody(mutation: QueuedMutation): FieldNoteUpsert {
  return {
    id: mutation.recordId,
    baseVersion: mutation.baseVersion,
    body: mutation.body,
    status: mutation.status,
    clientTimestamp: mutation.clientTimestamp,
  };
}
