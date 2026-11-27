import { Input, Sheet, Stack, Text } from "@ampm/ui";

import { DestinationField } from "../hotels-admin/hotel-destination-field";
import { CreateSheetFooter, CreateSheetForm } from "./create-sheet-parts";
import { DuplicateHints } from "./duplicate-hints";
import {
  EMPTY_NEW_HOTEL_DRAFT,
  newHotelBody,
  type NewHotelDraft,
  type RequestErrors,
} from "./info-request.form";
import { inviteHotelCopy } from "./invite-hotel-copy";
import { IssuedLink } from "./issued-link";
import {
  RecipientFields,
  ReferenceFields,
  RequestDetailFields,
  TestRequestToggle,
} from "./request-fields";
import { useCreateRequest, type CreateRequestSheet } from "./use-create-request";
import { useInfoRequestPermissions } from "./use-info-request-permissions";

interface HotelFieldsProps {
  readonly draft: NewHotelDraft;
  readonly patch: (next: Partial<NewHotelDraft>) => void;
  readonly errors: RequestErrors;
  readonly onAddDestination: (() => void) | undefined;
}

/** The proposed hotel: its name and its destination, required, and its website when known (D-192). */
function ProposedHotelFields({ draft, patch, errors, onAddDestination }: HotelFieldsProps) {
  return (
    <>
      <Input
        label="Hotel name"
        required
        value={draft.proposedName}
        onChangeText={(proposedName) => patch({ proposedName })}
        errorText={errors.proposedName}
        autoCapitalize="words"
        testID="invite-hotel-name"
      />
      <DestinationField
        value={draft.proposedDestinationId}
        onChange={(proposedDestinationId) => patch({ proposedDestinationId })}
        error={errors.proposedDestinationId}
        onAddDestination={onAddDestination}
      />
      <Input
        label={inviteHotelCopy.websiteLabel}
        helpText={inviteHotelCopy.websiteHelp}
        value={draft.proposedWebAddress}
        onChangeText={(proposedWebAddress) => patch({ proposedWebAddress })}
        errorText={errors.proposedWebAddress}
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={inviteHotelCopy.websitePlaceholder}
        testID="invite-hotel-web-address"
      />
    </>
  );
}

interface FormProps {
  readonly sheet: CreateRequestSheet<NewHotelDraft>;
  readonly canMakeTests: boolean;
  readonly onOpenHotel: ((hotelId: string) => void) | undefined;
  readonly onAddDestination: (() => void) | undefined;
}

/** The form: the hotel and the hotels it may already be, then the fields Send request takes. */
function InviteHotelForm({ sheet, canMakeTests, onOpenHotel, onAddDestination }: FormProps) {
  const fields = { draft: sheet.draft, patch: sheet.patch, errors: sheet.errors };
  return (
    <CreateSheetForm
      intro="A request for a hotel the catalogue does not hold yet. Check the hotels it may already be before you send it."
      refusal={sheet.refusal?.message}
    >
      <Stack gap={3}>
        <Text variant="eyebrow" tone="muted" accessibilityRole="header">
          The hotel
        </Text>
        <ProposedHotelFields {...fields} onAddDestination={onAddDestination} />
        <DuplicateHints
          name={sheet.draft.proposedName}
          webAddress={sheet.draft.proposedWebAddress}
          destinationId={sheet.draft.proposedDestinationId}
          onOpenHotel={onOpenHotel}
        />
      </Stack>
      <RecipientFields {...fields} mode={sheet.mode} />
      <RequestDetailFields {...fields} showKind={false} />
      <ReferenceFields {...fields} />
      <TestRequestToggle draft={sheet.draft} patch={sheet.patch} test={{ shown: canMakeTests }} />
    </CreateSheetForm>
  );
}

export interface InviteHotelSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** Leaves the sheet for a hinted hotel's record, where its own request is sent. */
  readonly onOpenHotel?: ((hotelId: string) => void) | undefined;
  /** With no destination yet: leaves for Destinations (a role that may add one). */
  readonly onAddDestination?: (() => void) | undefined;
}

/**
 * Invite a new hotel (D-188 §7; plan §8): a request for a hotel the catalogue does not hold yet, from the
 * hotels list (`hotels.info_requests.create`). It takes the proposed name and destination, and the hotel
 * website when staff know it (D-192), shows the catalogue hotels it may already be as they are typed and
 * any live invite of the same name in that destination, then the fields Send request takes (the
 * round is always the onboarding), the Super Admin's test switch included. Once created, the link shows
 * here once, with Copy and Share; closing forgets it.
 *
 *   <InviteHotelSheet open={inviting} onClose={() => setInviting(false)} onOpenHotel={openHotel} />
 */
export function InviteHotelSheet({
  open,
  onClose,
  onOpenHotel,
  onAddDestination,
}: InviteHotelSheetProps) {
  const { canMakeTests, canUpdate } = useInfoRequestPermissions();
  const sheet = useCreateRequest(open, EMPTY_NEW_HOTEL_DRAFT, newHotelBody, onClose);
  // A hinted hotel's record is where its own request is sent: the sheet closes on the way there.
  const openHotel = onOpenHotel
    ? (hotelId: string): void => {
        sheet.close();
        onOpenHotel(hotelId);
      }
    : undefined;
  return (
    <Sheet
      open={open}
      onClose={sheet.close}
      title={sheet.issued ? "Request created" : "Invite a new hotel"}
      size="full"
      footer={<CreateSheetFooter sheet={sheet} testID="invite-hotel" />}
      testID="invite-hotel"
    >
      {sheet.issued ? (
        <IssuedLink issued={sheet.issued} canRecordShare={canUpdate} />
      ) : (
        <InviteHotelForm {...{ sheet, canMakeTests, onAddDestination }} onOpenHotel={openHotel} />
      )}
    </Sheet>
  );
}
