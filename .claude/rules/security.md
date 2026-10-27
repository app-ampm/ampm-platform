---
paths:
  - "apps/**"
  - "packages/**"
---
# Security and visibility rules (AMPM)

- Two rules bind everything: internal costs, margins, vendor rates, quotations, commissions and negotiations never reach a client through screens, exports, notifications or APIs (brief rule 8); every permission is enforced on the server, never only hidden in the interface (rule 18).
- Every field belongs to one visibility class from `packages/policy` (PUBLIC, CLIENT, INTERNAL, RESTRICTED-NOTES, RESTRICTED-FINANCE, RESTRICTED-CONTACT, RESTRICTED-BANK, SENSITIVE-GUEST, RESTRICTED-IDENTITY, SECRET). A response is built from the model for the principal's classes; a field outside them is not sent at all. One response model per audience (for example `BudgetLineClientView`, `BudgetLineInternalView`, `BudgetLineFinanceView`); never a flag that hides a field.
- Client-facing amounts and internal amounts are different columns and different response models; `MoneyText` and every client view type accept client amounts only.
- Denial equals absence: a record the principal may not see returns the same 404 as a record that does not exist.
- Repository scoping is mandatory on every query of a project-owned table: project membership, demo flag, visibility, soft delete. No query bypasses the repository layer.
- Files are never public paths. The API checks the owning record, writes a `document_access_links` row and returns a signed URL valid for 15 minutes. Identity documents live in the restricted store under their own key, are never exported, and every read writes a `restricted_read` audit event and an alert.
- Exports run through the same guard and serialiser and strip SENSITIVE-GUEST, RESTRICTED-IDENTITY, RESTRICTED-BANK and SECRET whatever the role; RESTRICTED-FINANCE only for Finance and the Super Admin; every export is audited with filters and row count.
- Audit: create, update, delete, approve, share, export and restricted reads on important records, with actor, time, before and after values and address; append-only; never log business audit to application logs.
- Sessions: server-side; staff sessions time out after 12 hours idle, client sessions after 30 days; revoked on role or membership change; guest tokens exchanged once for a short session bound to the household. No self-registration anywhere.
- Input: schema validation on every body, query, param and header; parameterised queries only; output encoding; CSRF protection on state-changing web forms; content security policy without inline scripts.
- Abuse: per-IP and per-principal rate limits on sign-in, OTP and public forms; a bot check on public forms.
- Uploads: type detected by content, size limits per document type, antivirus scan before a file is downloadable, metadata stripped from images.
- Secrets in the secret manager only, injected at runtime; never in code, images, logs or test fixtures. Three keys: database, general storage, restricted store.
- Personal data: consent captured where data enters; nothing deleted automatically; retention jobs propose deletions for a Super Admin to approve; staging never holds real guest data; synthetic test data only.
