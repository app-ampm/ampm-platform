import { fireEvent, screen } from "../../test/render";
import { ConfigurationEditSheet } from "./configuration-edit-sheet";
import { failure, ok, renderWithApi, routedFetch, type FetchFn } from "./admin.test-utils";

const IDLE_KEY = "session.idle_timeouts";
const IDLE_PATH = `/admin/configurations/${IDLE_KEY}`;
const idleValue = { staffMinutes: 720, clientMinutes: 43200, demoMinutes: 43200 };

interface Captured {
  put?: unknown;
}

async function renderSheet(
  fetchImpl: FetchFn,
  entry: { key: string; value: unknown } = { key: IDLE_KEY, value: idleValue },
  onClose: jest.Mock = jest.fn(),
): Promise<jest.Mock> {
  await renderWithApi(<ConfigurationEditSheet entry={entry} onClose={onClose} />, fetchImpl);
  return onClose;
}

describe("ConfigurationEditSheet", () => {
  it("saves an edited integer value through the PUT and closes", async () => {
    const captured: Captured = {};
    const onClose = await renderSheet(
      routedFetch({
        [IDLE_PATH]: (init) => {
          captured.put = JSON.parse(String(init?.body));
          return ok({ key: IDLE_KEY, value: { ...idleValue, staffMinutes: 600 } });
        },
      }),
    );
    await fireEvent.changeText(await screen.findByTestId("config-field-staffMinutes"), "600");
    await fireEvent.press(screen.getByTestId("configuration-edit-submit"));
    expect(await screen.findByText("Setting saved")).toBeOnTheScreen();
    expect(captured.put).toEqual({ value: { ...idleValue, staffMinutes: 600 } });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("blocks an out-of-range value inline and never calls the API", async () => {
    const captured: Captured = {};
    const onClose = await renderSheet(
      routedFetch({
        [IDLE_PATH]: (init) => {
          captured.put = JSON.parse(String(init?.body));
          return ok({ key: IDLE_KEY, value: idleValue });
        },
      }),
    );
    // Zero fails the schema's `.positive()`; the editor shows it inline before any request.
    await fireEvent.changeText(await screen.findByTestId("config-field-staffMinutes"), "0");
    await fireEvent.press(screen.getByTestId("configuration-edit-submit"));
    expect(await screen.findByText("Must be at least 1")).toBeOnTheScreen();
    expect(captured.put).toBeUndefined();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows an error and stays open when the save fails on the server", async () => {
    const onClose = await renderSheet(routedFetch({ [IDLE_PATH]: () => failure("internal", 500) }));
    await fireEvent.press(await screen.findByTestId("configuration-edit-submit"));
    expect(await screen.findByText("Could not save the setting")).toBeOnTheScreen();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("edits a feature-flag map — toggling one off and adding another — then saves the record", async () => {
    const captured: Captured = {};
    await renderSheet(
      routedFetch({
        "/admin/configurations/feature.flags": (init) => {
          captured.put = JSON.parse(String(init?.body));
          return ok({ key: "feature.flags", value: {} });
        },
      }),
      { key: "feature.flags", value: { beta: true } },
    );
    await fireEvent.press(await screen.findByTestId("config-flag-beta"));
    await fireEvent.changeText(screen.getByTestId("config-flag-name"), "gamma");
    await fireEvent.press(screen.getByTestId("config-flag-add"));
    await fireEvent.press(screen.getByTestId("configuration-edit-submit"));
    expect(await screen.findByText("Setting saved")).toBeOnTheScreen();
    expect(captured.put).toEqual({ value: { beta: false, gamma: true } });
  });

  it("edits an enum set by its chips and saves the chosen keys", async () => {
    const captured: Captured = {};
    await renderSheet(
      routedFetch({
        "/admin/configurations/consultancy.chargeable_services": (init) => {
          captured.put = JSON.parse(String(init?.body));
          return ok({ key: "consultancy.chargeable_services", value: {} });
        },
      }),
      { key: "consultancy.chargeable_services", value: { chargeableServiceKeys: ["negotiation"] } },
    );
    await fireEvent.press(await screen.findByTestId("config-option-site_visit"));
    await fireEvent.press(screen.getByTestId("configuration-edit-submit"));
    expect(await screen.findByText("Setting saved")).toBeOnTheScreen();
    expect(captured.put).toEqual({
      value: { chargeableServiceKeys: ["negotiation", "site_visit"] },
    });
  });

  it("deselects an already-chosen chip and saves the remaining keys", async () => {
    const captured: Captured = {};
    await renderSheet(
      routedFetch({
        "/admin/configurations/consultancy.chargeable_services": (init) => {
          captured.put = JSON.parse(String(init?.body));
          return ok({ key: "consultancy.chargeable_services", value: {} });
        },
      }),
      {
        key: "consultancy.chargeable_services",
        value: { chargeableServiceKeys: ["negotiation", "site_visit"] },
      },
    );
    await fireEvent.press(await screen.findByTestId("config-option-negotiation"));
    await fireEvent.press(screen.getByTestId("configuration-edit-submit"));
    expect(await screen.findByText("Setting saved")).toBeOnTheScreen();
    expect(captured.put).toEqual({ value: { chargeableServiceKeys: ["site_visit"] } });
  });

  it("removes a feature flag and saves the record without it", async () => {
    const captured: Captured = {};
    await renderSheet(
      routedFetch({
        "/admin/configurations/feature.flags": (init) => {
          captured.put = JSON.parse(String(init?.body));
          return ok({ key: "feature.flags", value: {} });
        },
      }),
      { key: "feature.flags", value: { beta: true, legacy: true } },
    );
    await fireEvent.press(await screen.findByTestId("config-flag-remove-legacy"));
    await fireEvent.press(screen.getByTestId("configuration-edit-submit"));
    expect(await screen.findByText("Setting saved")).toBeOnTheScreen();
    expect(captured.put).toEqual({ value: { beta: true } });
  });

  it("clears a field's error once the value is corrected, before the next Save", async () => {
    await renderSheet(routedFetch({ [IDLE_PATH]: () => ok({ key: IDLE_KEY, value: idleValue }) }));
    await fireEvent.changeText(await screen.findByTestId("config-field-staffMinutes"), "0");
    await fireEvent.press(screen.getByTestId("configuration-edit-submit"));
    expect(await screen.findByText("Must be at least 1")).toBeOnTheScreen();
    // Correcting the value drops the stale message straight away, without pressing Save again.
    await fireEvent.changeText(screen.getByTestId("config-field-staffMinutes"), "600");
    expect(screen.queryByText("Must be at least 1")).toBeNull();
  });

  it("keeps the New flag field when the name already exists (no false 'added')", async () => {
    await renderSheet(
      routedFetch({
        "/admin/configurations/feature.flags": () => ok({ key: "feature.flags", value: {} }),
      }),
      { key: "feature.flags", value: { beta: true } },
    );
    await fireEvent.changeText(await screen.findByTestId("config-flag-name"), "beta");
    await fireEvent.press(screen.getByTestId("config-flag-add"));
    // The duplicate is rejected, so the field still shows the typed name rather than blanking.
    expect(screen.getByDisplayValue("beta")).toBeOnTheScreen();
  });
});
