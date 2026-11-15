import { useRouter } from "expo-router";

import { useStaffEnquiries } from "@ampm/api-client";
import { formatDayRange, type HotelEnquiryStaffView } from "@ampm/core";
import { Card, ListItem, SectionError, Skeleton, Stack, StatusChip, Text } from "@ampm/ui";

import {
  enquiryQueueLine,
  proposalTag,
  staffEnquiryBadge,
} from "../consultancy-admin/consultancy-admin.format";

/**
 * One of the client's enquiries: the hotel (the client is the page), guests and age, the stay as data,
 * and the status with the newest proposal's tag at the right. Opens the enquiry (TW-27).
 */
function AccountEnquiryRow({
  enquiry,
  onPress,
}: {
  readonly enquiry: HotelEnquiryStaffView;
  readonly onPress: () => void;
}) {
  const badge = staffEnquiryBadge[enquiry.status];
  const proposal = proposalTag(enquiry.latestProposal);
  const title = enquiry.hotelName ?? "Hotel enquiry";
  const subtitle = enquiryQueueLine(enquiry);
  const stay = formatDayRange(enquiry.dateFrom, enquiry.dateTo);
  return (
    <ListItem
      title={title}
      subtitle={subtitle}
      meta={formatDayRange(enquiry.dateFrom, enquiry.dateTo, { style: "data" })}
      trailing={
        <Stack gap={1} align="end">
          <StatusChip label={badge.label} tone={badge.tone} size="sm" />
          {proposal ? <StatusChip label={proposal.label} tone={proposal.tone} size="sm" /> : null}
        </Stack>
      }
      onPress={onPress}
      accessibilityLabel={[title, badge.label, proposal?.label, subtitle, stay]
        .filter(Boolean)
        .join(", ")}
      testID={`account-enquiry-${enquiry.id}`}
    />
  );
}

/** The loaded enquiries in one card; a longer history says only the newest page shows. */
function EnquiryList({
  items,
  hasMore,
  onOpen,
}: {
  readonly items: readonly HotelEnquiryStaffView[];
  readonly hasMore: boolean;
  readonly onOpen: (enquiryId: string) => void;
}) {
  return (
    <Card padding="sm">
      <Stack gap={2}>
        {items.map((enquiry) => (
          <AccountEnquiryRow
            key={enquiry.id}
            enquiry={enquiry}
            onPress={() => onOpen(enquiry.id)}
          />
        ))}
        {hasMore ? (
          <Text variant="bodySmall" tone="muted">{`Showing the newest ${items.length}.`}</Text>
        ) : null}
      </Stack>
    </Card>
  );
}

export interface AccountEnquiriesProps {
  readonly accountId: string;
  /** Whether the reader may see enquiries (`consultancy.enquiries.read`); no request otherwise. */
  readonly canRead: boolean;
}

/**
 * The client's hotel enquiries (TW-13 Hotels), newest first, each opening the enquiry. Hidden for a
 * role without the enquiry grant; a refused load hides it too (SectionError), a failed one retries.
 */
export function AccountEnquiries({ accountId, canRead }: AccountEnquiriesProps) {
  const router = useRouter();
  const enquiries = useStaffEnquiries({ accountId }, { enabled: canRead });
  if (!canRead) return null;
  if (enquiries.isError) {
    return (
      <SectionError
        title="Hotel enquiries"
        error={enquiries.error}
        onRetry={() => void enquiries.refetch()}
      />
    );
  }
  const items = enquiries.data?.items ?? [];
  return (
    <Stack gap={2} testID="account-enquiries">
      <Text variant="heading">Hotel enquiries</Text>
      {enquiries.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : items.length === 0 ? (
        <Text variant="bodySmall" tone="muted">
          No hotel enquiries yet. One appears when the client asks for help with a hotel.
        </Text>
      ) : (
        <EnquiryList
          items={items}
          hasMore={Boolean(enquiries.data?.nextCursor)}
          onOpen={(enquiryId) => router.push(`/enquiries/${enquiryId}`)}
        />
      )}
    </Stack>
  );
}
