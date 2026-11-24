import { useState, type ReactNode } from "react";
import { useRouter } from "expo-router";
import type { UseQueryResult } from "@tanstack/react-query";

import { useDeleteHotelDocument, useHotelDocuments, useStaffHotel } from "@ampm/api-client";
import { isAppError, type HotelDocumentView, type RateCardView } from "@ampm/core";
import {
  Button,
  Callout,
  ConfirmSheet,
  EmptyState,
  QueryErrorState,
  Screen,
  Skeleton,
  SplitPane,
  Stack,
  useToast,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { DocumentGroups, type DocumentGroupsProps } from "./document-groups";
import { DocumentUploadSheet } from "./document-upload-sheet";
import { DocumentsGuidePanel } from "./documents-guide-panel";
import { deleteDocumentWarning, fbCardPrefill } from "./hotel-documents.format";
import { HotelRecordHeader } from "./hotel-record-header";
import { HOTEL_RECORD_PATHNAME } from "./hotel-record.format";
import { RateCardEditSheet } from "./rate-card-edit-sheet";
import type { RateCardDraft } from "./rate-cards.form";
import { useDocumentPermissions } from "./use-document-permissions";

/** The upload sheet's opening: a new key each time, so every opening starts from a fresh draft. */
function useUploadSheet() {
  const [state, setState] = useState<{
    readonly key: number;
    readonly open: boolean;
    readonly replacing: HotelDocumentView | null;
  }>({ key: 0, open: false, replacing: null });
  const start = (replacing: HotelDocumentView | null): void =>
    setState((previous) => ({ key: previous.key + 1, open: true, replacing }));
  const close = (): void => setState((previous) => ({ ...previous, open: false }));
  return { ...state, start, close };
}

/**
 * Deleting a document: the one awaiting the confirm, then the delete. A refusal closes the confirm too:
 * it is mostly a newer version filed since, and the list has refreshed to show it.
 */
function useDocumentDelete(hotelId: string) {
  const toast = useToast();
  const remove = useDeleteHotelDocument(hotelId);
  const [deleting, setDeleting] = useState<HotelDocumentView | null>(null);
  const confirm = (): void => {
    if (!deleting || remove.isPending) return;
    remove.mutate(deleting.id, {
      onSuccess: () => toast.show({ title: `${deleting.title} deleted`, tone: "success" }),
      onError: (error) =>
        toast.show({
          title: isAppError(error) ? error.message : "Could not delete the document",
          tone: "danger",
        }),
      onSettled: () => setDeleting(null),
    });
  };
  return { deleting, setDeleting, confirm, pending: remove.isPending };
}

/** A menu's draft F&B card: the rate-card sheet's prefill while it is open, and the card once created. */
function useFbCard() {
  const [prefill, setPrefill] = useState<Partial<RateCardDraft> | null>(null);
  const [started, setStarted] = useState<RateCardView | null>(null);
  const start = (document: HotelDocumentView): void => setPrefill(fbCardPrefill(document));
  return { prefill, started, start, close: () => setPrefill(null), created: setStarted };
}

function DocumentsLoading() {
  return (
    <Stack gap={4} testID="documents-loading">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </Stack>
  );
}

interface BodyProps extends Omit<DocumentGroupsProps, "documents"> {
  readonly documents: UseQueryResult<HotelDocumentView[]>;
}

/** The library's states: loading, error or offline, empty, then the groups. */
function DocumentsBody({ documents, ...groups }: BodyProps) {
  const goToSignIn = useGoToSignIn();
  if (documents.isPending) return <DocumentsLoading />;
  if (documents.isError) {
    return (
      <QueryErrorState
        error={documents.error}
        onRetry={() => void documents.refetch()}
        onSignIn={goToSignIn}
        signIn={{
          title: "Sign in to see this hotel's documents",
          description: "Your session has ended. Sign in again to continue.",
        }}
        notFound={{
          title: "No documents to show",
          description:
            "This hotel may have been removed, or its documents are not open to your role.",
        }}
      />
    );
  }
  if (documents.data.length === 0) {
    return (
      <EmptyState
        icon="file"
        title="No documents yet"
        description={
          groups.permissions.canUpload
            ? "Upload the hotel's fact sheet, menus and floor plans to keep them with its record."
            : "Nobody has uploaded this hotel's fact sheet, menus or floor plans yet."
        }
        testID="documents-empty"
      />
    );
  }
  return <DocumentGroups documents={documents.data} {...groups} />;
}

/** Where a menu's draft F&B card went, with the way there (the Rate cards tab, in place). */
function StartedCardCallout({
  card,
  hotelId,
}: {
  readonly card: RateCardView;
  readonly hotelId: string;
}) {
  const router = useRouter();
  const openRates = (): void =>
    router.replace({ pathname: HOTEL_RECORD_PATHNAME.rates, params: { hotelId } });
  return (
    <Callout
      kind="success"
      title="Draft F&B card started"
      action={{ label: "Open rate cards", onPress: openRates }}
      testID="documents-card-started"
    >
      {`${card.name} is a draft on the Rate cards tab. Add its prices there: nothing reaches clients until the card is verified.`}
    </Callout>
  );
}

/** The confirm before a document goes, saying that every version goes with it (gold outline, no red). */
function DocumentDeleteConfirm({
  removal,
}: {
  readonly removal: ReturnType<typeof useDocumentDelete>;
}) {
  const document = removal.deleting;
  return (
    <ConfirmSheet
      open={document !== null}
      onClose={() => removal.setDeleting(null)}
      title={document ? `Delete ${document.title}?` : "Delete document?"}
      description={document ? deleteDocumentWarning(document) : ""}
      confirmLabel="Delete document"
      destructive
      loading={removal.pending}
      onConfirm={removal.confirm}
      testID="document-delete"
    />
  );
}

export interface HotelDocumentsScreenProps {
  readonly hotelId: string;
  readonly tabBar?: ReactNode;
}

/**
 * The staff hotel record's Documents tab (D-187 §6): the hotel's fact sheets, menus, floor plans and
 * other files by type, each with its earlier versions, opened through 15-minute links. The Hotel team
 * and the Super Admin upload (the screen's gold action), replace and delete; on a menu they start a
 * draft F&B rate card. Read by SA, SM, HT and PM; every action is hidden without its grant (D-164) and
 * gated server-side. From 1024 the library sits beside T5's side column (what each type takes).
 *
 *   <HotelDocumentsScreen hotelId={id} tabBar={<AppTabBar />} />
 */
export function HotelDocumentsScreen({ hotelId, tabBar }: HotelDocumentsScreenProps) {
  const documents = useHotelDocuments(hotelId);
  const permissions = useDocumentPermissions();
  const upload = useUploadSheet();
  const removal = useDocumentDelete(hotelId);
  const card = useFbCard();
  const onUpload = permissions.canUpload ? () => upload.start(null) : undefined;
  return (
    <Screen
      width="wide"
      tabBar={tabBar}
      header={<DocumentsHeader hotelId={hotelId} onUpload={onUpload} />}
    >
      <SplitPane
        sideWidth="sm"
        side={<DocumentsGuidePanel count={documents.data?.length} />}
        testID="documents-split"
      >
        <Stack gap={6}>
          {card.started ? <StartedCardCallout card={card.started} hotelId={hotelId} /> : null}
          <DocumentsBody
            hotelId={hotelId}
            documents={documents}
            permissions={permissions}
            onReplace={upload.start}
            onDelete={removal.setDeleting}
            onStartCard={card.start}
          />
        </Stack>
      </SplitPane>
      <DocumentSheets hotelId={hotelId} upload={upload} removal={removal} card={card} />
    </Screen>
  );
}

/** The record's header on its Documents tab, with the screen's one gold action for a role that uploads. */
function DocumentsHeader({
  hotelId,
  onUpload,
}: {
  readonly hotelId: string;
  /** Opens the upload sheet; left out for a role that may not upload. */
  readonly onUpload: (() => void) | undefined;
}) {
  const hotel = useStaffHotel(hotelId);
  const upload = onUpload ? (
    <Button variant="primary" size="sm" icon="upload" onPress={onUpload} testID="documents-upload">
      Upload document
    </Button>
  ) : undefined;
  return (
    <HotelRecordHeader hotelId={hotelId} section="documents" hotel={hotel.data} actions={upload} />
  );
}

/**
 * The upload sheet, the delete confirm and a menu's draft F&B card. At screen level, outside the split,
 * so an open sheet survives the window crossing 1024.
 */
function DocumentSheets({
  hotelId,
  upload,
  removal,
  card,
}: {
  readonly hotelId: string;
  readonly upload: ReturnType<typeof useUploadSheet>;
  readonly removal: ReturnType<typeof useDocumentDelete>;
  readonly card: ReturnType<typeof useFbCard>;
}) {
  return (
    <>
      <DocumentUploadSheet
        key={upload.key}
        hotelId={hotelId}
        open={upload.open}
        replacing={upload.replacing}
        onClose={upload.close}
      />
      <DocumentDeleteConfirm removal={removal} />
      <RateCardEditSheet
        hotelId={hotelId}
        open={card.prefill !== null}
        card={null}
        prefill={card.prefill ?? undefined}
        onClose={card.close}
        onCreated={card.created}
      />
    </>
  );
}
