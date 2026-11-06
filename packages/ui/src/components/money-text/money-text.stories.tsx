import { clientAmount } from "@ampm/core";

import { defineStories } from "../../stories/define";
import { Row, Stack } from "../layout";
import { Text } from "../text";
import { MoneyText } from "./money-text";

export const stories = defineStories({
  title: "MoneyText",
  stories: [
    {
      name: "Amounts: data, subheading, title",
      render: () => (
        <Stack gap={2}>
          <MoneyText amount={clientAmount(468000000)} />
          <MoneyText amount={clientAmount(5000000)} variant="subheading" />
          <MoneyText amount={clientAmount(123456700)} variant="title" />
          <MoneyText amount={clientAmount(123450)} tone="muted" />
        </Stack>
      ),
    },
    {
      name: "Indicative ranges",
      render: () => (
        <Stack gap={2}>
          <MoneyText amount={clientAmount(1600000)} amountMax={clientAmount(2400000)} />
          <MoneyText
            amount={clientAmount(360000)}
            amountMax={clientAmount(440000)}
            variant="subheading"
          />
        </Stack>
      ),
    },
    {
      name: "In a rate row",
      render: () => (
        <Stack gap={0}>
          {[
            { label: "Deluxe lake-view room", low: 1800000, high: 2000000 },
            { label: "Veg menu, per plate", low: 360000, high: 440000 },
            { label: "Lawn hire, per function", low: 65000000, high: null },
          ].map((line) => (
            <Row key={line.label} justify="between" className="border-t border-primary/16 py-2.5">
              <Text variant="bodySmall" tone="primary">
                {line.label}
              </Text>
              <MoneyText
                amount={clientAmount(line.low)}
                amountMax={line.high === null ? null : clientAmount(line.high)}
              />
            </Row>
          ))}
        </Stack>
      ),
    },
  ],
});
