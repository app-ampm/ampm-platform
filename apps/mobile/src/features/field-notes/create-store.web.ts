import { MemoryStore } from "./memory-store";
import type { OfflineStore } from "./offline-store";

/**
 * SPIKE STAND-IN — the web export's offline store: the in-memory fallback. Metro resolves this file
 * for the web platform in place of `create-store.ts`, which keeps expo-sqlite (and its WebAssembly
 * worker, which Metro cannot bundle) out of the web graph. The browser client portals have no offline
 * mode (.claude/rules/offline.md covers the team app); the fallback only lets the spike screen render.
 */
export function createOfflineStore(): Promise<OfflineStore> {
  return Promise.resolve(new MemoryStore());
}
