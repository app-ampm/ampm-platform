import type { ReactNode } from "react";

import {
  clientAmount,
  formatAmount,
  formatDay,
  internalAmount,
  type HotelProposalInternalView,
} from "@ampm/core";
import { Card, formatMoney, InternalPanel, MoneyText, Row, Stack, Text } from "@ampm/ui";

import { rateItemLabel } from "./consultancy-admin.form";
import { proposalStanding, staffProposalBadge } from "./consultancy-admin.format";
import { ProposalActions } from "./proposal-actions";
import { ProposalEditForm } from "./proposal-edit-form";
import { FigureRow, RecordHeader } from "./section-parts";
import { useSectionCard } from "./use-section-card";

type ProposalLine = HotelProposalInternalView["lines"][number];

export interface ProposalCardProps {
  readonly proposal: HotelProposalInternalView;
  readonly enquiryId: string;
  /** The draft is open in the edit form in place of the card. */
  readonly editing?: boolean | undefined;
  readonly onEdit?: (() => void) | undefined;
  readonly onEditDone?: (() => void) | undefined;
  readonly onRevised?: ((proposalId: string) => void) | undefined;
}

const noop = (): void => undefined;

/**
 * One proposal version as staff see it (T6 "Proposal, version 1 · draft"): where it stands in a line
 * under its title, then what the client sees — the client total and the client-visible lines, client
 * amounts in MoneyText. The internal total, the derived margin and the internal-only lines sit inside
 * an InternalPanel, never in the card itself (Peacock Night §3, security.md). A draft being edited is
 * drawn as its edit form instead.
 */
export function ProposalCard({
  proposal,
  enquiryId,
  editing = false,
  onEdit = noop,
  onEditDone = noop,
  onRevised = noop,
}: ProposalCardProps) {
  const card = useSectionCard();
  if (editing && proposal.status === "draft")
    return <ProposalEditForm proposal={proposal} enquiryId={enquiryId} onDone={onEditDone} />;
  return (
    <Card tone={card.tone} className={card.className} testID={`proposal-${proposal.id}`}>
      <Stack gap={4}>
        <Stack gap={1}>
          <RecordHeader
            title={`Proposal, version ${proposal.versionNumber}`}
            badge={staffProposalBadge[proposal.status]}
          />
          <Text variant="bodySmall" tone="muted">
            {proposalStanding(proposal)}
          </Text>
        </Stack>
        <ProposalClientTotal proposal={proposal} />
        <ClientLines lines={proposal.lines.filter((line) => line.clientVisible)} />
        <ProposalInternal proposal={proposal} />
        <ProposalActions
          proposal={proposal}
          enquiryId={enquiryId}
          onEdit={onEdit}
          onRevised={onRevised}
        />
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
