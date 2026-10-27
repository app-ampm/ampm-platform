import { fieldNoteStatus, type FieldNoteView, type QueuedMutation } from "@ampm/core";
import * as SQLite from "expo-sqlite";

import type { LocalNote, NoteDraft, OfflineStore, SyncResolution } from "./offline-store";

const DB_NAME = "ampm-field-notes-spike.db";

interface NoteRow {
  record_id: string;
  project_id: string;
  version: number;
  body: string;
  status: string;
  client_timestamp: string;
  pending: number;
}

interface QueueRow {
  sequence: number;
  record_id: string;
  base_version: number;
  body: string;
  status: string;
  client_timestamp: string;
}

/**
 * SPIKE STAND-IN — the team app's local store on plain expo-sqlite (the engine wired into the app).
 * Two tables: `field_notes` is the read cache; `change_queue` is the offline write queue, ordered by
 * an auto-increment sequence so it replays in the device's own order (.claude/rules/offline.md).
 *
 * Encryption at rest (offline.md) is NOT on in this spike: it needs `openDatabaseAsync(name, {
 * useSQLCipher: true })` with a key from the secret store, which the SQLCipher build requires — a
 * development build, not Expo Go. The store code is otherwise identical. See the spike D-record.
 */
export class SqliteStore implements OfflineStore {
  readonly engine = "expo-sqlite";
  private db: SQLite.SQLiteDatabase | null = null;

  async init(): Promise<void> {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS field_notes (
         record_id TEXT PRIMARY KEY NOT NULL,
         project_id TEXT NOT NULL,
         version INTEGER NOT NULL,
         body TEXT NOT NULL,
         status TEXT NOT NULL,
         client_timestamp TEXT NOT NULL,
         pending INTEGER NOT NULL
       );
       CREATE TABLE IF NOT EXISTS change_queue (
         sequence INTEGER PRIMARY KEY AUTOINCREMENT,
         record_id TEXT NOT NULL,
         project_id TEXT NOT NULL,
         base_version INTEGER NOT NULL,
         body TEXT NOT NULL,
         status TEXT NOT NULL,
         client_timestamp TEXT NOT NULL
       );`,
    );
    this.db = db;
  }

  async readNotes(projectId: string): Promise<LocalNote[]> {
    const rows = await this.database.getAllAsync<NoteRow>(
      "SELECT * FROM field_notes WHERE project_id = ? ORDER BY client_timestamp DESC",
      projectId,
    );
    return rows.map(toLocalNote);
  }

  async enqueue(projectId: string, draft: NoteDraft): Promise<void> {
    await this.database.withTransactionAsync(async () => {
      await this.database.runAsync(
        `INSERT INTO change_queue (record_id, project_id, base_version, body, status, client_timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`,
        draft.recordId,
        projectId,
        draft.baseVersion,
        draft.body,
        draft.status,
        draft.clientTimestamp,
      );
      await this.database.runAsync(
        `INSERT INTO field_notes (record_id, project_id, version, body, status, client_timestamp, pending)
         VALUES (?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(record_id) DO UPDATE SET body = excluded.body, status = excluded.status,
           client_timestamp = excluded.client_timestamp, pending = 1`,
        draft.recordId,
        projectId,
        draft.baseVersion,
        draft.body,
        draft.status,
        draft.clientTimestamp,
      );
    });
  }

  async pending(projectId: string): Promise<QueuedMutation[]> {
    const rows = await this.database.getAllAsync<QueueRow>(
      "SELECT * FROM change_queue WHERE project_id = ? ORDER BY sequence ASC",
      projectId,
    );
    return rows.map(toQueuedMutation);
  }

  async settle({ mutation, server }: SyncResolution): Promise<void> {
    await this.database.withTransactionAsync(async () => {
      await this.database.runAsync(
        "DELETE FROM change_queue WHERE record_id = ? AND base_version = ?",
        mutation.recordId,
        mutation.baseVersion,
      );
      await this.storeServer(server);
    });
  }

  async cacheServerNotes(notes: readonly FieldNoteView[]): Promise<void> {
    await this.database.withTransactionAsync(async () => {
      for (const note of notes) await this.storeServer(note);
    });
  }

  async wipe(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
    await SQLite.deleteDatabaseAsync(DB_NAME);
  }

  private get database(): SQLite.SQLiteDatabase {
    if (!this.db) throw new Error("SqliteStore.init() must run before any other call");
    return this.db;
  }

  /** Store the server's authoritative record; `pending` stays true while the queue still holds it. */
  private async storeServer(note: FieldNoteView): Promise<void> {
    const queued = await this.database.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM change_queue WHERE record_id = ?",
      note.id,
    );
    const pending = (queued?.count ?? 0) > 0 ? 1 : 0;
    await this.database.runAsync(
      `INSERT INTO field_notes (record_id, project_id, version, body, status, client_timestamp, pending)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(record_id) DO UPDATE SET project_id = excluded.project_id, version = excluded.version,
         body = excluded.body, status = excluded.status, client_timestamp = excluded.client_timestamp,
         pending = excluded.pending`,
      note.id,
      note.projectId,
      note.version,
      note.body,
      note.status,
      note.clientTimestamp,
      pending,
    );
  }
}

function toLocalNote(row: NoteRow): LocalNote {
  return {
    id: row.record_id,
    projectId: row.project_id,
    version: row.version,
    body: row.body,
    status: fieldNoteStatus.parse(row.status),
    clientTimestamp: row.client_timestamp,
    pending: row.pending === 1,
  };
}

function toQueuedMutation(row: QueueRow): QueuedMutation {
  return {
    sequence: row.sequence,
    recordId: row.record_id,
    baseVersion: row.base_version,
    body: row.body,
    status: fieldNoteStatus.parse(row.status),
    clientTimestamp: row.client_timestamp,
  };
}
