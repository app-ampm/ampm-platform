import { useState } from "react";
import { View } from "react-native";

import { formatDay, type HotelInfoRequestLinkIssued } from "@ampm/core";
import { Button, Callout, copyText, Row, shareText, Stack, Text, useToast } from "@ampm/ui";

import { emailOutcomeText, infoRequestHotelName } from "./info-requests.format";
import { RecordShareForm } from "./record-share-form";

/** Copy (the gold action where the browser can copy) and Share (where it has a share sheet). */
function LinkActions({ url, onShared }: { readonly url: string; readonly onShared: () => void }) {
  const toast = useToast();
  const copy = async (): Promise<void> => {
    const copied = (await copyText?.(url)) ?? false;
    toast.show({
      title: copied ? "Link copied" : "Could not copy: select the link and copy it",
      tone: copied ? "success" : "warning",
    });
    if (copied) onShared();
  };
  const share = async (): Promise<void> => {
    if (await shareText?.(url)) onShared();
  };
  if (!copyText && !shareText) {
    return (
      <Text variant="bodySmall" tone="muted">
        Select the link above to copy it.
      </Text>
    );
  }
  return (
    <Row gap={2} wrap>
      {copyText ? (
        <Button icon="copy" onPress={() => void copy()} testID="issued-link-copy">
          Copy link
        </Button>
      ) : null}
      {shareText ? (
        <Button
          variant={copyText ? "secondary" : "primary"}
          icon="share"
          onPress={() => void share()}
          testID="issued-link-share"
        >
          Share
        </Button>
      ) : null}
    </Row>
  );
}

export interface IssuedLinkProps {
  /** The create or reissue answer: the request, the link (shown only here) and its email's fate. */
  readonly issued: HotelInfoRequestLinkIssued;
  /** Offer to record a share after a copy or a share (`hotels.info_requests.update`). */
  readonly canRecordShare: boolean;
}

/**
 * A request's link, shown once (D-188 §4 and §7; plan §4.2): the warning that AMPM keeps no copy, the
 * link to select, its expiry, what became of its email, Copy and Share, and, once copied or shared, the
 * step that records how it went to the hotel. Never a `wa.me` link. The sheet that shows it forgets it
 * on close.
 *
 *   {create.data ? <IssuedLink issued={create.data} canRecordShare={canUpdate} /> : null}
 */
export function IssuedLink({ issued, canRecordShare }: IssuedLinkProps) {
  const { request, link, email } = issued;
  const [shared, setShared] = useState(false);
  return (
    <Stack gap={4} testID="issued-link">
      <Callout kind="warning" title="Shown only now" blur={false} testID="issued-link-warning">
        Copy or share this link now: AMPM keeps no copy of it. If it is lost, reissue it from the
        request, and this one stops working.
      </Callout>
      <Stack gap={2}>
        <Text variant="label">
          {request.reference} · {infoRequestHotelName(request)}
        </Text>
        <View className="rounded bg-primary/6 px-3.5 py-3">
          <Text variant="data" selectable testID="issued-link-url">
            {link.url}
          </Text>
        </View>
        <Text variant="bodySmall" tone="muted">
          Valid until {formatDay(link.expiresAt)}
        </Text>
        <Text
          variant="bodySmall"
          tone={email === "failed" ? "brand" : "body"}
          testID="issued-link-email"
        >
          {emailOutcomeText(email, request)}
        </Text>
      </Stack>
      <LinkActions url={link.url} onShared={() => setShared(true)} />
      {canRecordShare && shared ? (
        <RecordShareForm requestId={request.id} testID="issued-link-record" />
      ) : null}
    </Stack>
  );
}
