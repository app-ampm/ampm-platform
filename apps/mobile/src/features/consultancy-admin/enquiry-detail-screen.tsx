import { useRouter } from "expo-router";

import { useStaffEnquiry } from "@ampm/api-client";
import { Screen, ScreenHeader, useLayoutAt } from "@ampm/ui";

import { EnquiriesSplit } from "./enquiries-split";
import {
  BACK_TO_QUEUE,
  ENQUIRY_FALLBACK_TITLE,
  ENQUIRY_TITLE_SIZE,
  EnquiryHeading,
} from "./enquiry-heading";
import { EnquiryPane } from "./enquiry-pane";
import { EnquiryQueuePanel } from "./enquiry-queue-panel";

/**
 * The staff view of one enquiry (consultancy-admin, T6's detail). On a phone and a tablet, a detail
 * screen: the page's header with a back button to the queue, no tab bar, then the enquiry's sections.
 * From 1024, T6's queue beside this enquiry, selected in it; the pane carries the header, so the page
 * has none. The same tree at every width: only the wrappers' props change, and the header and the
 * queue have slots that stay empty where a width has none, so what is under way in the enquiry
 * survives a tablet turning or the window crossing 1024. The back button returns to the queue's page
 * whether that page is under this one (a phone opened it) or not (a desktop replaced it with this).
 */
export function StaffEnquiryDetailScreen({ enquiryId }: { readonly enquiryId: string }) {
  const isSplit = useLayoutAt("lg");
  const router = useRouter();
  return (
    <Screen
      width="wide"
      header={
        isSplit ? null : (
          <DetailHeader enquiryId={enquiryId} onBack={() => router.dismissTo("/enquiries")} />
        )
      }
    >
      <EnquiriesSplit
        isSplit={isSplit}
        queue={isSplit ? <EnquiryQueuePanel openId={enquiryId} /> : null}
      >
        {/* Keyed: choosing another enquiry beside the queue starts its pane afresh (no draft carried
            over); crossing 1024 changes no key, so a draft stays. */}
        <EnquiryPane key={enquiryId} enquiryId={enquiryId} />
      </EnquiriesSplit>
    </Screen>
  );
}

/**
 * The page's header keeps its back button through every state; the facts, the names and the chips
 * come with the enquiry.
 */
function DetailHeader({
  enquiryId,
  onBack,
}: {
  readonly enquiryId: string;
  readonly onBack: () => void;
}) {
  const enquiry = useStaffEnquiry(enquiryId);
  if (enquiry.data) return <EnquiryHeading enquiry={enquiry.data} onBack={onBack} />;
  return (
    <ScreenHeader
      onBack={onBack}
      backLabel={BACK_TO_QUEUE}
      title={ENQUIRY_FALLBACK_TITLE}
      titleClassName={ENQUIRY_TITLE_SIZE}
    />
  );
}
