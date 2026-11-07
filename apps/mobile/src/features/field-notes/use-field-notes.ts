import { useApiClient, type ApiClient } from "@ampm/api-client";
import {
  dedupeByIdempotency,
  fieldNoteList,
  fieldNoteUpsertResult,
  isAppError,
  orderForReplay,
  toUpsertBody,
  uuidv7,
} from "@ampm/core";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { AppState } from "react-native";

import { createOfflineStore } from "./create-store";
import type { LocalNote, NoteDraft, OfflineStore } from "./offline-store";

/** The one wedding the spike works with; a real sign-in resolves the user's assigned weddings. */
const DEMO_PROJECT_ID = "0192f3a0-7d3e-7b1a-9c2f-aaaaaaaaaaaa";
const notesPath = (projectId: string): string => `/spike/projects/${projectId}/field-notes`;

export interface FieldNotesController {
  readonly notes: readonly LocalNote[];
  readonly pendingCount: number;
  readonly isOnline: boolean;
  readonly isSyncing: boolean;
  /**
   * The last sync reached the API and was refused or failed (a role that may not send field notes, a
   * wedding outside the person's): the screen says so, never "Synced", and the queue is kept.
   */
  readonly hasSyncFailed: boolean;
  readonly isLoading: boolean;
  readonly engine: string;
  readonly addNote: (body: string) => void;
  readonly sync: () => void;
}

type NotesState = Omit<FieldNotesController, "addNote" | "sync">;
type Patch = (changes: Partial<NotesState>) => void;
type StoreRef = RefObject<OfflineStore | null>;

const INITIAL_STATE: NotesState = {
  notes: [],
  pendingCount: 0,
  isOnline: true,
  isSyncing: false,
  hasSyncFailed: false,
  isLoading: true,
  engine: "",
};

/** What the screen shows from the local store: the notes and how many writes still wait. */
async function snapshot(store: OfflineStore): Promise<Pick<NotesState, "notes" | "pendingCount">> {
  return {
    notes: await store.readNotes(DEMO_PROJECT_ID),
    pendingCount: (await store.pending(DEMO_PROJECT_ID)).length,
  };
}

function draftNote(body: string): NoteDraft {
  return {
    recordId: uuidv7(),
    baseVersion: 0,
    body,
    status: "open",
    clientTimestamp: new Date().toISOString(),
  };
}

/** Replays the queue in order, one write at a time, then refreshes the local cache from the server. */
async function replayQueue(api: ApiClient, store: OfflineStore): Promise<void> {
  const queue = dedupeByIdempotency(orderForReplay(await store.pending(DEMO_PROJECT_ID)));
  for (const mutation of queue) {
    const result = await api.request(notesPath(DEMO_PROJECT_ID), {
      method: "POST",
      body: toUpsertBody(mutation),
      schema: fieldNoteUpsertResult,
    });
    await store.settle({ mutation, server: result.note, outcome: result.outcome });
  }
  const list = await api.get(notesPath(DEMO_PROJECT_ID), fieldNoteList);
  await store.cacheServerNotes(list.items);
}

/**
 * One sync at a time. A fetch that cannot reach the API means offline; any other failure (forbidden,
 * not found, a server error) is a failed sync the screen shows (offline.md: a rejected change is shown,
 * never dropped silently). Either way the queue is kept and the next sync retries it.
 */
function useSync(api: ApiClient, storeRef: StoreRef, patch: Patch): () => Promise<void> {
  const syncingRef = useRef(false);
  return useCallback(async () => {
    const store = storeRef.current;
    if (!store || syncingRef.current) return;
    syncingRef.current = true;
    patch({ isSyncing: true });
    try {
      await replayQueue(api, store);
      patch({ isOnline: true, hasSyncFailed: false });
    } catch (error) {
      if (isAppError(error) && error.code === "network_error") patch({ isOnline: false });
      else patch({ isOnline: true, hasSyncFailed: true });
    } finally {
      syncingRef.current = false;
      patch({ isSyncing: false, ...(await snapshot(store)) });
    }
  }, [api, storeRef, patch]);
}

/** Opens the store once, syncs on start and whenever the app returns to the foreground. */
function useStoreLifecycle(storeRef: StoreRef, patch: Patch, sync: () => Promise<void>): void {
  useEffect(() => {
    let active = true;
    void (async () => {
      const store = await createOfflineStore();
      await store.init();
      if (!active) return;
      storeRef.current = store;
      patch({ engine: store.engine, isLoading: false, ...(await snapshot(store)) });
      void sync();
    })();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void sync();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [storeRef, patch, sync]);
}

/**
 * SPIKE STAND-IN — the team app's offline field notes (.claude/rules/offline.md): reads come from the
 * local store first; a new note is written locally and queued; the queue replays in order on
 * reconnection and on app foreground; the interface always knows whether it is offline and how many
 * changes are pending. The network state is inferred from whether a send reaches the API, so the
 * spike needs no extra connectivity dependency.
 */
export function useFieldNotes(): FieldNotesController {
  const api = useApiClient();
  const storeRef = useRef<OfflineStore | null>(null);
  const [state, setState] = useState<NotesState>(INITIAL_STATE);
  const patch = useCallback<Patch>((changes) => setState((s) => ({ ...s, ...changes })), []);
  const sync = useSync(api, storeRef, patch);
  const addNote = useCallback(
    async (body: string) => {
      const store = storeRef.current;
      const text = body.trim();
      if (!store || text.length === 0) return;
      await store.enqueue(DEMO_PROJECT_ID, draftNote(text));
      patch(await snapshot(store));
      void sync();
    },
    [patch, sync],
  );
  useStoreLifecycle(storeRef, patch, sync);
  return { ...state, addNote: (body) => void addNote(body), sync: () => void sync() };
}
