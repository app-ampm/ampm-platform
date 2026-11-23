import { Input } from "@ampm/ui";

import { checkedField, textField, type ProfileFieldsProps } from "./hotel-profile.bindings";
import { HOTEL_STATUSES, hotelStatusLabel } from "./hotels-admin.format";
import { MediaOptionPicker } from "./media-option-picker";

/** The longest brand, group or category the contract takes. */
const SHORT_TEXT_MAX = 255;

/** The names the hotel trades and is known under: its brand, the group behind it, its other names. */
function NameFields(props: ProfileFieldsProps) {
  return (
    <>
      <Input
        label="Brand"
        {...textField(props, "brand")}
        maxLength={SHORT_TEXT_MAX}
        placeholder="e.g. Example Collection"
        testID="hotel-brand"
      />
      <Input
        label="Parent group"
        helpText="The company or group behind the brand, if any."
        {...textField(props, "parentGroup")}
        maxLength={SHORT_TEXT_MAX}
        testID="hotel-parent-group"
      />
      <Input
        label="Name variants"
        helpText="Other names the hotel goes by, one per line (a | also separates two), up to 20. Internal: never shown to clients."
        {...checkedField(props, "nameAliases")}
        multiline
        testID="hotel-name-variants"
      />
    </>
  );
}

/**
 * Who the hotel is, under its name and destination: its brand and the group behind it, the other
 * names it goes by (INTERNAL: duplicate hints and imports match on them; never shown to clients), its
 * star category and its status in the catalogue.
 *
 *   <HotelIdentityFields draft={draft} patch={patch} errors={errors} fieldRef={fieldRef} />
 */
export function HotelIdentityFields(props: ProfileFieldsProps) {
  const { draft, patch } = props;
  return (
    <>
      <NameFields {...props} />
      <Input
        label="Star category"
        {...textField(props, "starCategory")}
        maxLength={SHORT_TEXT_MAX}
        placeholder="e.g. 5"
        testID="hotel-star"
      />
      <MediaOptionPicker
        label="Status"
        value={draft.status}
        options={HOTEL_STATUSES}
        optionLabel={hotelStatusLabel}
        onChange={(status) => patch({ status })}
        testID="hotel-status"
      />
    </>
  );
}
