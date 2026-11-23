import { useRef, type ComponentRef, type RefCallback } from "react";
import type { TextInput } from "react-native";

/** The text box behind an `Input`, as its `ref` receives it. */
export type FieldNode = ComponentRef<typeof TextInput>;

export interface FieldFocus<K extends string> {
  /** The ref to give a field's `Input`, so the form can focus the field by its key. */
  readonly fieldRef: (key: K) => RefCallback<FieldNode>;
  /** Moves focus to the field when it is mounted; a field without a text box is left alone. */
  readonly focusField: (key: K) => void;
}

/**
 * Focus a form's fields by key: each `Input` registers its text box under its key, and a blocked save
 * moves focus to the first field to fix. On the web workspace focusing scrolls the field into view
 * inside the sheet, and a screen reader reads the field with its error.
 *
 *   const focus = useFieldFocus<"name" | "city">();
 *   <Input label="City" ref={focus.fieldRef("city")} … />
 *   focus.focusField("city");
 */
export function useFieldFocus<K extends string>(): FieldFocus<K> {
  // Read and written only inside the callbacks, never during render.
  const nodes = useRef<Map<K, FieldNode> | null>(null);
  const registry = (): Map<K, FieldNode> => {
    nodes.current ??= new Map<K, FieldNode>();
    return nodes.current;
  };
  return {
    fieldRef: (key) => (node) => {
      if (node) registry().set(key, node);
      else registry().delete(key);
    },
    focusField: (key) => registry().get(key)?.focus(),
  };
}
