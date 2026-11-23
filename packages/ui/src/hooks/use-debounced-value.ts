import { useEffect, useState } from "react";

/** How long a search box waits after the last keystroke before it asks the server. */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * The value once it has stopped changing for `delayMs`. A search field shows every keystroke at once
 * but queries only when the person pauses, so typing "Udaipur" sends one request instead of seven,
 * each counted against the caller's rate limit (D-149). Every change restarts the wait, and the
 * first render returns the value as it is, so a screen that opens with a query searches straight away.
 *
 *   const [query, setQuery] = useState("");
 *   const settledQuery = useDebouncedValue(query.trim());
 *   const hotels = useHotels({ q: settledQuery || undefined });
 */
export function useDebouncedValue<Value>(value: Value, delayMs = SEARCH_DEBOUNCE_MS): Value {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}
