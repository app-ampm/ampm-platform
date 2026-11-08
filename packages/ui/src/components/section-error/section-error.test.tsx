import { errors } from "@ampm/core";

import { uiCopy } from "../../copy";
import { fireEvent, renderWithProviders, screen } from "../../test/render";
import { SectionError } from "./section-error";

const TITLE = "Subscriptions";

async function renderSection(error: unknown, onRetry: () => void = jest.fn()): Promise<void> {
  await renderWithProviders(<SectionError title={TITLE} error={error} onRetry={onRetry} />);
}

describe("SectionError", () => {
  // security.md, denial equals absence: a record the reader may not see is answered with the same 404
  // as a missing one, so a 404 hides the section exactly as a 403 does.
  it.each([
    ["403, a role without the section's grant", errors.forbidden()],
    ["404, a record outside the reader's reach", errors.notFound()],
  ])("hides the section on a %s, with nothing to retry", async (_case, error) => {
    await renderSection(error);
    expect(screen.queryByText(TITLE)).toBeNull();
    expect(screen.queryByText(uiCopy.error.title)).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps a failed load visible under the section's heading, with a retry", async () => {
    const onRetry = jest.fn();
    await renderSection(errors.internal(), onRetry);
    expect(screen.getByText(TITLE)).toBeOnTheScreen();
    expect(screen.getByText(uiCopy.error.title)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: uiCopy.retry }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("shows the offline state under the section's heading on a network failure", async () => {
    await renderSection(errors.network());
    expect(screen.getByText(TITLE)).toBeOnTheScreen();
    expect(screen.getByText(uiCopy.offline.title)).toBeOnTheScreen();
  });
});
