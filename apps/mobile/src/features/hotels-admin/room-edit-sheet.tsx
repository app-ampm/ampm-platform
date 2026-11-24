import type { RoomCategoryView } from "@ampm/core";
import { Button, Input, Sheet, Stack } from "@ampm/ui";

import { AreaFields } from "./area-fields";
import { ROOM_SIZE_AREA } from "./hotel-area.form";
import { LONG_TEXT_MAX } from "./hotel-form-fields";
import { ProfileSection } from "./hotel-profile-section";
import { MediaOptionPicker } from "./media-option-picker";
import { ROOM_FIELD_LABEL } from "./rooms.form";
import { UNIT_TYPE_CHOICES, unitTypeLabel } from "./subresources.format";
import { roomField, useRoomForm, type RoomFieldsProps } from "./use-room-form";

/** The longest name, view or bed configuration the contract takes. */
const LABEL_MAX = 255;

/** What the room category is: its name, unit type, view and beds. */
function RoomIdentityPanel(props: RoomFieldsProps) {
  const { draft, patch } = props;
  return (
    <ProfileSection title="Room category" testID="room-identity">
      <Input
        label={ROOM_FIELD_LABEL.name}
        required
        {...roomField(props, "name")}
        maxLength={LABEL_MAX}
        placeholder="e.g. Deluxe Lake View"
        testID="room-name"
      />
      <MediaOptionPicker
        label="Unit type"
        value={draft.unitType}
        options={UNIT_TYPE_CHOICES}
        optionLabel={unitTypeLabel}
        onChange={(unitType) => patch({ unitType })}
        testID="room-unit-type"
      />
      <Input
        label="View"
        value={draft.viewLabel}
        onChangeText={(viewLabel) => patch({ viewLabel })}
        maxLength={LABEL_MAX}
        placeholder="e.g. Lake view"
        testID="room-view"
      />
      <Input
        label="Bed configuration"
        value={draft.bedConfiguration}
        onChangeText={(bedConfiguration) => patch({ bedConfiguration })}
        maxLength={LABEL_MAX}
        placeholder="e.g. King or twin"
        testID="room-bed"
      />
    </ProfileSection>
  );
}

/** How many there are, how many each sleeps, and their size in both units. */
function RoomSizePanel(props: RoomFieldsProps) {
  return (
    <ProfileSection title="Size and occupancy" testID="room-size-panel">
      <Input
        label={ROOM_FIELD_LABEL.roomCount}
        {...roomField(props, "roomCount")}
        keyboardType="number-pad"
        testID="room-count"
      />
      <Input
        label={ROOM_FIELD_LABEL.maxOccupancy}
        helpText="The most guests one room sleeps, at least 1."
        {...roomField(props, "maxOccupancy")}
        keyboardType="number-pad"
        testID="room-occupancy"
      />
      <AreaFields
        sqmLabel={ROOM_FIELD_LABEL.sizeSqm}
        sqftLabel={ROOM_FIELD_LABEL.sizeSqft}
        sqm={roomField(props, "sizeSqm")}
        sqft={roomField(props, "sizeSqft")}
        rules={ROOM_SIZE_AREA}
        sqmTestID="room-size"
        sqftTestID="room-size-sqft"
      />
    </ProfileSection>
  );
}

/** The room's amenities, one per line, and its description. */
function RoomAmenitiesPanel({ draft, patch }: Pick<RoomFieldsProps, "draft" | "patch">) {
  return (
    <ProfileSection title="Amenities and notes" testID="room-amenities">
      <Input
        label="Facilities"
        helpText="One per line; a | also separates two."
        value={draft.facilities}
        onChangeText={(facilities) => patch({ facilities })}
        multiline
        testID="room-facilities"
      />
      <Input
        label="Description"
        value={draft.description}
        onChangeText={(description) => patch({ description })}
        multiline
        maxLength={LONG_TEXT_MAX}
        testID="room-description"
      />
    </ProfileSection>
  );
}

export interface RoomEditSheetProps {
  readonly hotelId: string;
  readonly open: boolean;
  /** The room category being edited, or null to add a new one. */
  readonly room: RoomCategoryView | null;
  readonly onClose: () => void;
}

/**
 * Add or edit a hotel room category (TW-22; D-178): its name, unit type, view and beds; how many there
 * are, how many each sleeps and their size (the m² worked out from a filled sq ft); its amenities, one
 * per line, and description. Hotel team / Super Admin only, gated server-side.
 *
 *   <RoomEditSheet hotelId={hotelId} open={open} room={editing} onClose={close} />
 */
export function RoomEditSheet({ hotelId, open, room, onClose }: RoomEditSheetProps) {
  const { pending, submit, ...fields } = useRoomForm(hotelId, open, room, onClose);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={room ? "Edit room category" : "New room category"}
      size="full"
      testID="room-edit"
      footer={
        <Button fullWidth loading={pending} onPress={submit} testID="room-edit-submit">
          {room ? "Save changes" : "Add room category"}
        </Button>
      }
    >
      <Stack gap={4}>
        <RoomIdentityPanel {...fields} />
        <RoomSizePanel {...fields} />
        <RoomAmenitiesPanel draft={fields.draft} patch={fields.patch} />
      </Stack>
    </Sheet>
  );
}
