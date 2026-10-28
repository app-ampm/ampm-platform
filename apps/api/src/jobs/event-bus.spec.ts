import { describe, expect, it } from "vitest";

import { EventBus, defineEvent } from "./event-bus.js";

const userJoined = defineEvent<{ userId: string }>("user.joined");

describe("EventBus", () => {
  it("delivers an event to every registered handler", async () => {
    const bus = new EventBus();
    const calls: string[] = [];
    bus.on(userJoined, (payload) => {
      calls.push(`a:${payload.userId}`);
    });
    bus.on(userJoined, async (payload) => {
      calls.push(`b:${payload.userId}`);
    });
    await bus.emit(userJoined, { userId: "u1" });
    expect(calls.sort()).toEqual(["a:u1", "b:u1"]);
  });

  it("is a no-op when nothing is listening", async () => {
    const bus = new EventBus();
    await expect(bus.emit(userJoined, { userId: "u1" })).resolves.toBeUndefined();
  });

  it("surfaces a throwing handler to the emitter", async () => {
    const bus = new EventBus();
    bus.on(userJoined, () => {
      throw new Error("handler failed");
    });
    await expect(bus.emit(userJoined, { userId: "u1" })).rejects.toThrow(/handler failed/);
  });
});
