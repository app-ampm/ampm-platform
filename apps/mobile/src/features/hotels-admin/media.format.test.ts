import {
  isClientFacing,
  mediaSummary,
  rightsClearedForClients,
  rightsLabel,
  rightsTone,
  scanStatusLabel,
  scanStatusTone,
  visibilityLabel,
  visibilityTone,
} from "./media.format";
import { mediaAssetFixture } from "./hotels-admin.test-utils";

describe("media.format", () => {
  it("labels and tones the scan state", () => {
    expect(scanStatusLabel("pending")).toBe("Scanning");
    expect(scanStatusLabel("clean")).toBe("Ready");
    expect(scanStatusTone("clean")).toBe("success");
    expect(scanStatusTone("rejected")).toBe("danger");
  });

  it("labels and tones visibility and rights", () => {
    expect(visibilityLabel("client")).toBe("Clients");
    expect(visibilityTone("internal")).toBe("neutral");
    expect(rightsLabel("consent_obtained")).toBe("Consent on file");
    expect(rightsTone("consent_required")).toBe("warning");
  });

  it("mirrors the GP-20 clearance rule", () => {
    expect(rightsClearedForClients("owned")).toBe(true);
    expect(rightsClearedForClients("licensed")).toBe(true);
    expect(rightsClearedForClients("consent_obtained")).toBe(true);
    expect(rightsClearedForClients("consent_required")).toBe(false);
  });

  it("knows which visibilities are client-facing", () => {
    expect(isClientFacing("internal")).toBe(false);
    expect(isClientFacing("client")).toBe(true);
    expect(isClientFacing("demo")).toBe(true);
  });

  it("summarises a photo for screen readers", () => {
    const photo = mediaAssetFixture({
      caption: "Lobby",
      scanStatus: "clean",
      visibility: "client",
    });
    expect(mediaSummary(photo)).toBe("Lobby, Ready, visible to clients");
  });
});
