import { Injectable } from "@nestjs/common";
import {
  fieldNoteUpsertResult,
  type FieldNoteList,
  type FieldNoteUpsert,
  type FieldNoteUpsertResult,
  type FieldNoteView,
} from "@ampm/core";

/**
 * SPIKE STAND-IN — sprint 2 offline spike (docs/review/build-plan.md §11.4). The server half of the
 * offline-capable mutation. An in-memory store (no Prisma model, no migration, nothing to tear down)
 * proves only what the spike must: a write keyed on the client id and its base version is idempotent
 * on replay, applies once in version order, and a stale write loses to the server (.claude/rules/
 * offline.md). Production replaces the Map with a project-scoped Prisma repository and an
 * idempotency-keys table and adds the conflict log; the rules below move to it unchanged.
 *
 * Key = (projectId, record id, baseVersion). This recognises a single device replaying its own
 * queue, which is what the wedding-day reconnection needs. Two devices editing the same record from
 * the same base would share a key; production narrows the key with a per-write client id and keeps
 * the losing free text in the conflict log — out of scope for this thin spike.
 */
@Injectable()
export class FieldNoteService {
  private readonly notes = new Map<string, FieldNoteView>();
  private readonly applied = new Map<string, FieldNoteView>();

  /** Reads the app refreshes into its local store, oldest first by the device's own timestamp. */
  list(projectId: string): FieldNoteList {
    const items = [...this.notes.values()]
      .filter((note) => note.projectId === projectId)
      .sort((a, b) => a.clientTimestamp.localeCompare(b.clientTimestamp));
    return { items, nextCursor: null };
  }

  /**
   * One offline-capable write. A replay of the same (id, baseVersion) returns the stored record with
   * no second apply; an in-order write applies and bumps the version; a stale base loses to the
   * server and comes back as a conflict, surfaced to the user and never dropped (offline.md).
   */
  upsert(projectId: string, input: FieldNoteUpsert): FieldNoteUpsertResult {
    const idempotencyKey = `${projectId}:${input.id}:${input.baseVersion}`;
    const replayed = this.applied.get(idempotencyKey);
    if (replayed) return fieldNoteUpsertResult.parse({ outcome: "duplicate", note: replayed });

    const recordKey = `${projectId}:${input.id}`;
    const result = this.resolve(projectId, input, this.notes.get(recordKey));

    this.notes.set(recordKey, result.note);
    this.applied.set(idempotencyKey, result.note);
    return result;
  }

  private resolve(
    projectId: string,
    input: FieldNoteUpsert,
    current: FieldNoteView | undefined,
  ): FieldNoteUpsertResult {
    const currentVersion = current?.version ?? 0;
    if (current && input.baseVersion !== currentVersion) {
      // The server wins on the status; production also keeps the losing free text in the conflict log.
      return fieldNoteUpsertResult.parse({ outcome: "conflict", note: current });
    }
    const note: FieldNoteView = {
      id: input.id,
      projectId,
      version: currentVersion + 1,
      body: input.body,
      status: input.status,
      clientTimestamp: input.clientTimestamp,
      serverTimestamp: new Date().toISOString(),
    };
    return fieldNoteUpsertResult.parse({ outcome: "applied", note });
  }
}
