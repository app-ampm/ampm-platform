import { ChoiceSegments, TextAreaField, TextField } from "@ampm/web-forms";

import { choiceField, textField } from "./bindings";
import { asksMinRooms, bookingId, type BookingTermsFields } from "./booking-terms.form";
import { PAIR_STYLES } from "./field-group";
import { withField } from "./field-values";
import { BOOKING_FIELDS_COPY as COPY, COMMON_FIELDS_COPY as COMMON } from "./section-fields-copy";
import type { SectionEditor } from "./use-section-editor";

type Editor = SectionEditor<BookingTermsFields>;
type TextKey = "minRooms" | "minNights" | "notes";

/** "Do weddings need a full buyout?": Yes is required, No not required, or Depends. */
const BUYOUT = [
  { value: "required", label: COMMON.yes },
  { value: "not_required", label: COMMON.no },
  { value: "depends", label: COMMON.depends },
];

/** "Can several functions run at once?": Yes is allowed, No not allowed, or Depends. */
const PARALLEL = [
  { value: "allowed", label: COMMON.yes },
  { value: "not_allowed", label: COMMON.no },
  { value: "depends", label: COMMON.depends },
];

const bind = (editor: Editor, key: TextKey) =>
  textField(editor, bookingId(key), editor.fields[key], (fields, value) =>
    withField(fields, key, value),
  );

/**
 * Booking terms (plan §5.1: 2.3 and 4.1 asked once, 4.2, 4.3; D-190 §2): a full buyout (Yes, No or
 * Depends, which can be cleared) and, unless every wedding needs one, the fewest rooms without it; the
 * fewest nights; functions side by side; notes. INTERNAL: couples never see these.
 *
 *   <BookingTermsSection editor={editor} />
 */
export function BookingTermsSection({ editor }: { readonly editor: Editor }) {
  const { fields } = editor;
  return (
    <>
      <ChoiceSegments
        legend={COPY.buyout}
        options={BUYOUT}
        look="soft"
        clearLabel={COMMON.clear}
        {...choiceField(editor, bookingId("buyout"), fields.buyout, (all, buyout) =>
          withField(all, "buyout", buyout),
        )}
      />
      <div className={PAIR_STYLES}>
        {asksMinRooms(fields.buyout) ? (
          <TextField label={COPY.minRooms} {...bind(editor, "minRooms")} inputMode="numeric" />
        ) : null}
        <TextField label={COPY.minNights} {...bind(editor, "minNights")} inputMode="numeric" />
      </div>
      <ChoiceSegments
        legend={COPY.parallel}
        options={PARALLEL}
        look="soft"
        clearLabel={COMMON.clear}
        {...choiceField(editor, bookingId("parallel"), fields.parallel, (all, parallel) =>
          withField(all, "parallel", parallel),
        )}
      />
      <TextAreaField label={COPY.notes} rows={3} {...bind(editor, "notes")} />
    </>
  );
}
