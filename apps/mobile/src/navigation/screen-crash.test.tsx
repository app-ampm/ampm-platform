import { fireEvent, renderWithProviders, screen } from "../test/render";
import { logCrash } from "./crash-log";
import { CRASH_COPY, ScreenCrash } from "./screen-crash";

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockRouter = { canGoBack: () => false };

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace }),
  useCanGoBack: () => mockRouter.canGoBack(),
}));
jest.mock("./crash-log", () => ({ logCrash: jest.fn() }));

const ERROR = new Error("A screen bug");

function renderCrash(retry = jest.fn(async () => undefined)) {
  return renderWithProviders(<ScreenCrash error={ERROR} retry={retry} />);
}

describe("ScreenCrash", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.canGoBack = () => false;
  });

  it("says the page stopped working, never the raw error", async () => {
    await renderCrash();
    expect(screen.getByRole("header", { name: CRASH_COPY.title })).toBeOnTheScreen();
    expect(screen.getByText(CRASH_COPY.stateTitle)).toBeOnTheScreen();
    expect(screen.getByText(CRASH_COPY.description)).toBeOnTheScreen();
    expect(screen.queryByText(/A screen bug/)).toBeNull();
  });

  it("logs the crash once, as a screen crash", async () => {
    await renderCrash();
    expect(logCrash).toHaveBeenCalledTimes(1);
    expect(logCrash).toHaveBeenCalledWith("screen", ERROR);
  });

  it("draws the screen afresh on Try again", async () => {
    const retry = jest.fn(async () => undefined);
    await renderCrash(retry);
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("goes to the entry route, which opens the person's own home", async () => {
    await renderCrash();
    await fireEvent.press(screen.getByRole("button", { name: CRASH_COPY.home }));
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("offers Back to where the person came from", async () => {
    mockRouter.canGoBack = () => true;
    await renderCrash();
    await fireEvent.press(screen.getByRole("button", { name: "Back" }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("leaves Back out when there is nowhere to go back to", async () => {
    await renderCrash();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });
});
