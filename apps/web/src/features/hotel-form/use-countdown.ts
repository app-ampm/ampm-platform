import { useEffect, useState } from "react";
import { secondsLeft } from "@ampm/core";

/**
 * The whole seconds left until `deadline` (milliseconds on this device's clock; null for none), counted
 * down once a second and stopping at 0: the resend wait (D-189 §3) and any Retry-After. It is measured
 * against the clock, so a throttled background tab catches up when it is shown again. Only words change,
 * once a second, with nothing animated, so reduced motion has nothing to hold back.
 *
 *   const left = useCountdown(identity.resendAt); // 30, 29, … 0
 */
export function useCountdown(deadline: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadline === null) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= deadline) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline]);
  return secondsLeft(deadline, now);
}
