import type { RefCallback } from "react";

import type { ProfileFieldKey } from "./hotel-profile.errors";
import type { HotelProfileDraft, HotelProfileErrors } from "./hotel-profile.form";
import type { FieldNode } from "./use-field-focus";

/*
 * What every part of the profile editor takes (the identity, details, location, food and booking terms
 * fields), and the bindings that wire one of its text fields to the draft: its value and setter, and
 * for a checked field its error on show and the ref a blocked save focuses.
 */

/** Merge a change into the draft. */
export type ProfilePatch = (next: Partial<HotelProfileDraft>) => void;

export interface ProfileFieldsProps {
  readonly draft: HotelProfileDraft;
  readonly patch: ProfilePatch;
  /** The errors on show: none until a save has been blocked once. */
  readonly errors: Partial<HotelProfileErrors>;
  /** The ref to give a checked field's Input, so a blocked save can focus it. */
  readonly fieldRef: (key: ProfileFieldKey) => RefCallback<FieldNode>;
}

/** A draft field held as free text (a number or a line list typed as text included). */
export type ProfileTextKey = {
  [K in keyof HotelProfileDraft]-?: string extends HotelProfileDraft[K] ? K : never;
}[keyof HotelProfileDraft];

export interface TextBinding {
  readonly value: string;
  readonly onChangeText: (value: string) => void;
}

export interface CheckedBinding extends TextBinding {
  readonly errorText: string | undefined;
  readonly ref: RefCallback<FieldNode>;
}

/**
 * A text field's value and setter, to spread on its Input.
 *
 * @example
 * <Input label="City" {...textField(props, "city")} testID="hotel-city" />
 */
export function textField(props: ProfileFieldsProps, key: ProfileTextKey): TextBinding {
  return {
    value: props.draft[key],
    onChangeText: (value) => props.patch({ [key]: value }),
  };
}

/**
 * A checked text field's value, setter, error on show and focus ref, to spread on its Input.
 *
 * @example
 * <Input label="PIN code" {...checkedField(props, "postalCode")} testID="hotel-postal-code" />
 */
export function checkedField(
  props: ProfileFieldsProps,
  key: ProfileTextKey & ProfileFieldKey,
): CheckedBinding {
  return { ...textField(props, key), errorText: props.errors[key], ref: props.fieldRef(key) };
}
