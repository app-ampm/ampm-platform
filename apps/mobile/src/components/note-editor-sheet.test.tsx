import { fireEvent, renderWithProviders, screen } from "../test/render";
import { NoteEditorSheet } from "./note-editor-sheet";

async function setup(initialNote: string | null) {
  const onSave = jest.fn();
  await renderWithProviders(
    <NoteEditorSheet
      open
      onClose={jest.fn()}
      title="Note"
      initialNote={initialNote}
      onSave={onSave}
      saving={false}
      maxLength={1000}
    />,
  );
  return onSave;
}

describe("NoteEditorSheet", () => {
  it("seeds the field from the saved note and saves the edited draft", async () => {
    const onSave = await setup("great lawn");
    expect(screen.getByDisplayValue("great lawn")).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText("Your note"), "a new note");
    await fireEvent.press(screen.getByRole("button", { name: "Save note" }));
    expect(onSave).toHaveBeenCalledWith("a new note");
  });

  it("saves null when the field is left blank, so a blank save clears the note", async () => {
    const onSave = await setup("great lawn");
    await fireEvent.changeText(screen.getByLabelText("Your note"), "   ");
    await fireEvent.press(screen.getByRole("button", { name: "Save note" }));
    expect(onSave).toHaveBeenCalledWith(null);
  });
});
