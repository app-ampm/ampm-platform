import type { FieldNoteView, QueuedMutation } from "@ampm/core";

import type { LocalNote, NoteDraft, OfflineStore, SyncResolution } from "./offline-store";

/**
 * SPIKE STAND-IN — an in-memory OfflineStore for the Expo web export and tests. The spike's real
 * store is native expo-sqlite; sqlite on web needs a wasm + Metro setup out of scope here, so the
 * web build uses this (not persistent — a reload starts empty). See `create-store`.
 */
export class MemoryStore implements OfflineStore {
  readonly engine = "memory (web)";
  private readonly notes = new Map<string, LocalNote>();
  private queue: QueuedMutation[] = [];
  private sequence = 0;

  init(): Promise<void> {
    return Promise.resolve();
  }

  readNotes(projectId: string): Promise<LocalNote[]> {
    const rows = [...this.notes.values()]
      .filter((note) => note.projectId === projectId)
      .sort((a, b) => b.clientTimestamp.localeCompare(a.clientTimestamp));
    return Promise.resolve(rows);
  }

  enqueue(projectId: string, draft: NoteDraft): Promise<void> {
    this.sequence += 1;
    this.queue.push({
      sequence: this.sequence,
      recordId: draft.recordId,
      baseVersion: draft.baseVersion,
      body: draft.body,
      status: draft.status,
      clientTimestamp: draft.clientTimestamp,
    });
    this.notes.set(draft.recordId, {
      id: draft.recordId,
      projectId,
      version: draft.baseVersion,
      body: draft.body,
      status: draft.status,
      clientTimestamp: draft.clientTimestamp,
      pending: true,
    });
    return Promise.resolve();
  }

  pending(projectId: string): Promise<QueuedMutation[]> {
    const rows = this.queue
      .filter((mutation) => this.notes.get(mutation.recordId)?.projectId === projectId)
      .sort((a, b) => a.sequence - b.sequence);
    return Promise.resolve(rows);
  }

  settle({ mutation, server }: SyncResolution): Promise<void> {
    this.queue = this.queue.filter(
      (queued) =>
        !(queued.recordId === mutation.recordId && queued.baseVersion === mutation.baseVersion),
    );
    this.storeServer(server);
    return Promise.resolve();
  }

  cacheServerNotes(notes: readonly FieldNoteView[]): Promise<void> {
    for (const note of notes) this.storeServer(note);
    return Promise.resolve();
  }

  wipe(): Promise<void> {
    this.notes.clear();
    this.queue = [];
    this.sequence = 0;
    return Promise.resolve();
  }

  private storeServer(note: FieldNoteView): void {
    const pending = this.queue.some((queued) => queued.recordId === note.id);
    this.notes.set(note.id, {
      id: note.id,
      projectId: note.projectId,
      version: note.version,
      body: note.body,
      status: note.status,
      clientTimestamp: note.clientTimestamp,
      pending,
    });
  }
}
