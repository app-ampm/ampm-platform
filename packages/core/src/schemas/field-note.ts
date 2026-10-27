import { z } from "zod";

import { isoDateTime, page, uuid } from "./common";

/**
 * SPIKE STAND-IN — sprint 2 offline spike (docs/review/build-plan.md §11.4). A throwaway "field
 * note" that stands in for the operational records the team app edits with no signal (incidents, cue
 * updates, checklist items). Its shape is the one the offline rules dictate (.claude/rules/
 * offline.md): a client-generated UUID v7 `id` plus a base `version` form the idempotency key, so a
 * replayed queue never duplicates; the device's own timestamp rides along; the status and the free
 * text carry the two conflict rules. Removed when the real records arrive (see the spike D-record).
 */

/** Open → acknowledged → resolved; the server wins on these transitions (offline.md). */
export const fieldNoteStatus = z.enum(["open", "acknowledged", "resolved"]);
export type FieldNoteStatus = z.infer<typeof fieldNoteStatus>;

/** An offline-capable write; `id` + `baseVersion` are the server's idempotency key. */
export const fieldNoteUpsert = z.object({
  /** Client-generated UUID v7, stable across retries so a replay is recognised, never re-applied. */
  id: uuid,
  /** The version the edit was based on, 0 for a create; a stale value loses to the server. */
  baseVersion: z.number().int().min(0),
  /** Free text; merged last-writer-wins with the losing version kept in the conflict log (offline.md). */
  body: z.string().min(1).max(500),
  status: fieldNoteStatus,
  /** The device's original time of the edit, in UTC, kept through the queue (offline.md). */
  clientTimestamp: isoDateTime,
});
export type FieldNoteUpsert = z.infer<typeof fieldNoteUpsert>;

/** How the server applied a write, so the client can show a rejected change and never drop it. */
export const fieldNoteOutcome = z.enum(["applied", "duplicate", "conflict"]);
export type FieldNoteOutcome = z.infer<typeof fieldNoteOutcome>;

/** The server's authoritative record. */
export const fieldNoteView = z.object({
  id: uuid,
  projectId: uuid,
  version: z.number().int().min(1),
  body: z.string(),
  status: fieldNoteStatus,
  clientTimestamp: isoDateTime,
  serverTimestamp: isoDateTime,
});
export type FieldNoteView = z.infer<typeof fieldNoteView>;

/** The server's answer to one upsert: the outcome plus the authoritative record. */
export const fieldNoteUpsertResult = z.object({
  outcome: fieldNoteOutcome,
  note: fieldNoteView,
});
export type FieldNoteUpsertResult = z.infer<typeof fieldNoteUpsertResult>;

/** The reads the app refreshes into its local store (cursor-paginated per api.md). */
export const fieldNoteList = page(fieldNoteView);
export type FieldNoteList = z.infer<typeof fieldNoteList>;
