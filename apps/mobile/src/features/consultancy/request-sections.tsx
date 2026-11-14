import type { HotelEnquiryClientDetailView } from "@ampm/core";

import { EnquiryActivity } from "./enquiry-activity";
import { EnquiryWithdraw } from "./enquiry-withdraw";
import { AgreementSection, ProposalsSection } from "./request-commercial";
import { MilestonesSection, VisitsSection } from "./request-progress";

/**
 * Everything hanging off an enquiry under its summary, in one order at every width: the agreement, the
 * proposals, the site visits, the milestones, the activity and the withdraw action. A fragment, so the
 * phone's page stack and the desktop detail panel each space the sections their own way.
 */
export function RequestSections({ enquiry }: { readonly enquiry: HotelEnquiryClientDetailView }) {
  return (
    <>
      <AgreementSection enquiryId={enquiry.id} />
      <ProposalsSection enquiryId={enquiry.id} />
      <VisitsSection enquiryId={enquiry.id} />
      <MilestonesSection enquiryId={enquiry.id} />
      <EnquiryActivity events={enquiry.events} />
      <EnquiryWithdraw enquiry={enquiry} />
    </>
  );
}
