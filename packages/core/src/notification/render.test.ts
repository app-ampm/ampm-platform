import { describe, expect, it } from "vitest";

import { CONFIG_REGISTRY, type NotificationTemplate } from "../schemas/config.js";
import { renderString, renderTemplate } from "./render.js";

describe("renderString", () => {
  it("fills placeholders from variables", () => {
    const out = renderString("Hi {{name}}, go to {{url}}", { name: "Pat", url: "x" });
    expect(out.text).toBe("Hi Pat, go to x");
    expect(out.missing).toEqual([]);
  });

  it("records a missing variable and renders it empty (fail closed)", () => {
    const out = renderString("Hi {{name}}", {});
    expect(out.text).toBe("Hi ");
    expect(out.missing).toEqual(["name"]);
  });

  it("dedupes a repeated missing variable", () => {
    const out = renderString("{{a}} {{a}} {{b}}", {});
    expect([...out.missing].sort()).toEqual(["a", "b"]);
  });

  it("does not HTML-escape substituted values by default", () => {
    expect(renderString("{{v}}", { v: "<b>&\"'" }).text).toBe("<b>&\"'");
  });

  it("HTML-escapes substituted values when asked, so a value cannot inject markup", () => {
    const out = renderString(
      '<a href="{{url}}">{{name}}</a>',
      { url: "x?a=1&b=2", name: "<script>" },
      { escapeHtml: true },
    );
    expect(out.text).toBe('<a href="x?a=1&amp;b=2">&lt;script&gt;</a>');
  });

  it("escapes attribute-breakout quotes so a value cannot escape an href", () => {
    const out = renderString('<a href="{{u}}">', { u: 'x" onmouseover="y' }, { escapeHtml: true });
    expect(out.text).toBe('<a href="x&quot; onmouseover=&quot;y">');
    expect(renderString("{{v}}", { v: "a'b" }, { escapeHtml: true }).text).toBe("a&#39;b");
  });

  it("flags a malformed placeholder as missing so the caller fails closed", () => {
    const out = renderString("Hi {{bad-name}} {{ok}}", { ok: "x" });
    expect(out.text).toContain("{{bad-name}}");
    expect(out.missing).toContain("{{bad-name}}");
  });
});

describe("renderTemplate", () => {
  const template: NotificationTemplate = {
    email: {
      subject: "Hi {{name}}",
      html: '<p>Hi {{name}}</p><a href="{{url}}">go</a>',
      text: "Hi {{name}} {{url}}",
    },
    sms: { text: "code {{code}}" },
    whatsapp: { providerTemplateId: "wa_1", params: ["{{name}}", "{{code}}"] },
    push: { title: "Hi {{name}}", body: "see {{url}}" },
  };

  it("renders email content with only the html part escaped", () => {
    const out = renderTemplate(template, "email", { name: "A&B", url: "u?x=1&y=2" });
    expect(out.missing).toEqual([]);
    expect(out.content).toEqual({
      kind: "email",
      subject: "Hi A&B",
      html: '<p>Hi A&amp;B</p><a href="u?x=1&amp;y=2">go</a>',
      text: "Hi A&B u?x=1&y=2",
    });
  });

  it("collects the missing variables across every email part", () => {
    const out = renderTemplate(template, "email", {});
    expect([...out.missing].sort()).toEqual(["name", "url"]);
    expect(out.content?.kind).toBe("email");
  });

  it("renders sms, whatsapp and push content", () => {
    expect(renderTemplate(template, "sms", { code: "123" }).content).toEqual({
      kind: "sms",
      text: "code 123",
    });
    expect(renderTemplate(template, "whatsapp", { name: "Pat", code: "9" }).content).toEqual({
      kind: "whatsapp",
      providerTemplateId: "wa_1",
      params: ["Pat", "9"],
    });
    expect(renderTemplate(template, "push", { name: "Pat", url: "u" }).content).toEqual({
      kind: "push",
      title: "Hi Pat",
      body: "see u",
    });
  });

  it("returns null content when the template has no block for the channel", () => {
    expect(renderTemplate({ email: template.email }, "sms", {}).content).toBeNull();
  });
});

