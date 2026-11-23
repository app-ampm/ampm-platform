import { useHotelCuisineOptions } from "@ampm/api-client";
import { Button, FilterChip, Row, Skeleton, Stack, Text } from "@ampm/ui";

import { cuisineChoices, distinctLabels, isCuisineChosen, toggleCuisine } from "./hotel-food.form";

/** A chip's test id from its label: "North Indian" → "hotel-cuisine-north-indian". */
function chipTestID(label: string): string {
  return `hotel-cuisine-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

/** The list failed to load: say so, and offer a retry; the hotel's own labels stay above. */
function CuisinesFetchError({ onRetry }: { readonly onRetry: () => void }) {
  return (
    <Stack gap={2}>
      <Text
        variant="bodySmall"
        tone="brand"
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
      >
        Couldn&apos;t load the cuisine list.
      </Text>
      <Button variant="secondary" size="sm" onPress={onRetry} testID="hotel-cuisines-retry">
        Retry
      </Button>
    </Stack>
  );
}

export interface CuisineChipsProps {
  /** Load the configured options only while the editor is open. */
  readonly open: boolean;
  /** The cuisines chosen in the draft. */
  readonly chosen: readonly string[];
  /** The cuisines the hotel had when the editor opened, offered again if staff remove one. */
  readonly saved: readonly string[];
  readonly onChange: (next: string[]) => void;
  /** The gold line naming what is wrong with the choice. */
  readonly error?: string | undefined;
}

/**
 * The hotel's cuisines as filter chips (D-178): the configured options (`hotel.cuisine_options`), each
 * label the hotel has that they no longer list, and "Other". A chosen chip is solid peacock with a
 * check, so it never reads by colour alone. The hotel's labels show in every state, so the list
 * loading or failing never hides or drops them; a failed load offers a retry.
 *
 *   <CuisineChips open={open} chosen={draft.cuisines} saved={hotel?.cuisines ?? []} onChange={set} />
 */
export function CuisineChips({ open, chosen, saved, onChange, error }: CuisineChipsProps) {
  const options = useHotelCuisineOptions({ enabled: open });
  const kept = [...saved, ...chosen];
  const offered = options.data
    ? cuisineChoices(options.data.options, options.data.other, kept)
    : distinctLabels(kept);
  return (
    <Stack gap={2} testID="hotel-cuisines">
      <Text variant="eyebrow" tone="muted">
        Cuisines
      </Text>
      <Row gap={2} wrap>
        {offered.map((label) => {
          const isChosen = isCuisineChosen(chosen, label);
          return (
            <FilterChip
              key={label}
              label={label}
              selected={isChosen}
              icon={isChosen ? "check" : undefined}
              onPress={() => onChange(toggleCuisine(chosen, label))}
              testID={chipTestID(label)}
            />
          );
        })}
      </Row>
      {options.isPending ? <Skeleton className="h-10 w-full" /> : null}
      {options.isError ? <CuisinesFetchError onRetry={() => void options.refetch()} /> : null}
      {error ? (
        <Text variant="bodySmall" tone="brand" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </Stack>
  );
}
