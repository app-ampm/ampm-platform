/**
 * @ampm/web-forms: the public website's plain-HTML form fields (D-175), shared by the contact form and
 * the hotel information form. Presentational DOM controls styled with the kit's recipes from
 * `@ampm/ui/styles`: no fetching, no upload logic, no validation of their own. The forms keep their
 * state in `useState`, check it with pure `*.form` helpers and the Zod schemas from `@ampm/core`, and
 * pass each field its value, its change handler and its error. Every word is a prop.
 *
 *   import { CheckboxField, CodeField, MobileField, SelectField, TextField } from "@ampm/web-forms";
 *
 *   <TextField id="fullName" label="Your name" value={fields.fullName} onChange={…} required
 *     autoComplete="name" error={errors.fullName} />
 *   <MobileField id="mobile" label="Mobile number" value={fields.mobile} onChange={…} required />
 *   <CodeField id="code" label="Your 6-digit code" value={code} onChange={setCode} />
 *
 * The hotel information form adds (D-190 §5): a number with its unit (NumberUnitField), a choice that can
 * be cleared back to unanswered (ChoiceSegments' `clearLabel`) or say what each answer means (its
 * `description`), repeatable rows each in a fieldset with its legend (RepeatableFieldsets) and a chip group
 * with Other (ChipGroupField).
 */
export { CheckboxField } from "./checkbox-field";
export type { CheckboxFieldProps } from "./checkbox-field";
export { ChipGroupField } from "./chip-group-field";
export type { ChipGroupFieldProps, ChipGroupOther } from "./chip-group-field";
export { ChoiceSegments } from "./choice-segments";
export type { ChoiceOption, ChoiceSegmentsProps } from "./choice-segments";
export type { ChoiceLook } from "./choice-segments.styles";
export { CodeField } from "./code-field";
export type { CodeFieldProps } from "./code-field";
export { CODE_LENGTH, codeDigits, codeInputHandler } from "./code-field.value";
export { FieldMessage, fieldAria } from "./field-message";
export type { FieldMessageOptions } from "./field-message";
export { FieldShell } from "./field-shell";
export type { FieldShellProps } from "./field-shell";
export { MOBILE_PREFIX, MobileField } from "./mobile-field";
export type { MobileFieldProps } from "./mobile-field";
export { NumberUnitField, unitSelectId } from "./number-unit-field";
export type { NumberUnitFieldProps } from "./number-unit-field";
export { peerFocusRingStyles } from "./peer-focus.styles";
export { RepeatableFieldsets, focusTargetAfter, rowFieldsetId } from "./repeatable-fieldsets";
export type { FocusTarget, RepeatableFieldsetsProps, RepeatableRow } from "./repeatable-fieldsets";
export { SelectField } from "./select-field";
export type { SelectFieldProps, SelectOption } from "./select-field";
export { TextAreaField } from "./text-area-field";
export type { TextAreaFieldProps } from "./text-area-field";
export { TextField } from "./text-field";
export type { TextFieldProps } from "./text-field";
