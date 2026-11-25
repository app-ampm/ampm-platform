import { act, renderHook } from "../../test/render";
import type { SentCode } from "./client-code-step.types";
import { useResendCountdown } from "./use-resend-countdown";

const SENT: SentCode = { expiresInSeconds: 300, resendAfterSeconds: 30 };
const NO_WAIT: SentCode = { expiresInSeconds: 300, resendAfterSeconds: 0 };

/**
 * The countdown's own once-a-second timers, started and still running. React and the renderer keep
 * timers of their own, so the fake clock's total count says nothing about this hook's.
 */
function countdownTimers() {
  const start = jest.spyOn(globalThis, "setInterval");
  const stop = jest.spyOn(globalThis, "clearInterval");
  const started = (): unknown[] =>
    start.mock.calls.flatMap((call, index) =>
      call[1] === 1000 ? [start.mock.results[index]?.value] : [],
    );
  const running = (): unknown[] =>
    started().filter((id) => !stop.mock.calls.some((call) => call[0] === id));
  return { started, running };
}

describe("useResendCountdown", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("counts the wait down once a second and stops its timer at 0", async () => {
    const timers = countdownTimers();
    const { result } = await renderHook(() => useResendCountdown(SENT));
    expect(result.current).toBe(30);
    await act(() => jest.advanceTimersByTime(1000));
    expect(result.current).toBe(29);
    await act(() => jest.advanceTimersByTime(29_000));
    expect(result.current).toBe(0);
    expect(timers.started()).toHaveLength(1);
    expect(timers.running()).toEqual([]);
  });

  it("goes by the clock, so a timer paused meanwhile catches up when it runs again", async () => {
    const { result } = await renderHook(() => useResendCountdown(SENT));
    // The app sat in the background for 20 seconds without a tick, then the next tick came.
    jest.setSystemTime(Date.now() + 20_000);
    await act(() => jest.advanceTimersByTime(1000));
    expect(result.current).toBe(9);
  });

  it("starts the wait again for a new code", async () => {
    const { result, rerender } = await renderHook(
      ({ sent }: { readonly sent: SentCode }) => useResendCountdown(sent),
      { initialProps: { sent: SENT } },
    );
    await act(() => jest.advanceTimersByTime(30_000));
    expect(result.current).toBe(0);
    await rerender({ sent: { ...SENT } });
    expect(result.current).toBe(30);
    await act(() => jest.advanceTimersByTime(2000));
    expect(result.current).toBe(28);
  });

  it("clears its timer when the code step goes away", async () => {
    const timers = countdownTimers();
    const { unmount } = await renderHook(() => useResendCountdown(SENT));
    expect(timers.running()).toHaveLength(1);
    await unmount();
    expect(timers.running()).toEqual([]);
  });

  it("runs no timer when no wait is asked for (the dev demo)", async () => {
    const timers = countdownTimers();
    const { result } = await renderHook(() => useResendCountdown(NO_WAIT));
    expect(result.current).toBe(0);
    expect(timers.started()).toEqual([]);
  });
});
