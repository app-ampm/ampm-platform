import { Linking } from "react-native";

import { useHotelDocumentLink } from "@ampm/api-client";
import { isAppError } from "@ampm/core";
import { Button, useToast } from "@ampm/ui";

import { opensInBrowser } from "./hotel-documents.format";

export interface OpenDocumentButtonProps {
  readonly hotelId: string;
  /** The version to open: a document's own id opens its latest version, an earlier version's id that one. */
  readonly versionId: string;
  /** The version's detected type: a PDF or an image opens, an Office file downloads. */
  readonly mimeType: string;
  /** What it opens, for a screen reader: "Banquet menu", "version 1 of Banquet menu". */
  readonly name: string;
  readonly variant?: "secondary" | "ghost" | undefined;
  readonly testID?: string | undefined;
}

/**
 * Open one version of a hotel document (D-187 §6): mint a 15-minute link and open it in a new tab. Every
 * press mints its own link, since each is a recorded access, and each button holds its own mint, so only
 * the pressed one shows it is busy. The link serves a PDF or an image inline and an Office file as a
 * download, so the button says which.
 *
 *   <OpenDocumentButton hotelId={hotelId} versionId={document.id} mimeType={document.mimeType} name={document.title} />
 */
export function OpenDocumentButton({
  hotelId,
  versionId,
  mimeType,
  name,
  variant = "secondary",
  testID,
}: OpenDocumentButtonProps) {
  const toast = useToast();
  const link = useHotelDocumentLink(hotelId);
  const inBrowser = opensInBrowser(mimeType);
  const label = inBrowser ? "Open" : "Download";
  const open = (): void => {
    if (link.isPending) return;
    link.mutate(versionId, {
      onSuccess: ({ url }) => void Linking.openURL(url),
      onError: (error) =>
        toast.show({
          title: isAppError(error) ? error.message : "Could not open the document",
          tone: "danger",
        }),
    });
  };
  return (
    <Button
      variant={variant}
      size="sm"
      icon={inBrowser ? "external-link" : "download"}
      loading={link.isPending}
      accessibilityLabel={`${label} ${name}`}
      onPress={open}
      testID={testID}
    >
      {label}
    </Button>
  );
}
