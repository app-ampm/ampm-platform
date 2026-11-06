import { createRef, type ComponentRef } from "react";
import { Text, type View } from "react-native";

import { classes, fireEvent, renderWithProviders, screen } from "../../test/render";
import { Card } from "./card";
import { cardFrameStyles, cardStyles } from "./card.styles";

describe("Card", () => {
  it("is a plain surface without onPress", async () => {
    await renderWithProviders(
      <Card testID="card">
        <Text>Taj Lake Palace</Text>
      </Card>,
    );
    expect(screen.getByTestId("card")).toBeOnTheScreen();
    expect(screen.getByText("Taj Lake Palace")).toBeOnTheScreen();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("becomes a button with onPress", async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <Card onPress={onPress} accessibilityLabel="Open Taj Lake Palace">
        <Text>Taj Lake Palace</Text>
      </Card>,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Open Taj Lake Palace" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("draws base glass behind the content by default, with the stroke on the card", async () => {
    await renderWithProviders(
      <Card testID="card">
        <Text>Raj Niwas Palace</Text>
      </Card>,
    );
    const card = screen.getByTestId("card");
    expect(card.props.className).toContain("border-primary/16");
    expect(card.props.className).toContain("rounded-lg");
    expect(card.props.className).toContain("md:rounded-xl");
    expect(card.props.className).toContain("p-5");
    expect(JSON.stringify(screen.toJSON())).toContain("bg-surface/50");
  });

  it("draws the peacock and gold recipes for those tones", async () => {
    await renderWithProviders(
      <>
        <Card tone="peacock" testID="verified" />
        <Card tone="gold" testID="live" />
      </>,
    );
    expect(screen.getByTestId("verified").props.className).toContain("border-highlight/70");
    expect(screen.getByTestId("live").props.className).toContain("border-brand/50");
    const tree = JSON.stringify(screen.toJSON());
    expect(tree).toContain("bg-highlight/30");
    expect(tree).toContain("bg-brand/14");
  });

  it("uses flat tints, not glass, for nested and internal cards", async () => {
    await renderWithProviders(
      <>
        <Card tone="flat" testID="nested" />
        <Card tone="internal" testID="internal" />
      </>,
    );
    // Whole classes: rows inside panels are radius 16 ("rounded"), not the glass card's
    // "rounded-lg", which a substring match would let through.
    const nested = classes(screen.getByTestId("nested").props.className);
    expect(nested).toEqual(expect.arrayContaining(["bg-primary/6", "rounded"]));
    expect(nested).not.toContain("rounded-lg");
    expect(classes(screen.getByTestId("internal").props.className)).toEqual(
      expect.arrayContaining(["border-dashed", "bg-brand/6"]),
    );
    expect(JSON.stringify(screen.toJSON())).not.toContain("bg-surface/50");
  });

  it("maps padding, hover and focus to tokens, with no drop shadows", () => {
    expect(cardFrameStyles({ padding: "sm" })).toContain("p-4");
    expect(cardFrameStyles({ padding: "lg" })).toContain("p-6");
    expect(cardFrameStyles({ padding: "none" })).toContain("p-0");
    const pressable = cardFrameStyles({ pressable: true });
    expect(pressable).toContain("web:hover:border-primary/24");
    expect(pressable).toContain("web:focus-visible:shadow-halo");
    expect(cardFrameStyles({ tone: "peacock", pressable: true })).toContain(
      "web:hover:border-highlight",
    );
    expect(cardFrameStyles()).not.toContain("web:hover");
    for (const tone of ["glass", "peacock", "gold", "flat", "internal"] as const)
      expect(cardStyles({ tone, pressable: true })).not.toMatch(/shadow-(sm|md|lg|xl)/);
  });

  it("gives the website the whole glass card on one element", () => {
    const glass = cardStyles();
    expect(glass).toContain("bg-surface/50");
    expect(glass).toContain("border-primary/16");
    expect(glass).toContain("web:shadow-rim");
    expect(glass).toContain("web:backdrop-blur-glass");
    expect(glass).toContain("flex");
    expect(cardStyles({ blur: false })).not.toContain("backdrop-blur");
    expect(cardStyles({ tone: "flat" })).not.toContain("bg-surface/50");
    expect(cardStyles({ pressable: true })).toContain("active:opacity-90");
  });

  it("passes the caller's classes through", async () => {
    await renderWithProviders(<Card testID="card" className="flex-1 md:p-7" />);
    expect(screen.getByTestId("card").props.className).toContain("md:p-7");
  });

  it("forwards its ref, pressable or not", async () => {
    const pressable = createRef<ComponentRef<typeof View>>();
    const plain = createRef<ComponentRef<typeof View>>();
    await renderWithProviders(
      <>
        <Card ref={pressable} onPress={jest.fn()} accessibilityLabel="Open" />
        <Card ref={plain} />
      </>,
    );
    expect(pressable.current).not.toBeNull();
    expect(plain.current).not.toBeNull();
  });
});
