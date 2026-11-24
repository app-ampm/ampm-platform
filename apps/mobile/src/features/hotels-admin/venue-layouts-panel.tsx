import { VENUE_OTHER_LAYOUT_NAME_MAX, VENUE_OTHER_LAYOUTS_MAX } from "@ampm/core";
import { Button, Divider, Input, Row, Stack, Text } from "@ampm/ui";

import { FieldAlert } from "./field-alert";
import { ProfileSection } from "./hotel-profile-section";
import type { VenueFieldsProps } from "./use-venue-form";
import {
  canAddLayout,
  layoutRowErrors,
  layoutsListError,
  newLayoutDraft,
  type LayoutDraft,
  type LayoutRowErrors,
} from "./venue-layouts.form";

const NO_ERRORS: LayoutRowErrors = { layout: undefined, max: undefined, min: undefined };

interface LayoutRowProps {
  readonly row: LayoutDraft;
  readonly index: number;
  readonly errors: LayoutRowErrors;
  readonly onChange: (row: LayoutDraft) => void;
  readonly onRemove: () => void;
}

/** A layout's guests: the most it takes and, for a range, the fewest, side by side. */
function LayoutGuests({
  row,
  errors,
  onChange,
  testID,
}: Omit<LayoutRowProps, "index" | "onRemove"> & {
  readonly testID: string;
}) {
  return (
    <Row gap={3}>
      <Input
        label="Most guests"
        value={row.max}
        onChangeText={(max) => onChange({ ...row, max })}
        errorText={errors.max}
        keyboardType="number-pad"
        className="flex-1"
        testID={`${testID}-max`}
      />
      <Input
        label="Fewest guests"
        helpText="Optional, for a range"
        value={row.min}
        onChangeText={(min) => onChange({ ...row, min })}
        errorText={errors.min}
        keyboardType="number-pad"
        className="flex-1"
        testID={`${testID}-min`}
      />
    </Row>
  );
}

/**
 * One layout: its number with a remove button named after it, its name, and its guests, named as a group
 * for screen readers.
 */
function LayoutRow({ row, index, errors, onChange, onRemove }: LayoutRowProps) {
  const title = `Layout ${index + 1}`;
  const testID = `venue-layout-${index}`;
  return (
    <Stack gap={3} role="group" aria-label={title} testID={testID}>
      <Row gap={2} align="center" justify="between">
        <Text variant="label" tone="muted">
          {title}
        </Text>
        <Button
          variant="ghost"
          size="sm"
          icon="trash"
          accessibilityLabel={`Remove ${row.layout.trim() || title.toLowerCase()}`}
          onPress={onRemove}
          testID={`${testID}-remove`}
        />
      </Row>
      <Input
        label="Name"
        value={row.layout}
        onChangeText={(layout) => onChange({ ...row, layout })}
        errorText={errors.layout}
        maxLength={VENUE_OTHER_LAYOUT_NAME_MAX}
        placeholder="e.g. Classroom"
        testID={`${testID}-name`}
      />
      <LayoutGuests row={row} errors={errors} onChange={onChange} testID={testID} />
    </Stack>
  );
}

/** "Add layout", a secondary action, until the list holds the most it may. */
function AddLayout({ canAdd, onAdd }: { readonly canAdd: boolean; readonly onAdd: () => void }) {
  return (
    <Row gap={2} align="center" wrap>
      <Button
        variant="secondary"
        size="sm"
        icon="plus"
        disabled={!canAdd}
        onPress={onAdd}
        testID="venue-layout-add"
      >
        Add layout
      </Button>
      {canAdd ? null : (
        <Text variant="bodySmall" tone="muted" testID="venue-layouts-full">
          {`That is the most: ${VENUE_OTHER_LAYOUTS_MAX} layouts.`}
        </Text>
      )}
    </Row>
  );
}

/** Each row's errors on show, and the list's once every row passes its own. */
function layoutErrorsOnShow(rows: readonly LayoutDraft[], showErrors: boolean) {
  const rowErrors = rows.map((row) => (showErrors ? layoutRowErrors(row) : NO_ERRORS));
  const rowsPass = rowErrors.every((e) => !e.layout && !e.max && !e.min);
  return { rowErrors, listError: showErrors && rowsPass ? layoutsListError(rows) : undefined };
}

/**
 * The venue's other layouts beside its three capacities (D-178): up to 12 rows of a name, the most guests
 * and, for a range, the fewest. "Add layout" adds a blank row until the cap; a row left blank is dropped
 * on save. After a blocked save each row shows its own errors, then the list's (each name once).
 *
 *   <VenueLayoutsPanel {...fields} />
 */
export function VenueLayoutsPanel({ draft, patch, showErrors }: VenueFieldsProps) {
  const rows = draft.otherLayouts;
  const setRows = (otherLayouts: readonly LayoutDraft[]): void => patch({ otherLayouts });
  const { rowErrors, listError } = layoutErrorsOnShow(rows, showErrors);
  return (
    <ProfileSection
      title="Other layouts"
      description={`Beside seated, theatre and floating: up to ${VENUE_OTHER_LAYOUTS_MAX}, such as classroom or U-shape.`}
      testID="venue-layouts"
    >
      {rows.length === 0 ? (
        <Text variant="bodySmall" tone="muted" testID="venue-layouts-empty">
          No other layouts yet.
        </Text>
      ) : null}
      {rows.map((row, index) => (
        <Stack key={row.key} gap={4}>
          {index > 0 ? <Divider /> : null}
          <LayoutRow
            row={row}
            index={index}
            errors={rowErrors[index] ?? NO_ERRORS}
            onChange={(next) => setRows(rows.map((r) => (r.key === next.key ? next : r)))}
            onRemove={() => setRows(rows.filter((r) => r.key !== row.key))}
          />
        </Stack>
      ))}
      {listError ? <FieldAlert text={listError} testID="venue-layouts-error" /> : null}
      <AddLayout
        canAdd={canAddLayout(rows)}
        onAdd={() => setRows([...rows, newLayoutDraft(rows)])}
      />
    </ProfileSection>
  );
}
