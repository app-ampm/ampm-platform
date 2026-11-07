import { FIRST_MESSAGE_DELAY_MS, LIVE_REGION_ID } from "../../lib/live-region.web";
import { act, renderOnWeb } from "../../test/web";
import { Callout } from "../callout";
import { OfflineBanner } from "../offline-banner";
import { OfflineState } from "../offline-state";
import { useToast } from "./toast-provider";

const spoken = () => document.getElementById(LIVE_REGION_ID)?.textContent ?? "";

function ShowToastButton() {
  const toasts = useToast();
  return (
    <button type="button" onClick={() => toasts.show({ title: "Saved", description: "All good" })}>
      Show
    </button>
  );
}

// A polite notice appears already filled, and a live region inserted together with its text is not
// reliably spoken. So on the web the notices carry no live region of their own and speak through the
// page's one region, which exists before the words arrive.
describe("polite notices on the web", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    document.getElementById(LIVE_REGION_ID)?.remove();
  });

  async function settle() {
    await act(async () => {
      jest.advanceTimersByTime(FIRST_MESSAGE_DELAY_MS);
    });
  }

  it("speaks a toast through the page's live region, not its own", async () => {
    const { container } = await renderOnWeb(<ShowToastButton />);
    const show = container.querySelector("button");
    await act(async () => show?.click());
    await settle();
    expect(spoken()).toBe("Saved. All good");
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector("[aria-live]")).toBeNull();
  });

  it("speaks the offline banner, the pending-sync callout and the offline state the same way", async () => {
    const { container } = await renderOnWeb(
      <>
        <OfflineBanner queuedCount={3} />
        <Callout kind="pending-sync">3 changes waiting.</Callout>
        <OfflineState />
      </>,
    );
    await settle();
    expect(spoken()).toContain("Offline. 3 updates queued. They sync when signal returns.");
    expect(spoken()).toContain("Changes pending sync. 3 changes waiting.");
    expect(spoken()).toContain("You are offline.");
    expect(container.querySelector("[aria-live]")).toBeNull();
  });

  it("leaves a danger callout to its alert, which speaks as it appears", async () => {
    const { container } = await renderOnWeb(<Callout kind="danger">Nothing was charged.</Callout>);
    await settle();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "Something needs attention",
    );
    expect(spoken()).toBe("");
  });
});
