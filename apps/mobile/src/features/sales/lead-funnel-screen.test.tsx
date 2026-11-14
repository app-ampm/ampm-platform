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

// The window's width picks the layout: the sections stacked below 1024, side by side from there.
const mockWindow = { width: 1280 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockWindow.width, height: 900, scale: 2, fontScale: 1 }),
}));

beforeEach(() => {
  mockWindow.width = 1280;
});

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

  it("reads the total as a glass KPI card: eyebrow, numeral, and the open and converted", async () => {
    await renderWithApi(<LeadFunnelScreen />, funnelFetch(["SM"]));
    const kpi = within(await screen.findByTestId("funnel-kpi"));
    expect(kpi.getByText("Leads in range")).toBeOnTheScreen();
    expect(kpi.getByText("12")).toBeOnTheScreen();
    expect(kpi.getByText("9 open · 2 converted")).toBeOnTheScreen();
  });

  it("sets By stage beside By source from 1024, so no bar spans the desktop", async () => {
    await renderWithApi(<LeadFunnelScreen />, funnelFetch(["SM"]));
    const columns = await screen.findByTestId("funnel-columns");
    expect(columns.props.className).toEqual(expect.stringContaining("flex-row"));
    const [stage, source] = columns.children as unknown as Parameters<typeof within>[0][];
    expect(within(stage).getByTestId("funnel-by-stage")).toBeOnTheScreen();
    expect(within(source).getByTestId("funnel-by-source")).toBeOnTheScreen();
  });

  it("stacks the sections on a phone, the range switch in the header", async () => {
    mockWindow.width = 390;
    await renderWithApi(<LeadFunnelScreen />, funnelFetch(["SM"]));
    const columns = await screen.findByTestId("funnel-columns");
    expect(columns.props.className).toEqual(expect.stringContaining("flex-col"));
    expect(within(screen.getByTestId("funnel-header")).getByTestId("funnel-window")).toBeTruthy();
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
