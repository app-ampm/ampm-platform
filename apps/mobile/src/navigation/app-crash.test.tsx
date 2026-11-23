import { uiCopy } from "@ampm/ui";

import { fireEvent, render, screen } from "../test/render";
import { AppCrash } from "./app-crash";
import { logCrash } from "./crash-log";

jest.mock("./crash-log", () => ({ logCrash: jest.fn() }));

const ERROR = new Error("A chrome bug");

describe("AppCrash", () => {
  beforeEach(() => jest.clearAllMocks());

  // It replaces the whole root layout, so it renders here without the app's providers, as it must.
  it("shows the shared error state under its own theme, never the raw error", async () => {
    await render(<AppCrash error={ERROR} retry={jest.fn(async () => undefined)} />);
    expect(screen.getByTestId("app-crash")).toBeOnTheScreen();
    expect(screen.getByText(uiCopy.error.title)).toBeOnTheScreen();
    expect(screen.getByText(uiCopy.error.description)).toBeOnTheScreen();
    expect(screen.queryByText(/A chrome bug/)).toBeNull();
  });

  it("logs the crash as an app crash and draws the app afresh on Try again", async () => {
    const retry = jest.fn(async () => undefined);
    await render(<AppCrash error={ERROR} retry={retry} />);
    expect(logCrash).toHaveBeenCalledWith("app", ERROR);
    await fireEvent.press(screen.getByRole("button", { name: uiCopy.retry }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
