import { useRouter } from "expo-router";

import { useHotelEnquiries } from "@ampm/api-client";
import { Card, cn, Link, Skeleton, Stack } from "@ampm/ui";

import { RequestRow } from "../consultancy/request-row";
import { EnquiriesPanel } from "./enquiries-panel";
import { HOME_PANEL } from "./home-panel.styles";
import { PanelHeading } from "./panel-heading";

/** D4 lists three; the rest are one tap away on the requests page (D8). */
const PREVIEW_LIMIT = 3;

interface EnquiriesPreviewProps {
  readonly className?: string | undefined;
}

/**
 * D4's "Enquiries" column on a desktop: the client's latest hotel requests with their status chips, and
 * "All →" to the requests page. While they load it shows a skeleton; with none yet, or on an error, it
 * falls back to the entry row into the requests page, so the home always offers the way in.
 */
export function EnquiriesPreview({ className }: EnquiriesPreviewProps) {
  const router = useRouter();
  const enquiries = useHotelEnquiries();
  if (enquiries.isPending) return <EnquiriesPreviewLoading className={className} />;
  if (enquiries.isError || enquiries.items.length === 0)
    return <EnquiriesPanel className={className} />;
  return (
    <Card padding="sm" className={cn(HOME_PANEL, className)} testID="enquiries-preview">
      <PanelHeading title="Enquiries">
        <Link
          href="/portal/requests"
          variant="standalone"
          textVariant="label"
          accessibilityLabel="All hotel requests"
        >
          All →
        </Link>
      </PanelHeading>
      <Stack gap={2}>
        {enquiries.items.slice(0, PREVIEW_LIMIT).map((enquiry) => (
          <RequestRow
            key={enquiry.id}
            enquiry={enquiry}
            onOpen={() => router.push(`/portal/requests/${enquiry.id}`)}
          />
        ))}
      </Stack>
    </Card>
  );
}

function EnquiriesPreviewLoading({ className }: EnquiriesPreviewProps) {
  // The Skeletons are hidden from assistive tech, so the Card announces the load itself (WCAG 4.1.3).
  return (
    <Card
      padding="sm"
      accessible
      accessibilityLabel="Loading your hotel requests"
      className={cn(HOME_PANEL, "gap-3", className)}
      testID="enquiries-preview-loading"
    >
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-16 w-full rounded" />
      <Skeleton className="h-16 w-full rounded" />
    </Card>
  );
}
