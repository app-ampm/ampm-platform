import { Text } from "react-native";

import { fireEvent, renderWithProviders, screen } from "../../test/render";
import { DataTable, type DataTableColumn } from "./data-table";

interface Row {
  readonly id: string;
  readonly name: string;
  readonly count: number;
}

/** The window's width picks the layout: the columns side by side from 768, stacked rows below. */
const mockWindow = { width: 1024 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockWindow.width, height: 900, scale: 2, fontScale: 1 }),
}));

beforeEach(() => {
  mockWindow.width = 1024;
});

const ROWS: Row[] = [
  { id: "a", name: "Alpha", count: 3 },
  { id: "b", name: "Beta", count: 7 },
];

const COLUMNS: DataTableColumn<Row>[] = [
  { key: "name", header: "Name", render: (row) => <Text>{row.name}</Text> },
  {
    key: "count",
    header: "Count",
    align: "end",
    render: (row) => <Text>{String(row.count)}</Text>,
  },
];

describe("DataTable", () => {
  it("renders the headers and every cell value", async () => {
    await renderWithProviders(
      <DataTable columns={COLUMNS} rows={ROWS} keyExtractor={(row) => row.id} testID="table" />,
    );
    expect(screen.getByText("Name")).toBeOnTheScreen();
    expect(screen.getByText("Count")).toBeOnTheScreen();
    expect(screen.getByText("Alpha")).toBeOnTheScreen();
    expect(screen.getByText("7")).toBeOnTheScreen();
  });

  it("calls onRowPress with the row when a row is pressed", async () => {
    const onRowPress = jest.fn();
    await renderWithProviders(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        keyExtractor={(row) => row.id}
        onRowPress={onRowPress}
        rowAccessibilityLabel={(row) => row.name}
      />,
    );
    await fireEvent.press(screen.getByLabelText("Beta"));
    expect(onRowPress).toHaveBeenCalledWith(ROWS[1]);
  });

  it("is not a button without onRowPress", async () => {
    await renderWithProviders(
      <DataTable columns={COLUMNS} rows={ROWS} keyExtractor={(row) => row.id} />,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("marks the open row with a bar and a tint, and says it is the current one", async () => {
    await renderWithProviders(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        keyExtractor={(row) => row.id}
        onRowPress={jest.fn()}
        rowAccessibilityLabel={(row) => row.name}
        selectedKey="b"
      />,
    );
    const open = screen.getByRole("button", { name: "Beta" });
    expect(open).toHaveProp("aria-current", "true");
    expect(open).toBeSelected();
    expect(screen.getByRole("button", { name: "Alpha" })).not.toHaveProp("aria-current");
    expect(screen.getAllByTestId("data-table-selected-mark")).toHaveLength(1);
  });

  it("stacks each row on a phone: its name, then every other column as label and value", async () => {
    mockWindow.width = 390;
    const onRowPress = jest.fn();
    await renderWithProviders(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        keyExtractor={(row) => row.id}
        onRowPress={onRowPress}
        rowAccessibilityLabel={(row) => row.name}
      />,
    );
    expect(screen.getByTestId("data-table-stacked")).toBeOnTheScreen();
    // No header row: the lead column's own header is not repeated, the others label their values.
    expect(screen.queryByText("Name")).toBeNull();
    expect(screen.getAllByText("Count")).toHaveLength(2);
    expect(screen.getByText("Alpha")).toBeOnTheScreen();
    expect(screen.getByText("7")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Beta" }));
    expect(onRowPress).toHaveBeenCalledWith(ROWS[1]);
  });

  it("keeps the columns on a phone when the table opts out (two narrow columns that fit)", async () => {
    mockWindow.width = 390;
    await renderWithProviders(
      <DataTable columns={COLUMNS} rows={ROWS} keyExtractor={(row) => row.id} stackBelow={false} />,
    );
    expect(screen.queryByTestId("data-table-stacked")).toBeNull();
    expect(screen.getByText("Name")).toBeOnTheScreen();
  });
});
