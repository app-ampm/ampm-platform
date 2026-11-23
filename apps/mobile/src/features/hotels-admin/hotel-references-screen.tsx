import { useState, type ReactNode } from "react";

import { useDeleteHotelReference, useHotelReferences, useStaffHotel } from "@ampm/api-client";
import type { WeddingReferenceView } from "@ampm/core";
import {
  Card,
  ConfirmSheet,
  Divider,
  QueryErrorState,
  Screen,
  Skeleton,
  SplitPane,
  Stack,
  Text,
  useToast,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { HotelRecordHeader } from "./hotel-record-header";
import { ReferenceEditSheet } from "./reference-edit-sheet";
import { ReferenceRow } from "./reference-row";
import { referencesClientView, referenceTitle, shownSummary } from "./references.format";
import { SubresourceSection } from "./subresource-section";
import { useReferencePermissions, type ReferencePermissions } from "./use-reference-permissions";

function ReferencesLoading() {
  return (
    <Stack gap={4} testID="references-loading">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </Stack>
  );
}

/**
 * T5's side column: what clients see of the hotel's past weddings today, and the rule that decides it
 * (GP-20). Counts in words, never colour alone.
 */
function ReferencesClientViewPanel({
  references,
}: {
  readonly references: readonly WeddingReferenceView[];
}) {
  const view = referencesClientView(references);
  return (
    <Card testID="references-client-view">
      <Stack gap={3}>
        <Text variant="subheading">What clients see</Text>
        <Text variant="bodySmall" tone="primary" testID="references-shown">
          {shownSummary(view)}
        </Text>
        {view.ready > 0 ? (
          <Text variant="bodySmall" tone="body">{`${view.ready} ready to show`}</Text>
        ) : null}
        {view.awaitingConsent > 0 ? (
          <Text
            variant="bodySmall"
            tone="body"
          >{`${view.awaitingConsent} waiting for consent`}</Text>
        ) : null}
        <Divider />
        <Text variant="bodySmall" tone="muted">
          A past wedding reaches the hotel page only with the couple's consent on file and once you
          choose to show it. Attaching consent never shows it by itself.
        </Text>
      </Stack>
    </Card>
  );
}

/** The add / edit / remove state for the list, kept out of the view. */
function useReferenceEditing(hotelId: string) {
  const toast = useToast();
  const remove = useDeleteHotelReference(hotelId);
  const [editing, setEditing] = useState<{ readonly item: WeddingReferenceView | null } | null>(
    null,
  );
  const [deleting, setDeleting] = useState<WeddingReferenceView | null>(null);
  const confirmDelete = (): void => {
    if (!deleting || remove.isPending) return;
    const title = referenceTitle(deleting);
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.show({ title: `The ${title} was removed`, tone: "success" });
        setDeleting(null);
      },
      onError: () => toast.show({ title: "Could not remove the reference", tone: "danger" }),
    });
  };
  return { editing, setEditing, deleting, setDeleting, confirmDelete, pending: remove.isPending };
}

/** The confirm shown before a reference is removed (gold outline, never red). */
function ReferenceRemoveConfirm({
  reference,
  pending,
  onClose,
  onConfirm,
}: {
  readonly reference: WeddingReferenceView | null;
  readonly pending: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}) {
  return (
    <ConfirmSheet
      open={reference !== null}
      onClose={onClose}
      title={reference ? `Remove the ${referenceTitle(reference)}?` : "Remove reference?"}
      description="This removes the reference from the hotel, and from the hotel page if clients see it."
      confirmLabel="Remove"
      destructive
      loading={pending}
      onConfirm={onConfirm}
      testID="reference-remove"
    />
  );
}

interface ReferencesListProps {
  readonly hotelId: string;
  readonly references: readonly WeddingReferenceView[];
  readonly permissions: ReferencePermissions;
}

/** The rows, a divider between each. */
function ReferenceRows({
  hotelId,
  references,
  permissions,
  onEdit,
  onDelete,
}: ReferencesListProps & {
  readonly onEdit: (reference: WeddingReferenceView) => void;
  readonly onDelete: (reference: WeddingReferenceView) => void;
}) {
  return references.map((reference, index) => (
    <Stack key={reference.id} gap={3}>
      {index > 0 ? <Divider /> : null}
      <ReferenceRow
        hotelId={hotelId}
        reference={reference}
        canUpdate={permissions.canUpdate}
        canDelete={permissions.canDelete}
        onEdit={() => onEdit(reference)}
        onDelete={() => onDelete(reference)}
      />
    </Stack>
  ));
}

/** The hotel's previous weddings, newest first, with their add / edit / remove. */
function ReferencesList({ hotelId, references, permissions }: ReferencesListProps) {
  const m = useReferenceEditing(hotelId);
  return (
    <>
      <SubresourceSection
        title="Previous weddings"
        addLabel={permissions.canCreate ? "Add reference" : undefined}
        onAdd={permissions.canCreate ? () => m.setEditing({ item: null }) : undefined}
        isEmpty={references.length === 0}
        emptyText={
          permissions.canCreate
            ? "No past weddings yet. Add one the hotel has hosted to show clients what it can do."
            : "No past weddings recorded for this hotel yet."
        }
        testID="reference-section"
      >
        <ReferenceRows
          hotelId={hotelId}
          references={references}
          permissions={permissions}
          onEdit={(item) => m.setEditing({ item })}
          onDelete={m.setDeleting}
        />
      </SubresourceSection>
      <ReferenceEditSheet
        hotelId={hotelId}
        open={m.editing !== null}
        reference={m.editing?.item ?? null}
        onClose={() => m.setEditing(null)}
      />
      <ReferenceRemoveConfirm
        reference={m.deleting}
        pending={m.pending}
        onClose={() => m.setDeleting(null)}
        onConfirm={m.confirmDelete}
      />
    </>
  );
}

function ReferencesBody({ hotelId }: { readonly hotelId: string }) {
  const references = useHotelReferences(hotelId);
  const permissions = useReferencePermissions();
  const goToSignIn = useGoToSignIn();
  if (references.isPending) return <ReferencesLoading />;
  if (references.isError) {
    return (
      <QueryErrorState
        error={references.error}
        onRetry={() => void references.refetch()}
        onSignIn={goToSignIn}
        signIn={{
          title: "Sign in to manage this hotel",
          description: "Your session has ended. Sign in again to continue.",
        }}
      />
    );
  }
  return (
    <SplitPane
      sideWidth="sm"
      side={<ReferencesClientViewPanel references={references.data} />}
      testID="references-split"
    >
      <ReferencesList hotelId={hotelId} references={references.data} permissions={permissions} />
    </SplitPane>
  );
}

export interface HotelReferencesScreenProps {
  readonly hotelId: string;
  readonly tabBar?: ReactNode;
}

/**
 * The staff hotel record's References tab (TW-22, feature 9.3): the weddings the hotel has hosted,
 * shown to clients as social proof only once the couple's consent is on file and staff choose to show
 * them (GP-20). Read by SA, SM, HT and PM; changed by SA and HT, gated server-side.
 *
 *   <HotelReferencesScreen hotelId={id} tabBar={<AppTabBar />} />
 */
export function HotelReferencesScreen({ hotelId, tabBar }: HotelReferencesScreenProps) {
  const hotel = useStaffHotel(hotelId);
  return (
    <Screen
      width="wide"
      tabBar={tabBar}
      header={<HotelRecordHeader hotelId={hotelId} section="references" hotel={hotel.data} />}
    >
      <ReferencesBody hotelId={hotelId} />
    </Screen>
  );
}
