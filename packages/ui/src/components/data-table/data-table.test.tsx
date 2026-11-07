import { Text } from "react-native";

import { fireEvent, renderWithProviders, screen } from "../../test/render";
import { DataTable, type DataTableColumn } from "./data-table";

interface Row {
  readonly id: string;
  readonly name: string;
  readonly count: number;
}

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
});
