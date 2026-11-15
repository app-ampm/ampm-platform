import { ScrollView } from "react-native";

import { useStaffEnquiryPipeline } from "@ampm/api-client";
import { hotelEnquiryStage, type HotelEnquiryStage } from "@ampm/core";
import { FilterChip } from "@ampm/ui";

import { STAGE_LABEL } from "./enquiry-next-step";

/**
 * The queue's pipeline filter: "All" then one chip per stage in pipeline order, each with how many
 * enquiries sit there (the counts cover the whole pipeline in the reader's scope, not just the page
 * loaded), in one row that scrolls sideways as the search's filter chips do. The chosen chip is solid
 * peacock with a check, so it never reads by colour alone; until the counts arrive the chips show
 * their names only.
 */
export function EnquiryStageFilter({
  value,
  onChange,
}: {
  readonly value: HotelEnquiryStage | null;
  readonly onChange: (stage: HotelEnquiryStage | null) => void;
}) {
  const stages = useStaffEnquiryPipeline().data?.stages;
  const total = stages ? Object.values(stages).reduce((sum, count) => sum + count, 0) : undefined;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel="Filter by pipeline stage"
      // A scroll view grows to fill a flex column (the queue panel); the chip row keeps its own height.
      className="grow-0"
      // The chips' 46 targets around their 38 pills clip at a horizontal scroll's edges without this.
      contentContainerClassName="gap-2 py-1"
      testID="enquiry-stage-filter"
    >
      <FilterChip
        label="All"
        count={total}
        selected={value === null}
        icon={value === null ? "check" : undefined}
        onPress={() => onChange(null)}
        testID="enquiry-stage-all"
      />
      {hotelEnquiryStage.options.map((stage) => (
        <FilterChip
          key={stage}
          label={STAGE_LABEL[stage]}
          count={stages?.[stage]}
          selected={value === stage}
          icon={value === stage ? "check" : undefined}
          onPress={() => onChange(value === stage ? null : stage)}
          testID={`enquiry-stage-${stage}`}
        />
      ))}
    </ScrollView>
  );
}
