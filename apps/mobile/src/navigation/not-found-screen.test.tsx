import { fireEvent, renderWithProviders, screen } from "../test/render";
import { NOT_FOUND_COPY, NotFoundScreen } from "./not-found-screen";

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockRouter = { canGoBack: () => false };

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace }),
  useCanGoBack: () => mockRouter.canGoBack(),
}));

describe("NotFoundScreen", () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockReplace.mockClear();
    mockRouter.canGoBack = () => false;
  });

  it("says the page isn't here, in Peacock Night's words rather than a router's", async () => {
    await renderWithProviders(<NotFoundScreen />);
    expect(screen.getByRole("header", { name: NOT_FOUND_COPY.title })).toBeOnTheScreen();
    expect(screen.getByText(NOT_FOUND_COPY.stateTitle)).toBeOnTheScreen();
    expect(screen.getByText(NOT_FOUND_COPY.description)).toBeOnTheScreen();
  });

  it("takes the person to the entry route, which opens their own home", async () => {
    await renderWithProviders(<NotFoundScreen />);
    await fireEvent.press(screen.getByRole("button", { name: NOT_FOUND_COPY.home }));
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("offers Back to where the person came from", async () => {
    mockRouter.canGoBack = () => true;
    await renderWithProviders(<NotFoundScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Back" }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("leaves Back out when the address was opened directly, with nowhere to go back to", async () => {
    await renderWithProviders(<NotFoundScreen />);
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });
});
