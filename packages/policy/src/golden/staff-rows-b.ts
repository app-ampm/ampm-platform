/*
 * Golden table of §5.8 to §5.10 (docs/permission-matrix.md lines 231-269), written by hand from the
 * document, line by line: every role's letters, scope and note (src/staff.golden.test.ts).
 */
import { all, assigned, explicit, own, row, type GoldenRow } from "./staff";

/**
 * The rows of §5.8 to §5.10, in the document's order.
 *
 * @example
 * STAFF_ROWS_5_8_TO_5_10.find((golden) => golden.line === 229)?.label;
 */
export const STAFF_ROWS_5_8_TO_5_10: readonly GoldenRow[] = [
  // §5.8 Vendors, artists and production
  row(230, "5.8", "Vendor categories", {
    SA: "CRUD",
    SM: "R",
    HT: "R",
    PM: "R",
    CD: "R",
    VC: "CRU",
    RG: "R",
    HL: "R",
    FA: "R",
  }),
  row(231, "5.8", "Vendor profiles, client fields", {
    SA: "CRUD",
    SM: "R",
    PM: "R",
    CD: "R",
    VC: "CRUD",
    HL: "R",
    FA: "R",
  }),
  row(232, "5.8", "Vendor contacts", { SA: "RU", PM: assigned("R"), VC: "RU", HL: assigned("R") }),
  row(233, "5.8", "Vendor internal rating and notes", { SA: "RU", PM: assigned("R"), VC: "RU" }),
  // VC "RU": §4 line 125 opens RESTRICTED-BANK to SA and FA only, so VC has no grant until AMPM
  // decides, the reading of scripts/notes.ts (ENGINE-4); SA keeps "R", FA "RU".
  row(234, "5.8", "Vendor bank details", { SA: "R", FA: "RU" }),
  row(235, "5.8", "Vendor availability", { SA: "CRU", PM: "R", VC: "CRU" }),
  row(236, "5.8", "Vendor assignments and client decisions", {
    SA: "CRUD",
    PM: assigned("CRU"),
    CD: assigned("R"),
    VC: "CRU",
    HL: assigned("R"),
    FA: "R",
  }),
  row(237, "5.8", "Vendor proposals, client amounts", {
    SA: "CRUS",
    PM: assigned("RUS"),
    CD: assigned("R"),
    VC: "CRUS",
    FA: "R",
  }),
  row(238, "5.8", "Vendor proposals, internal cost", {
    SA: "RU",
    PM: assigned("R"),
    VC: "RU",
    FA: "R",
  }),
  row(239, "5.8", "Vendor deliverables", {
    SA: "CRUD",
    PM: assigned("CRUA"),
    CD: assigned("R"),
    VC: "CRU",
    HL: assigned("U", { fields: ["delivered"] }),
  }),
  row(240, "5.8", "Artist bookings", {
    SA: "CRUD",
    PM: assigned("CRU"),
    CD: assigned("R"),
    VC: "CRU",
    HL: assigned("R"),
  }),
  row(241, "5.8", "Artist fee, internal", { SA: "RU", PM: assigned("R"), VC: "RU", FA: "R" }),
  row(242, "5.8", "Production items", {
    SA: "CRUD",
    PM: assigned("CRU"),
    CD: assigned("R"),
    VC: "CRU",
    HL: assigned("CRU"),
  }),
  // §5.9 Creative, approvals and client requests
  row(248, "5.9", "Design items and versions", {
    SA: "CRUDS",
    PM: assigned("CRUS"),
    CD: assigned("CRUDS"),
    VC: assigned("R"),
    RG: assigned("R"),
    HL: assigned("R"),
  }),
  // SM, HT and FA "CR (o) UD": read as UD (o), the reading of scripts/notes.ts (POL-19).
  row(249, "5.9", "Comments, internal", {
    SA: "CRUD",
    SM: [own("CR"), own("UD")],
    HT: [own("CR"), own("UD")],
    PM: [assigned("CR"), own("UD")],
    CD: [assigned("CR"), own("UD")],
    VC: [assigned("CR"), own("UD")],
    RG: [assigned("CR"), own("UD")],
    HL: [assigned("CR"), own("UD")],
    FA: [own("CR"), own("UD")],
  }),
  row(250, "5.9", "Comments, client-visible replies", {
    SA: "CRUD",
    HT: all("CRU", { subjects: ["hotel"] }),
    PM: assigned("CRU"),
    CD: assigned("CRU", { subjects: ["design"] }),
    VC: assigned("CRU", { subjects: ["vendor_proposal"] }),
    RG: assigned("CRU", { subjects: ["guest"] }),
    FA: all("CRU", { subjects: ["invoice"] }),
  }),
  row(251, "5.9", "Client requests (questions, change requests, support)", {
    SA: "CRUDA",
    SM: "R",
    HT: all("RU", { subjects: ["hotel"] }),
    PM: assigned("RUA"),
    CD: assigned("RU"),
    VC: assigned("RU"),
    RG: assigned("RU"),
    HL: assigned("RU"),
    FA: "R",
  }),
  row(252, "5.9", "Approvals, submit for decision", {
    SA: "CRU",
    HT: all("C", { subjects: ["hotel_proposal"] }),
    PM: assigned("CRU"),
    CD: assigned("C", { subjects: ["design", "invitation"] }),
    VC: all("C", { subjects: ["vendor_proposal"] }),
    FA: all("C", { subjects: ["budget_line", "contract", "invoice"] }),
  }),
  row(253, "5.9", "Approval decisions, on the client's behalf with evidence", {
    SA: "A",
    PM: assigned("A"),
  }),
  row(254, "5.9", "Live chat conversations and messages (Q20)", {
    SA: "CRUD",
    SM: "CRU",
    HT: all("CRU", { subjects: ["hotel"] }),
    PM: assigned("CRU"),
    CD: assigned("R"),
    VC: assigned("R"),
    RG: assigned("CRU", { subjects: ["guest"] }),
    HL: assigned("CRU"),
    FA: "R",
  }),
  // §5.10 Guests and RSVP
  row(260, "5.10", "Invitations and versions", {
    SA: "CRUDS",
    PM: assigned("CRUS"),
    CD: assigned("CRU"),
    RG: assigned("RU"),
  }),
  row(261, "5.10", "Invitation distribution (recipients, send)", {
    SA: "CRU",
    PM: assigned("R"),
    RG: assigned("CRU"),
  }),
  row(262, "5.10", "Family groups and guests, standard fields", {
    SA: "CRUD",
    PM: assigned("CRU"),
    RG: assigned("CRUD"),
    HL: assigned("RU"),
  }),
  row(263, "5.10", "Guest sensitive fields (allergies, accessibility)", {
    SA: "R",
    PM: assigned("R"),
    RG: assigned("RU"),
    HL: assigned("R"),
  }),
  row(264, "5.10", "Guest internal notes", {
    SA: "RU",
    PM: assigned("R"),
    RG: assigned("CRU"),
    HL: assigned("R"),
  }),
  row(265, "5.10", "Identity documents", {
    SA: all("R", { checks: ["break_glass"] }),
    RG: explicit(assigned("CRU")),
    HL: assigned("R", { checks: ["check_in"] }),
  }),
  row(266, "5.10", "Attendance", {
    SA: "CRU",
    PM: assigned("RU"),
    RG: assigned("CRU"),
    HL: assigned("R"),
  }),
  row(267, "5.10", "RSVP tokens (issue, revoke)", {
    SA: "CRU",
    PM: assigned("CRU"),
    RG: assigned("CRU"),
  }),
  row(268, "5.10", "RSVP responses (submission log)", {
    SA: "R",
    PM: assigned("R"),
    RG: assigned("CR"),
  }),
  row(269, "5.10", "Guest support requests", {
    SA: "CRU",
    PM: assigned("RU"),
    RG: assigned("CRU"),
    HL: assigned("CRU"),
  }),
];
