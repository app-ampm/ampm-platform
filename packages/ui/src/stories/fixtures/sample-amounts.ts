/**
 * Sample money for the stories, kept out of the components and the stories themselves. Prices and
 * fees are configuration that code never carries (AC-02.9 / AC-25.4; docs/tools/scan_price_literals.py
 * fails on a currency amount in source and, like for test fixtures, skips this folder), so the
 * gallery's figures live here as fixtures. Illustration only: nothing shows these to a person.
 *
 *   <Text variant="data">{SAMPLE_AMOUNTS.advancePayment}</Text>
 */
export const SAMPLE_AMOUNTS = {
  roomNight: "₹14,200",
  vegPlate: "₹2,900",
  lawnHire: "₹5,10,000",
  roomRange: "₹18–24K",
  packageRange: "₹65–80 lakh",
  advancePayment: "₹9,50,000",
  weddingBudget: "₹46,80,000",
} as const;
