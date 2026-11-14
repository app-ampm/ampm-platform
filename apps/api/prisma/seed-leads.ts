/**
 * Synthetic Sales leads across the funnel stages and sources (feature 8.x), so the pipeline board, the
 * funnel and the convert-to-client flow have content out of the box — the capture form and the website
 * land real ones in production. Owned by Sales; idempotent by fixed id; synthetic throughout (data.md).
 */
import { type PrismaClient } from "../src/generated/prisma/client.js";
import { PRIVACY_NOTICE_VERSION } from "../src/modules/crm/leads/lead-constants.js";

/** The seeded Sales user's identity subject (seed.ts SEED.sales); the leads are owned by Sales. */
const SALES_SUBJECT = "local:sm";

type LeadStage = "new" | "contacted" | "introduction_shared" | "demo_offered" | "follow_up";

const LEADS: ReadonlyArray<{
  readonly id: string;
  readonly name: string;
  readonly first: string;
  readonly sourceKey: string;
  readonly status: LeadStage;
  readonly destination: string;
  readonly guests: number;
  readonly requestedDemo: boolean;
}> = [
  {
    id: "0192f3a0-7d3e-7b1a-9c2f-0000000000e1",
    name: "Ananya & Rohan",
    first: "ananya",
    sourceKey: "website",
    status: "new",
    destination: "Goa",
    guests: 150,
    requestedDemo: true,
  },
  {
    id: "0192f3a0-7d3e-7b1a-9c2f-0000000000e2",
    name: "Meera & Dev",
    first: "meera",
    sourceKey: "instagram",
    status: "contacted",
    destination: "Udaipur",
    guests: 300,
    requestedDemo: false,
  },
  {
    id: "0192f3a0-7d3e-7b1a-9c2f-0000000000e3",
    name: "Sara & Kabir",
    first: "sara",
    sourceKey: "referral",
    status: "introduction_shared",
    destination: "Jaipur",
    guests: 200,
    requestedDemo: false,
  },
  {
    id: "0192f3a0-7d3e-7b1a-9c2f-0000000000e4",
    name: "Nisha & Arjun",
    first: "nisha",
    sourceKey: "website",
    status: "demo_offered",
    destination: "Goa",
    guests: 120,
    requestedDemo: true,
  },
  {
    id: "0192f3a0-7d3e-7b1a-9c2f-0000000000e5",
    name: "Tara & Veer",
    first: "tara",
    sourceKey: "advertisement",
    status: "follow_up",
    destination: "Udaipur",
    guests: 250,
    requestedDemo: false,
  },
];

export async function seedLeads(prisma: PrismaClient): Promise<void> {
  const sales = await prisma.user.findUnique({
    where: { identitySubject: SALES_SUBJECT },
    select: { id: true },
  });
  const sources = await prisma.leadSource.findMany({ select: { id: true, sourceKey: true } });
  const sourceId = (key: string): string => {
    const found = sources.find((source) => source.sourceKey === key);
    if (!found) throw new Error(`lead source ${key} was not seeded`);
    return found.id;
  };
  for (const [index, lead] of LEADS.entries()) {
    await prisma.lead.upsert({
      where: { id: lead.id },
      // Never reset status on a re-seed, so a tester's demo progress (a lead dragged forward or converted)
      // stands — matching the enquiry upserts; the create fields are static, so there is nothing to refresh.
      update: {},
      create: {
        id: lead.id,
        sourceId: sourceId(lead.sourceKey),
        status: lead.status,
        name: lead.name,
        email: `${lead.first}@example.com`,
        phone: `+911234568${100 + index}`,
        destinationText: lead.destination,
        guestEstimate: lead.guests,
        requirements: "Destination wedding; exploring venues and dates.",
        consentMarketing: true,
        // Mirror the real capture paths: consent is recorded with its timestamp and notice version together.
        consentAt: new Date(),
        consentNoticeVersion: PRIVACY_NOTICE_VERSION,
        requestedDemo: lead.requestedDemo,
        ...(sales ? { ownerUserId: sales.id, createdBy: sales.id } : {}),
      },
    });
  }
}
