import { useState } from "react";

/** A value and the person it belongs to (undefined until the page knows who is signed in). */
interface Owned<T> {
  readonly owner: string | undefined;
  readonly value: T;
}

/**
 * State that belongs to the person signed in (D-190 §5, review fix C2): what they chose on a page (7.4,
 * 7.5, an unsent correction) is kept across a new code entered in place while the same person signs in
 * again, and starts again from `initial` when someone else does. People are told apart by their id on the
 * request (`me.personId`), never by name. A value set before the page knew who was signed in is theirs.
 *
 *   const [fields, updateFields] = usePersonScoped(site.flow.me.data?.personId, EMPTY_DECLARATIONS);
 *   updateFields((current) => ({ ...current, accuracyAccepted: true }));
 */
export function usePersonScoped<T>(
  personId: string | undefined,
  initial: T,
): readonly [T, (update: (current: T) => T) => void] {
  const [held, setHeld] = useState<Owned<T>>({ owner: personId, value: initial });
  let current = held;
  if (personId !== undefined && held.owner !== personId) {
    current = { owner: personId, value: held.owner === undefined ? held.value : initial };
    // Kept from this render on, as React allows a component to adjust its own state while it renders.
    setHeld(current);
  }
  const update = (change: (value: T) => T) =>
    setHeld((owned) => ({ owner: owned.owner, value: change(owned.value) }));
  return [current.value, update];
}
