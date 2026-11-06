import { renderWithProviders, screen } from "../../test/render";
import { Avatar } from "./avatar";
import { AvatarGroup } from "./avatar-group";
import { avatarGroupTone, avatarStyles, initialsOf } from "./avatar.styles";

describe("Avatar", () => {
  it("shows the initials and reads as the person's name", async () => {
    await renderWithProviders(<Avatar name="Ananya Sharma" />);
    expect(screen.getByRole("image", { name: "Ananya Sharma" })).toBeOnTheScreen();
    expect(screen.getByText("AS")).toBeOnTheScreen();
  });

  it("takes an explicit label", async () => {
    await renderWithProviders(<Avatar name="Eva M." accessibilityLabel="Eva M., Super Admin" />);
    expect(screen.getByRole("image", { name: "Eva M., Super Admin" })).toBeOnTheScreen();
  });

  it("takes the first letters of the first two words", () => {
    expect(initialsOf("Ananya Sharma")).toBe("AS");
    expect(initialsOf("  kabir   mehta singh ")).toBe("KM");
    expect(initialsOf("Eva")).toBe("E");
    expect(initialsOf("अनन्या शर्मा")).toBe("अश");
  });

  it("is a gold or peacock circle with midnight initials", async () => {
    await renderWithProviders(<Avatar name="Kabir Mehta" tone="highlight" testID="avatar" />);
    expect(screen.getByTestId("avatar").props.className).toContain("bg-highlight");
    expect(screen.getByText("KM").props.className).toContain("text-highlight-ink");
    expect(avatarStyles({ tone: "brand" })).toContain("bg-brand");
    expect(avatarStyles({})).toContain("rounded-full");
  });

  it("maps every size to its circle and its initials", async () => {
    expect(avatarStyles({ size: "sm" })).toContain("h-8 w-8");
    expect(avatarStyles({ size: "md" })).toContain("h-10 w-10");
    expect(avatarStyles({ size: "lg" })).toContain("h-12 w-12");
    expect(avatarStyles({ size: "xl" })).toContain("h-14 w-14");
    await renderWithProviders(
      <>
        <Avatar name="Small One" size="sm" />
        <Avatar name="Extra Large" size="xl" />
      </>,
    );
    expect(screen.getByText("SO").props.className).toContain("text-xs");
    expect(screen.getByText("SO").props.className).toContain("font-sans-extrabold");
    expect(screen.getByText("EL").props.className).toContain("text-lg");
    expect(screen.getByText("EL").props.className).toContain("font-sans-bold");
  });
});

describe("AvatarGroup", () => {
  const team = ["Ravi Kumar", "Isha Shah", "Meera Rao", "Dev Patel", "Sana Ali"];

  it("is one image named by everyone in it", async () => {
    await renderWithProviders(<AvatarGroup names={["Ananya Sharma", "Kabir Mehta"]} />);
    expect(screen.getByRole("image", { name: "Ananya Sharma, Kabir Mehta" })).toBeOnTheScreen();
    expect(screen.getAllByRole("image")).toHaveLength(1);
    expect(screen.getByText("AS")).toBeOnTheScreen();
    expect(screen.getByText("KM")).toBeOnTheScreen();
  });

  it("collapses everyone past max into a +n circle", async () => {
    await renderWithProviders(<AvatarGroup names={team} max={2} />);
    expect(screen.getByRole("image", { name: "Ravi Kumar, Isha Shah, 3 more" })).toBeOnTheScreen();
    expect(screen.getByText("+3")).toBeOnTheScreen();
    expect(screen.queryByText("MR")).toBeNull();
  });

  it("alternates gold and peacock and overlaps each circle after the first", async () => {
    expect([0, 1, 2].map(avatarGroupTone)).toEqual(["brand", "highlight", "brand"]);
    await renderWithProviders(<AvatarGroup names={team} max={3} testID="group" />);
    const circles = screen
      .getByTestId("group")
      .children.filter((child) => typeof child !== "string");
    const classes = circles.map((circle) => String(circle.props.className));
    expect(classes).toHaveLength(4);
    expect(classes.every((name) => name.includes("border-2 border-surface"))).toBe(true);
    expect(classes[0]).not.toContain("-ml-2");
    expect(classes.slice(1).every((name) => name.includes("-ml-2"))).toBe(true);
    expect(classes[1]).toContain("bg-highlight");
    expect(classes[3]).toContain("bg-subtle");
  });

  it("does not overlap a lone +n circle", async () => {
    await renderWithProviders(<AvatarGroup names={team} max={0} testID="group" />);
    expect(screen.getByRole("image", { name: "5 more" })).toBeOnTheScreen();
    expect(screen.getByText("+5")).toBeOnTheScreen();
    const [only] = screen
      .getByTestId("group")
      .children.filter((child) => typeof child !== "string");
    expect(String(only?.props.className)).not.toContain("-ml-2");
  });
});
