import { clientAmount, internalAmount } from "@ampm/core";

import { renderWithProviders, screen } from "../../test/render";
import { MoneyText } from "./money-text";

describe("MoneyText", () => {
  it("formats a client-facing amount in rupees", async () => {
    await renderWithProviders(<MoneyText amount={clientAmount(123456700)} />);
    expect(screen.getByText("₹12,34,567")).toBeOnTheScreen();
  });

  it("never accepts an internal amount", async () => {
    const internal = internalAmount(100);
    // @ts-expect-error internal amounts are not client-facing (data-model A-4)
    await expect(renderWithProviders(<MoneyText amount={internal} />)).resolves.toBeDefined();
  });
});
