import { useRouter } from "expo-router";

import { useStaffServiceAgreements } from "@ampm/api-client";
import { clientAmount, type ServiceAgreementStaffView } from "@ampm/core";
import {
  Card,
  ListItem,
  MoneyText,
  SectionError,
  Skeleton,
  Stack,
  StatusChip,
  Text,
} from "@ampm/ui";

import { feeStructureLabel } from "../consultancy-admin/consultancy-admin.form";
import { staffAgreementBadge } from "../consultancy-admin/consultancy-admin.format";

/**
 * One agreement: the service and how its fee is charged, the fee (a client amount: what the client
 * agreed to pay) and the status. One for a hotel enquiry opens that enquiry, where it is worked (TW-27
 * Agreement); one with no enquiry is read here.
 */
function AgreementRow({
  agreement,
  onPress,
}: {
  readonly agreement: ServiceAgreementStaffView;
  readonly onPress: (() => void) | undefined;
}) {
  const badge = staffAgreementBadge[agreement.status];
  const structure = feeStructureLabel(agreement.feeStructure);
  return (
    <ListItem
      title={agreement.serviceName}
      subtitle={agreement.hotelEnquiryId ? `${structure} · hotel enquiry` : structure}
      trailing={
        <Stack gap={1} align="end">
          <MoneyText amount={clientAmount(agreement.fee.minor, agreement.fee.currency)} />
          <StatusChip label={badge.label} tone={badge.tone} size="sm" />
        </Stack>
      }
      showChevron={onPress !== undefined}
      onPress={onPress}
      accessibilityLabel={`${agreement.serviceName}, ${badge.label}, ${structure}`}
      testID={`account-agreement-${agreement.id}`}
    />
  );
}

/** The loaded agreements in one card; one for a hotel enquiry opens it. */
function AgreementList({
  items,
  onOpenEnquiry,
}: {
  readonly items: readonly ServiceAgreementStaffView[];
  readonly onOpenEnquiry: (enquiryId: string) => void;
}) {
  return (
    <Card padding="sm">
      <Stack gap={2}>
        {items.map((agreement) => {
          const enquiryId = agreement.hotelEnquiryId;
          return (
            <AgreementRow
              key={agreement.id}
              agreement={agreement}
              onPress={enquiryId ? () => onOpenEnquiry(enquiryId) : undefined}
            />
          );
        })}
      </Stack>
    </Card>
  );
}

export interface AccountAgreementsProps {
  readonly accountId: string;
  /** Whether the reader may see agreements (`crm.service_agreements.read`); no request otherwise. */
  readonly canRead: boolean;
}

/**
 * The client's paid-service agreements (TW-13 Agreements). Hidden for a role without the grant; a
 * refused load hides it too (SectionError), a failed one retries.
 */
export function AccountAgreements({ accountId, canRead }: AccountAgreementsProps) {
  const router = useRouter();
  const agreements = useStaffServiceAgreements({ accountId }, { enabled: canRead });
  if (!canRead) return null;
  if (agreements.isError) {
    return (
      <SectionError
        title="Service agreements"
        error={agreements.error}
        onRetry={() => void agreements.refetch()}
      />
    );
  }
  const items = agreements.data?.items ?? [];
  return (
    <Stack gap={2} testID="account-agreements">
      <Text variant="heading">Service agreements</Text>
      {agreements.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : items.length === 0 ? (
        <Text variant="bodySmall" tone="muted">
          No agreements yet. Sales drafts one from a hotel enquiry that asks for a paid service.
        </Text>
      ) : (
        <AgreementList
          items={items}
          onOpenEnquiry={(enquiryId) => router.push(`/enquiries/${enquiryId}`)}
        />
      )}
    </Stack>
  );
}
