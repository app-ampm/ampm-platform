import type { NotificationChannel, RecipientType } from "@ampm/core";

/*
 * The send path's gates (D-188 §5): a module that queues notifications of its own can register a gate
 * for their template-key prefix, and the send job asks it, at send time in the worker, whether a queued
 * notification may still go. The hotel form's kill switch is one: a `hotel_form.*` email queued while
 * the form's mode admitted it is dropped if the mode no longer does. A gate reads what the notification
 * is and is about, never its address or its render data.
 */

/** What a gate reads of a queued notification. */
export interface GatedNotification {
  readonly templateKey: string;
  readonly recipientType: RecipientType;
  readonly recipientId: string;
  readonly channel: NotificationChannel;
  readonly entityType: string | null;
  readonly entityId: string | null;
}

/** Whether a queued notification may still be sent; false drops it. A gate that throws is retried. */
export type SendGate = (notification: GatedNotification) => Promise<boolean>;

/**
 * The gates, by template-key prefix: one per prefix, so two modules never fight over one family.
 *
 * @example
 * gates.register("hotel_form.", (notification) => hotelForm.admits(notification));
 */
export class SendGates {
  private readonly gates = new Map<string, SendGate>();

  register(prefix: string, gate: SendGate): void {
    if (prefix === "" || this.gates.has(prefix)) {
      throw new Error(`A send gate for "${prefix}" is already registered, or the prefix is empty`);
    }
    this.gates.set(prefix, gate);
  }

  /** Whether every gate of the notification's template admits it; a template no gate covers passes. */
  async admits(notification: GatedNotification): Promise<boolean> {
    for (const [prefix, gate] of this.gates) {
      if (notification.templateKey.startsWith(prefix) && !(await gate(notification))) return false;
    }
    return true;
  }
}
