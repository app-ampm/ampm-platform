import { useState } from "react";

import { defineStories } from "../../stories/define";
import { Text } from "../text";
import { OtpInput, type OtpInputProps } from "./otp-input";

type DemoProps = Omit<OtpInputProps, "value" | "onChangeText"> & { readonly initial?: string };

/** Keeps the code in state and shows the last completed code, as a sign-in screen would use it. */
function Demo({ initial = "", ...props }: DemoProps) {
  const [code, setCode] = useState(initial);
  const [completed, setCompleted] = useState<string | null>(null);
  return (
    <>
      <OtpInput value={code} onChangeText={setCode} onComplete={setCompleted} {...props} />
      {completed ? (
        <Text variant="caption" tone="muted">
          {`onComplete(${completed})`}
        </Text>
      ) : null}
    </>
  );
}

export const stories = defineStories({
  title: "OtpInput",
  stories: [
    {
      name: "Six-digit code",
      description: "Tap the cells and type, or paste a code: filled cells turn peacock.",
      render: () => <Demo label="Six-digit code" helpText="Sent by SMS just now" />,
    },
    {
      name: "Partly filled",
      description: "With focus, the next cell takes the gold stroke and halo.",
      render: () => <Demo label="Six-digit code" initial="482" />,
    },
    {
      name: "Error: gold, keeps the digits",
      render: () => (
        <Demo
          label="Six-digit code"
          initial="482913"
          errorText="That code didn't match. Check the SMS and try again."
        />
      ),
    },
    {
      name: "Disabled",
      render: () => <Demo initial="48" disabled helpText="Request a new code to try again" />,
    },
    {
      name: "Four digits",
      render: () => <Demo label="Four-digit code" length={4} />,
    },
  ],
});
