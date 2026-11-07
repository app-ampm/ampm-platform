import { StyleSheet } from "react-native";

import { clientAmount, internalAmount } from "@ampm/core";

import { renderWithProviders, screen } from "../../test/render";
import { formatMoney, MoneyText } from "./money-text";

describe("MoneyText", () => {
  it("formats a client-facing amount in rupees", async () => {
    await renderWithProviders(<MoneyText amount={clientAmount(123456700)} />);
    expect(screen.getByText("₹12,34,567")).toBeOnTheScreen();
  });

  it("groups lakhs and crores the Indian way", async () => {
    await renderWithProviders(<MoneyText amount={clientAmount(468000000)} />);
    expect(screen.getByText("₹46,80,000")).toBeOnTheScreen();
  });

  it("never accepts an internal amount", async () => {
    const internal = internalAmount(100);
    // @ts-expect-error internal amounts are not client-facing (data-model A-4)
    await expect(renderWithProviders(<MoneyText amount={internal} />)).resolves.toBeDefined();
    // @ts-expect-error nor as the top of a range
    const range = <MoneyText amount={clientAmount(100)} amountMax={internal} />;
    expect(range).toBeDefined();
  });

  it("shows a range with one rupee sign and an en dash, and speaks it in words", async () => {
    await renderWithProviders(
      <MoneyText amount={clientAmount(1600000)} amountMax={clientAmount(2400000)} />,
    );
    const range = screen.getByText("₹16,000–24,000");
    expect(range).toBeOnTheScreen();
    expect(range.props.accessibilityLabel).toBe("₹16,000 to ₹24,000");
  });

  it("shows one value when the range is empty or collapsed", () => {
    expect(formatMoney(clientAmount(1600000), null).text).toBe("₹16,000");
    expect(formatMoney(clientAmount(1600000), clientAmount(1600000)).text).toBe("₹16,000");
    expect(formatMoney(clientAmount(123450), clientAmount(200000)).text).toBe("₹1,234.50–2,000");
  });

  it("renders Manrope 600 with tabular figures in pearl 100%", async () => {
    await renderWithProviders(<MoneyText amount={clientAmount(5000000)} />);
    const value = screen.getByText("₹50,000");
    expect(value.props.className).toContain("font-sans-semibold");
    expect(value.props.className).toContain("tabular-nums");
    expect(value.props.className).toContain("text-sm");
    expect(value.props.className).toContain("text-primary");
  });

  it("keeps tabular figures on a larger variant and the caller's classes", async () => {
    await renderWithProviders(
      <MoneyText amount={clientAmount(5000000)} variant="subheading" className="text-right" />,
    );
    const value = screen.getByText("₹50,000");
    expect(value.props.className).toContain("tabular-nums");
    expect(value.props.className).toContain("text-lg");
    expect(value.props.className).toContain("text-right");
    // NativeWind drops the class on native, so the digits line up through fontVariant there.
    expect(StyleSheet.flatten(value.props.style)).toEqual({ fontVariant: ["tabular-nums"] });
  });

  // Text makes the title and display sizes headers; a price is a figure, not a heading.
  it("reads a big figure as text, not as a heading", async () => {
    await renderWithProviders(
      <>
        <MoneyText amount={clientAmount(5000000)} variant="title" />
        <MoneyText amount={clientAmount(1600000)} variant="subheading" />
      </>,
    );
    expect(screen.queryAllByRole("header")).toEqual([]);
    expect(screen.getByText("₹50,000")).toHaveProp("accessibilityRole", "text");
  });
});
