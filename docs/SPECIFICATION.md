# Wage-Calc — Application Specification

> Status: **Awaiting product-owner approval** — no code is written until this document is approved.
> Last updated: 2026-08-06

---

## 1. Product Overview

**Purpose.** A single-purpose payroll tool for one accountant at one business (an events/venue-staffing style operation). It replaces mental arithmetic and ad-hoc notes for calculating shift wages across a ~75-person staff roster working 6–10 shifts per week at multiple venues.

**Core value.** Enter a shift's staff, times and breaks → get accurate per-staff and shift-total wages instantly, keep a permanent searchable record, produce PDF/Excel reports, and track exactly who has been paid so nobody is ever double-paid or missed.

**Users.** Exactly one: the accountant. Single sign-in. Primarily used on a phone (PWA), on the go.

**Out of scope (confirmed).**
- Tax/NI deductions of any kind — gross pay only.
- Multi-company / multi-tenant support.
- Staff-facing access of any kind.
- Sensitive personal data (NI number, address, emergency contact, ID photo) — **deferred post-prototype**; kept external for now. Schema is designed so these can be added later as view-only fields.
- Rota/scheduling features (this records what happened for pay purposes; it is not a shift-planning tool).

---

## 2. Confirmed Decisions Register

| # | Decision | Detail |
|---|----------|--------|
| D1 | Currency | GBP, standard rounding to nearest penny |
| D2 | Time entry | 15-minute steps, 24-hour display |
| D3 | Rate model | **Shift-level rates** (Option A): each shift has one base rate + one supervisor rate. No per-individual rate overrides within a shift |
| D4 | Standard rates | Company-wide base rate and supervisor rate stored in Settings; prefill every new shift; editable per shift; changing Settings affects future shifts only (past shifts keep their snapshot) |
| D5 | Supervisor | Exactly **one** supervisor per shift (DB-enforced), picked from the roster; supervisor role on a profile is a label only and never affects pay |
| D6 | Breaks | Unpaid, entered in **minutes**, deducted from paid hours. Default 60 min for crew, 0 min for supervisor (auto-set when designated, still editable) |
| D7 | Additional amount | One optional £ field per staff per shift, default £0, set freely by the accountant; shown as its own column in reports |
| D8 | Flexible individual times | Staff entries inherit shift start/finish but each entry's times are individually editable |
| D9 | Overnight shifts | Supported (finish after midnight); no pay difference |
| D10 | Clash rule | A staff member cannot appear in two shifts whose time ranges overlap — blocked with a clear error |
| D11 | Same-day multiples | Multiple shifts may run per day, and a staff member may work several shifts in one day if times don't overlap |
| D12 | History | Kept **forever** (one-month deletion scrapped). Default views show the current pay week; full history reachable via filterable table |
| D13 | Pay week | Monday–Sunday; wages distributed weekly (Monday evening / Tuesday morning) |
| D14 | Paid tracking | Per staff-line per shift. Payments view: pick specific days/shifts → shows **only staff who are owed money** → per-staff owed totals + grand total → mark individual staff (or all) paid |
| D15 | Locations | Fixed saved list, extendable inline when creating a shift; purely informational (venue names); optional per-shift description that appears in reports |
| D16 | Staff profile (prototype) | Name, phone number, role (regular / supervisor / manager), active flag. Deactivate ≠ delete; reactivation supported; deactivated staff remain in past records |
| D17 | Audit | Edits to shifts are never silent — changes recorded and viewable |
| D18 | Reports | Per-shift breakdown + per-staff summary; **PDF primary**, XLSX also available |
| D19 | Auth | Single account, email + password, secure sessions; no roles/permissions needed |
| D20 | Platform | Responsive **PWA**, phone-first (installable to home screen), works on desktop too |
| D21 | Scale | ~75 staff, 6–10 shifts/week (~300–500/yr) — small data; simple fast queries; free/low-cost hosting. Large functions run to **50 staff per shift, ~25 per batch**, 3–4 back-to-back per week |

### Amendments (2026-08-15) — batches, breaks, reports

These supersede the decisions noted against each. Requested by the product owner after live use.

