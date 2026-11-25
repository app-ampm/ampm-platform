import { HOTEL_FORM_DESIGNATIONS, HOTEL_FORM_ERRORS, HOTEL_FORM_MOBILE_REFUSAL } from "@ampm/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBotCheck } from "@/components/bot-check/use-bot-check";

import { EMPTY_DETAILS } from "./details.form";
import { HOTEL_FORM_COPY } from "./hotel-form-copy";
import { PRIVACY_NOTICE } from "./privacy-notice";
import {
  BY_SMS,
  HELP,
  LINK,
  ON_SCREEN,
  buttonsIn,
  decoded,
  flowAt,
  screenOf,
  tagsWith,
} from "./screen.test-utils";

/* HF-01, HF-02 and HF-03 in each of their states (D-189 §8), as the server renders them. */

vi.mock("@/components/bot-check/use-bot-check", () => ({
  useBotCheck: vi.fn(() => ({
    ref: () => undefined,
    check: { status: "checking" },
    token: null,
    reset: () => undefined,
  })),
}));

const NOW = Date.parse("2026-11-25T10:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.mocked(useBotCheck).mockClear();
});

const welcome = (state = {}) => screenOf(flowAt({ phase: { kind: "welcome" }, ...state }));
const details = (state = {}) =>
  screenOf(flowAt({ phase: { kind: "identity", identity: { step: "details" } }, ...state }));
const code = (issued = ON_SCREEN, state = {}) =>
  screenOf(
    flowAt({
      phase: { kind: "identity", identity: { step: "code", issued, resendAt: NOW + 30_000 } },
      ...state,
    }),
  );

