import { textField } from "./bindings";
import { withField } from "./field-values";
import { propertyId, type PropertyFields } from "./property.form";
import type { SectionEditor } from "./use-section-editor";

/** The property section's editor. */
export type PropertyEditor = SectionEditor<PropertyFields>;

/** The property section's own strings, each one field. */
export type PropertyTextKey =
  | "name"
  | "groupName"
  | "street"
  | "locality"
  | "city"
  | "state"
  | "postalCode"
  | "mapsUrl"
  | "website"
  | "accessNotes"
  | "starCategory"
  | "description"
  | "facilitiesOther";

/**
 * A field's props for one of the property section's strings.
 *
 * @example
 * <TextField label="City or town" {...bindProperty(editor, "city")} />
 */
export const bindProperty = (editor: PropertyEditor, key: PropertyTextKey) =>
  textField(editor, propertyId(key), editor.fields[key], (fields, value) =>
    withField(fields, key, value),
  );
