import { useEffect, useState } from "react";

import type { SentCode } from "./client-code-step.types";

/** "0:25", "1:05": the wait as "Send a new code" shows it. */
export function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function counted(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** "25 seconds", "1 minute 5 seconds": the same wait as a screen reader says it. */
export function spokenCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return counted(rest, "second");
  const whole = counted(minutes, "minute");
  return rest === 0 ? whole : `${whole} ${counted(rest, "second")}`;
}

/**
 * The seconds left before another code may be asked for: the sent code's `resendAfterSeconds`, counted
 * down once a second from when it arrived; a new code starts the count again. It is measured against
 * the clock, so a timer paused meanwhile (an app in the background, a throttled browser tab) catches up
 * when it resumes, and it stops at 0. Only the words change, once a second, with nothing animated, so
 * reduced motion has nothing to hold back.
 *
 *   const left = useResendCountdown(sent); // 30, 29, … 0
 */
export function useResendCountdown(sent: SentCode): number {
  const [elapsed, setElapsed] = useState({ sent, seconds: 0 });
  const seconds = elapsed.sent === sent ? elapsed.seconds : 0;
  const left = Math.max(0, sent.resendAfterSeconds - seconds);
  const counting = left > 0;
  useEffect(() => {
    if (!counting) return undefined;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setElapsed({ sent, seconds: Math.floor((Date.now() - startedAt) / 1000) });
    }, 1000);
    return () => clearInterval(timer);
  }, [sent, counting]);
  return left;
}
