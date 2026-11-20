import { createServer, type Server, type Socket } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClamAvScanner, SCANNER_UNAVAILABLE } from "./clamav-scanner.js";

/**
 * The ClamAV adapter's contract test (api.md: one per provider adapter) against a fake clamd that reads
 * INSTREAM exactly as the daemon does: a NUL-terminated `zINSTREAM`, then chunks behind a 4-byte
 * big-endian length, ended by a zero length; it answers one NUL-terminated line. The real daemon was
 * checked against the same adapter by hand (production-setup.md, "Antivirus").
 */

// The EICAR test file, joined at run time so this source never holds the whole signature (an endpoint
// scanner on a developer's machine would otherwise quarantine the file).
const EICAR = Buffer.from(
  ["X5O!P%@AP[4\\PZX54(P^)7CC)7}$", "EICAR-STANDARD-ANTIVIRUS-TEST-FILE", "!$H+H*"].join(""),
);

interface FakeClamd {
  readonly port: number;
  /** What each connection sent: its command and the chunk lengths and bytes of its stream. */
  readonly sessions: { command: string; chunkLengths: number[]; stream: Buffer }[];
  close(): Promise<void>;
}

/** `answer` returns clamd's reply for a stream, or null to say nothing and keep the connection open. */
async function fakeClamd(answer: (stream: Buffer) => string | null): Promise<FakeClamd> {
  const sessions: FakeClamd["sessions"] = [];
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    const session: FakeClamd["sessions"][number] = {
      command: "",
      chunkLengths: [],
      stream: Buffer.alloc(0),
    };
    let pending = Buffer.alloc(0);
    socket.on("data", (data: Buffer) => {
      pending = Buffer.concat([pending, data]);
      if (!session.command) {
        const end = pending.indexOf(0);
        if (end < 0) return;
        session.command = pending.subarray(0, end).toString();
        pending = pending.subarray(end + 1);
      }
      while (pending.length >= 4) {
        const length = pending.readUInt32BE(0);
        if (length === 0) {
          sessions.push(session);
          const reply = answer(session.stream);
          if (reply !== null) socket.end(`${reply}\0`);
          return;
        }
        if (pending.length < 4 + length) return;
        session.chunkLengths.push(length);
        session.stream = Buffer.concat([session.stream, pending.subarray(4, 4 + length)]);
        pending = pending.subarray(4 + length);
      }
    });
  });
  const port = await listen(server);
  return {
    port,
    sessions,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("not listening on TCP");
  return address.port;
}

/** clamd's answers as ClamAV 1.5.5 gave them: the EICAR file (it must open the stream), else clean. */
const realisticVerdict = (stream: Buffer): string =>
  stream.subarray(0, EICAR.length).equals(EICAR)
    ? "stream: Eicar-Test-Signature FOUND"
    : "stream: OK";

const logger = { warn: vi.fn() };
let clamd: FakeClamd | undefined;

function scanner(port: number, timeoutMs = 2000): ClamAvScanner {
  return new ClamAvScanner({ host: "127.0.0.1", port, timeoutMs }, logger);
}

afterEach(async () => {
  await clamd?.close();
  clamd = undefined;
  logger.warn.mockReset();
});

describe("ClamAvScanner (AC-20.3)", () => {
  it("rejects the EICAR test file as infected", async () => {
    expect(EICAR).toHaveLength(68);
    clamd = await fakeClamd(realisticVerdict);
    expect(await scanner(clamd.port).scan(EICAR)).toBe("rejected");
    expect(logger.warn).toHaveBeenCalledWith("storage.av_scan.threat_found", {
      signature: "Eicar-Test-Signature",
    });
  });

  it("passes a clean file, streamed whole in INSTREAM's length-prefixed chunks", async () => {
    clamd = await fakeClamd(realisticVerdict);
    const upload = Buffer.alloc(200 * 1024, "clean bytes ");
    expect(await scanner(clamd.port).scan(upload)).toBe("clean");
    const [session] = clamd.sessions;
    expect(session?.command).toBe("zINSTREAM");
    expect(session?.chunkLengths).toEqual([65536, 65536, 65536, 8192]);
    expect(session?.stream.equals(upload)).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("fails closed when clamd accepts the stream but gives no verdict in time", async () => {
    clamd = await fakeClamd(() => null);
    const started = Date.now();
    await expect(scanner(clamd.port, 1000).scan(Buffer.from("clean"))).rejects.toMatchObject({
      code: "unavailable",
      status: 503,
      message: SCANNER_UNAVAILABLE,
    });
    expect(Date.now() - started).toBeLessThan(1900);
    expect(logger.warn).toHaveBeenCalledWith("storage.av_scan.unavailable", {
      error: expect.stringContaining("no verdict within 1000 ms"),
    });
  });

  it("fails closed when clamd cannot be reached", async () => {
    const closed = createServer();
    const port = await listen(closed);
    await new Promise<void>((resolve) => closed.close(() => resolve()));
    await expect(scanner(port).scan(Buffer.from("clean"))).rejects.toMatchObject({
      code: "unavailable",
      status: 503,
    });
    expect(logger.warn).toHaveBeenCalledWith("storage.av_scan.unavailable", {
      error: expect.stringContaining("ECONNREFUSED"),
    });
  });

  it.each([
    ["clamd's own error", "INSTREAM size limit exceeded. ERROR"],
    ["an answer that is almost OK", "stream: OKAY"],
    ["an empty answer", ""],
  ])("fails closed on %s, never clean", async (_case, reply) => {
    clamd = await fakeClamd(() => reply);
    await expect(scanner(clamd.port).scan(Buffer.from("clean"))).rejects.toMatchObject({
      code: "unavailable",
      status: 503,
    });
    expect(logger.warn).toHaveBeenCalledWith("storage.av_scan.no_verdict", { reply });
  });

  it("fails closed when clamd hangs up without a verdict", async () => {
    const hangUp = createServer((socket) => socket.destroy());
    const port = await listen(hangUp);
    try {
      await expect(scanner(port).scan(Buffer.from("clean"))).rejects.toMatchObject({
        code: "unavailable",
      });
    } finally {
      await new Promise<void>((resolve) => hangUp.close(() => resolve()));
    }
  });
});