describe("HF-01, Welcome and privacy notice", () => {
  it("is step 1 of 3, under the page's one heading, with Start as its gold action", () => {
    const html = welcome();
    expect(html.match(/<h1 /g)).toHaveLength(1);
    expect(html).toMatch(
      /<h1 [^>]*>Tell AMPM about <span class="text-brand">your hotel\.<\/span><\/h1>/,
    );
    expect(html).toContain("Step 1 of 3");
    expect(buttonsIn(html)).toEqual(["Start"]);
  });

  it("says what AMPM asks and why, how long it takes, coming back, colleagues and who sees answers", () => {
    const html = welcome();
    expect(html).toContain(
      "rooms, venues, food and beverage, booking terms, photos and floor plans",
    );
    expect(html).toContain("about 20 minutes");
    expect(html).toContain("open this link again to carry on");
    expect(html).toContain("Colleagues can help");
    expect(html).toContain("Anyone who has this link can see what is entered here");
  });

  it("carries the privacy notice: who sees what, every processor, how long, and whom to ask", () => {
    const html = welcome();
    expect(html).toMatch(/<details[^>]*><summary[^>]*>Read the privacy notice<\/summary>/);
    expect(html).toContain(PRIVACY_NOTICE.dated);
    for (const processor of ["Cloudflare", "Resend", "an SMS provider", "a hosting company"])
      expect(html).toContain(processor);
    expect(html).toContain("12 months");
    expect(html).toContain("masked after 24 months");
    expect(html).toContain(`To ask about your data, or to complain: ${HELP}`);
  });

  it("hints at opening the page in a browser from an app, and says when the link stops working", () => {
    const html = welcome();
    expect(html).toContain("Opened this from WhatsApp, Gmail or another app?");
    expect(html).toContain("This link works until 25 Dec 2026.");
    expect(html).toContain(`Need help? ${HELP}`);
  });

  it("says plainly when the request is with AMPM, or complete", () => {
    expect(decoded(welcome({ link: { ...LINK, state: "locked" } }))).toContain(
      HOTEL_FORM_COPY.welcome.locked,
    );
    expect(welcome({ link: { ...LINK, state: "status_only" } })).toContain(
      "This request is complete. Until 25 Dec 2026 you can sign in to see its status",
    );
    expect(decoded(welcome())).not.toContain(HOTEL_FORM_COPY.welcome.locked);
  });

  it("tells a person who signed out, and asks whom to call while AMPM has set no contact", () => {
    const notice = { message: HOTEL_FORM_COPY.welcome.signedOut, retryAt: null, isReload: false };
    const html = welcome({ notice, helpContact: null });
    expect(html).toMatch(/role="alert"[^>]*><p[^>]*>You&#x27;re signed out\./);
    expect(html).toContain(`Need help? ${HOTEL_FORM_COPY.helpFallback}`);
  });
});

describe("HF-02, Your details", () => {
  it("asks for the name, the designation and an Indian mobile, each required", () => {
    const html = details();
    expect(html).toContain("Step 2 of 3");
    expect(tagsWith(html, "input", 'id="hf-full-name"')[0]).toContain('autoComplete="name"');
    expect(tagsWith(html, "select", 'id="hf-designation"')[0]).toContain('aria-required="true"');
    for (const designation of HOTEL_FORM_DESIGNATIONS)
      expect(tagsWith(html, "option", `value="${designation}"`)).toHaveLength(1);
    const [mobile] = tagsWith(html, "input", 'id="hf-mobile"');
    expect(mobile).toContain('type="tel"');
    expect(html).toMatch(/>\+91<\/span>/);
  });

  it("asks for Other's words only once Other is chosen", () => {
    expect(details()).not.toContain('id="hf-designation-other"');
    const claim = { ...EMPTY_DETAILS, designationChoice: "Other" };
    expect(details({ claim })).toContain('id="hf-designation-other"');
  });

  it("asks for the notice's tick beside the notice, and runs the bot check for hf_code", () => {
    const html = details();
    expect(tagsWith(html, "input", 'id="hf-notice"')[0]).toContain('aria-required="true"');
    expect(html).toContain("I have read the privacy notice and accept it");
    expect(html).toContain("<summary");
    expect(vi.mocked(useBotCheck)).toHaveBeenCalledWith(expect.any(String), {
      action: "hf_code",
    });
    expect(html).toContain('<div id="hf-bot-check"');
  });

  it("waits for the bot check before it sends, saying why", () => {
    const [send] = tagsWith(details(), "button", 'type="submit"');
    expect(send).toContain('disabled=""');
    expect(send).toContain('aria-describedby="hf-bot-check-status"');
    vi.mocked(useBotCheck).mockReturnValue({
      ref: () => undefined,
      check: { status: "passed", token: "token-1" },
      token: "token-1",
      reset: () => undefined,
    });
    expect(tagsWith(details(), "button", 'type="submit"')[0]).not.toContain('disabled=""');
  });

  it("shows each refused answer on its field, the tick's too", () => {
    const errors = {
      fullName: "Enter your name",
      mobile: HOTEL_FORM_MOBILE_REFUSAL,
      notice: HOTEL_FORM_COPY.details.noticeRequired,
    };
    const html = details({ errors });
    expect(tagsWith(html, "input", 'id="hf-full-name"')[0]).toContain(
      'aria-describedby="hf-full-name-error"',
    );
    expect(html).toContain(`<p id="hf-mobile-error" role="alert"`);
    expect(html).toContain(`<p id="hf-notice-error" role="alert"`);
  });

  it("shows the API's refusal and counts its wait down on the button", () => {
    const notice = { message: HOTEL_FORM_ERRORS.tooSoon, retryAt: NOW + 25_000, isReload: false };
    const html = details({ notice });
    expect(html).toMatch(/role="alert"[^>]*><p[^>]*>Please wait a few seconds/);
    expect(buttonsIn(html)).toContain("Try again in 0:25");
  });

  it("offers a reload when the notice changed under the page", () => {
    const notice = { message: HOTEL_FORM_ERRORS.noticeStale, retryAt: null, isReload: true };
    expect(buttonsIn(details({ notice }))).toContain("Reload the page");
  });
});

describe("HF-03, Enter your code", () => {
  it("is step 3 of 3, with Change to go back to the details", () => {
    const html = code();
    expect(html).toContain("Step 3 of 3");
    expect(html).toMatch(/<button[^>]*aria-label="Change your details"[^>]*>/);
  });

  it("shows the code in a callout in on-screen mode, with Use this code", () => {
    const html = code();
    expect(html).toContain("Your one-time code");
    expect(html).toContain('<span aria-hidden="true">482917</span>');
    expect(html).toContain('<span class="sr-only">4 8 2 9 1 7</span>');
    expect(buttonsIn(html)).toContain("Use this code");
    expect(html).toContain("Your code for +91 ••••• •1234");
  });

  it("never shows a code in SMS mode, saying where it went in words a screen reader can say", () => {
    const html = code(BY_SMS);
    expect(html).not.toContain("482917");
    expect(html).not.toContain("Use this code");
    expect(html).toContain("We sent a 6-digit code to +91 ••••• •1234");
    expect(html).toContain("We sent a 6-digit code to your mobile number ending in 1234");
  });

  it("asks for six digits with the number keypad and code autofill", () => {
    const [field] = tagsWith(code(), "input", 'id="hf-code"');
    expect(field).toContain('inputMode="numeric"');
    expect(field).toContain('autoComplete="one-time-code"');
  });

  it("holds Send a new code back until the API's pause is over", () => {
    const html = code();
    expect(buttonsIn(html)).toContain("Send a new code in 0:30");
    const [resend] = tagsWith(html, "button", 'aria-describedby="hf-resend-check-status"');
    expect(resend).toContain('disabled=""');
  });

  it("keeps a refused code's digits, with the refusal on the field", () => {
    const html = code(ON_SCREEN, { code: "111111", codeError: HOTEL_FORM_ERRORS.invalidCode });
    const [field] = tagsWith(html, "input", 'id="hf-code"');
    expect(field).toContain('value="111111"');
    expect(field).toContain('aria-invalid="true"');
    expect(html).toContain("That code didn&#x27;t work or has expired.");
  });
});
