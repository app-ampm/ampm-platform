import type { FieldNoteStatus, FieldNoteView, QueuedMutation } from "@ampm/core";

/**
 * SPIKE STAND-IN — sprint 2 offline spike (docs/review/build-plan.md §11.4). The team app's local
 * store + change queue (.claude/rules/offline.md): reads come from here first; a write is saved
 * locally and appended to the queue; the queue replays in order on reconnection. Two engines
 * implement this one interface so the spike can compare them: `sqlite-store` (plain expo-sqlite, the
 * one wired into the app) and `watermelon-store` (WatermelonDB, for the comparison).
 */

/** A note as held on the device; `pending` is true while a write for it waits in the queue. */
export interface LocalNote {
  readonly id: string;
  readonly projectId: string;
  readonly version: number;
  readonly body: string;
  readonly status: FieldNoteStatus;
  readonly clientTimestamp: string;
  readonly pending: boolean;
}

/** What the app records locally before the write is queued. */
export interface NoteDraft {
  readonly recordId: string;
  readonly baseVersion: number;
  readonly body: string;
  readonly status: FieldNoteStatus;
  readonly clientTimestamp: string;
}

/** The server's answer to one replayed write, carried back into the store. */
export interface SyncResolution {
  readonly mutation: QueuedMutation;
  readonly server: FieldNoteView;
  readonly outcome: "applied" | "duplicate" | "conflict";
}

export interface OfflineStore {
  /** The engine's name, shown in the UI and logs. */
  readonly engine: string;
  init(): Promise<void>;
  /** Reads for a wedding, newest first (offline.md: reads come from the local store first). */
  readNotes(projectId: string): Promise<LocalNote[]>;
  /** Save a note locally and append the write to the change queue. */
  enqueue(projectId: string, draft: NoteDraft): Promise<void>;
  /** The queued writes for a wedding, oldest first, ready to replay. */
  pending(projectId: string): Promise<QueuedMutation[]>;
  /** A replayed write the server has answered: drop it from the queue, store the server's record. */
  settle(resolution: SyncResolution): Promise<void>;
  /** Refresh the local cache from the server's reads. */
  cacheServerNotes(notes: readonly FieldNoteView[]): Promise<void>;
  /** Sign-out or membership removal: wipe every local trace (offline.md). */
  wipe(): Promise<void>;
}
