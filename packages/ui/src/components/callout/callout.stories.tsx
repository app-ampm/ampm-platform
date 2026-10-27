import { defineStories } from "../../stories/define";
import { Stack } from "../layout";
import { Callout, calloutKinds, type CalloutKind } from "./callout";

const copy: Record<CalloutKind, string> = {
  indicative:
    "Rates are a range from the hotel's last verification; the hotel confirms on request.",
  requested: "AMPM has asked the hotel; you will be told when they answer.",
  verified: "The hotel confirmed these dates and rates on 12 March.",
  "awaiting-confirmation": "Your approval is recorded; the vendor confirms within two days.",
  offline: "What you see may be out of date. Changes are kept and sent when you are back online.",
  "pending-sync": "3 changes are waiting to reach the server.",
  info: "Guests can update their own RSVP until the cut-off date.",
  success: "The invitation went out to 142 households.",
  warning: "Two rooms are allocated twice; fix before the rooming list goes to the hotel.",
  danger: "The payment could not be recorded. Nothing was charged.",
};

export const stories = defineStories({
  title: "Callout",
  stories: [
    {
      name: "Every kind",
      render: () => (
        <Stack gap={3}>
          {(Object.keys(calloutKinds) as CalloutKind[]).map((kind) => (
            <Callout key={kind} kind={kind}>
              {copy[kind]}
            </Callout>
          ))}
        </Stack>
      ),
    },
    {
      name: "With action",
      render: () => (
        <Callout kind="pending-sync" action={{ label: "Retry now", onPress: () => undefined }}>
          3 changes are waiting to reach the server.
        </Callout>
      ),
    },
  ],
});
