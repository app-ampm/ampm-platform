import { useState, type ReactNode } from "react";
import { useRouter } from "expo-router";

import { useStaffAccess } from "@ampm/api-client";
import type { HotelStaffDetail } from "@ampm/core";
import { Button, ScreenHeader, SegmentedControl, Stack } from "@ampm/ui";

import { HotelProfileEditSheet } from "./hotel-profile-edit-sheet";
import {
  HOTEL_RECORD_PATHNAME,
  hotelRecordEyebrow,
  hotelRecordSection,
  visibleHotelRecordTabs,
  type HotelRecordSection,
} from "./hotel-record.format";

export interface HotelRecordHeaderProps {
  readonly hotelId: string;
  /** The section this page shows; its tab is the selected one. */
  readonly section: HotelRecordSection;
  /** The hotel once it has loaded; until then the header names no hotel and offers no profile edit. */
  readonly hotel: HotelStaffDetail | undefined;
  /** The page's own actions, after Edit profile: the media manager's gold Add media. */
  readonly actions?: ReactNode;
}

/** Moves between the record's sections in place (replace, not push) and back to the catalogue. */
function useRecordNavigation(hotelId: string, section: HotelRecordSection) {
  const router = useRouter();
  return {
    openSection: (value: string): void => {
      const next = hotelRecordSection(value);
      if (next && next !== section) {
        router.replace({ pathname: HOTEL_RECORD_PATHNAME[next], params: { hotelId } });
      }
    },
    back: (): void => router.dismissTo("/hotels-admin"),
  };
}

/** The record's actions: Edit profile once the hotel has loaded, then the page's own. */
function RecordActions({
  onEdit,
  actions,
}: {
  readonly onEdit: (() => void) | undefined;
  readonly actions: ReactNode;
}) {
  return (
    <>
      {onEdit ? (
        <Button
          variant="secondary"
          size="sm"
          icon="edit"
          onPress={onEdit}
          testID="hotel-edit-profile"
        >
          Edit profile
        </Button>
      ) : null}
      {actions}
    </>
  );
}

/**
 * The top of a staff hotel record (T5), shared by its pages: back to the catalogue, "Hotels ·
 * <destination>" over the hotel's name, the record's actions at the right, and the record strip under
 * it, holding the tabs the person's grants open (D-164: Documents only for a reader of documents). A tab
 * replaces the page rather than stacking it, so back always returns to the catalogue. It owns the
 * profile editor, which the window crossing 1024 never resets: the header sits in the same place at
 * every width.
 *
 *   <Screen header={<HotelRecordHeader hotelId={id} section="rates" hotel={hotel.data} />}>…</Screen>
 */
export function HotelRecordHeader({ hotelId, section, hotel, actions }: HotelRecordHeaderProps) {
  const navigation = useRecordNavigation(hotelId, section);
  const tabs = visibleHotelRecordTabs(useStaffAccess(), section);
  const [editingProfile, setEditingProfile] = useState(false);
  const onEdit = hotel ? () => setEditingProfile(true) : undefined;
  return (
    <Stack gap={4}>
      <ScreenHeader
        eyebrow={hotelRecordEyebrow(hotel)}
        title={hotel?.name ?? "Hotel"}
        onBack={navigation.back}
        backLabel="Back to hotels"
        actions={
          onEdit || actions ? <RecordActions onEdit={onEdit} actions={actions} /> : undefined
        }
      />
      <SegmentedControl
        variant="underline"
        scrollable
        accessibilityLabel="Hotel record sections"
        options={tabs}
        value={section}
        onChange={navigation.openSection}
        testID="hotel-record-tabs"
      />
      <HotelProfileEditSheet
        open={editingProfile}
        hotel={hotel ?? null}
        onClose={() => setEditingProfile(false)}
      />
    </Stack>
  );
}
