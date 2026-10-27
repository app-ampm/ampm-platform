import { fieldNoteStatus, type FieldNoteView, type QueuedMutation } from "@ampm/core";
import {
  appSchema,
  columnName,
  Database,
  Model,
  Q,
  tableName,
  tableSchema,
} from "@nozbe/watermelondb";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite";

import type { LocalNote, NoteDraft, OfflineStore, SyncResolution } from "./offline-store";

/**
 * SPIKE STAND-IN — the WatermelonDB arm of the sprint 2 offline spike (docs/review/build-plan.md
 * §11.4), for the comparison only. It implements the SAME OfflineStore interface as the expo-sqlite
 * store, so the two are judged on equal terms.
 *
 * IMPORTANT — this module is written and type-checked but is NOT wired into the app (create-store
 * never imports it), because WatermelonDB cannot run in Expo Go: its SQLite adapter is a native JSI
 * module that needs a community config plugin and a development build (see the spike comparison and
 * D-record). It also means every candidate sync library is, in this spike, a compile-only artifact.
 *
 * Two deliberate notes for the comparison:
 *  - This uses WatermelonDB purely as a local database with OUR change queue on top, to honour the
 *    locked offline rules (.claude/rules/offline.md: our own base-version idempotency key, server
 *    wins on status, a conflict log). WatermelonDB's real value is its opinionated `synchronize()`
 *    engine (last-pulled-at pull/push with its own conflict model), which those rules do not use —
 *    so here it buys nothing over expo-sqlite while still costing a development build.
 *  - Production WatermelonDB uses decorated models (`@field`, `@text`); this arm uses the untyped
 *    `_setRaw`/`_getRaw` API so the spike needs no `experimentalDecorators` or Babel plugin changes.
 */

const FIELD_NOTES = tableName<FieldNoteModel>("field_notes");
const CHANGE_QUEUE = tableName<QueueModel>("change_queue");

const COL = {
  recordId: columnName("record_id"),
  projectId: columnName("project_id"),
  version: columnName("version"),
  baseVersion: columnName("base_version"),
  body: columnName("body"),
  status: columnName("status"),
  clientTimestamp: columnName("client_timestamp"),
  pending: columnName("pending"),
  sequence: columnName("sequence"),
};

class FieldNoteModel extends Model {
  static table = FIELD_NOTES;
}

class QueueModel extends Model {
  static table = CHANGE_QUEUE;
}

const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: "field_notes",
      columns: [
        { name: "record_id", type: "string", isIndexed: true },
        { name: "project_id", type: "string", isIndexed: true },
        { name: "version", type: "number" },
        { name: "body", type: "string" },
        { name: "status", type: "string" },
        { name: "client_timestamp", type: "string" },
        { name: "pending", type: "boolean" },
      ],
    }),
    tableSchema({
      name: "change_queue",
      columns: [
        { name: "record_id", type: "string", isIndexed: true },
        { name: "project_id", type: "string", isIndexed: true },
        { name: "base_version", type: "number" },
        { name: "body", type: "string" },
        { name: "status", type: "string" },
        { name: "client_timestamp", type: "string" },
        { name: "sequence", type: "number" },
      ],
    }),
  ],
});

function readString(model: Model, column: ReturnType<typeof columnName>): string {
  return String(model._getRaw(column) ?? "");
}

function readNumber(model: Model, column: ReturnType<typeof columnName>): number {
  return Number(model._getRaw(column) ?? 0);
}

export class WatermelonStore implements OfflineStore {
  readonly engine = "watermelondb";
  private db: Database | null = null;

  init(): Promise<void> {
    const adapter = new SQLiteAdapter({ schema, dbName: "ampm-field-notes-watermelon", jsi: true });
    this.db = new Database({ adapter, modelClasses: [FieldNoteModel, QueueModel] });
    return Promise.resolve();
  }

  async readNotes(projectId: string): Promise<LocalNote[]> {
    const rows = await this.notes.query(Q.where(COL.projectId, projectId)).fetch();
    return rows.map(toLocalNote).sort((a, b) => b.clientTimestamp.localeCompare(a.clientTimestamp));
  }

