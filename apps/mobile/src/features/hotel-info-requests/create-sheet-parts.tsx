import type { ReactNode } from "react";

import { Button, Callout, Stack, Text } from "@ampm/ui";

import type { RequestDraft } from "./info-request.form";
import type { CreateRequestSheet } from "./use-create-request";

/**
 * A create sheet's footer: Create request while the form shows, then Done once the link shows, which
 * closes the sheet and forgets the link.
 *
 *   <CreateSheetFooter sheet={sheet} testID="send-request" />
 */
export function CreateSheetFooter<D extends RequestDraft>({
  sheet,
  testID,
}: {
  readonly sheet: CreateRequestSheet<D>;
  readonly testID: string;
}) {
  if (sheet.issued) {
    return (
      <Button fullWidth variant="secondary" onPress={sheet.close} testID={`${testID}-done`}>
        Done
      </Button>
    );
  }
  return (
    <Button fullWidth loading={sheet.pending} onPress={sheet.submit} testID={`${testID}-submit`}>
      Create request
    </Button>
  );
}

/**
 * A create sheet's form frame: what the request is for, the API's refusal of the last try (a second live
 * request names the one it already has), then the fields.
 *
 *   <CreateSheetForm intro="A link for …" refusal={sheet.refusal?.message}>…fields…</CreateSheetForm>
 */
export function CreateSheetForm({
  intro,
  refusal,
  children,
}: {
  readonly intro: string;
  readonly refusal: string | undefined;
  readonly children: ReactNode;
}) {
  return (
    <Stack gap={6}>
      <Text variant="bodySmall" tone="body">
        {intro}
      </Text>
      {refusal ? (
        <Callout kind="danger" title={refusal} blur={false} testID="request-refusal" />
      ) : null}
      {children}
    </Stack>
  );
}
