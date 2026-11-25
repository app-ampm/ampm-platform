import type { HotelStaffDetail } from "@ampm/core";
import { Sheet } from "@ampm/ui";

import { CreateSheetFooter, CreateSheetForm } from "./create-sheet-parts";
import { EMPTY_REQUEST_DRAFT, existingHotelBody, type RequestDraft } from "./info-request.form";
import { IssuedLink } from "./issued-link";
import {
  RecipientFields,
  ReferenceFields,
  RequestDetailFields,
  TestRequestToggle,
  type TestSwitch,
} from "./request-fields";
import { useCreateRequest, type CreateRequestSheet } from "./use-create-request";
import { useInfoRequestPermissions } from "./use-info-request-permissions";

type Hotel = Pick<HotelStaffDetail, "id" | "name" | "status">;

/** The test switch: the Super Admin's, and only for a draft hotel (the API's rule). */
function testSwitchFor(canMakeTests: boolean, status: HotelStaffDetail["status"]): TestSwitch {
  return {
    shown: canMakeTests,
    refusal: status === "draft" ? undefined : "Only a draft hotel can have a test request.",
  };
}

/** The form: the recipient and "Email it", the round, the label and note, AMPM's reference, the test. */
function SendRequestForm({
  sheet,
  hotel,
  test,
}: {
  readonly sheet: CreateRequestSheet<RequestDraft>;
  readonly hotel: Hotel;
  readonly test: TestSwitch;
}) {
  const fields = { draft: sheet.draft, patch: sheet.patch, errors: sheet.errors };
  return (
    <CreateSheetForm
      intro={`A link for ${hotel.name} to fill in the hotel information form. You see the link once, when the request is created.`}
      refusal={sheet.refusal?.message}
    >
      <RecipientFields {...fields} mode={sheet.mode} />
      <RequestDetailFields {...fields} showKind />
      <ReferenceFields {...fields} />
      <TestRequestToggle draft={sheet.draft} patch={sheet.patch} test={test} />
    </CreateSheetForm>
  );
}

export interface SendRequestSheetProps {
  readonly open: boolean;
  /** The catalogue hotel the request is for. */
  readonly hotel: Hotel;
  readonly onClose: () => void;
}

/**
 * Send request (D-188 §7; plan §8): a hotel information request for a hotel the catalogue holds, from its
 * record (`hotels.info_requests.create`). It takes the recipient, "Email it" under the hotel form's mode,
 * the round, the label and note the hotel sees, AMPM's reference (official website and switchboard with
 * its source) and, for the Super Admin, the test switch. Once created, the link shows here once, with
 * Copy and Share; closing forgets it. A second live request is refused with the API's message, which names
 * it.
 *
 *   <SendRequestSheet open={sending} hotel={hotel} onClose={() => setSending(false)} />
 */
export function SendRequestSheet({ open, hotel, onClose }: SendRequestSheetProps) {
  const { canMakeTests, canUpdate } = useInfoRequestPermissions();
  const bodyOf = (draft: RequestDraft) => existingHotelBody(hotel.id, draft);
  const sheet = useCreateRequest(open, EMPTY_REQUEST_DRAFT, bodyOf, onClose);
  return (
    <Sheet
      open={open}
      onClose={sheet.close}
      title={sheet.issued ? "Request created" : "Send request"}
      size="full"
      footer={<CreateSheetFooter sheet={sheet} testID="send-request" />}
      testID="send-request"
    >
      {sheet.issued ? (
        <IssuedLink issued={sheet.issued} canRecordShare={canUpdate} />
      ) : (
        <SendRequestForm
          sheet={sheet}
          hotel={hotel}
          test={testSwitchFor(canMakeTests, hotel.status)}
        />
      )}
    </Sheet>
  );
}
