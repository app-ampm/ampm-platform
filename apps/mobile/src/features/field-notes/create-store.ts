import type { OfflineStore } from "./offline-store";
import { SqliteStore } from "./sqlite-store";

/**
 * SPIKE STAND-IN — picks the offline store for the platform. Native (iOS, Android) uses expo-sqlite:
 * persistent, runs in Expo Go. The web export resolves `create-store.web.ts` instead, so expo-sqlite
 * and its WebAssembly worker never enter the web bundle (a dynamic import does not keep a module out
 * of Metro's graph). See `offline-store`.
 */
export function createOfflineStore(): Promise<OfflineStore> {
  return Promise.resolve(new SqliteStore());
}
