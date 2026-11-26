import type { SectionEditor } from "./use-section-editor";

/*
 * The props a section's fields take, bound to the editor: the value, the change (a change the person
 * made, so the section saves once typing stops) and the message once the field was left.
 */

type Change = (event: { target: { value: string } }) => void;

/**
 * A text field's props for one string the section's fields hold.
 *
 * @example
 * <TextField label="City or town" {...textField(editor, id, fields.city, (f, city) => ({ ...f, city }))} />
 */
export function textField<F>(
  editor: SectionEditor<F>,
  id: string,
  value: string,
  set: (fields: F, value: string) => F,
): { id: string; value: string; onChange: Change; error: string | undefined } {
  return {
    id,
    value,
    onChange: (event) => editor.update((fields) => set(fields, event.target.value)),
    error: editor.errorOf(id),
  };
}

/**
 * A pill choice's props (ChoiceSegments) for one answer the section's fields hold.
 *
 * @example
 * <ChoiceSegments legend="Setting" options={…} {...choiceField(editor, id, row.setting, setSetting)} />
 */
export function choiceField<F>(
  editor: SectionEditor<F>,
  name: string,
  value: string,
  set: (fields: F, value: string) => F,
): { name: string; value: string; onChange: Change; error: string | undefined } {
  return {
    name,
    value,
    onChange: (event) => editor.update((fields) => set(fields, event.target.value)),
    error: editor.errorOf(name),
  };
}

/**
 * The rows with the one `isRow` picks changed.
 *
 * @example
 * withRow(fields.rows, (row) => row.rowId === rowId, (row) => ({ ...row, name }));
 */
export function withRow<R>(
  rows: readonly R[],
  isRow: (row: R) => boolean,
  change: (row: R) => R,
): readonly R[] {
  return rows.map((row) => (isRow(row) ? change(row) : row));
}
