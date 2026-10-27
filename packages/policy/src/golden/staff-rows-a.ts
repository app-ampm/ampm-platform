/*
 * Golden table of §5.1 to §5.7 (docs/permission-matrix.md lines 142-223), written by hand from the
 * document, line by line: every role's letters, scope and note (src/staff.golden.test.ts).
 */
import { all, assigned, own, row, type GoldenRow } from "./staff";

const EVERYONE_READS = { SM: "R", HT: "R", PM: "R", CD: "R", VC: "R", RG: "R", HL: "R", FA: "R" };

/**
 * The rows of §5.1 to §5.7, in the document's order.
 *
 * @example
 * STAFF_ROWS_5_1_TO_5_7.find((golden) => golden.line === 142)?.label;
 */
export const STAFF_ROWS_5_1_TO_5_7: readonly GoldenRow[] = [
  // §5.1 Administration
  row(142, "5.1", "Staff users and global roles", { ...EVERYONE_READS, SA: "CRUD" }),
  row(143, "5.1", "Client user logins (invite, reset, disable)", {
    SA: "CRUD",
    SM: "CRU",
    PM: assigned("CRU"),
  }),
  row(144, "5.1", "Roles and permissions", { ...EVERYONE_READS, SA: "CRUD" }),
  row(145, "5.1", "Configurations (thresholds, labels, templates, escalation rules)", {
    SA: "CRU",
    FA: "R",
  }),
  row(146, "5.1", "Audit log", {
    SA: "RX",
    PM: assigned("R"),
    FA: all("R", { subjects: ["finance_entity"] }),
  }),
  row(147, "5.1", "Import jobs", {
    SA: "CR",
    HT: all("CR", { subjects: ["hotel"] }),
    PM: assigned("CR", { subjects: ["guest"] }),
    VC: all("CR", { subjects: ["vendor"] }),
    RG: assigned("CR", { subjects: ["guest"] }),
  }),
  row(148, "5.1", "Notifications log", {
    SA: "R",
    SM: own("R"),
    HT: own("R"),
    PM: own("R"),
    CD: own("R"),
    VC: own("R"),
    RG: own("R"),
    HL: own("R"),
    FA: own("R"),
  }),
  // §5.2 CRM and commercial
  row(154, "5.2", "Leads and lead activities", { SA: "CRUD", SM: "CRUD", HT: "R", PM: "R" }),
  row(155, "5.2", "Client accounts and contacts", {
    SA: "CRUD",
    SM: "CRUD",
    HT: "R",
    PM: assigned("RU"),
    RG: assigned("R"),
    HL: assigned("R"),
    FA: all("RU", { fields: ["billing"] }),
  }),
  row(156, "5.2", "Plans and plan modules", { SA: "CRUD", SM: "R", FA: "R" }),
  row(157, "5.2", "Subscriptions", {
    SA: "CRUD",
    SM: "CRU",
    HT: "R",
    FA: all("RU", { fields: ["status"] }),
  }),
  row(158, "5.2", "Service agreements", {
    SA: "CRUD",
    SM: "CRU",
    HT: all("CRU", { subjects: ["hotel"] }),
    PM: assigned("RU"),
    FA: "R",
  }),
  row(159, "5.2", "Payment milestones", { SA: "CRUD", SM: "R", PM: assigned("R"), FA: "CRUD" }),
  row(160, "5.2", "Payments inbound from clients", {
    SA: "CRUD",
    SM: "R",
    PM: assigned("R"),
    FA: "CRUD",
  }),
  row(161, "5.2", "Payments outbound to vendors and hotels", {
    SA: "CRUD",
    HT: "R",
    PM: assigned("R"),
    VC: assigned("R"),
    FA: "CRUD",
  }),
  // §5.3 Hotels
  row(167, "5.3", "Destinations", { ...EVERYONE_READS, SA: "CRUD", HT: "CRUD" }),
  row(168, "5.3", "Hotel profiles, client fields", { ...EVERYONE_READS, SA: "CRUD", HT: "CRUD" }),
  row(169, "5.3", "Hotel internal rating and notes", { SA: "RU", SM: "R", HT: "RU", PM: "R" }),
  row(170, "5.3", "Hotel contacts", {
    SA: "CRUD",
    SM: "R",
    HT: "CRUD",
    PM: "R",
    HL: assigned("R"),
  }),
  row(171, "5.3", "Room categories and venues", { ...EVERYONE_READS, SA: "CRUD", HT: "CRUD" }),
  row(172, "5.3", "Rate cards and rate items", {
    SA: "CRUD",
    SM: "R",
    HT: "CRUD",
    PM: "R",
    FA: "R",
  }),
  row(173, "5.3", "Verifications", { ...EVERYONE_READS, SA: "CRU", HT: "CRU" }),
  row(174, "5.3", "Hotel media and rights status", {
    SA: "CRUDS",
    SM: all("RU", { fields: ["rights"] }),
    HT: "CRUDS",
    PM: "R",
    CD: "R",
    VC: "R",
  }),
  row(175, "5.3", "Wedding references", { SA: "CRUD", SM: "R", HT: "CRUD", PM: "R" }),
  row(176, "5.3", "Saved hotels (created by clients)", {
    SA: "R",
    SM: "R",
    HT: "R",
    PM: assigned("R"),
  }),
  // §5.4 Hotel consultancy
  row(182, "5.4", "Hotel enquiries, client fields", {
    SA: "CRUD",
    SM: "CR",
    HT: "CRU",
    PM: assigned("CRU"),
    FA: "R",
  }),
  row(183, "5.4", "Enquiry internal notes and internal-only events", {
    SA: "CRU",
    SM: "R",
    HT: "CRU",
    PM: assigned("CR"),
  }),
  row(184, "5.4", "Site visits", { SA: "CRU", SM: "R", HT: "CRU", PM: assigned("CRU") }),
  row(185, "5.4", "Hotel proposals, client amounts", {
    SA: "CRUS",
    SM: "R",
    HT: "CRUS",
    PM: assigned("RUS"),
    FA: "R",
  }),
  row(186, "5.4", "Hotel proposals, internal amounts", {
    SA: "RU",
    HT: "RU",
    PM: assigned("R"),
    FA: "R",
  }),
  row(187, "5.4", "Booking milestones", {
    SA: "CRU",
    SM: "R",
    HT: "CRU",
    PM: assigned("CRU"),
    FA: "RU",
  }),
  // §5.5 Wedding projects
  row(193, "5.5", "Wedding projects (create, edit, status)", {
    SA: "CRUD",
    SM: "CR",
    HT: "R",
    PM: assigned("CRU"),
    CD: assigned("R"),
    VC: assigned("R"),
    RG: assigned("R"),
    HL: assigned("R"),
    FA: "R",
  }),
  row(194, "5.5", "Project internal notes", { SA: "RU", PM: assigned("RU"), FA: "R" }),
  row(195, "5.5", "Project hotels and external venues", {
    SA: "CRU",
    HT: "CRU",
    PM: assigned("CRU"),
    CD: assigned("R"),
    VC: assigned("R"),
    RG: assigned("R"),
    HL: assigned("RU"),
  }),
  row(196, "5.5", "Project members, staff", {
    SA: "CRUD",
    PM: assigned("CRUD"),
    CD: assigned("R"),
    VC: assigned("R"),
    RG: assigned("R"),
    HL: assigned("R"),
  }),
  row(197, "5.5", "Project members, client users and their flags", {
    SA: "CRUD",
    SM: "CRU",
    PM: assigned("CRUD"),
  }),
  // §5.6 Functions, programme and run-of-show
  row(203, "5.6", "Functions", {
    SA: "CRUD",
    SM: "R",
    HT: assigned("R"),
    PM: assigned("CRUD"),
    CD: assigned("RU", { fields: ["theme", "dress_code"] }),
    VC: assigned("R"),
    RG: assigned("R"),
    HL: assigned("RU", { fields: ["logistics_notes"] }),
    FA: "R",
  }),
  row(204, "5.6", "Programme items (shared schedule)", {
    SA: "CRUDS",
    PM: assigned("CRUDS"),
    CD: assigned("R"),
    VC: assigned("R"),
    RG: assigned("R"),
    HL: assigned("CRU"),
  }),
  row(205, "5.6", "Run-of-show items", {
    SA: "CRUD",
    PM: assigned("CRUD"),
    CD: assigned("R"),
    VC: assigned("RU", { fields: ["vendor_cues"] }),
    RG: assigned("R"),
    HL: assigned("CRU"),
  }),
  row(206, "5.6", "Readiness checklist items", {
    SA: "CRU",
    PM: assigned("CRU"),
    CD: assigned("RU"),
    VC: assigned("RU"),
    RG: assigned("R"),
    HL: assigned("CRU"),
  }),
  // PM: "request only" (Q10): asking is not a grant.
  row(207, "5.6", "Readiness exceptions (Q10: Eva's authorised personnel only)", { SA: "A" }),
  row(208, "5.6", "Function status (planned, confirmed, cancelled)", {
    SA: "U",
    PM: assigned("U"),
  }),
  // §5.7 Budget and finance
  row(214, "5.7", "Budget categories", { ...EVERYONE_READS, SA: "CRUD", FA: "CRUD" }),
  row(215, "5.7", "Budget lines, client-facing amounts", {
    SA: "CRUDS",
    HT: all("RU", { side: "hotel" }),
    PM: assigned("CRUS"),
    CD: assigned("R"),
    VC: assigned("RU", { side: "vendor" }),
    HL: assigned("R"),
    FA: "CRUS",
  }),
  row(216, "5.7", "Budget lines, internal cost", {
    SA: "RU",
    HT: all("RU", { side: "hotel" }),
    PM: assigned("RU"),
    VC: assigned("RU", { side: "vendor" }),
    FA: "RU",
  }),
  row(217, "5.7", "Cost entries", {
    SA: "CRUD",
    HT: all("CR", { side: "hotel" }),
    PM: assigned("CR"),
    VC: assigned("CR"),
    FA: "CRUD",
  }),
  row(218, "5.7", "Vendor quotes", { SA: "CRUD", PM: assigned("R"), VC: "CRUD", FA: "R" }),
  row(219, "5.7", "Contracts with the client", {
    SA: "CRUS",
    SM: "R",
    PM: assigned("RUS"),
    FA: "CRUS",
  }),
  row(220, "5.7", "Contracts with vendors and hotels", {
    SA: "CRU",
    HT: all("CRU", { side: "hotel" }),
    PM: assigned("R"),
    VC: all("CRU", { side: "vendor" }),
    FA: "RU",
  }),
  row(221, "5.7", "Invoices issued to the client", {
    SA: "CRUS",
    SM: "R",
    PM: assigned("R"),
    FA: "CRUS",
  }),
  row(222, "5.7", "Invoices received from vendors and hotels", {
    SA: "CRU",
    HT: all("CR", { side: "hotel" }),
    PM: assigned("R"),
    VC: assigned("CR", { side: "vendor" }),
    FA: "CRU",
  }),
  row(223, "5.7", "Final accounts", { SA: "CRUA", PM: assigned("RU"), FA: "CRUA" }),
];
