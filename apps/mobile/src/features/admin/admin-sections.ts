import type { Href } from "expo-router";

/** A settings section's key: the last part of its route under `/admin`. */
export type AdminSectionKey =
  "users" | "roles" | "notifications" | "notification-templates" | "configuration" | "audit";

export interface AdminSection {
  readonly key: AdminSectionKey;
  readonly href: Href;
  /** The short name on the section strip (T12: Roles, Plans and demo, Audit log). */
  readonly label: string;
  /** The name on the console's landing, and its one line below. */
  readonly title: string;
  readonly subtitle: string;
}

/*
 * The admin console's settings sections, in the console's order. The landing lists them and every
 * section page carries them as its strip, so the two can never disagree. The console shows every
 * section to everyone who reaches it (the rail gates the console itself); the server refuses a
 * section a role may not read.
 */
export const ADMIN_SECTIONS: readonly AdminSection[] = [
  {
    key: "users",
    href: "/admin/users",
    label: "Users",
    title: "Users and roles",
    subtitle: "Staff accounts, roles, authenticator and access",
  },
  {
    key: "roles",
    href: "/admin/roles",
    label: "Roles",
    title: "Roles and permissions",
    subtitle: "Every role and exactly what it can do",
  },
  {
    key: "notifications",
    href: "/admin/notifications",
    label: "Notifications",
    title: "Notifications",
    subtitle: "Every notice the platform sent, and how it was delivered",
  },
  {
    key: "notification-templates",
    href: "/admin/notification-templates",
    label: "Templates",
    title: "Notification templates",
    subtitle: "The message templates sent on each channel",
  },
  {
    key: "configuration",
    href: "/admin/configuration",
    label: "Configuration",
    title: "Configuration",
    subtitle: "Platform thresholds, policies and feature switches",
  },
  {
    key: "audit",
    href: "/admin/audit",
    label: "Audit log",
    title: "Audit log",
    subtitle: "The append-only history of every change",
  },
];
