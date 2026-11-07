import { ME_DEMO, ME_LOCKED, ME_SUBSCRIBER } from "./portal.fixtures";
import {
  billingLabel,
  canBrowseHotels,
  firstName,
  greeting,
  hasHotelAssistance,
  isDiscoveryActive,
  moduleLabel,
  paymentPhase,
  termLabel,
} from "./portal.format";

describe("portal.format", () => {
  it("greets by the first word of the name, and not at all when the name is blank", () => {
    expect(firstName("  Ananya   Sharma ")).toBe("Ananya");
    expect(greeting("Ananya Sharma")).toBe("Hello, Ananya");
    expect(firstName("   ")).toBeNull();
    expect(greeting("")).toBeUndefined();
  });

  it("opens the subscriber home only when the subscription reaches every hotel", () => {
    expect(isDiscoveryActive(ME_SUBSCRIBER)).toBe(true);
    expect(isDiscoveryActive(ME_LOCKED)).toBe(false);
    // A demo principal browses its scoped set but has not activated discovery.
    expect(isDiscoveryActive(ME_DEMO)).toBe(false);
    expect(canBrowseHotels(ME_DEMO)).toBe(true);
    expect(canBrowseHotels(ME_LOCKED)).toBe(false);
    expect(hasHotelAssistance(ME_SUBSCRIBER)).toBe(true);
    expect(hasHotelAssistance(ME_DEMO)).toBe(false);
  });

  it("names the plan's modules, billing and term for the card", () => {
    expect(moduleLabel("hotel_assistance")).toBe("Hotel assistance");
    expect(billingLabel("one_time")).toBe("One-time");
    expect(billingLabel("recurring")).toBe("Recurring");
    expect(termLabel(30)).toBe("30 days from payment");
    expect(termLabel(1)).toBe("1 day from payment");
  });

  it("follows a purchase from not started to pending to activating", () => {
    expect(paymentPhase(null, false)).toBe("idle");
    expect(paymentPhase(null, true)).toBe("idle");
    expect(paymentPhase("sub-1", false)).toBe("pending");
    expect(paymentPhase("sub-1", true)).toBe("activating");
  });
});
