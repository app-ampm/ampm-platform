import { clientAmount } from "@ampm/core";

import { defineStories } from "../../stories/define";
import { Stack } from "../layout";
import { MoneyText } from "./money-text";

export const stories = defineStories({
  title: "MoneyText",
  stories: [
    {
      name: "Amounts",
      render: () => (
        <Stack gap={1}>
          <MoneyText amount={clientAmount(123456700)} variant="title" />
          <MoneyText amount={clientAmount(4500000)} />
          <MoneyText amount={clientAmount(123450)} tone="muted" weight="normal" />
        </Stack>
      ),
    },
  ],
});