| # | Decision | Detail |
|---|----------|--------|
| D22 | **Batches** (amends D8) | A shift contains one or more **batches**; a batch contains one or more staff. The batch carries the start/finish times its staff inherit, so a 25-person group is timed once rather than per person. Individual staff may still override their own times (someone who moved batches or came in late). A batch may hold a single person — typically the supervisor |
| D23 | Break steps (amends D2) | Breaks are entered in **5-minute** steps. Shift and batch times stay on 15-minute steps |
| D24 | Shift window is a hard bound | No batch and no staff member may start before the shift starts or finish after it ends. Rejected server-side with a named error |
| D25 | Supervisor scope unchanged (upholds D5) | Still exactly one supervisor per **shift**, not per batch, DB-enforced. They may sit in a batch of their own |
| D26 | Reports: PDF only (amends D18) | The **Excel/XLSX export is removed entirely**, along with the `exceljs` dependency |
| D27 | PDF contents | Adds a **phone** column; rows are **grouped under their batch** (with the batch's times, headcount and subtotal); the **Hours** column shows **total time on site including breaks**. Pay is still calculated on hours worked *after* deducting the break — the Break column sits beside Hours and the report carries a note saying so |
| D28 | Batch naming | Batches are numbered ("Batch 1", "Batch 2") and can optionally be given a name, e.g. "Bar staff" |

### Amendments (2026-08-16) — home metrics, PDF layout, company name

| # | Decision | Detail |
|---|----------|--------|
| D29 | Company name | Settings holds a **company/account name**, printed at the top of every PDF and in its running footer |
| D30 | Home metrics | Adds a **monthly spend** figure (smaller heading than the 7-day headline). The Shifts tile shows **this month's** count with the last-7-days count beneath |
| D31 | Home: outstanding | The daily spend chart is **removed**; its place shows the **largest amount owed to any one staff member**, their name, and total outstanding — linking to Payments |
| D32 | PDF layout is size-independent | Fixed column widths and a fixed row height with single-line clipping; only individual rows are unbreakable so long shifts **flow onto further pages** instead of overprinting; table headers repeat on each page; explicit page margins and a "Page N of M" footer |

---

## 3. Wage Calculation (the heart of the app)

For each staff entry on a shift:

```
worked_minutes = (entry_end − entry_start) − break_minutes     // end may be past midnight
hours          = worked_minutes / 60
rate           = shift.supervisor_rate  if entry is the supervisor
                 shift.base_rate        otherwise
base_pay       = round(hours × rate, 2 dp)                     // half-up rounding
total_pay      = base_pay + additional_amount
```

- Times snap to 15-minute increments; `worked_minutes` is therefore always a multiple of 15.
- `entry_end` earlier than `entry_start` on the clock means the entry crosses midnight; internally times are stored as full timestamps so the subtraction is always correct.
- Validation: `worked_minutes > 0` (break cannot equal or exceed the worked span); `break_minutes ≥ 0`; `additional_amount ≥ 0`; rates > 0.
- Shift total = Σ per-staff `total_pay`. Grand totals in Payments/Reports = Σ over selected shifts.
- All money handled as integer pence internally (never floating point); formatted as £x,xxx.xx for display.

---

## 4. Data Model

```
Batch         id, shift_id → Shift, name (nullable), position,
              start_at, end_at            -- one or more per shift (D22)
User          id, email (unique), password_hash, created_at
Settings      id (singleton), company_name (nullable), base_rate_pence,
              supervisor_rate_pence, updated_at
Location      id, name (unique), created_at
Staff         id, name, phone, role ENUM(regular|supervisor|manager),
              is_active (default true), created_at, updated_at
Shift         id, date, location_id → Location, description (nullable),
              start_at (timestamp), end_at (timestamp),
              base_rate_pence, supervisor_rate_pence,      -- snapshots from Settings
              created_at, updated_at
ShiftEntry    id, shift_id → Shift, batch_id → Batch, staff_id → Staff,
              is_supervisor (bool),
              start_at, end_at (timestamps; default = shift's),
              break_minutes (int; default 60, or 0 if supervisor),
              additional_pence (default 0),
              paid (bool, default false), paid_at (nullable),
              UNIQUE(shift_id, staff_id)
AuditLog      id, entity_type, entity_id, action ENUM(create|update|delete),
              changes (JSON: field → {from, to}), created_at
```

**Constraints & indexes**
- Partial unique index on `ShiftEntry(shift_id) WHERE is_supervisor` → exactly one supervisor enforced at the database level, not just the UI.
- Overlap check on save: reject an entry if the same `staff_id` has another entry whose `[start_at, end_at)` intersects (excluding the entry being edited).
- Wage-affecting fields on a paid entry are locked; editing requires explicitly reverting it to unpaid first (audit-logged), preventing silent drift between what was paid and what the record says.
- Indexes: `Shift(date)`, `ShiftEntry(staff_id)`, `ShiftEntry(paid)`, `AuditLog(entity_type, entity_id)`.
- Deleting a shift soft-deletes nothing: shifts are hard-deleted **only if fully unpaid**, and the deletion is audit-logged with a snapshot. Shifts containing paid entries cannot be deleted.
- Staff with any shift history cannot be deleted, only deactivated.

---

## 5. Pages & Screens

| # | Screen | Route | Purpose |
|---|--------|-------|---------|
| P1 | Sign in | `/login` | Email + password. Rate-limited. |
| P2 | **Home** | `/` | Dashboard: 7-day spend with week-on-week trend, shifts this month (and last 7 days), staff hours, **month-to-date spend**, and the **largest amount owed to one staff member**. Below it, shifts from the **last 7 days** (rolling): location, date, times, staff count, total, paid state |
| P3 | New / Edit shift | `/shifts/new`, `/shifts/[id]/edit` | Date, location (pick or add-new inline), optional description, shift start/finish, rates (prefilled from Settings, editable). Then one or more **batch** cards, each with its own start/finish and a full-screen multi-select roster picker for adding many staff at once. Staff appear as compact rows (name, hours, pay) expanding to break / additional / supervisor / optional individual times. Per-batch "break all" bulk setter, per-batch subtotal, live shift total |
| P4 | Shift detail | `/shifts/[id]` | Read view: summary header + per-staff table (times, break, hours, rate, additional, total, paid badge); change-history panel; edit/delete actions |
| P5 | History | `/history` | Table of all shifts ever; filters: date range, location, staff member; columns: date, location, staff count, times, total; row → shift detail |
| P6 | **Payments** | `/payments` | Date/day-range selector (defaults to last complete pay week Mon–Sun) with the ability to **deselect individual days or individual shifts** from the selection; lists **only staff owed money**: name, shifts worked (expandable), hours, owed; grand total owed; "Mark paid" per staff and "Mark all paid"; confirmation step before marking |
| P7 | Reports | `/reports` | Pick day / week / custom range → preview → download **PDF** (Excel removed, D26). Contents: per-shift sections (location, date, times, description) subdivided by **batch** (times, headcount, subtotal), per-staff rows with name, **phone**, times, break, **hours on site**, rate, additional and total; plus per-staff summary and grand total |
| P8 | Staff | `/staff` | Roster list with active/inactive tabs and search; add/edit (name, phone, role); deactivate & reactivate |
| P9 | Settings | `/settings` | **Company name** (printed on every PDF, D29); standard base & supervisor rates; location list management (rename only — removal deliberately not offered); account (change password) |

All screens: loading, empty, and error states designed; phone-first layout; large touch targets; 24-h times; £ formatting.

**Key flow — creating a typical shift (the everyday path, optimised to be fast):**
1. Home → New shift → pick date, location, type times (15-min steppers), rates already filled.
2. Search/tap staff names to add them — all inherit the shift times and 60-min break.
3. Tap one person's "supervisor" toggle → their break flips to 0, rate display flips to supervisor rate.
4. Adjust any individual's times/break/additional if needed (e.g. someone left early).
5. Totals update live; Save. Clash validation runs; any conflict names the person and the conflicting shift.

**Key flow — Monday payday:**
1. Payments → defaults to last week (Mon–Sun) → sees e.g. 14 staff owed, £3,912.50 total.
2. Optionally deselect specific days. Hands out wages; taps "Mark paid" per person as they're paid (or "Mark all").
3. Anyone already paid earlier no longer appears — double-payment impossible.
4. Reports → same week → PDF for the records.

---

## 6. Architecture & Technology

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | **Next.js 15 (App Router) + TypeScript** | One codebase for UI + API, first-class PWA support, boring and reliable |
| UI | Tailwind CSS + shadcn/ui components | Fast to build, accessible, consistent phone-first design |
| Database | **PostgreSQL** (Neon free tier) | Real constraints (partial unique index), free at this scale, daily backups |
| ORM | Prisma | Typed queries, migrations |
| Auth | Auth.js credentials provider — bcrypt password hash, HTTP-only session cookies, login rate-limiting | Single user; no OAuth complexity |
| PDF | `@react-pdf/renderer` server-side | Reliable, styleable payroll PDFs |
| XLSX | `exceljs` | Proper .xlsx with formatting |
| Hosting | **Vercel free tier** (app) + **Neon free tier** (DB) | ~£0/month at this scale; custom domain optional (~£10/yr) |
| PWA | Web manifest + service worker (app-shell caching) | Installable on the accountant's phone. Online-required for data (offline entry is a possible future addition, not MVP) |

Server-side validation on every mutation (Zod schemas shared client/server). All money in integer pence. All times stored UTC, displayed Europe/London.

---

## 7. Security

- All routes and API endpoints require an authenticated session except `/login`; middleware-enforced.
- bcrypt (cost 12) password hashing; generic login error messages; rate-limited login (5 attempts / 15 min per IP).
- HTTPS everywhere (Vercel default), secure/HTTP-only/SameSite cookies, CSRF protection via Auth.js.
- Zod validation server-side on every input; Prisma parameterisation (no raw SQL).
- Security headers (CSP, HSTS, X-Frame-Options DENY, nosniff).
- Secrets only in environment variables; nothing hardcoded.
- Audit log gives tamper-evidence for wage edits.
- When sensitive staff fields (NI, address, ID photo) are added post-prototype: encrypted at rest, private object storage with signed URLs for photos, never included in exports.
- UK GDPR posture (prototype): only name + phone held → still personal data; lawful basis is legitimate interest (payroll administration); permanent wage records align with statutory record-keeping duties. Formal compliance review deferred until sensitive fields are added.

---

## 8. Testing Strategy

| Level | Tool | Coverage |
|-------|------|----------|
| Unit | Vitest | **Wage calculation exhaustively**: rounding, 15-min boundaries, overnight spans, break ≥ span rejection, supervisor rate selection, additional amounts, pence arithmetic |
| Unit | Vitest | Overlap detection: touching boundaries (allowed), containment, partial overlap, overnight overlap, same staff different days |
| Integration | Vitest + test DB | API routes: auth guards, validation rejections, one-supervisor enforcement, paid-entry locking, audit log writes, payment marking idempotency |
| E2E | Playwright | Critical flows: login, create shift end-to-end, edit with audit check, payments flow incl. double-payment prevention, PDF/XLSX download, staff deactivate/reactivate |
| Manual | — | Phone-viewport walkthrough of every screen before release |

CI runs typecheck, lint, unit + integration tests on every push; E2E before deploy.

---

## 9. Assumptions — ALL CONFIRMED by product owner (2026-08-06)

| # | Confirmed decision |
|---|-----------|
| A1 | Sensitive fields (NI, address, emergency contact, ID photo) are **excluded from the prototype** entirely; schema leaves room to add them later as view-only data |
| A2 | Home screen shows shifts from the **last 7 days** (rolling from today). Payments defaults to the last complete pay week (Mon–Sun) and supports deselecting individual days **and individual shifts** |
| A3 | "Mark paid" applies to all of that staff member's unpaid entries within the accountant's current selection — some staff may be paid while others in the same selection remain unpaid |
| A4 | Paid entries lock their wage-affecting fields; unlocking (reverting to unpaid) is allowed and audit-logged |
| A5 | Shifts with any paid entries cannot be deleted; fully-unpaid shifts can |
| A6 | Additional amount is £ only (no negative "deduction" values) |
| A7 | Locations can be renamed; location **removal is not offered** (feature dropped by product owner) |
| A8 | The single user account is created by seed script at deployment, and the **seeded credentials are clearly surfaced** (printed at seed time and documented in the README); password changeable in Settings; forgotten-password recovery is a documented re-seed procedure — email-based reset is a future addition |

---

## 10. Risks

| Risk | Mitigation |
|------|-----------|
| Single account, no password recovery | Documented re-seed procedure; email reset in future scope |
| Free-tier DB cold starts (Neon) | Acceptable at this scale; paid tier (~£5/mo) removes it if annoying |
| Accountant offline at a venue | MVP requires connectivity; offline-capable entry listed as future work |
| Legal wage-record retention | Solved by permanent history + exports |
| Wage calc bugs = real money errors | Exhaustive unit tests + integer pence arithmetic + audit trail |