  async enqueue(projectId: string, draft: NoteDraft): Promise<void> {
    await this.database.write(async () => {
      const sequence = (await this.nextSequence()) + 1;
      await this.queue.create((row) => {
        row._setRaw(COL.recordId, draft.recordId);
        row._setRaw(COL.projectId, projectId);
        row._setRaw(COL.baseVersion, draft.baseVersion);
        row._setRaw(COL.body, draft.body);
        row._setRaw(COL.status, draft.status);
        row._setRaw(COL.clientTimestamp, draft.clientTimestamp);
        row._setRaw(COL.sequence, sequence);
      });
      await this.putNote(projectId, draft.recordId, draft.baseVersion, draft, true);
    });
  }

  async pending(projectId: string): Promise<QueuedMutation[]> {
    const rows = await this.queue.query(Q.where(COL.projectId, projectId)).fetch();
    return rows.map(toQueuedMutation).sort((a, b) => a.sequence - b.sequence);
  }

  async settle({ mutation, server }: SyncResolution): Promise<void> {
    await this.database.write(async () => {
      const rows = await this.queue
        .query(
          Q.where(COL.recordId, mutation.recordId),
          Q.where(COL.baseVersion, mutation.baseVersion),
        )
        .fetch();
      for (const row of rows) await row.markAsDeleted();
      const stillQueued = await this.queue
        .query(Q.where(COL.recordId, mutation.recordId))
        .fetchCount();
      await this.putNote(server.projectId, server.id, server.version, server, stillQueued > 0);
    });
  }

  async cacheServerNotes(notes: readonly FieldNoteView[]): Promise<void> {
    await this.database.write(async () => {
      for (const note of notes) {
        const stillQueued = await this.queue.query(Q.where(COL.recordId, note.id)).fetchCount();
        await this.putNote(note.projectId, note.id, note.version, note, stillQueued > 0);
      }
    });
  }

  async wipe(): Promise<void> {
    await this.database.write(async () => {
      await this.database.unsafeResetDatabase();
    });
  }

  private async putNote(
    projectId: string,
    recordId: string,
    version: number,
    source: { readonly body: string; readonly status: string; readonly clientTimestamp: string },
    pending: boolean,
  ): Promise<void> {
    const existing = await this.notes.query(Q.where(COL.recordId, recordId)).fetch();
    for (const row of existing) await row.markAsDeleted();
    await this.notes.create((row) => {
      row._setRaw(COL.recordId, recordId);
      row._setRaw(COL.projectId, projectId);
      row._setRaw(COL.version, version);
      row._setRaw(COL.body, source.body);
      row._setRaw(COL.status, source.status);
      row._setRaw(COL.clientTimestamp, source.clientTimestamp);
      row._setRaw(COL.pending, pending);
    });
  }

  private async nextSequence(): Promise<number> {
    const rows = await this.queue.query().fetch();
    return rows.reduce((max, row) => Math.max(max, readNumber(row, COL.sequence)), 0);
  }

  private get database(): Database {
    if (!this.db) throw new Error("WatermelonStore.init() must run before any other call");
    return this.db;
  }

  private get notes() {
    return this.database.get<FieldNoteModel>(FIELD_NOTES);
  }

  private get queue() {
    return this.database.get<QueueModel>(CHANGE_QUEUE);
  }
}

function toLocalNote(row: FieldNoteModel): LocalNote {
  return {
    id: readString(row, COL.recordId),
    projectId: readString(row, COL.projectId),
    version: readNumber(row, COL.version),
    body: readString(row, COL.body),
    status: fieldNoteStatus.parse(readString(row, COL.status)),
    clientTimestamp: readString(row, COL.clientTimestamp),
    pending: Boolean(row._getRaw(COL.pending)),
  };
}

function toQueuedMutation(row: QueueModel): QueuedMutation {
  return {
    sequence: readNumber(row, COL.sequence),
    recordId: readString(row, COL.recordId),
    baseVersion: readNumber(row, COL.baseVersion),
    body: readString(row, COL.body),
    status: fieldNoteStatus.parse(readString(row, COL.status)),
    clientTimestamp: readString(row, COL.clientTimestamp),
  };
}
