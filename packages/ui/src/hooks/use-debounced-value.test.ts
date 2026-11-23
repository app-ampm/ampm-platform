import { act, renderHook } from "../test/render";
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "./use-debounced-value";

interface HookProps {
  readonly value: string;
}

function renderDebounced(initialProps: HookProps, delayMs?: number) {
  return renderHook(({ value }: HookProps) => useDebouncedValue(value, delayMs), {
    initialProps,
  });
}

describe("useDebouncedValue", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("returns the first value at once, so a screen opened with a query searches straight away", async () => {
    const { result } = await renderDebounced({ value: "Udaipur" });
    expect(result.current).toBe("Udaipur");
  });

  it("holds the settled value while the person types, then takes the last one after the pause", async () => {
    const { result, rerender } = await renderDebounced({ value: "" });
    await rerender({ value: "U" });
    await rerender({ value: "Ud" });
    await rerender({ value: "Uda" });
    await act(() => jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1));
    expect(result.current).toBe("");
    await act(() => jest.advanceTimersByTime(1));
    expect(result.current).toBe("Uda");
  });

  it("restarts the wait on every change, so a steady typist never settles on a half-typed word", async () => {
    const { result, rerender } = await renderDebounced({ value: "" });
    await rerender({ value: "G" });
    await act(() => jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 50));
    await rerender({ value: "Go" });
    await act(() => jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 50));
    expect(result.current).toBe("");
    await act(() => jest.advanceTimersByTime(50));
    expect(result.current).toBe("Go");
  });

  it("waits for the delay a caller passes instead of the search default", async () => {
    const { result, rerender } = await renderDebounced({ value: "" }, 1000);
    await rerender({ value: "Jaipur" });
    await act(() => jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    expect(result.current).toBe("");
    await act(() => jest.advanceTimersByTime(1000 - SEARCH_DEBOUNCE_MS));
    expect(result.current).toBe("Jaipur");
  });
});
