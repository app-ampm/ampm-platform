import { CONFIGURATIONS_QUERY_KEY, NOTIFICATION_TEMPLATES_QUERY_KEY } from "@ampm/api-client";
import type { NotificationTemplates } from "@ampm/core";

import { fireEvent, screen } from "../../test/render";
import { NotificationTemplateEditSheet } from "./notification-template-edit-sheet";
import { failure, ok, renderWithApi, routedFetch, type FetchFn } from "./admin.test-utils";

const PATH = "/admin/configurations/notification.templates";

const staffInvite = {
  email: { subject: "Your AMPM invitation", html: "<p>Hi {{name}}</p>", text: "Hi {{name}}" },
};
const bookingReminder = { sms: { text: "Your visit is on {{date}}." } };
const allTemplates: NotificationTemplates = {
  "staff.invite": staffInvite,
  "booking.reminder": bookingReminder,
};

interface Captured {
  put?: unknown;
}

/** A fetch that records the PUT body and returns the record unchanged. */
const savingFetch = (captured: Captured): FetchFn =>
  routedFetch({
    [PATH]: (init) => {
      captured.put = JSON.parse(String(init?.body));
      return ok({ key: "notification.templates", value: allTemplates });
    },
  });

async function renderSheet(
  fetchImpl: FetchFn,
  entry: { key: string; template: NotificationTemplates[string] } = {
    key: "staff.invite",
    template: staffInvite,
  },
  onClose: jest.Mock = jest.fn(),
): Promise<jest.Mock> {
  await renderWithApi(
    <NotificationTemplateEditSheet entry={entry} allTemplates={allTemplates} onClose={onClose} />,
    fetchImpl,
  );
  return onClose;
}

describe("NotificationTemplateEditSheet", () => {
  it("edits a channel field and saves the whole record with just that template changed", async () => {
    const captured: Captured = {};
    const onClose = await renderSheet(savingFetch(captured));
    await fireEvent.changeText(
      await screen.findByTestId("template-field-email-subject"),
      "Welcome to AMPM",
    );
    await fireEvent.press(screen.getByTestId("notification-template-edit-submit"));
    expect(await screen.findByText("Template saved")).toBeOnTheScreen();
    expect(captured.put).toEqual({
      value: {
        "staff.invite": {
          email: { subject: "Welcome to AMPM", html: "<p>Hi {{name}}</p>", text: "Hi {{name}}" },
        },
        "booking.reminder": bookingReminder,
      },
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("blocks saving an enabled channel whose primary content is blank", async () => {
    const captured: Captured = {};
    await renderSheet(savingFetch(captured));
    await fireEvent.changeText(await screen.findByTestId("template-field-email-subject"), "   ");
    await fireEvent.press(screen.getByTestId("notification-template-edit-submit"));
    expect(await screen.findByText(/Add the subject/)).toBeOnTheScreen();
    expect(captured.put).toBeUndefined();
  });

  it("turns a channel off and drops it from the saved template", async () => {
    const captured: Captured = {};
    await renderSheet(savingFetch(captured));
    await fireEvent.press(await screen.findByTestId("template-channel-email"));
    await fireEvent.press(screen.getByTestId("notification-template-edit-submit"));
    expect(await screen.findByText("Template saved")).toBeOnTheScreen();
    expect(captured.put).toEqual({
      value: { "staff.invite": {}, "booking.reminder": bookingReminder },
    });
  });

  it("turns a new channel on, fills it, and includes it in the saved template", async () => {
    const captured: Captured = {};
    await renderSheet(savingFetch(captured));
    await fireEvent.press(await screen.findByTestId("template-channel-push"));
    await fireEvent.changeText(screen.getByTestId("template-field-push-title"), "You're invited");
    await fireEvent.changeText(screen.getByTestId("template-field-push-body"), "Tap to activate");
    await fireEvent.press(screen.getByTestId("notification-template-edit-submit"));
    expect(await screen.findByText("Template saved")).toBeOnTheScreen();
    expect(captured.put).toEqual({
      value: {
        "staff.invite": {
          email: {
            subject: "Your AMPM invitation",
            html: "<p>Hi {{name}}</p>",
            text: "Hi {{name}}",
          },
          push: { title: "You're invited", body: "Tap to activate" },
        },
        "booking.reminder": bookingReminder,
      },
    });
  });

  it("shows an error and stays open when the save fails on the server", async () => {
    const onClose = await renderSheet(routedFetch({ [PATH]: () => failure("internal", 500) }));
    await fireEvent.press(await screen.findByTestId("notification-template-edit-submit"));
    expect(await screen.findByText("Could not save the template")).toBeOnTheScreen();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("refreshes both the templates view and the configuration inventory on save", async () => {
    const captured: Captured = {};
    const queryClient = await renderWithApi(
      <NotificationTemplateEditSheet
        entry={{ key: "staff.invite", template: staffInvite }}
        allTemplates={allTemplates}
        onClose={jest.fn()}
      />,
      savingFetch(captured),
    );
    const spy = jest.spyOn(queryClient, "invalidateQueries");
    await fireEvent.changeText(
      await screen.findByTestId("template-field-email-subject"),
      "Welcome",
    );
    await fireEvent.press(screen.getByTestId("notification-template-edit-submit"));
    expect(await screen.findByText("Template saved")).toBeOnTheScreen();
    // Templates live under the config key the inventory also reads, so both queries are invalidated.
    expect(spy).toHaveBeenCalledWith({ queryKey: NOTIFICATION_TEMPLATES_QUERY_KEY });
    expect(spy).toHaveBeenCalledWith({ queryKey: CONFIGURATIONS_QUERY_KEY });
  });

  it("clears a field's error once the content is corrected, before the next Save", async () => {
    await renderSheet(
      routedFetch({ [PATH]: () => ok({ key: "notification.templates", value: allTemplates }) }),
    );
    await fireEvent.changeText(await screen.findByTestId("template-field-email-subject"), "   ");
    await fireEvent.press(screen.getByTestId("notification-template-edit-submit"));
    expect(await screen.findByText(/Add the subject/)).toBeOnTheScreen();
    // Correcting the value drops the stale message straight away, without pressing Save again.
    await fireEvent.changeText(screen.getByTestId("template-field-email-subject"), "Welcome");
    expect(screen.queryByText(/Add the subject/)).toBeNull();
  });
});
