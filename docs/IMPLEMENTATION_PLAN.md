# Wage-Calc — Implementation Plan

> Executes only after SPECIFICATION.md is approved. Milestones are sequential; each ends with its tests passing and nothing known-broken.

## Milestone 1 — Foundation
**Objective:** runnable skeleton with CI.
- Next.js 15 + TypeScript + Tailwind + shadcn/ui scaffold; PWA manifest; repo + CI (typecheck, lint, test).
- Prisma + Postgres wired (local dev DB + Neon); base layout, navigation shell, £/time formatting utilities.
- **Accept:** app boots, deploys to Vercel preview, CI green.

## Milestone 2 — Data layer & wage engine
**Objective:** the maths and schema, fully tested before any UI uses them.
- Full Prisma schema + migrations (incl. partial unique supervisor index).
- Pure wage-calculation module (pence arithmetic, overnight, breaks, rounding) + overlap detector.
- Exhaustive unit tests (this is the milestone where calculation correctness is proven).
- **Accept:** all calc/overlap unit tests pass; migrations apply cleanly.

## Milestone 3 — Authentication
**Objective:** locked door.
- Auth.js credentials login, bcrypt, rate limiting, middleware guarding all routes, seed script for the account, change-password in Settings.
- **Accept:** unauthenticated access impossible (integration-tested); login/logout E2E passes.

## Milestone 4 — Staff, locations, settings
**Objective:** the reference data the shift screen depends on.
- Staff roster CRUD + deactivate/reactivate + search; location list + inline add; Settings rates page.
- Audit logging plumbing (used by all later mutations).
- **Accept:** roster and settings flows E2E-pass on phone viewport.

## Milestone 5 — Shifts (core feature)
**Objective:** the everyday workflow.
- New/edit shift screen: prefilled rates, staff picker, supervisor toggle (break auto-0), per-staff overrides, live totals, clash validation with named conflicts.
- Shift detail view with per-staff table + change history; Home screen (last 7 days rolling); delete rules (unpaid-only).
- **Accept:** full create→edit→view→delete cycle E2E; supervisor uniqueness and overlap rules enforced server-side.

## Milestone 6 — Payments
**Objective:** nobody double-paid.
- Payments screen: day/range selection (default last pay week) with per-day and per-shift deselection, owed-only staff list with expandable shift breakdown, grand total, mark-paid (per staff / all) with confirmation, paid-entry field locking + unlock flow.
- **Accept:** E2E proves a paid staff member disappears from owed list and locked fields reject edits.

## Milestone 7 — History & reports
**Objective:** the record-keeping half.
- History table with date/location/staff filters over full history.
- Report generation: PDF (primary) + XLSX for day/week/custom range — per-shift sections, additional column, per-staff summary, grand total.
- **Accept:** downloaded PDF and XLSX verified against a seeded known-answer dataset.

## Milestone 8 — Hardening & polish
**Objective:** production-ready.
- Security pass (headers, rate limits, validation audit); error/empty/loading state sweep; accessibility pass; performance check; PWA install flow verified on a real phone.
- **Accept:** full Playwright suite green; manual phone walkthrough of every screen; spec conformance review.

## Milestone 9 — Deployment
**Objective:** live.
- Production Vercel + Neon setup, env vars, seed (credentials printed and documented in README), backups confirmed, README + setup/deploy/troubleshooting docs, final completion report.
- **Accept:** accountant can log in on their phone at the production URL and run a real shift end-to-end.
