import { Input } from "@ampm/ui";

import { checkedField, textField, type ProfileFieldsProps } from "./hotel-profile.bindings";

/**
 * The hotel's details under its identity: its room count, its website, and the client-facing free text
 * it shows in discovery (its description and its amenities, one per line as the import's list rule
 * reads them).
 *
 *   <HotelDetailFields draft={draft} patch={patch} errors={errors} fieldRef={fieldRef} />
 */
export function HotelDetailFields(props: ProfileFieldsProps) {
  return (
    <>
      <Input
        label="Total rooms"
        {...checkedField(props, "totalRooms")}
        keyboardType="number-pad"
        placeholder="e.g. 120"
        testID="hotel-rooms"
      />
      <Input
        label="Website"
        {...textField(props, "website")}
        keyboardType="url"
        autoCapitalize="none"
        placeholder="https://…"
        testID="hotel-website"
      />
      <Input
        label="Client description"
        helpText="Shown to clients in discovery."
        {...textField(props, "descriptionClient")}
        multiline
        testID="hotel-description"
      />
      <Input
        label="Facilities"
        helpText="One per line; a | also separates two."
        {...textField(props, "facilities")}
        multiline
        testID="hotel-facilities"
      />
    </>
  );
}
