import { createContext, useContext, type ReactNode } from "react";

const ReadOnlyContext = createContext(false);

/**
 * Makes the fields inside read-only (D-190 §5, review fix E7), in place of `<fieldset disabled>`: text
 * fields stay focusable, so their text can be selected and copied, while choices, ticks, chips and lists
 * cannot change, and Clear, Add and Remove are not offered. A hotel form submitted while a section was
 * open keeps the person's unsaved text on screen this way, for them to copy into a correction.
 *
 *   <ReadOnlyFields isReadOnly={editor.isReadOnly}>{questions}</ReadOnlyFields>
 */
export function ReadOnlyFields({
  isReadOnly,
  children,
}: {
  readonly isReadOnly: boolean;
  readonly children: ReactNode;
}) {
  return <ReadOnlyContext.Provider value={isReadOnly}>{children}</ReadOnlyContext.Provider>;
}

/**
 * Whether the fields around are read-only ({@link ReadOnlyFields}): a field's own controls follow it.
 *
 *   const isReadOnly = useIsReadOnly();
 */
export function useIsReadOnly(): boolean {
  return useContext(ReadOnlyContext);
}
