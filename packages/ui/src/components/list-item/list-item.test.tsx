import { createRef, type ComponentRef } from "react";
import { Text, type View } from "react-native";

import { fireEvent, renderWithProviders, screen } from "../../test/render";
import { ListItem } from "./list-item";
import { listItemStyles } from "./list-item.styles";

describe("ListItem", () => {
  it("shows the title, subtitle and meta, and is not a button without onPress", async () => {
    await renderWithProviders(
      <ListItem
        title="Bagh Mahal Retreat"
        subtitle="Asked the property on 4 Nov"
        meta="12–14 FEB 2027 · 300 GUESTS"
        testID="row"
      />,
    );
    expect(screen.getByText("Bagh Mahal Retreat").props.numberOfLines).toBe(1);
    expect(screen.getByText("Asked the property on 4 Nov").props.className).toContain("text-muted");
    expect(screen.getByText("12–14 FEB 2027 · 300 GUESTS").props.className).toContain(
      "tabular-nums",
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByTestId("row").props.className).not.toContain("min-h-touch");
  });

  it("is a button with onPress, named by its content or its label", async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <>
        <ListItem title="Raj Niwas Palace" subtitle="Udaipur" onPress={onPress} />
        <ListItem
          title="ENQ-0418"
          accessibilityLabel="Enquiry 0418, Ananya Sharma"
          onPress={onPress}
        />
      </>,
    );
    await fireEvent.press(screen.getByRole("button", { name: /Raj Niwas Palace/ }));
    await fireEvent.press(screen.getByRole("button", { name: "Enquiry 0418, Ananya Sharma" }));
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it("renders the leading thumbnail, the trailing chip and the chevron", async () => {
    await renderWithProviders(
      <ListItem
        title="Aravalli Lake Resort"
        leading={<Text>thumb</Text>}
        trailing={<Text>Submitted</Text>}
        showChevron
        testID="row"
      />,
    );
    // The thumbnail repeats what the title says, so screen readers skip it; the chip is read.
    expect(screen.queryByText("thumb")).toBeNull();
    expect(screen.getByText("thumb", { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText("Submitted")).toBeOnTheScreen();
    expect(screen.getByTestId("row-chevron", { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it("maps the flat and plain tones to tokens", async () => {
    await renderWithProviders(
      <>
        <ListItem title="Flat" testID="flat" />
        <ListItem title="Plain" tone="plain" testID="plain" />
      </>,
    );
    const flat = screen.getByTestId("flat").props.className;
    expect(flat).toContain("bg-primary/6");
    expect(flat).toContain("border-primary/12");
    expect(flat).toContain("rounded");
    expect(flat).toContain("px-3.5");
    const plain = screen.getByTestId("plain").props.className;
    expect(plain).toContain("border-t");
    expect(plain).toContain("border-primary/16");
    expect(plain).not.toContain("bg-primary/6");
  });

  it("gives pressable rows the 44px target, the hover stroke and the focus halo", () => {
    const pressable = listItemStyles({ pressable: true });
    expect(pressable).toContain("min-h-touch");
    expect(pressable).toContain("web:hover:border-primary/24");
    expect(pressable).toContain("web:focus-visible:shadow-halo");
    expect(pressable).toContain("active:bg-primary/12");
    expect(listItemStyles({ tone: "plain", pressable: true })).toContain("active:bg-primary/6");
    expect(listItemStyles()).toContain("flex");
  });

  it("forwards its ref to the row", async () => {
    const ref = createRef<ComponentRef<typeof View>>();
    await renderWithProviders(<ListItem ref={ref} title="Raj Niwas Palace" onPress={jest.fn()} />);
    expect(ref.current).not.toBeNull();
  });
});
