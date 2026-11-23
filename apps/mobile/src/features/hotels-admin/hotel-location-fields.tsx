import { Input } from "@ampm/ui";

import type { ProfileFieldKey } from "./hotel-profile.errors";
import {
  checkedField,
  textField,
  type ProfileFieldsProps,
  type ProfileTextKey,
} from "./hotel-profile.bindings";
import { ProfileSection } from "./hotel-profile-section";

/** The longest name or place the contract takes, and the longest notes. */
const SHORT_TEXT_MAX = 255;
const LONG_TEXT_MAX = 10_000;
/** The longest postal code and Maps link the contract takes. */
const POSTAL_CODE_MAX = 16;
const MAPS_URL_MAX = 2048;

/** The street address and the locality and city it sits in. */
function StreetFields(props: ProfileFieldsProps) {
  return (
    <>
      <Input
        label="Address"
        {...textField(props, "address")}
        multiline
        maxLength={LONG_TEXT_MAX}
        testID="hotel-address"
      />
      <Input
        label="Locality"
        helpText="The neighbourhood or area, e.g. the lakeside or the old city."
        {...textField(props, "locality")}
        maxLength={SHORT_TEXT_MAX}
        testID="hotel-locality"
      />
      <Input
        label="City"
        {...textField(props, "city")}
        maxLength={SHORT_TEXT_MAX}
        testID="hotel-city"
      />
    </>
  );
}

/** The state and the postal code; an Indian PIN is checked against the destination's country. */
function RegionFields(props: ProfileFieldsProps) {
  return (
    <>
      <Input
        label="State"
        {...textField(props, "state")}
        maxLength={SHORT_TEXT_MAX}
        testID="hotel-state"
      />
      <Input
        label="PIN code"
        {...checkedField(props, "postalCode")}
        autoCapitalize="characters"
        maxLength={POSTAL_CODE_MAX}
        testID="hotel-postal-code"
      />
    </>
  );
}

/** The hotel's Google Maps link and its coordinates, which staff may now set. */
function MapFields(props: ProfileFieldsProps) {
  return (
    <>
      <Input
        label="Google Maps link"
        helpText="An https link from google.com/maps or maps.app.goo.gl."
        {...checkedField(props, "mapsUrl")}
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={MAPS_URL_MAX}
        testID="hotel-maps-url"
      />
      <Input
        label="Latitude"
        {...checkedField(props, "latitude")}
        keyboardType="numbers-and-punctuation"
        placeholder="e.g. 24.576100"
        testID="hotel-latitude"
      />
      <Input
        label="Longitude"
        {...checkedField(props, "longitude")}
        keyboardType="numbers-and-punctuation"
        placeholder="e.g. 73.683300"
        testID="hotel-longitude"
      />
    </>
  );
}

interface TravelLegProps extends ProfileFieldsProps {
  /** The place reached, as each label starts: "Airport", "Railway station", "City centre". */
  readonly place: string;
  readonly testID: string;
  /** The field naming the place, with its label; a city centre has none. */
  readonly name?: { readonly key: ProfileTextKey; readonly label: string } | undefined;
  readonly kmKey: ProfileTextKey & ProfileFieldKey;
  readonly minutesKey: ProfileTextKey & ProfileFieldKey;
}

/** How a guest reaches one place: its name, the distance in km and the drive in minutes. */
function TravelLeg({ place, testID, name, kmKey, minutesKey, ...props }: TravelLegProps) {
  return (
    <>
      {name ? (
        <Input
          label={name.label}
          {...textField(props, name.key)}
          maxLength={SHORT_TEXT_MAX}
          testID={`${testID}-name`}
        />
      ) : null}
      <Input
        label={`${place} distance (km)`}
        {...checkedField(props, kmKey)}
        keyboardType="decimal-pad"
        testID={`${testID}-km`}
      />
      <Input
        label={`${place} drive (minutes)`}
        {...checkedField(props, minutesKey)}
        keyboardType="number-pad"
        testID={`${testID}-minutes`}
      />
    </>
  );
}

/** The airport, the railway station and the city centre, each with its distance and drive. */
function AccessFields(props: ProfileFieldsProps) {
  return (
    <>
      <TravelLeg
        {...props}
        place="Airport"
        testID="hotel-airport"
        name={{ key: "airportName", label: "Nearest airport" }}
        kmKey="airportDistanceKm"
        minutesKey="airportDriveMinutes"
      />
      <TravelLeg
        {...props}
        place="Railway station"
        testID="hotel-railway"
        name={{ key: "railwayStationName", label: "Nearest railway station" }}
        kmKey="railwayDistanceKm"
        minutesKey="railwayDriveMinutes"
      />
      <TravelLeg
        {...props}
        place="City centre"
        testID="hotel-city-centre"
        kmKey="cityCentreDistanceKm"
        minutesKey="cityCentreDriveMinutes"
      />
    </>
  );
}

/**
 * The profile editor's "Location and access" section (D-178): where the hotel is (address, locality,
 * city, state, PIN code, Google Maps link and coordinates) and how guests reach it (the nearest airport
 * and railway station and the city centre, in km and drive minutes), then notes on access.
 *
 *   <HotelLocationFields draft={draft} patch={patch} errors={errors} fieldRef={fieldRef} />
 */
export function HotelLocationFields(props: ProfileFieldsProps) {
  return (
    <ProfileSection
      title="Location and access"
      description="Where the hotel is, and how guests reach it."
      testID="hotel-location"
    >
      <StreetFields {...props} />
      <RegionFields {...props} />
      <MapFields {...props} />
      <AccessFields {...props} />
      <Input
        label="Access notes"
        helpText="Roads, ferries, last-mile transfers, parking for coaches."
        {...textField(props, "accessNotes")}
        multiline
        maxLength={LONG_TEXT_MAX}
        testID="hotel-access-notes"
      />
    </ProfileSection>
  );
}
