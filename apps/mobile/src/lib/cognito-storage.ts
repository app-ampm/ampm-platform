import * as SecureStore from "expo-secure-store";

/**
 * Amplify's token store backed by the device keychain (`expo-secure-store`), so Cognito refresh and
 * access tokens never touch AsyncStorage or disk in clear text (security.md, offline.md). The shape
 * matches Amplify's `KeyValueStorageInterface` (set via `cognitoUserPoolsTokenProvider.setKeyValueStorage`).
 *
 * Native only: on the web export Amplify keeps its own default storage, so this is never constructed
 * there (SecureStore is unavailable on web). SecureStore keys allow only `[A-Za-z0-9._-]`, but Amplify's
 * token keys embed the username (an email, with `@`), so every key is hex-encoded to a safe form; since
 * SecureStore cannot enumerate, an index key records the stored keys so `clear()` can remove them all.
 */
const INDEX_KEY = "ampm_cognito_keys";

function encodeKey(key: string): string {
  let out = "ampm_";
  for (let i = 0; i < key.length; i += 1) out += key.charCodeAt(i).toString(16).padStart(4, "0");
  return out;
}

async function readIndex(): Promise<readonly string[]> {
  const raw = await SecureStore.getItemAsync(INDEX_KEY);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === "string") : [];
  } catch {
    return [];
  }
}

export class SecureKeyValueStorage {
  async setItem(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(encodeKey(key), value);
    const index = await readIndex();
    if (!index.includes(key)) {
      await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify([...index, key]));
    }
  }

  async getItem(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(encodeKey(key));
  }

  async removeItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(encodeKey(key));
    const index = await readIndex();
    if (index.includes(key)) {
      await SecureStore.setItemAsync(INDEX_KEY, JSON.stringify(index.filter((k) => k !== key)));
    }
  }

  async clear(): Promise<void> {
    const index = await readIndex();
    await Promise.all(index.map((key) => SecureStore.deleteItemAsync(encodeKey(key))));
    await SecureStore.deleteItemAsync(INDEX_KEY);
  }
}
