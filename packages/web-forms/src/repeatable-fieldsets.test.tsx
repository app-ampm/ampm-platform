// @vitest-environment jsdom
import { act, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { buttonNamed, byId, mount, press, type Mounted } from "./dom.test-utils";
import { markupOf, noop, tagsWith } from "./markup.test-utils";
import { RepeatableFieldsets, rowFieldsetId } from "./repeatable-fieldsets";

/* Repeatable rows (D-190 §5): add, remove and rename a row, each a fieldset with its legend. */

interface Row {
  readonly key: string;
  readonly name: string;
}

const legendOf = (row: Row, index: number) => row.name || `Room category ${index + 1}`;

/** The list with its rows held in state, as a form holds them; a row's name renames it. */
function Rooms({ start, max = 3 }: { readonly start: readonly Row[]; readonly max?: number }) {
  const [rows, setRows] = useState(start);
  const [next, setNext] = useState(start.length + 1);
  return (
    <RepeatableFieldsets
      id="rooms"
      legend="Room categories"
      rows={rows.map((row, index) => ({ ...row, legend: legendOf(row, index) }))}
      renderRow={(row) => (
        <input
          id={`name-${row.key}`}
          aria-label="Category name"
          value={row.name}
          onChange={(event) =>
            setRows((all) =>
              all.map((each) =>
                each.key === row.key ? { ...each, name: event.target.value } : each,
              ),
            )
          }
        />
      )}
      onAdd={() => {
        setRows((all) => [...all, { key: `r${next}`, name: "" }]);
        setNext((count) => count + 1);
      }}
      onRemove={(key) => setRows((all) => all.filter((row) => row.key !== key))}
      addLabel="Add a room category"
      removeText="Remove"
      removeLabel={(legend) => `Remove ${legend}`}
      removedText={(legend) => `${legend} removed`}
      max={max}
      capText={`You can add up to ${max} room categories.`}
      emptyText="No room categories yet."
    />
  );
}

const THREE: readonly Row[] = [
  { key: "r1", name: "Deluxe" },
  { key: "r2", name: "Suite" },
  { key: "r3", name: "Villa" },
];

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

describe("repeatable fieldsets, as the server sends them", () => {
  const html = markupOf(
    <RepeatableFieldsets
      id="rooms"
      legend="Room categories"
      rows={[{ key: "r1", legend: "Deluxe" }]}
      renderRow={() => <input id="name-r1" aria-label="Category name" />}
      onAdd={noop}
      onRemove={noop}
      addLabel="Add a room category"
      removeText="Remove"
      removeLabel={(legend) => `Remove ${legend}`}
      removedText={(legend) => `${legend} removed`}
      max={3}
      capText="You can add up to 3 room categories."
      help="One row for each kind of room."
    />,
  );

  it("names the list and each row with a legend, the row's own name renaming it", () => {
    expect(html).toMatch(/<fieldset id="rooms"[^>]*><legend[^>]*>Room categories<\/legend>/);
    expect(html).toMatch(
      new RegExp(
        `<fieldset id="${rowFieldsetId("rooms", "r1")}"[^>]*><legend[^>]*>Deluxe</legend>`,
      ),
    );
    expect(html).toContain('<p id="rooms-help"');
  });

  it("names each Remove after its row, and keeps a polite region for what was removed", () => {
    const [remove] = tagsWith(html, "button", 'aria-label="Remove Deluxe"');
    expect(remove).toContain('type="button"');
    expect(html).toMatch(/<p role="status" aria-live="polite" class="sr-only"><\/p>/);
    expect(html).toContain(">Add a room category<");
  });
});

describe("repeatable fieldsets in use", () => {
  it("moves focus to the new row's first field after Add", async () => {
    mounted = await mount(<Rooms start={THREE.slice(0, 1)} />);
    await press(buttonNamed(mounted.host, "Add a room category"));
    expect(document.activeElement).toBe(byId("name-r2"));
    expect(byId(rowFieldsetId("rooms", "r2")).querySelector("legend")?.textContent).toBe(
      "Room category 2",
    );
  });

  it("renames a row as its name is typed", async () => {
    mounted = await mount(<Rooms start={THREE.slice(0, 1)} />);
    const input = byId("name-r1");
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setValue?.call(input, "Lake Suite");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(byId(rowFieldsetId("rooms", "r1")).querySelector("legend")?.textContent).toBe(
      "Lake Suite",
    );
    expect(
      byId(rowFieldsetId("rooms", "r1")).querySelector("button")?.getAttribute("aria-label"),
    ).toBe("Remove Lake Suite");
  });

  it("after Remove, moves focus to the row that took its place and says what went", async () => {
    mounted = await mount(<Rooms start={THREE} />);
    const remove = byId(rowFieldsetId("rooms", "r2")).querySelector("button");
    if (remove === null) throw new Error("No Remove");
    await press(remove);
    expect(document.getElementById(rowFieldsetId("rooms", "r2"))).toBeNull();
    expect(document.activeElement).toBe(byId(rowFieldsetId("rooms", "r3")));
    expect(mounted.host.querySelector('[role="status"]')?.textContent).toBe("Suite removed");
  });

  it("after removing the last row, moves focus to the row before it, then to Add", async () => {
    mounted = await mount(<Rooms start={THREE.slice(0, 2)} />);
    const lastRemove = byId(rowFieldsetId("rooms", "r2")).querySelector("button");
    if (lastRemove === null) throw new Error("No Remove");
    await press(lastRemove);
    expect(document.activeElement).toBe(byId(rowFieldsetId("rooms", "r1")));
    const onlyRemove = byId(rowFieldsetId("rooms", "r1")).querySelector("button");
    if (onlyRemove === null) throw new Error("No Remove");
    await press(onlyRemove);
    expect(document.activeElement).toBe(buttonNamed(mounted.host, "Add a room category"));
    expect(mounted.host.textContent).toContain("No room categories yet.");
  });

  it("offers no Add at the cap, and says why", async () => {
    mounted = await mount(<Rooms start={THREE.slice(0, 2)} max={3} />);
    await press(buttonNamed(mounted.host, "Add a room category"));
    expect(document.activeElement).toBe(byId("name-r3"));
    expect([...mounted.host.querySelectorAll("button")].map((b) => b.textContent)).not.toContain(
      "Add a room category",
    );
    expect(mounted.host.textContent).toContain("You can add up to 3 room categories.");
  });
});
