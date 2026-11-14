import { act, renderHook } from "../test/render";
import { getAccessToken, restoreLocalSession, setAccessToken, useIsSignedIn } from "./session";

/** A minimal in-memory Storage so the web-only dev-token persistence can be exercised under Jest (node). */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    value: memoryStorage(),
    configurable: true,
    writable: true,
  });
  setAccessToken(null);
});

describe("useIsSignedIn", () => {
  it("renders again each time the token is stored or dropped", async () => {
    const { result } = await renderHook(() => useIsSignedIn());
    expect(result.current).toBe(false);
    await act(() => setAccessToken("signed-in-token"));
    expect(result.current).toBe(true);
    expect(getAccessToken()).toBe("signed-in-token");
    await act(() => setAccessToken(null));
    expect(result.current).toBe(false);
    expect(getAccessToken()).toBeNull();
  });
});

describe("restoreLocalSession", () => {
  it("restores a persisted dev token after a refresh and re-renders readers", async () => {
    // A prior dev-login persisted its token to web storage; the in-memory token is empty, as after a refresh.
    globalThis.localStorage.setItem("ampm.devToken", "persisted-token");
    const { result } = await renderHook(() => useIsSignedIn());
    expect(result.current).toBe(false);
    await act(() => restoreLocalSession());
    expect(result.current).toBe(true);
    expect(getAccessToken()).toBe("persisted-token");
  });

  it("is a no-op when nothing was persisted", () => {
    restoreLocalSession();
    expect(getAccessToken()).toBeNull();
  });
});
