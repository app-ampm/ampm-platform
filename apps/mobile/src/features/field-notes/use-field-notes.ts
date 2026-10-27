import { useApiClient } from "@ampm/api-client";
import {
  dedupeByIdempotency,
  fieldNoteList,
  fieldNoteUpsertResult,
  isAppError,
  orderForReplay,
  toUpsertBody,
  uuidv7,
} from "@ampm/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { createOfflineStore } from "./create-store";
import type { LocalNote, OfflineStore } from "./offline-store";

/** The one wedding the spike works with; a real sign-in resolves the user's assigned weddings. */
const DEMO_PROJECT_ID = "0192f3a0-7d3e-7b1a-9c2f-aaaaaaaaaaaa";
const notesPath = (projectId: string): string => `/spike/projects/${projectId}/field-notes`;

export interface FieldNotesController {
  readonly notes: readonly LocalNote[];
  readonly pendingCount: number;
  readonly isOnline: boolean;
  readonly isSyncing: boolean;
  readonly isLoading: boolean;
  readonly engine: string;
  readonly addNote: (body: string) => void;
  readonly sync: () => void;
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
  const syncingRef = useRef(false);
  const [notes, setNotes] = useState<readonly LocalNote[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [engine, setEngine] = useState("");

  const refresh = useCallback(async (store: OfflineStore) => {
    setNotes(await store.readNotes(DEMO_PROJECT_ID));
    setPendingCount((await store.pending(DEMO_PROJECT_ID)).length);
  }, []);

  const sync = useCallback(async () => {
    const store = storeRef.current;
    if (!store || syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);
    try {
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
      setIsOnline(true);
    } catch (error) {
      // A failed fetch means offline; the queue is kept and the next sync retries it.
      if (isAppError(error) && error.code === "network_error") setIsOnline(false);
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
      await refresh(store);
    }
  }, [api, refresh]);

  const addNote = useCallback(
    async (body: string) => {
      const store = storeRef.current;
      const text = body.trim();
      if (!store || text.length === 0) return;
      await store.enqueue(DEMO_PROJECT_ID, {
        recordId: uuidv7(),
        baseVersion: 0,
        body: text,
        status: "open",
        clientTimestamp: new Date().toISOString(),
      });
      await refresh(store);
      void sync();
    },
    [refresh, sync],
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      const store = await createOfflineStore();
      await store.init();
      if (!active) return;
      storeRef.current = store;
      setEngine(store.engine);
      await refresh(store);
      setIsLoading(false);
      void sync();
    })();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void sync();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, [refresh, sync]);

  return {
    notes,
    pendingCount,
    isOnline,
    isSyncing,
    isLoading,
    engine,
    addNote: (body) => void addNote(body),
    sync: () => void sync(),
  };
}
