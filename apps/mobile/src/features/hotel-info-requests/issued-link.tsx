import { useState } from "react";
import { View } from "react-native";

import { formatDay, type HotelInfoRequestLinkIssued } from "@ampm/core";
import { Button, Callout, copyText, Icon, Row, shareText, Stack, Text } from "@ampm/ui";

import { emailOutcomeText, infoRequestHotelName } from "./info-requests.format";
import { RecordShareForm } from "./record-share-form";

/** What the last copy did: on the clipboard, refused by the browser, or not tried yet. */
type CopyOutcome = "copied" | "failed" | null;

/** Copy and Share's state; `handed` once the link may have left the sheet (a copy, even refused). */
function useLinkHandover(url: string) {
  const [copy, setCopy] = useState<CopyOutcome>(null);
  const [shared, setShared] = useState(false);
  return {
    copy,
    handed: copy !== null || shared,
    onCopy: async (): Promise<void> => setCopy((await copyText?.(url)) ? "copied" : "failed"),
    onShare: async (): Promise<void> => {
      if (await shareText?.(url)) setShared(true);
    },
  };
}

/**
 * What the copy did, said in the sheet: a toast would sit under the sheet's modal on the web. A refused
 * copy (no permission) says to copy by hand.
 */
function CopyFeedback({ copy }: { readonly copy: CopyOutcome }) {
  if (copy === "copied") {
    return (
      <Row gap={2} align="center">
        <Icon name="check-circle" tone="primary" size="sm" />
        <Text variant="bodySmall" accessibilityLiveRegion="polite" testID="issued-link-copied">
          Link copied.
        </Text>
      </Row>
    );
  }
  if (copy === "failed") {
    return (
      <Text
        variant="bodySmall"
        tone="brand"
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        testID="issued-link-copy-failed"
      >
        Could not copy: select the link above and copy it.
      </Text>
    );
  }
  return null;
}

/** Copy (the gold action where the browser can copy) and Share (where it has a share sheet). */
function LinkActions({ handover }: { readonly handover: ReturnType<typeof useLinkHandover> }) {
  if (!copyText && !shareText) {
    return (
      <Text variant="bodySmall" tone="muted">
        Select the link above to copy it.
      </Text>
    );
  }
  return (
    <Stack gap={2}>
      <Row gap={2} wrap>
        {copyText ? (
          <Button icon="copy" onPress={() => void handover.onCopy()} testID="issued-link-copy">
            Copy link
          </Button>
        ) : null}
        {shareText ? (
          <Button
            variant={copyText ? "secondary" : "primary"}
            icon="share"
            onPress={() => void handover.onShare()}
            testID="issued-link-share"
          >
            Share
          </Button>
        ) : null}
      </Row>
      <CopyFeedback copy={handover.copy} />
    </Stack>
  );
}

/** The link to select, its expiry and what became of its email. */
function LinkFacts({ issued }: { readonly issued: HotelInfoRequestLinkIssued }) {
  const { request, link, email } = issued;
  return (
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
 * link to select, its expiry, what became of its email, Copy and Share, and, once the link may have left
 * the sheet (a copy, a share, or by hand where neither is offered), the step that records how it went to
 * the hotel. Never a `wa.me` link. The sheet that shows it forgets it on close.
 *
 *   {create.data ? <IssuedLink issued={create.data} canRecordShare={canUpdate} /> : null}
 */
export function IssuedLink({ issued, canRecordShare }: IssuedLinkProps) {
  const handover = useLinkHandover(issued.link.url);
  const byHandOnly = !copyText && !shareText;
  return (
    <Stack gap={4} testID="issued-link">
      <Callout kind="warning" title="Shown only now" blur={false} testID="issued-link-warning">
        Copy or share this link now: AMPM keeps no copy of it. If it is lost, reissue it from the
        request, and this one stops working.
      </Callout>
      <LinkFacts issued={issued} />
      <LinkActions handover={handover} />
      {canRecordShare && (handover.handed || byHandOnly) ? (
        <RecordShareForm requestId={issued.request.id} testID="issued-link-record" />
      ) : null}
    </Stack>
  );
}
