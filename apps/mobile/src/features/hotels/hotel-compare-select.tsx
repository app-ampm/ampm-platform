import { useRouter } from "expo-router";
import { useState } from "react";

import { HOTEL_COMPARE_MAX, HOTEL_COMPARE_MIN } from "@ampm/core";
import { Button, Checkbox, politeLiveRegion, Row, Text, useAnnounce } from "@ampm/ui";

export interface HotelCompareSelection {
  readonly comparing: boolean;
  readonly selected: readonly string[];
  /** True while the picks are being prepared before the compare opens (discovery's save-then-compare). */
  readonly opening: boolean;
  readonly start: () => void;
  readonly exit: () => void;
  readonly toggle: (hotelId: string) => void;
  readonly open: () => void;
}

/**
 * Compare-mode state shared by the shortlist (CP-06) and discovery (B12b): which hotels are picked (2–4,
 * capped at the maximum) and opening the side-by-side with them. `beforeOpen` runs just before navigating —
 * discovery passes the save step, because the compare endpoint returns only saved hotels, so a hotel picked
 * from a browse card is put on the shortlist first; the shortlist, whose hotels are already saved, passes
 * nothing. If `beforeOpen` rejects the picks are kept (the caller has reported the failure) so the user can
 * try again, and the compare never opens with hotels the server would silently drop.
 */
export function useHotelCompareSelection(
  beforeOpen?: (ids: readonly string[]) => Promise<void>,
): HotelCompareSelection {
  const router = useRouter();
  const [comparing, setComparing] = useState(false);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [opening, setOpening] = useState(false);
  const toggle = (hotelId: string): void =>
    setSelected((current) =>
      current.includes(hotelId)
        ? current.filter((id) => id !== hotelId)
        : current.length >= HOTEL_COMPARE_MAX
          ? current
          : [...current, hotelId],
    );
  const exit = (): void => {
    setComparing(false);
    setSelected([]);
  };
  const go = (ids: readonly string[]): void => {
    router.push({ pathname: "/hotels/compare", params: { ids: ids.join(",") } });
    exit();
  };
  const open = (): void => {
    const ids = selected;
    if (ids.length < HOTEL_COMPARE_MIN || ids.length > HOTEL_COMPARE_MAX) return;
    if (!beforeOpen) return go(ids);
    void (async () => {
      setOpening(true);
      try {
        await beforeOpen(ids);
        go(ids);
      } catch {
        // beforeOpen reported the failure; keep the picks so the user can retry.
      } finally {
        setOpening(false);
      }
    })();
  };
  return { comparing, selected, opening, start: () => setComparing(true), exit, toggle, open };
}

export interface HotelCompareCheckboxProps {
  readonly hotelId: string;
  readonly name: string;
  /** Where the hotel is, already formatted ("Udaipur, Rajasthan"). */
  readonly destinationText: string;
  readonly selected: readonly string[];
  readonly onToggle: (hotelId: string) => void;
}

/** A hotel as a compare pick: checked when selected, disabled once the maximum is chosen. */
export function HotelCompareCheckbox({
  hotelId,
  name,
  destinationText,
  selected,
  onToggle,
}: HotelCompareCheckboxProps) {
  const checked = selected.includes(hotelId);
  return (
    <Checkbox
      label={name}
      description={destinationText}
      checked={checked}
      onCheckedChange={() => onToggle(hotelId)}
      disabled={!checked && selected.length >= HOTEL_COMPARE_MAX}
      testID={`compare-select-${hotelId}`}
      className="border-t border-primary/16 py-3"
    />
  );
}

export interface CompareBarProps {
  readonly count: number;
  /** True while the picks are being saved before the compare opens (discovery's save-then-compare). */
  readonly opening?: boolean;
  readonly onCompare: () => void;
}

/** The compare picker's footer: how many are chosen, the cap once it is reached, and the action (2–4 only). */
export function CompareBar({ count, opening = false, onCompare }: CompareBarProps) {
  const ready = count >= HOTEL_COMPARE_MIN && count <= HOTEL_COMPARE_MAX;
  const atMax = count >= HOTEL_COMPARE_MAX;
  const message =
    count === 0
      ? `Pick ${HOTEL_COMPARE_MIN}–${HOTEL_COMPARE_MAX} hotels to compare`
      : atMax
        ? `Maximum ${HOTEL_COMPARE_MAX} — uncheck one to swap`
        : `${count} selected`;
  useAnnounce(atMax ? message : undefined, atMax, { web: true });
  return (
    <Row gap={3} justify="between" align="center" className="border-t border-primary/16 pt-3">
      <Text variant="caption" tone="muted" className="shrink" {...politeLiveRegion()}>
        {message}
      </Text>
      <Button
        variant="primary"
        size="sm"
        disabled={!ready || opening}
        loading={opening}
        onPress={onCompare}
      >
        Compare
      </Button>
    </Row>
  );
}
