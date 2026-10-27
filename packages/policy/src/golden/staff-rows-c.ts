/*
 * Golden table of §5.11 to §5.15 (docs/permission-matrix.md lines 274-316), written by hand from the
 * document, line by line: every role's letters, scope and note (src/staff.golden.test.ts).
 */
import { all, assigned, own, row, type GoldenRow } from "./staff";

/**
 * The rows of §5.11 to §5.15, in the document's order.
 *
 * @example
 * STAFF_ROWS_5_11_TO_5_15.find((golden) => golden.line === 274)?.label;
 */
export const STAFF_ROWS_5_11_TO_5_15: readonly GoldenRow[] = [
  // §5.11 Rooms, travel and transport
  row(274, "5.11", "Room blocks, client fields", {
    SA: "CRU",
    HT: "CRU",
    PM: assigned("CRU"),
    RG: assigned("R"),
    HL: assigned("R"),
    FA: "R",
  }),
  row(275, "5.11", "Room blocks, internal rate", {
    SA: "RU",
    HT: "RU",
    PM: assigned("R"),
    FA: "R",
  }),
  row(276, "5.11", "Room allocations and occupants", {
    SA: "CRUD",
    HT: "R",
    PM: assigned("RU"),
    RG: assigned("CRU"),
    HL: assigned("CRUD"),
  }),
  row(277, "5.11", "Travel segments", {
    SA: "CRU",
    PM: assigned("R"),
    RG: assigned("CRU"),
    HL: assigned("CRU"),
  }),
  row(278, "5.11", "Vehicles, transfers, passengers", {
    SA: "CRUD",
    PM: assigned("RU"),
    VC: assigned("R", { subjects: ["transport_vendor"] }),
    RG: assigned("R"),
    HL: assigned("CRUD"),
  }),
  row(279, "5.11", "Guest departures", {
    SA: "CRU",
    PM: assigned("R"),
    RG: assigned("RU"),
    HL: assigned("CRU"),
  }),
  row(280, "5.11", "Lost and found", {
    SA: "CRU",
    PM: assigned("RU"),
    RG: assigned("R"),
    HL: assigned("CRU"),
  }),
  // §5.12 Menus
  row(286, "5.12", "Menus, versions, items", {
    SA: "CRUDS",
    PM: assigned("CRUS"),
    CD: assigned("R"),
    VC: assigned("CRU"),
    RG: assigned("R"),
    HL: assigned("R"),
  }),
  row(287, "5.12", "Headcounts", {
    SA: "R",
    PM: assigned("R"),
    VC: assigned("R"),
    RG: assigned("R"),
    HL: assigned("R"),
  }),
  // §5.13 Tasks, staffing and incidents
  row(293, "5.13", "Tasks", {
    SA: "CRUD",
    SM: own("CRU"),
    HT: own("CRU"),
    PM: assigned("CRUD"),
    CD: assigned("CRU"),
    VC: assigned("CRU"),
    RG: assigned("CRU"),
    HL: assigned("CRU"),
    FA: own("CRU"),
  }),
  row(294, "5.13", "Task dependencies", {
    SA: "CRUD",
    PM: assigned("CRUD"),
    CD: assigned("CR"),
    VC: assigned("CR"),
    RG: assigned("CR"),
    HL: assigned("CR"),
  }),
  row(295, "5.13", "Staff assignments", {
    SA: "CRUD",
    PM: assigned("CRUD"),
    CD: own("R"),
    VC: own("R"),
    RG: own("R"),
    HL: assigned("CRU"),
  }),
  row(296, "5.13", "Incidents (report, assign, escalate, resolve, close)", {
    SA: "CRUD",
    PM: assigned("CRUA"),
    CD: assigned("CR"),
    VC: assigned("CR"),
    RG: assigned("CR"),
    HL: assigned("CRU"),
  }),
  // §5.14 Documents and media
  row(302, "5.14", "Documents on records the role can reach", {
    SA: "CRUD",
    SM: "CRU",
    HT: "CRU",
    PM: assigned("CRUD"),
    CD: assigned("CRU"),
    VC: "CRU",
    RG: assigned("CRU"),
    HL: assigned("CRU"),
    FA: "CRU",
  }),
  row(303, "5.14", "Set client visibility on a document", {
    SA: "S",
    HT: all("S", { subjects: ["hotel_proposal"] }),
    PM: assigned("S"),
    CD: assigned("S", { subjects: ["design"] }),
    VC: all("S", { subjects: ["vendor_proposal"] }),
    FA: all("S", { subjects: ["invoice", "client_contract"] }),
  }),
  row(304, "5.14", "Media assets", {
    SA: "CRUD",
    SM: all("RU", { fields: ["rights", "showcase"] }),
    HT: all("CRUD", { subjects: ["hotel"] }),
    PM: "R",
    CD: assigned("CRUD", { subjects: ["design"] }),
    VC: all("CRUD", { subjects: ["vendor"] }),
  }),
  row(305, "5.14", "Expiring access links", {
    SA: "CRUD",
    SM: own("C"),
    HT: own("C"),
    PM: assigned("C"),
    CD: assigned("C"),
    VC: own("C"),
    RG: assigned("C"),
    HL: assigned("C"),
    FA: own("C"),
  }),
  // §5.15 Closure, feedback and public website; "request only" (lines 307 and 313) grants nothing.
  row(311, "5.15", "Closure checklist items", {
    SA: "CRU",
    PM: assigned("CRU"),
    VC: all("U", { subjects: ["vendor_completion"] }),
    HL: assigned("U", { subjects: ["departures", "lost_and_found"] }),
    FA: all("U", { subjects: ["final_accounts"] }),
  }),
  row(312, "5.15", "Close the project", {
    SA: "A",
    PM: assigned("A", { checks: ["closure_ready"] }),
  }),
  row(313, "5.15", "Archive the project after the window (Q23)", { SA: "A" }),
  row(314, "5.15", "Approve a retention deletion proposed by the retention job (Q17)", { SA: "A" }),
  row(315, "5.15", "Client feedback", { SA: "R", SM: "R", PM: assigned("R") }),
  row(316, "5.15", "CMS pages and showcase items", {
    SA: "CRUD",
    SM: "CRU",
    HT: "R",
    PM: "R",
    CD: "R",
    VC: "R",
    RG: "R",
    HL: "R",
    FA: "R",
  }),
];