describe("disk space template baselines", () => {
  const templates = CONFIG_REGISTRY["notification.templates"].default;
  const vars = { freeGb: "8.4", floorGb: "9", warnGb: "12" };

  it("system.disk_critical says plainly that new hotel-form uploads are refused", () => {
    const template = templates["system.disk_critical"];
    if (!template) throw new Error("missing baseline system.disk_critical");
    const out = renderTemplate(template, "email", vars);
    expect(out.missing).toEqual([]);
    if (out.content?.kind !== "email") throw new Error("expected email content");
    expect(out.content.text).toBe(
      "The AMPM server has 8.4 GB of disk free, below the 9 GB floor: new hotel-form uploads are refused until space is freed.",
    );
  });

  it("system.disk_low gives the free space, the warning level and the floor", () => {
    const template = templates["system.disk_low"];
    if (!template) throw new Error("missing baseline system.disk_low");
    const out = renderTemplate(template, "email", { ...vars, freeGb: "11.2" });
    expect(out.missing).toEqual([]);
    if (out.content?.kind !== "email") throw new Error("expected email content");
    expect(out.content.text).toContain("11.2 GB of disk free, below the 12 GB warning level");
    expect(out.content.text).toContain("9 GB floor");
    expect(out.content.html).toContain("11.2 GB");
  });
});

describe("invite template baselines", () => {
  it("staff.invite and client.invite render fully from { name, activationUrl }", () => {
    const templates = CONFIG_REGISTRY["notification.templates"].default;
    const vars = { name: "Pat", activationUrl: "https://app.example/activate?token=abc" };
    for (const key of ["staff.invite", "client.invite"] as const) {
      const template = templates[key];
      if (!template) throw new Error(`missing baseline ${key}`);
      const out = renderTemplate(template, "email", vars);
      expect(out.missing).toEqual([]);
      if (out.content?.kind !== "email") throw new Error("expected email content");
      expect(out.content.text).toContain("Pat");
      expect(out.content.text).toContain("https://app.example/activate?token=abc");
    }
  });
});

describe("hotel form template baseline (D-188 §5)", () => {
  const template = CONFIG_REGISTRY["notification.templates"].default["hotel_form.link"];
  const vars = {
    reference: "HIR-2026-0001",
    hotelName: "Synthetic Lake Hotel",
    expiresOn: "24 December 2026, 15:30 IST",
    link: "https://site.synthetic.example/hotel-form#k=hfl_synthetic-link-secret",
  };

  it("hotel_form.link gives the reference, the hotel's name, the expiry and the link", () => {
    if (!template) throw new Error("missing baseline hotel_form.link");
    const out = renderTemplate(template, "email", vars);
    expect(out.missing).toEqual([]);
    if (out.content?.kind !== "email") throw new Error("expected email content");
    expect(out.content.subject).toContain("HIR-2026-0001");
    for (const value of Object.values(vars)) {
      expect(out.content.text).toContain(value);
      expect(out.content.html).toContain(value);
    }
    expect(out.content.html).toContain(`href="${vars.link}"`);
  });

  it("hotel_form.link takes those four values and nothing else, so no text a hotel typed fits", () => {
    if (!template?.email) throw new Error("missing baseline hotel_form.link email");
    const { subject, html, text } = template.email;
    const names = [subject, html, text].flatMap((part) =>
      [...part.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((match) => match[1]),
    );
    expect(new Set(names)).toEqual(new Set(Object.keys(vars)));
  });
});

describe("hotel form code baseline (D-174, D-189 §2)", () => {
  const template = CONFIG_REGISTRY["notification.templates"].default["hotel_form.code"];

  it("hotel_form.code is an SMS only, worded as D-174's DLT template with the code first", () => {
    if (!template?.sms) throw new Error("missing baseline hotel_form.code sms");
    expect(template.email).toBeUndefined();
    const out = renderTemplate(template, "sms", { code: "048213" });
    expect(out.missing).toEqual([]);
    if (out.content?.kind !== "sms") throw new Error("expected sms content");
    // DLT registers the text with {#var#} where the code goes; the two must stay word for word equal.
    expect(template.sms.text.replace("{{code}}", "{#var#}")).toBe(
      "{#var#} is your AMPM verification code for the hotel information form. It is valid for 5 minutes. Do not share it. -AMPM",
    );
    expect(out.content.text.startsWith("048213 is your AMPM verification code")).toBe(true);
  });

  it("hotel_form.code takes the code and nothing else, so no text a hotel typed fits", () => {
    const text = template?.sms?.text ?? "";
    const names = [...text.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((match) => match[1]);
    expect(names).toEqual(["code"]);
  });
});
