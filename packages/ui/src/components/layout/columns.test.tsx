import { Text } from "react-native";

import { renderWithProviders, screen } from "../../test/render";
import { Columns } from "./columns";
import { Grid } from "./grid";
import { MasterDetail } from "./master-detail";
import { SplitPane } from "./split-pane";

// The window's width decides whether the layouts sit side by side (from 1024) or stack.
const mockWindow = { width: 1440 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockWindow.width, height: 900, scale: 2, fontScale: 1 }),
}));

const className = (testID: string) => String(screen.getByTestId(testID).props.className);
/** The wrapper `Columns` and `Grid` put around a child. */
const cellOf = (text: string) => screen.getByText(text).parent;

describe("Columns", () => {
  beforeEach(() => {
    mockWindow.width = 1440;
  });

  it("puts its children side by side in their shares of the row from 1024", async () => {
    await renderWithProviders(
      <Columns ratios={[1.5, 1]} testID="columns">
        <Text>Search</Text>
        <Text>Plan</Text>
        {null}
      </Columns>,
    );
    expect(className("columns")).toContain("flex-row");
    expect(className("columns")).toContain("gap-4.5");
    expect(screen.getByTestId("columns").children).toHaveLength(2);
    expect(cellOf("Search")?.props.style).toEqual({ flexGrow: 1.5, flexBasis: 0, minWidth: 0 });
    expect(cellOf("Plan")?.props.style).toEqual({ flexGrow: 1, flexBasis: 0, minWidth: 0 });
  });

  it("stacks them in order on a narrower window", async () => {
    mockWindow.width = 900;
    await renderWithProviders(
      <Columns ratios={[1.5, 1]} testID="columns">
        <Text>Search</Text>
        <Text>Plan</Text>
      </Columns>,
    );
    expect(className("columns")).toContain("flex-col");
    expect(cellOf("Search")?.props.style).toBeUndefined();
  });

  it("can sit side by side from 768", async () => {
    mockWindow.width = 900;
    await renderWithProviders(
      <Columns at="md" testID="columns">
        <Text>a</Text>
        <Text>b</Text>
      </Columns>,
    );
    expect(className("columns")).toContain("flex-row");
  });
});

describe("SplitPane", () => {
  beforeEach(() => {
    mockWindow.width = 1440;
  });

  it("keeps a fixed side panel beside the main column", async () => {
    await renderWithProviders(
      <SplitPane side={<Text>Verification</Text>} testID="split">
        <Text>Rates</Text>
      </SplitPane>,
    );
    expect(className("split")).toContain("flex-row");
    expect(String(screen.getByText("Rates").parent?.props.className)).toContain("flex-1");
    expect(String(screen.getByText("Verification").parent?.props.className)).toContain("w-72");
    expect(screen.getByTestId("split").children[0]).toBe(screen.getByText("Rates").parent);
  });

  it("puts the panel first at the start, and stacks it after the main column when narrow", async () => {
    await renderWithProviders(
      <SplitPane side={<Text>Queue</Text>} sideWidth="list" sidePosition="start" testID="split">
        <Text>Enquiry</Text>
      </SplitPane>,
    );
    expect(screen.getByTestId("split").children[0]).toBe(screen.getByText("Queue").parent);
    expect(String(screen.getByText("Queue").parent?.props.className)).toContain("w-list");

    mockWindow.width = 390;
    await renderWithProviders(
      <SplitPane side={<Text>Facts</Text>} testID="narrow">
        <Text>Activity</Text>
      </SplitPane>,
    );
    expect(className("narrow")).toContain("flex-col");
    expect(screen.getByTestId("narrow").children[0]).toBe(screen.getByText("Activity").parent);
  });
});

describe("MasterDetail", () => {
  it("shows the list beside the selected item from 1024, or the placeholder", async () => {
    mockWindow.width = 1440;
    await renderWithProviders(
      <MasterDetail list={<Text>Queue</Text>} placeholder={<Text>Pick an enquiry</Text>} />,
    );
    expect(screen.getByText("Queue")).toBeOnTheScreen();
    expect(screen.getByText("Pick an enquiry")).toBeOnTheScreen();
    expect(String(screen.getByText("Queue").parent?.props.className)).toContain("w-list");
  });

  it("shows one at a time on a narrower window: the detail when one is selected", async () => {
    mockWindow.width = 390;
    await renderWithProviders(
      <MasterDetail list={<Text>Queue</Text>} detail={<Text>Bagh Mahal Retreat</Text>} />,
    );
    expect(screen.getByText("Bagh Mahal Retreat")).toBeOnTheScreen();
    expect(screen.queryByText("Queue")).toBeNull();
  });
});

describe("Grid", () => {
  it("lays cells in rows of the window's column count, padding the last row", async () => {
    mockWindow.width = 1440;
    await renderWithProviders(
      <Grid testID="grid">
        <Text key="goa">Goa</Text>
        <Text key="jaipur">Jaipur</Text>
        <Text key="udaipur">Udaipur</Text>
        <Text key="kerala">Kerala</Text>
      </Grid>,
    );
    const rows = screen.getByTestId("grid").children;
    expect(rows).toHaveLength(2);
    expect(String(cellOf("Goa")?.props.className)).toContain("flex-1");
  });

  it("is one column on a phone", async () => {
    mockWindow.width = 390;
    await renderWithProviders(
      <Grid testID="grid">
        <Text key="goa">Goa</Text>
        <Text key="jaipur">Jaipur</Text>
      </Grid>,
    );
    expect(screen.getByTestId("grid").children).toHaveLength(2);
  });
});
