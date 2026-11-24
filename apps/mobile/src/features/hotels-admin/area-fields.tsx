import type { RefCallback } from "react";

import { Input } from "@ampm/ui";

import { DERIVED_SQM_HINT, isSqmDerived, shownSqm, type AreaRules } from "./hotel-area.form";
import type { FieldNode } from "./use-field-focus";

/** One of an area's boxes as its form binds it: the draft text, its setter, its error on show, its ref. */
export interface AreaFieldBinding {
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly errorText: string | undefined;
  readonly ref?: RefCallback<FieldNode> | undefined;
}

export interface AreaFieldsProps {
  /** "Size (m²)". */
  readonly sqmLabel: string;
  /** "Size (sq ft)". */
  readonly sqftLabel: string;
  readonly sqm: AreaFieldBinding;
  readonly sqft: AreaFieldBinding;
  readonly rules: AreaRules;
  readonly sqmTestID: string;
  readonly sqftTestID: string;
}

/**
 * An area in m² and in sq ft (D-178): a room's size, a venue's area or pre-function area, a hotel's
 * event space. While the sq ft is filled, the m² box shows the figure worked out from it, read-only,
 * with the hint "Worked out from sq ft"; with the sq ft empty, the m² is typed (and what was typed comes
 * back when the sq ft is emptied). One component, so the four areas never drift apart.
 *
 *   <AreaFields sqmLabel="Area (m²)" sqftLabel="Area (sq ft)" sqm={…} sqft={…} rules={VENUE_AREA}
 *     sqmTestID="venue-area" sqftTestID="venue-area-sqft" />
 */
export function AreaFields({
  sqmLabel,
  sqftLabel,
  sqm,
  sqft,
  rules,
  sqmTestID,
  sqftTestID,
}: AreaFieldsProps) {
  const derived = isSqmDerived(sqft.value);
  return (
    <>
      <Input
        label={sqmLabel}
        value={shownSqm(sqm.value, sqft.value, rules)}
        onChangeText={sqm.onChangeText}
        disabled={derived}
        helpText={derived ? DERIVED_SQM_HINT : undefined}
        errorText={derived ? undefined : sqm.errorText}
        ref={sqm.ref}
        keyboardType="number-pad"
        testID={sqmTestID}
      />
      <Input
        label={sqftLabel}
        value={sqft.value}
        onChangeText={sqft.onChangeText}
        errorText={sqft.errorText}
        ref={sqft.ref}
        keyboardType="number-pad"
        testID={sqftTestID}
      />
    </>
  );
}
