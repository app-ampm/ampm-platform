import {
  hotelInfoRequestKind,
  hotelInfoRequestStatus,
  type HotelInfoRequestKind,
  type HotelInfoRequestStatus,
} from "@ampm/core";
import { FilterChip, Row, Stack, Text, Toggle } from "@ampm/ui";

import { infoRequestKindLabel, infoRequestStatusLabel } from "./info-requests.format";

/** The queue's filters: a status, a round, and (the Super Admin's) the test requests. */
export interface RequestFilters {
  readonly status: HotelInfoRequestStatus | null;
  readonly kind: HotelInfoRequestKind | null;
  readonly includeTests: boolean;
}

export const NO_REQUEST_FILTERS: RequestFilters = { status: null, kind: null, includeTests: false };

/** Whether any filter narrows the queue. */
export function isFiltered(filters: RequestFilters): boolean {
  return filters.status !== null || filters.kind !== null || filters.includeTests;
}

interface ChipsProps<T extends string> {
  readonly label: string;
  readonly allLabel: string;
  readonly options: readonly T[];
  readonly optionLabel: (option: T) => string;
  readonly value: T | null;
  readonly onChange: (value: T | null) => void;
  readonly testID: string;
}

/** One filter: "All" and each option, one chosen at a time. */
function FilterChips<T extends string>(props: ChipsProps<T>) {
  const { label, allLabel, options, optionLabel, value, onChange, testID } = props;
  return (
    <Stack gap={1.5}>
      <Text variant="eyebrow" tone="muted">
        {label}
      </Text>
      <Row gap={2} wrap testID={testID}>
        <FilterChip
          label={allLabel}
          selected={value === null}
          onPress={() => onChange(null)}
          testID={`${testID}-all`}
        />
        {options.map((option) => (
          <FilterChip
            key={option}
            label={optionLabel(option)}
            selected={value === option}
            onPress={() => onChange(option)}
            testID={`${testID}-${option}`}
          />
        ))}
      </Row>
    </Stack>
  );
}

export interface InfoRequestFiltersProps {
  readonly filters: RequestFilters;
  readonly onChange: (filters: RequestFilters) => void;
  /** The test requests switch: the Super Admin's alone. */
  readonly showTests: boolean;
}

/**
 * TW-99's filters (D-188 §7): status and round as chips, and, for the Super Admin, whether the test
 * requests show (they are left out by default).
 *
 *   <InfoRequestFilters filters={filters} onChange={setFilters} showTests={canMakeTests} />
 */
export function InfoRequestFilters({ filters, onChange, showTests }: InfoRequestFiltersProps) {
  return (
    <Stack gap={3} testID="requests-filters">
      <FilterChips
        label="Status"
        allLabel="All statuses"
        options={hotelInfoRequestStatus.options}
        optionLabel={infoRequestStatusLabel}
        value={filters.status}
        onChange={(status) => onChange({ ...filters, status })}
        testID="requests-status"
      />
      <FilterChips
        label="Round"
        allLabel="All rounds"
        options={hotelInfoRequestKind.options}
        optionLabel={infoRequestKindLabel}
        value={filters.kind}
        onChange={(kind) => onChange({ ...filters, kind })}
        testID="requests-kind"
      />
      {showTests ? (
        <Toggle
          className="max-w-md"
          label="Show test requests"
          value={filters.includeTests}
          onValueChange={(includeTests) => onChange({ ...filters, includeTests })}
          testID="requests-tests"
        />
      ) : null}
    </Stack>
  );
}
