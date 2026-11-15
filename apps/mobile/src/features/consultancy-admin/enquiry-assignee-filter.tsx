import { useStaffEnquiryPipeline } from "@ampm/api-client";
import type { HotelEnquiryAssigneeFilter } from "@ampm/core";
import { FilterChip, Row } from "@ampm/ui";

const CHOICES: ReadonlyArray<{
  readonly value: HotelEnquiryAssigneeFilter | null;
  readonly label: string;
  readonly testID: string;
}> = [
  { value: null, label: "Everyone", testID: "enquiry-assignee-all" },
  { value: "me", label: "Mine", testID: "enquiry-assignee-me" },
  { value: "unassigned", label: "Unassigned", testID: "enquiry-assignee-unassigned" },
];

/**
 * The queue's owner filter, above its stages: everyone's enquiries, the reader's own open ones, or the
 * open ones nobody holds yet — each with its count from the pipeline (open work only, so the list under
 * a chip matches its number). The chosen chip is solid peacock with a check, never colour alone.
 */
export function EnquiryAssigneeFilter({
  value,
  onChange,
}: {
  readonly value: HotelEnquiryAssigneeFilter | null;
  readonly onChange: (assignee: HotelEnquiryAssigneeFilter | null) => void;
}) {
  const pipeline = useStaffEnquiryPipeline().data;
  const count = (choice: HotelEnquiryAssigneeFilter | null): number | undefined => {
    if (choice === "me") return pipeline?.mineOpen;
    if (choice === "unassigned") return pipeline?.unassignedOpen;
    return undefined;
  };
  return (
    <Row gap={2} wrap accessibilityLabel="Filter by owner" testID="enquiry-assignee-filter">
      {CHOICES.map((choice) => {
        const selected = value === choice.value;
        return (
          <FilterChip
            key={choice.testID}
            label={choice.label}
            count={count(choice.value)}
            selected={selected}
            icon={selected ? "check" : undefined}
            onPress={() => onChange(selected ? null : choice.value)}
            testID={choice.testID}
          />
        );
      })}
    </Row>
  );
}
