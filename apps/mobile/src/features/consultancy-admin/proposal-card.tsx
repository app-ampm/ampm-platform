import type { ReactNode } from "react";

import { useReviseProposal, useShareProposal } from "@ampm/api-client";
import {
  clientAmount,
  formatAmount,
  formatDay,
  internalAmount,
  type HotelProposalInternalView,
} from "@ampm/core";
import {
  Button,
  Card,
  formatMoney,
  InternalPanel,
  MoneyText,
  Row,
  Stack,
  Text,
  useToast,
} from "@ampm/ui";

import { rateItemLabel } from "./consultancy-admin.form";
import { staffProposalBadge } from "./consultancy-admin.format";
import { FigureRow, RecordHeader } from "./section-parts";
import { useSectionCard } from "./use-section-card";

type ProposalLine = HotelProposalInternalView["lines"][number];

/**
 * One proposal version as staff see it (T6 "Proposal, version 1 · draft"). The card holds what the
 * client sees: the client total and the client-visible lines, client amounts in MoneyText. The internal
 * total, the derived margin and the internal-only lines sit inside an InternalPanel, never in the card
 * itself (Peacock Night §3, security.md).
 */
export function ProposalCard({
  proposal,
  enquiryId,
}: {
  readonly proposal: HotelProposalInternalView;
  readonly enquiryId: string;
}) {
  const card = useSectionCard();
  return (
    <Card tone={card.tone} className={card.className} testID={`proposal-${proposal.id}`}>
      <Stack gap={4}>
        <RecordHeader
          title={`Proposal, version ${proposal.versionNumber}`}
          badge={staffProposalBadge[proposal.status]}
        />
        <ProposalClientTotal proposal={proposal} />
        <ClientLines lines={proposal.lines.filter((line) => line.clientVisible)} />
        <ProposalInternal proposal={proposal} />
        <ProposalActions proposal={proposal} enquiryId={enquiryId} />
      </Stack>
    </Card>
  );
}

function ProposalClientTotal({ proposal }: { readonly proposal: HotelProposalInternalView }) {
  return (
    <Stack gap={1}>
      <Text variant="eyebrow">Client total</Text>
      <MoneyText
        amount={clientAmount(proposal.clientTotal.minor, proposal.clientTotal.currency)}
        variant="title"
      />
      {proposal.validUntil ? (
        <Text variant="bodySmall" tone="muted">
          {`Valid until ${formatDay(proposal.validUntil)}`}
        </Text>
      ) : null}
    </Stack>
  );
}

/** A line under a hairline: the description in full, its kind and quantity × unit price, its total. */
function LineRow({
  line,
  unitPrice,
  total,
}: {
  readonly line: ProposalLine;
  readonly unitPrice: string;
  readonly total: ReactNode;
}) {
  return (
    <Row gap={3} align="start" className="border-t border-primary/16 py-3">
      <Stack gap={1} className="flex-1">
        <Text weight="semibold" tone="primary">
          {line.description}
        </Text>
        <Text variant="data" tone="muted">
          {`${rateItemLabel(line.itemType)} · ${line.quantity} × ${unitPrice}`}
        </Text>
      </Stack>
      {total}
    </Row>
  );
}

/** The lines the client sees: client amounts, so MoneyText (and formatMoney for the unit price). */
function ClientLines({ lines }: { readonly lines: readonly ProposalLine[] }) {
  if (lines.length === 0) return null;
  return (
    <Stack gap={0}>
      <Text variant="eyebrow" className="pb-2">
        Lines the client sees
      </Text>
      {lines.map((line) => (
        <LineRow
          key={line.id}
          line={line}
          unitPrice={
            formatMoney(clientAmount(line.unitAmount.minor, line.unitAmount.currency)).text
          }
          total={
            <MoneyText amount={clientAmount(line.totalAmount.minor, line.totalAmount.currency)} />
          }
        />
      ))}
    </Stack>
  );
}

/** The RESTRICTED-FINANCE figures a client never sees — absent (not rendered) for a reader without the grant. */
function ProposalInternal({ proposal }: { readonly proposal: HotelProposalInternalView }) {
  const { internalTotal, margin } = proposal;
  const lines = proposal.lines.filter((line) => !line.clientVisible);
  if (!internalTotal && !margin && lines.length === 0) return null;
  return (
    <InternalPanel className="rounded" testID={`proposal-internal-${proposal.id}`}>
      {internalTotal ? (
        <FigureRow
          label="Internal total"
          value={formatAmount(internalAmount(internalTotal.minor, internalTotal.currency))}
        />
      ) : null}
      {margin ? (
        <FigureRow
          label="Margin"
          value={formatAmount(internalAmount(margin.minor, margin.currency))}
          tone="brand"
        />
      ) : null}
      <InternalLines lines={lines} />
    </InternalPanel>
  );
}

/** Lines kept off the client view: internal amounts, formatted inside the panel, never MoneyText. */
function InternalLines({ lines }: { readonly lines: readonly ProposalLine[] }) {
  if (lines.length === 0) return null;
  return (
    <Stack gap={0} className="pt-2">
      <Text variant="eyebrow" className="pb-2">
        Internal-only lines
      </Text>
      {lines.map((line) => (
        <LineRow
          key={line.id}
          line={line}
          unitPrice={formatAmount(internalAmount(line.unitAmount.minor, line.unitAmount.currency))}
          total={
            <Text variant="data">
              {formatAmount(internalAmount(line.totalAmount.minor, line.totalAmount.currency))}
            </Text>
          }
        />
      ))}
    </Stack>
  );
}

/**
 * Share a draft with the client, or supersede a shared version with a fresh draft to re-price. Sharing
 * is a confirm action on a version, so it is a peacock `highlight` (as "Approve version 3"): the
 * screen's one gold button is the enquiry's next pipeline step.
 */
function ProposalActions({
  proposal,
  enquiryId,
}: {
  readonly proposal: HotelProposalInternalView;
  readonly enquiryId: string;
}) {
  const toast = useToast();
  const share = useShareProposal(proposal.id, enquiryId);
  const revise = useReviseProposal(proposal.id, enquiryId);
  const onError = (): void => {
    toast.show({ title: "Could not update the proposal", tone: "danger" });
  };
  if (proposal.status === "draft") {
    return (
      <Button
        variant="highlight"
        fullWidth
        loading={share.isPending}
        onPress={() => share.mutate(undefined, { onError })}
      >
        {`Share version ${proposal.versionNumber} with client`}
      </Button>
    );
  }
  if (proposal.status === "shared" || proposal.status === "revision_requested") {
    return (
      <Button
        variant="secondary"
        loading={revise.isPending}
        onPress={() => revise.mutate(undefined, { onError })}
      >
        Revise (new version)
      </Button>
    );
  }
  return null;
}
