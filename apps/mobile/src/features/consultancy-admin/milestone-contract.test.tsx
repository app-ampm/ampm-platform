import { Linking } from "react-native";

import type { BookingMilestoneStatus } from "@ampm/core";
import { pickFile } from "@ampm/ui";
import type * as UiModule from "@ampm/ui";

import { fireEvent, screen, waitFor, within } from "../../test/render";
import {
  ENQUIRY_ID,
  MILESTONE_ID,
  jsonResponse,
  milestoneFixture,
  ok,
  page,
  renderWithApi,
  routedFetch,
  type Route,
  type SentRequest,
} from "./consultancy-admin.test-utils";
import { MilestonesSection } from "./enquiry-progress";

jest.mock("@ampm/ui", () => ({
  ...jest.requireActual<typeof UiModule>("@ampm/ui"),
  pickFile: jest.fn(),
}));

const DOCUMENT_ID = "018f0000-0000-7000-8000-0000000009d1";
const MILESTONES = "GET /consultancy-admin/booking-milestones";
const ATTACH = `POST /consultancy-admin/booking-milestones/${MILESTONE_ID}/contract`;
const LINK = `POST /consultancy-admin/booking-milestones/${MILESTONE_ID}/contract/link`;
const LINK_PATH = "/documents/links/018f0000-0000-7000-8000-00000000a111/token";

const contractMilestone = (
  documentId: string | null = null,
  status: BookingMilestoneStatus = "pending",
) => milestoneFixture({ milestoneType: "contract_signed", amount: null, documentId, status });

const pdf = (sizeBytes = 2_048) => ({
  file: new Blob(["%PDF-1.4"], { type: "application/pdf" }),
  mimeType: "application/pdf",
  sizeBytes,
  name: "signed-contract.pdf",
});

async function renderSection(routes: Record<string, Route>, sent: SentRequest[] = []) {
  await renderWithApi(<MilestonesSection enquiryId={ENQUIRY_ID} />, routedFetch(routes, sent));
  return screen.findByTestId("milestones");
}

const posts = (sent: readonly SentRequest[]) => sent.filter((request) => request.method === "POST");

beforeEach(() => {
  jest.mocked(pickFile).mockReset();
});

describe("MilestonesSection: the signed contract on a contract_signed milestone (D-132)", () => {
  it("asks for the contract first and offers no Done until one is attached", async () => {
    const milestones = await renderSection({ [MILESTONES]: () => page([contractMilestone()]) });
    expect(
      within(milestones).getByText(
        "Attach the signed contract (PDF, JPEG or PNG) to mark this done.",
      ),
    ).toBeOnTheScreen();
    expect(
      within(milestones).getByRole("button", { name: "Attach signed contract" }),
    ).toBeOnTheScreen();
    expect(within(milestones).queryByRole("button", { name: "Done" })).toBeNull();
    expect(within(milestones).getByRole("button", { name: "Cancelled" })).toBeOnTheScreen();
  });

  it("uploads the picked file to the milestone, narrowing the picker to PDF, JPEG and PNG", async () => {
    const sent: SentRequest[] = [];
    jest.mocked(pickFile).mockResolvedValue(pdf());
    const milestones = await renderSection(
      {
        [MILESTONES]: () => page([contractMilestone()]),
        [ATTACH]: () => ok(contractMilestone(DOCUMENT_ID)),
      },
      sent,
    );
    await fireEvent.press(
      within(milestones).getByRole("button", { name: "Attach signed contract" }),
    );
    expect(pickFile).toHaveBeenCalledWith("application/pdf,image/jpeg,image/png");
    await waitFor(() =>
      expect(posts(sent)).toContainEqual({
        method: "POST",
        path: `/consultancy-admin/booking-milestones/${MILESTONE_ID}/contract`,
        body: null, // raw bytes, not JSON
      }),
    );
    expect(await screen.findByText("Signed contract attached")).toBeOnTheScreen();
  });

  it("refuses a file over the limit without uploading it", async () => {
    const sent: SentRequest[] = [];
    jest.mocked(pickFile).mockResolvedValue(pdf(21 * 1024 * 1024));
    const milestones = await renderSection(
      { [MILESTONES]: () => page([contractMilestone()]) },
      sent,
    );
    await fireEvent.press(
      within(milestones).getByRole("button", { name: "Attach signed contract" }),
    );
    expect(await screen.findByText("This file is over the 20 MB limit")).toBeOnTheScreen();
    expect(posts(sent)).toEqual([]);
  });

  it("shows the API's refusal, such as a file that is not a PDF, JPEG or PNG", async () => {
    jest.mocked(pickFile).mockResolvedValue(pdf());
    const refusal = {
      code: "validation_failed",
      message: "Unsupported file type; allowed: PDF, JPEG, PNG",
    };
    const milestones = await renderSection({
      [MILESTONES]: () => page([contractMilestone()]),
      [ATTACH]: () => jsonResponse({ error: refusal }, 400),
    });
    await fireEvent.press(
      within(milestones).getByRole("button", { name: "Attach signed contract" }),
    );
    expect(
      await screen.findByText("Unsupported file type; allowed: PDF, JPEG, PNG"),
    ).toBeOnTheScreen();
  });

  it("with a contract attached: views it through a minted link, offers a replacement and Done", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    const expiresAt = "2026-11-15T12:15:00.000Z";
    const milestones = await renderSection({
      [MILESTONES]: () => page([contractMilestone(DOCUMENT_ID)]),
      [LINK]: () => ok({ url: LINK_PATH, expiresAt }),
    });
    expect(within(milestones).getByText("Contract attached")).toBeOnTheScreen();
    expect(within(milestones).getByRole("button", { name: "Replace contract" })).toBeOnTheScreen();
    expect(within(milestones).getByRole("button", { name: "Done" })).toBeOnTheScreen();
    await fireEvent.press(within(milestones).getByRole("button", { name: "View contract" }));
    // The root-relative link is opened from the API base, not the app's own origin.
    await waitFor(() => expect(open).toHaveBeenCalledWith(`http://api.test${LINK_PATH}`));
    open.mockRestore();
  });

  it("keeps only View contract once the milestone is done", async () => {
    const milestones = await renderSection({
      [MILESTONES]: () => page([contractMilestone(DOCUMENT_ID, "done")]),
    });
    expect(within(milestones).getByRole("button", { name: "View contract" })).toBeOnTheScreen();
    expect(within(milestones).queryByRole("button", { name: "Replace contract" })).toBeNull();
    expect(within(milestones).queryByRole("button", { name: "Done" })).toBeNull();
  });

  it("adds nothing to a milestone of another type", async () => {
    const milestones = await renderSection({ [MILESTONES]: () => page([milestoneFixture()]) });
    expect(within(milestones).queryByRole("button", { name: "Attach signed contract" })).toBeNull();
    expect(within(milestones).getByRole("button", { name: "Done" })).toBeOnTheScreen();
  });
});
