"use client";

import { cn, segmentLabelStyles, segmentStyles, segmentedTrackStyles } from "@ampm/ui/styles";

import {
  DESTINATIONS_COPY,
  REGIONS,
  type RegionFilter as RegionFilterValue,
} from "./destinations-content";

const OPTIONS: readonly { readonly value: RegionFilterValue; readonly label: string }[] = [
  { value: "all", label: DESTINATIONS_COPY.all },
  ...REGIONS.map((region) => ({ value: region, label: region })),
];

export interface RegionFilterProps {
  readonly value: RegionFilterValue;
  readonly onChange: (value: RegionFilterValue) => void;
  /** Placement in the caller's row (`xl:self-end`). */
  readonly className?: string | undefined;
}

/**
 * The region pills (W4): the kit's segmented track in glass, the chosen region a peacock pill with a
 * midnight label. Toggle buttons (aria-pressed) in a named group, each a 44px target; on a phone the
 * track scrolls sideways rather than widen the page.
 */
export function RegionFilter({ value, onChange, className }: RegionFilterProps) {
  return (
    <div
      role="group"
      aria-label={DESTINATIONS_COPY.filterLabel}
      className={cn(
        segmentedTrackStyles(),
        "max-w-full shrink-0 overflow-x-auto backdrop-blur-glass backdrop-saturate-glass",
        className,
      )}
    >
      {OPTIONS.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onChange(option.value)}
            className={cn(segmentStyles({ selected: isSelected }), "min-h-touch shrink-0")}
          >
            <span
              className={cn(
                segmentLabelStyles({ state: isSelected ? "selected" : "default" }),
                "whitespace-nowrap",
              )}
            >
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
