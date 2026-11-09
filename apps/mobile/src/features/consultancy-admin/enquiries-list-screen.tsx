import type { ReactNode } from "react";
import { useRouter } from "expo-router";

import { useStaffEnquiries } from "@ampm/api-client";
import { formatDayRange, type HotelEnquiryStaffView } from "@ampm/core";
import {
  Card,
  EmptyState,
  ListItem,
  QueryErrorState,
  Screen,
  ScreenHeader,
  Skeleton,
  Stack,
  StatusChip,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import {
  ROLE_WITHOUT_GRANT,
  UNASSIGNED_BADGE,
  enquiryQueueLine,
  queueEyebrow,
  staffEnquiryBadge,
} from "./consultancy-admin.format";

type EnquiriesQuery = ReturnType<typeof useStaffEnquiries>;

/**
 * The staff hotel-enquiry queue (consultancy-admin, T6): every account's enquiries, newest first, as
 * rows in one glass panel. A top-level screen: the route passes the app's tab bar, and on wide windows
 * the layout draws the rail instead.
 */
export function StaffEnquiriesListScreen({ tabBar }: { readonly tabBar?: ReactNode }) {
  const enquiries = useStaffEnquiries();
  const hasRows = enquiries.isSuccess && enquiries.data.items.length > 0;
  const eyebrow = hasRows ? queueEyebrow(enquiries.data) : undefined;
  return (
    <Screen
      width="wide"
      tabBar={tabBar}
      header={<ScreenHeader eyebrow={eyebrow} title="Enquiries" />}
    >
      <QueueBody enquiries={enquiries} />
    </Screen>
  );
}

function QueueBody({ enquiries }: { readonly enquiries: EnquiriesQuery }) {
  const router = useRouter();
  const goToSignIn = useGoToSignIn();
  if (enquiries.isPending) return <QueueLoading />;
  if (enquiries.isError)
    return (
      <QueryErrorState
        error={enquiries.error}
        onRetry={() => void enquiries.refetch()}
        onSignIn={goToSignIn}
        signIn={{ title: "Sign in to view enquiries" }}
        forbidden={ROLE_WITHOUT_GRANT}
      />
    );
  if (enquiries.data.items.length === 0)
    return (
      <EmptyState
        icon="inbox"
        title="No hotel enquiries yet"
        description="Enquiries arrive here when a client asks AMPM to check a hotel."
      />
    );
  return (
    <Card padding="sm" className="md:p-5.5">
      <Stack gap={2}>
        {enquiries.data.items.map((enquiry) => (
          <EnquiryRow
            key={enquiry.id}
            enquiry={enquiry}
            onPress={() => router.push(`/enquiries/${enquiry.id}`)}
          />
        ))}
      </Stack>
    </Card>
  );
}

/**
 * One enquiry in the queue: what is being planned, the guests and the age, the stay as data, the
 * status chip and, when nobody holds it yet, the gold "Unassigned" (the team's to pick up). The staff
 * view carries no reference, client or hotel name, so the row leaves them out.
 */
function EnquiryRow({
  enquiry,
  onPress,
}: {
  readonly enquiry: HotelEnquiryStaffView;
  readonly onPress: () => void;
}) {
  const badge = staffEnquiryBadge[enquiry.status];
  const unassigned = enquiry.assignedUserId === null;
  const title = enquiry.functionsSummary ?? "Hotel enquiry";
  const subtitle = enquiryQueueLine(enquiry);
  const stay = formatDayRange(enquiry.dateFrom, enquiry.dateTo);
  const spoken = [title, badge.label, unassigned ? UNASSIGNED_BADGE.label : null, subtitle, stay];
  return (
    <ListItem
      title={title}
      subtitle={subtitle}
      meta={formatDayRange(enquiry.dateFrom, enquiry.dateTo, { style: "data" })}
      trailing={
        <Stack gap={1} align="end">
          <StatusChip label={badge.label} tone={badge.tone} size="sm" className="self-end" />
          {unassigned ? (
            <StatusChip
              label={UNASSIGNED_BADGE.label}
              tone={UNASSIGNED_BADGE.tone}
              size="sm"
              className="self-end"
            />
          ) : null}
        </Stack>
      }
      onPress={onPress}
      accessibilityLabel={spoken.filter(Boolean).join(", ")}
    />
  );
}

/** Rows the height of the loaded ones, in the same panel, so the queue does not jump on arrival. */
function QueueLoading() {
  return (
    <Card padding="sm" className="md:p-5.5">
      <Stack gap={2} testID="staff-enquiries-loading">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </Stack>
    </Card>
  );
}
