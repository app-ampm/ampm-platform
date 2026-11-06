import { clientAmount } from "@ampm/core";

import { renderOnWeb } from "../../test/web";
import { MoneyText } from "./money-text";

// react-native-web renders a header as an <h1>: a big price must stay out of heading navigation.
describe("MoneyText on the web", () => {
  it("renders a big figure as text, never as a heading", async () => {
    const { container } = await renderOnWeb(
      <MoneyText amount={clientAmount(123456700)} variant="title" />,
    );
    expect(container.querySelector("h1, h2, h3, [role='heading']")).toBeNull();
    expect(container.textContent).toBe("₹12,34,567");
  });

  it("speaks a range in words", async () => {
    const { container } = await renderOnWeb(
      <MoneyText amount={clientAmount(1600000)} amountMax={clientAmount(2400000)} />,
    );
    expect(container.querySelector("[aria-label]")?.getAttribute("aria-label")).toBe(
      "₹16,000 to ₹24,000",
    );
  });
});
