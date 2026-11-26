import { TextField } from "@ampm/web-forms";

import { QuietLine } from "../form-parts";
import { textField } from "./bindings";
import { factSheetId, type FactSheetFields } from "./fact-sheet.form";
import { withField } from "./field-values";
import { FACT_SHEET_FIELDS_COPY as COPY } from "./section-fields-copy";
import type { SectionEditor } from "./use-section-editor";

/**
 * Fact sheet, photos and floor plans (plan §5.1, upload field 1; D-190 §2): for now when the fact sheet
 * was last updated, as a month; its uploads, the menus', the photos' and the floor plans' arrive in
 * Slice 9, so there is no upload control yet.
 *
 *   <FactSheetSection editor={editor} />
 */
export function FactSheetSection({ editor }: { readonly editor: SectionEditor<FactSheetFields> }) {
  return (
    <>
      <TextField
        label={COPY.factSheetAsOf}
        help={COPY.factSheetAsOfHelp}
        type="month"
        {...textField(
          editor,
          factSheetId("factSheetAsOf"),
          editor.fields.factSheetAsOf,
          (fields, month) => withField(fields, "factSheetAsOf", month),
        )}
      />
      <QuietLine>{COPY.uploadsSoon}</QuietLine>
    </>
  );
}
