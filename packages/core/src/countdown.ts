/*
 * A wait shown as it counts down: the client sign-in's "Send a new code in 0:25" (D-147) and the hotel
 * form's resend and Retry-After waits (D-189 §3). Pure, so the apps and the site share one copy.
 */

/**
 * "0:25", "1:05": a wait in seconds as minutes and seconds.
 *
 * @example
 * formatCountdown(65); // "1:05"
 */
export function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function counted(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/**
 * "25 seconds", "1 minute 5 seconds": the same wait as a screen reader says it.
 *
 * @example
 * spokenCountdown(65); // "1 minute 5 seconds"
 */
export function spokenCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return counted(rest, "second");
  const whole = counted(minutes, "minute");
  return rest === 0 ? whole : `${whole} ${counted(rest, "second")}`;
}

/**
 * The whole seconds from `now` to a deadline (both in milliseconds), a part second counting as a whole
 * one, never below 0; 0 without a deadline.
 *
 * @example
 * secondsLeft(Date.now() + 1_500, Date.now()); // 2
 */
export function secondsLeft(deadline: number | null, now: number): number {
  if (deadline === null) return 0;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
