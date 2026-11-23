import { Linking } from "react-native";

import {
  useAttachReferenceConsent,
  useReferenceConsentLink,
  useUpdateHotelReference,
} from "@ampm/api-client";
import {
  DOCUMENT_UPLOAD_TYPES,
  isAppError,
  MAX_DOCUMENT_UPLOAD_BYTES,
  type WeddingReferenceView,
} from "@ampm/core";
import { Button, pickFile, Row, Text, useToast } from "@ampm/ui";

const LIMIT_MB = MAX_DOCUMENT_UPLOAD_BYTES / (1024 * 1024);

const messageOf = (error: unknown, fallback: string): string =>
  isAppError(error) ? error.message : fallback;

/** Pick the couple's consent and upload it; the size is checked here so a too-big file never uploads. */
function useAttachConsent(hotelId: string, reference: WeddingReferenceView) {
  const toast = useToast();
  const attach = useAttachReferenceConsent(hotelId, reference.id);
  const replacing = reference.consentDocumentId !== null;
  const choose = async (): Promise<void> => {
    if (attach.isPending) return;
    const picked = await pickFile(DOCUMENT_UPLOAD_TYPES.join(","));
    if (!picked) {
      toast.show({ title: "Attach the consent from the web workspace", tone: "info" });
      return;
    }
    if (picked.sizeBytes > MAX_DOCUMENT_UPLOAD_BYTES) {
      toast.show({ title: `This file is over the ${LIMIT_MB} MB limit`, tone: "danger" });
      return;
    }
    attach.mutate(
      { file: picked.file },
      {
        onSuccess: () =>
          toast.show({
            title: replacing ? "Consent replaced" : "Consent attached",
            tone: "success",
          }),
        onError: (error) =>
          toast.show({ title: messageOf(error, "Could not attach the consent"), tone: "danger" }),
      },
    );
  };
  return { choose, pending: attach.isPending };
}

/** Mint a 15-minute link and open it; every press mints its own (a link is a recorded access). */
function useViewConsent(hotelId: string, referenceId: string) {
  const toast = useToast();
  const link = useReferenceConsentLink(hotelId, referenceId);
  const open = (): void => {
    if (link.isPending) return;
    link.mutate(undefined, {
      onSuccess: ({ url }) => void Linking.openURL(url),
      onError: (error) =>
        toast.show({ title: messageOf(error, "Could not open the consent"), tone: "danger" }),
    });
  };
  return { open, pending: link.isPending };
}

/** Show the reference to clients, or take it back to internal; the server holds GP-20 either way. */
function useVisibility(hotelId: string, reference: WeddingReferenceView) {
  const toast = useToast();
  const update = useUpdateHotelReference(hotelId);
  const toggle = (): void => {
    if (update.isPending) return;
    const clientVisible = !reference.clientVisible;
    update.mutate(
      { referenceId: reference.id, body: { clientVisible } },
      {
        onSuccess: () =>
          toast.show({
            title: clientVisible ? "Now shown to clients" : "Hidden from clients",
            tone: "success",
          }),
        onError: (error) =>
          toast.show({ title: messageOf(error, "Could not change who sees it"), tone: "danger" }),
      },
    );
  };
  return { toggle, pending: update.isPending };
}

/** Attach the consent, or replace the one on file. */
function AttachConsentButton({
  hotelId,
  reference,
}: {
  readonly hotelId: string;
  readonly reference: WeddingReferenceView;
}) {
  const attach = useAttachConsent(hotelId, reference);
  const hasConsent = reference.consentDocumentId !== null;
  return (
    <Button
      variant={hasConsent ? "ghost" : "secondary"}
      size="sm"
      icon="paperclip"
      loading={attach.pending}
      onPress={() => void attach.choose()}
      testID={`reference-${reference.id}-attach`}
    >
      {hasConsent ? "Replace consent" : "Attach consent"}
    </Button>
  );
}

/** Show to clients once the consent is on file, or hide again. */
function VisibilityButton({
  hotelId,
  reference,
}: {
  readonly hotelId: string;
  readonly reference: WeddingReferenceView;
}) {
  const visibility = useVisibility(hotelId, reference);
  return (
    <Button
      variant={reference.clientVisible ? "ghost" : "secondary"}
      size="sm"
      icon={reference.clientVisible ? "eye-off" : "eye"}
      loading={visibility.pending}
      onPress={visibility.toggle}
      testID={`reference-${reference.id}-visibility`}
    >
      {reference.clientVisible ? "Hide from clients" : "Show to clients"}
    </Button>
  );
}

export interface ReferenceActionsProps {
  readonly hotelId: string;
  readonly reference: WeddingReferenceView;
  /**
   * The role may view, attach or replace the consent and show or hide the reference
   * (`hotels.wedding_references.update`: SA, HT). A role that only reads sees the chips, no actions.
   */
  readonly canUpdate: boolean;
}

/** The actions themselves, for a role that may update references. */
function ManageActions({ hotelId, reference }: Omit<ReferenceActionsProps, "canUpdate">) {
  const view = useViewConsent(hotelId, reference.id);
  const hasConsent = reference.consentDocumentId !== null;
  return (
    <>
      {!hasConsent ? (
        <Text variant="bodySmall" tone="body">
          Attach the couple's consent (PDF, JPEG or PNG) before showing this to clients.
        </Text>
      ) : null}
      <Row gap={2} wrap>
        {hasConsent ? (
          <Button
            variant="secondary"
            size="sm"
            icon="file"
            loading={view.pending}
            onPress={view.open}
            testID={`reference-${reference.id}-view-consent`}
          >
            View consent
          </Button>
        ) : null}
        <AttachConsentButton hotelId={hotelId} reference={reference} />
        {hasConsent || reference.clientVisible ? (
          <VisibilityButton hotelId={hotelId} reference={reference} />
        ) : null}
      </Row>
    </>
  );
}

/**
 * A reference's consent and client-visibility actions (GP-20), only for a role that manages references:
 * the consent names the couple, so it opens (through a short-lived link) only for SA and HT, as the API
 * gates it. They attach or replace it, and show the reference to clients only once it is on file;
 * without consent the row says what unlocks showing it rather than offering a button the server would
 * refuse. A role that only reads (SM, PM) gets no actions.
 */
export function ReferenceActions({ canUpdate, ...props }: ReferenceActionsProps) {
  return canUpdate ? <ManageActions {...props} /> : null;
}
