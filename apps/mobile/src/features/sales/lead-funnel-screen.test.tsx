import { fireEvent, screen, within } from "../../test/render";
import { LeadFunnelScreen } from "./lead-funnel-screen";
import {
  failure,
  leadFunnelViewFixture,
  ok,
  renderWithApi,
  routedFetch,
  staffMeFixture,
  type FetchFn,
} from "./sales.test-utils";

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 1280, height: 900, scale: 2, fontScale: 1 }),
}));

const FUNNEL_PATH = "/crm/reports/lead-funnel";

function funnelFetch(roles: ReturnType<typeof staffMeFixture>["roles"]): FetchFn {
  return routedFetch({
    "/me": () => ok(staffMeFixture(roles)),
    [FUNNEL_PATH]: () => ok(leadFunnelViewFixture()),
  });
}

describe("LeadFunnelScreen", () => {
  it("shows the total and the bars by stage and source for Sales", async () => {
    await renderWithApi(<LeadFunnelScreen />, funnelFetch(["SM"]));
    expect(await screen.findByTestId("funnel-total")).toBeOnTheScreen();
    expect(screen.getByText("12")).toBeOnTheScreen();
    const stages = within(await screen.findByTestId("funnel-by-stage"));
    expect(stages.getByText("New")).toBeOnTheScreen();
    expect(stages.getByText("Contacted")).toBeOnTheScreen();
    const sources = within(await screen.findByTestId("funnel-by-source"));
    expect(sources.getByText("Instagram")).toBeOnTheScreen();
    expect(sources.getByText("Referral")).toBeOnTheScreen();
  });

  it("hides the funnel from a role without the report key — and never queries it", async () => {
    const paths: string[] = [];
    const base = funnelFetch(["HT"]);
    const spy: FetchFn = (input, init) => {
      paths.push(String(input));
      return base(input, init);
    };
    await renderWithApi(<LeadFunnelScreen />, spy);
    expect(await screen.findByTestId("funnel-forbidden")).toBeOnTheScreen();
    expect(screen.queryByTestId("funnel-total")).toBeNull();
    expect(paths.some((p) => p.includes("/crm/reports/lead-funnel"))).toBe(false);
  });

  it("refetches with a date window when it changes", async () => {
    const urls: string[] = [];
    const base = funnelFetch(["SM"]);
    const spy: FetchFn = (input, init) => {
      urls.push(String(input));
      return base(input, init);
    };
    await renderWithApi(<LeadFunnelScreen />, spy);
    await screen.findByTestId("funnel-total");
    await fireEvent.press(screen.getByText("30 days"));
    expect(urls.some((url) => url.includes("/crm/reports/lead-funnel?from="))).toBe(true);
  });

  it("offers sign-in — not the denial line — when the session has ended (/me fails)", async () => {
    const fetch = routedFetch({
      "/me": () => failure("unauthenticated", 401),
      [FUNNEL_PATH]: () => ok(leadFunnelViewFixture()),
    });
    await renderWithApi(<LeadFunnelScreen />, fetch);
    expect(await screen.findByText("Sign in to view the funnel")).toBeOnTheScreen();
    expect(screen.queryByTestId("funnel-forbidden")).toBeNull();
  });

  it("shows an empty line when there are no leads in the window", async () => {
    const fetch = routedFetch({
      "/me": () => ok(staffMeFixture(["SM"])),
      [FUNNEL_PATH]: () => ok(leadFunnelViewFixture({ total: 0, byStatus: [], bySource: [] })),
    });
    await renderWithApi(<LeadFunnelScreen />, fetch);
    expect(await screen.findByTestId("funnel-empty")).toBeOnTheScreen();
  });
});
