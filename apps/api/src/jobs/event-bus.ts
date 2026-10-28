import { Injectable } from "@nestjs/common";

/** An in-process domain event: a stable name carrying a typed payload (the payload field is phantom). */
export interface DomainEvent<T> {
  readonly name: string;
  readonly payload?: T;
}

export function defineEvent<T>(name: string): DomainEvent<T> {
  return { name };
}

export type EventHandler<T> = (payload: T) => void | Promise<void>;

/**
 * The in-process domain-event bus (architecture §6: cross-module reactions go through domain events
 * whose handlers enqueue jobs, so a module never calls another module's service directly). Handlers
 * are awaited together; keep them thin (enqueue a job) — a handler that throws fails the emit, so
 * the durable work belongs in the job, not the handler.
 *
 * @example
 * bus.on(leadConverted, (payload) => this.jobs.enqueue(welcomeEmail, payload));
 * await bus.emit(leadConverted, { accountId });
 */
@Injectable()
export class EventBus {
  private readonly handlers = new Map<string, EventHandler<unknown>[]>();

  on<T>(event: DomainEvent<T>, handler: EventHandler<T>): void {
    const list = this.handlers.get(event.name) ?? [];
    // The payload type is erased in the registry; emit only ever calls a handler with its event's
    // own payload, so widening to `unknown` here is sound.
    list.push(handler as EventHandler<unknown>);
    this.handlers.set(event.name, list);
  }

  async emit<T>(event: DomainEvent<T>, payload: T): Promise<void> {
    const list = this.handlers.get(event.name) ?? [];
    await Promise.all(list.map((handler) => handler(payload)));
  }
}
