import { defineStories } from "../../stories/define";
import { GlassPanel } from "../glass-panel";
import { Stack } from "../layout";
import { Text } from "../text";
import { Callout, type CalloutKind } from "./callout";

interface Example {
  readonly kind: CalloutKind;
  readonly body: string;
}

const EXAMPLES: readonly Example[] = [
  {
    kind: "indicative",
    body: "Rates are a range from the hotel's last verification; the hotel confirms on request.",
  },
  { kind: "requested", body: "AMPM has asked the hotel; you will be told when they answer." },
  { kind: "verified", body: "The hotel confirmed these dates and rates on 12 March." },
  {
    kind: "awaiting-confirmation",
    body: "Your approval is recorded; the vendor confirms within two days.",
  },
  {
    kind: "offline",
    body: "What you see may be out of date. Changes are kept and sent when you are back online.",
  },
  { kind: "pending-sync", body: "3 changes are waiting to reach the server." },
  { kind: "info", body: "Guests can update their own RSVP until the cut-off date." },
  { kind: "success", body: "The invitation went out to 142 households." },
  {
    kind: "warning",
    body: "Two rooms are allocated twice; fix before the rooming list goes to the hotel.",
  },
  { kind: "danger", body: "The payment could not be recorded. Nothing was charged." },
];

export const stories = defineStories({
  title: "Callout",
  stories: [
    {
      name: "Every kind",
      description:
        "Base glass for notes, gold for waiting and needs-you, peacock for verified and offline-safe.",
      render: () => (
        <Stack gap={3}>
          {EXAMPLES.map(({ kind, body }) => (
            <Callout key={kind} kind={kind}>
              {body}
            </Callout>
          ))}
        </Stack>
      ),
    },
    {
      name: "With action",
      render: () => (
        <Stack gap={3}>
          <Callout kind="pending-sync" action={{ label: "Retry now", onPress: () => undefined }}>
            3 changes are waiting to reach the server.
          </Callout>
          <Callout
            kind="warning"
            title="27 hotels have stale rates"
            action={{ label: "Review stale rates", onPress: () => undefined }}
          >
            Older than 120 days. 6 of them are in clients' selections.
          </Callout>
        </Stack>
      ),
    },
    {
      name: "Title only",
      render: () => (
        <Stack gap={3}>
          <Callout kind="indicative" title="Subscribe to unlock full hotel discovery" />
          <Callout kind="success" title="Converted to a client account" />
        </Stack>
      ),
    },
    {
      name: "Nested in a panel",
      description:
        "Inside another glass panel a callout passes blur={false}: only top-level panels blur.",
      render: () => (
        <GlassPanel className="gap-3 p-5">
          <Text variant="heading">Raj Niwas Palace</Text>
          <Callout kind="verified" blur={false}>
            Rates verified on 2 Nov 2026 by the hotel team.
          </Callout>
          <Callout kind="requested" blur={false}>
            Availability for 12–14 Feb is with the hotel.
          </Callout>
        </GlassPanel>
      ),
    },
  ],
});
