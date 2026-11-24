import type { HotelImportKind } from "@ampm/core";
import { SegmentedControl, Stack, Text } from "@ampm/ui";

import { IMPORT_KIND_COPY, isImportKind } from "./hotel-import.kinds";

export interface ImportKindPickerProps {
  /** The kinds this staff member may import, in the picker's order. */
  readonly kinds: readonly HotelImportKind[];
  readonly value: HotelImportKind;
  readonly onChange: (kind: HotelImportKind) => void;
}

/**
 * What the file imports (TW-25): Hotels, Rooms or Venues, as pill segments spanning the column; only the
 * kinds the staff member's grants allow. Changing it locks Import until the file is validated as the
 * new kind.
 *
 *   <ImportKindPicker kinds={kinds} value={kind} onChange={changeKind} />
 */
export function ImportKindPicker({ kinds, value, onChange }: ImportKindPickerProps) {
  return (
    <Stack gap={2}>
      <Text variant="eyebrow" tone="muted">
        What to import
      </Text>
      <SegmentedControl
        options={kinds.map((kind) => ({ value: kind, label: IMPORT_KIND_COPY[kind].label }))}
        value={value}
        onChange={(next) => {
          if (isImportKind(next)) onChange(next);
        }}
        fullWidth
        accessibilityLabel="What to import"
        testID="hotel-import-kind"
      />
    </Stack>
  );
}
