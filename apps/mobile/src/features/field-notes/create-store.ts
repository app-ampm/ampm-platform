import { Platform } from "react-native";

import type { OfflineStore } from "./offline-store";

/**
 * SPIKE STAND-IN — picks the offline store for the platform. Native uses expo-sqlite (persistent,
 * runs in Expo Go); the Expo web export uses the in-memory fallback. The native module is loaded
 * lazily with a dynamic import so the web bundle never evaluates it. See `offline-store`.
 */
export async function createOfflineStore(): Promise<OfflineStore> {
  if (Platform.OS === "web") {
    const { MemoryStore } = await import("./memory-store");
    return new MemoryStore();
  }
  const { SqliteStore } = await import("./sqlite-store");
  return new SqliteStore();
}
