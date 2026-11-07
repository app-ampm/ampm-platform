import { useRouter } from "expo-router";

import { useHotel, useHotelEnquiry } from "@ampm/api-client";
import type { HotelEnquiryClientDetailView } from "@ampm/core";
import { Card, QueryErrorState, Screen, ScreenHeader, Skeleton, Stack, StatusChip } from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { enquiryChip } from "./consultancy.format";
import { EnquiryActivity } from "./enquiry-activity";
import { EnquirySummary } from "./enquiry-summary";
import { AgreementSection, ProposalsSection } from "./request-commercial";
import { MilestonesSection, VisitsSection } from "./request-progress";

/**
 * CP: one hotel request and everything hanging off it (D8): the stay and its status stepper, the
 * agreement, the proposals, visits, milestones and the activity. A detail screen: a back button and
 * no tab bar.
 */
export function RequestDetailScreen({ enquiryId }: { readonly enquiryId: string }) {
  const router = useRouter();
  const enquiry = useHotelEnquiry(enquiryId);
  return (
    <Screen
      width="content"
      header={<DetailHeader enquiry={enquiry.data} onBack={() => router.back()} />}
    >
      <DetailBody enquiry={enquiry} enquiryId={enquiryId} />
    </Screen>
  );
}

/**
 * The hotel's name as the title (read through the cached hotel query; "Hotel request" until it
 * arrives, or if it cannot), and the enquiry's status chip at its right once the enquiry has loaded.
 */
function DetailHeader({
  enquiry,
  onBack,
}: {
  readonly enquiry: HotelEnquiryClientDetailView | undefined;
  readonly onBack: () => void;
}) {
  // An empty id leaves the hotel query disabled until the enquiry names its hotel.
  const hotel = useHotel(enquiry?.hotelId ?? "");
  const chip = enquiry ? enquiryChip(enquiry) : null;
  return (
    <ScreenHeader
      eyebrow="Enquiry"
      title={hotel.data?.name ?? "Hotel request"}
      onBack={onBack}
      trailing={chip ? <StatusChip label={chip.label} tone={chip.tone} /> : null}
    />
  );
}

function DetailBody({
  enquiry,
  enquiryId,
}: {
  readonly enquiry: ReturnType<typeof useHotelEnquiry>;
  readonly enquiryId: string;
}) {
  const goToSignIn = useGoToSignIn();
  if (enquiry.isPending) return <DetailLoading />;
  if (enquiry.isError)
    return (
      <QueryErrorState
        error={enquiry.error}
        onRetry={() => void enquiry.refetch()}
        onSignIn={goToSignIn}
        signIn={{ title: "Sign in to view this request" }}
        notFound={{ title: "Request not found" }}
      />
    );
  return (
    <Stack gap={6}>
      <EnquirySummary enquiry={enquiry.data} />
      <AgreementSection enquiryId={enquiryId} />
      <ProposalsSection enquiryId={enquiryId} />
      <VisitsSection enquiryId={enquiryId} />
      <MilestonesSection enquiryId={enquiryId} />
      <EnquiryActivity events={enquiry.data.events} />
    </Stack>
  );
}

function DetailLoading() {
  return (
    <Stack gap={4} testID="request-detail-loading">
      <Card padding="lg">
        <Stack gap={4.5}>
          <Skeleton shape="text" className="w-2/3" />
          <Skeleton className="h-14 w-full" />
        </Stack>
      </Card>
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </Stack>
  );
}
