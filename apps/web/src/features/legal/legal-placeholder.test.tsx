import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PrivacyPage, {
  dynamic as privacyDynamic,
  metadata as privacyMeta,
} from "@/app/privacy/page";
import TermsPage, { dynamic as termsDynamic, metadata as termsMeta } from "@/app/terms/page";

/** Where the privacy and terms links land until AMPM publishes the documents. */
describe("legal placeholder pages", () => {
  it("render per request under their own titles (D-046: the strict-nonce CSP)", () => {
    expect(privacyDynamic).toBe("force-dynamic");
    expect(termsDynamic).toBe("force-dynamic");
    expect(privacyMeta.title).toBe("Privacy notice · AMPM");
    expect(termsMeta.title).toBe("Terms of use · AMPM");
  });

  it("name the document and say when AMPM publishes it", () => {
    const privacy = renderToStaticMarkup(<PrivacyPage />);
    expect(privacy).toMatch(/<h1 [^>]*>Privacy notice<\/h1>/);
    expect(privacy).toContain("AMPM publishes its privacy notice here before the site launches.");
    const terms = renderToStaticMarkup(<TermsPage />);
    expect(terms).toMatch(/<h1 [^>]*>Terms of use<\/h1>/);
    expect(terms).toContain("AMPM publishes its terms of use here before the site launches.");
  });
});
