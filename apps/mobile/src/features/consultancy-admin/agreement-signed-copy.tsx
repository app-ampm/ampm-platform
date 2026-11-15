import { Linking } from "react-native";

import { useAgreementSignedCopyLink, useMarkAgreementSignedOffline } from "@ampm/api-client";
import {
  DOCUMENT_UPLOAD_TYPES,
  MAX_DOCUMENT_UPLOAD_BYTES,
  type ServiceAgreementStaffView,
} from "@ampm/core";
import { Button, pickFile, useToast } from "@ampm/ui";

import { errorMessage } from "./consultancy-admin.form";

const LIMIT_MB = MAX_DOCUMENT_UPLOAD_BYTES / (1024 * 1024);

/** Pick the signed copy and upload it; the size is checked here so a too-big file never uploads. */
function useMarkSigned(agreement: ServiceAgreementStaffView, enquiryId: string) {
  const toast = useToast();
  const signed = useMarkAgreementSignedOffline(agreement.id, enquiryId);
  const fail = (title: string): void => {
    toast.show({ title, tone: "danger" });
  };
  const choose = async (): Promise<void> => {
    if (signed.isPending) return;
    const picked = await pickFile(DOCUMENT_UPLOAD_TYPES.join(","));
    if (!picked) {
      toast.show({ title: "Attach the signed copy from the web workspace", tone: "info" });
      return;
    }
    if (picked.sizeBytes > MAX_DOCUMENT_UPLOAD_BYTES) {
      fail(`This file is over the ${LIMIT_MB} MB limit`);
      return;
    }
    signed.mutate(
      { file: picked.file },
      {
        onSuccess: () =>
          toast.show({
            title: "Recorded as signed. Activate it to start the work",
            tone: "success",
          }),
        onError: (error) => fail(errorMessage(error, "Could not attach the signed copy")),
      },
    );
  };
  return { choose, pending: signed.isPending };
}

/**
 * "Mark signed offline" (feature 10.2, D-135): the client signed on paper or by email instead of in the
 * portal, so staff attach the signed copy, and that upload is what records the acceptance. The size is
 * checked here so a too-big file never uploads; the server types it by content and scans it.
 */
export function MarkSignedOfflineButton({
  agreement,
  enquiryId,
}: {
  readonly agreement: ServiceAgreementStaffView;
  readonly enquiryId: string;
}) {
  const signed = useMarkSigned(agreement, enquiryId);
  return (
    <Button
      variant="secondary"
      size="sm"
      icon="paperclip"
      loading={signed.pending}
      onPress={() => void signed.choose()}
    >
      Mark signed offline
    </Button>
  );
}

/** Open the signed copy through a 15-minute link; every press mints its own (a recorded access). */
export function ViewSignedCopyButton({ agreementId }: { readonly agreementId: string }) {
  const toast = useToast();
  const link = useAgreementSignedCopyLink(agreementId);
  const open = (): void => {
    if (link.isPending) return;
    link.mutate(undefined, {
      onSuccess: ({ url }) => void Linking.openURL(url),
      onError: (error) =>
        toast.show({
          title: errorMessage(error, "Could not open the signed copy"),
          tone: "danger",
        }),
    });
  };
  return (
    <Button variant="ghost" size="sm" icon="file" loading={link.isPending} onPress={open}>
      View signed copy
    </Button>
  );
}
