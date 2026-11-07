import { useRouter } from "expo-router";

import { useStaffEnquiry } from "@ampm/api-client";
import { isAppError, type HotelEnquiryStaffDetailView } from "@ampm/core";
import {
  Card,
  EmptyState,
  ErrorState,
  OfflineState,
  Screen,
  ScreenHeader,
  Skeleton,
  Stack,
  StatusChip,
} from "@ampm/ui";

import { enquiryFacts } from "../consultancy/consultancy.format";
import { staffEnquiryBadge } from "./consultancy-admin.format";
import { EnquiryActivity } from "./enquiry-activity";
import { AgreementSection, ProposalsSection } from "./enquiry-commercial";
import { EnquiryDetails } from "./enquiry-details";
import { MilestonesSection, VisitsSection } from "./enquiry-progress";
import { EnquiryStatusActions } from "./enquiry-status-actions";

type EnquiryQuery = ReturnType<typeof useStaffEnquiry>;

/**
 * The staff view of one enquiry (consultancy-admin, T6's detail): the stay as data over the title in
 * Gilda and the status chip, then the internal detail and the pipeline controls. A detail screen: no
 * tab bar, a back button to the queue.
 */
export function StaffEnquiryDetailScreen({ enquiryId }: { readonly enquiryId: string }) {
  const router = useRouter();
  const enquiry = useStaffEnquiry(enquiryId);
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
 * The header keeps its back button through every state; the reference line and the chip come with the
 * enquiry. The staff view carries no hotel or client name, so the title is the functions summary: free
 * text that can run long, so a phone sets it at 28 (M4's phone titles are smaller still) beside the chip.
 */
function DetailHeader({
  enquiry,
  onBack,
}: {
  readonly enquiry: HotelEnquiryStaffDetailView | undefined;
  readonly onBack: () => void;
}) {
  const badge = enquiry ? staffEnquiryBadge[enquiry.status] : null;
  return (
    <ScreenHeader
      onBack={onBack}
      backLabel="Back to enquiries"
      eyebrow={enquiry ? enquiryFacts(enquiry).toUpperCase() : undefined}
      title={enquiry?.functionsSummary ?? "Hotel enquiry"}
      titleClassName="text-3xl md:text-4xl"
      trailing={badge ? <StatusChip label={badge.label} tone={badge.tone} /> : undefined}
    />
  );
}

function DetailBody({
  enquiry,
  enquiryId,
}: {
  readonly enquiry: EnquiryQuery;
  readonly enquiryId: string;
}) {
  if (enquiry.isPending) return <DetailLoading />;
  if (enquiry.isError)
    return <DetailError error={enquiry.error} onRetry={() => void enquiry.refetch()} />;
  return (
    <Stack gap={4}>
      <EnquiryDetails enquiry={enquiry.data} />
      <EnquiryStatusActions enquiryId={enquiryId} status={enquiry.data.status} />
      <AgreementSection enquiryId={enquiryId} accountId={enquiry.data.accountId} />
      <ProposalsSection enquiryId={enquiryId} />
      <VisitsSection enquiryId={enquiryId} />
      <MilestonesSection enquiryId={enquiryId} />
      <EnquiryActivity events={enquiry.data.events} />
    </Stack>
  );
}

function DetailError({
  error,
  onRetry,
}: {
  readonly error: unknown;
  readonly onRetry: () => void;
}) {
  const router = useRouter();
  if (isAppError(error) && error.code === "network_error")
    return <OfflineState onRetry={onRetry} />;
  if (isAppError(error) && error.code === "unauthenticated")
    return (
      <EmptyState
        icon="lock"
        title="Sign in to view this enquiry"
        action={{
          label: "Sign in",
          variant: "primary",
          onPress: () => router.replace("/sign-in"),
        }}
      />
    );
  if (isAppError(error) && error.code === "forbidden")
    return <EmptyState icon="lock" title="Not available for your role" />;
  if (isAppError(error) && error.code === "not_found")
    return <EmptyState icon="inbox" title="Enquiry not found" />;
  return <ErrorState onRetry={onRetry} />;
}

/** The shapes of the loaded screen (details, then the pipeline panel), so nothing jumps on arrival. */
function DetailLoading() {
  return (
    <Stack gap={4} testID="staff-enquiry-loading">
      <Card>
        <Stack gap={3}>
          <Skeleton shape="text" className="w-40" />
          <Skeleton className="h-16 w-full" />
        </Stack>
      </Card>
      <Skeleton className="h-36 w-full rounded-lg" />
    </Stack>
  );
}
