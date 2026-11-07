import { act, renderHook } from "../test/render";
import { getAccessToken, setAccessToken, useIsSignedIn } from "./session";

beforeEach(() => {
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
