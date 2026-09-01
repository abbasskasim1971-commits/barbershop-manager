# Barbershop Management System — Implementation Roadmap

## Phase 1: Project Foundation & Infrastructure

**Goal:** Bootstrapped project with clean architecture, encrypted database, and authentication working end-to-end.

- [x] Initialize Electron + React + TypeScript project with build/config tooling
- [x] Set up ESLint + Prettier (simplified rules for v7 compatibility)
- [x] Enforce clean architecture folder structure: `domain/`, `application/`, `infrastructure/`, `presentation/`
- [x] Implement SQLite via `sql.js` (WASM) for dev; `better-sqlite3` + SQLCipher target for production
- [x] Implement database migrations system
- [x] Implement Baghdad-time timezone handling (store UTC internally, render Baghdad time everywhere)
- [x] Implement system event log table (logins/logouts, sync events)
- [x] Set up i18n — Arabic & Kurdish Sorani, RTL, Latin numerals, Gregorian calendar
- [x] Create the main Electron window and basic tab navigation shell (POS, Inventory, Expenses, Reports, Settings)

**Deliverable:** App launches, encrypted DB is ready, auth screen works, basic navigation is functional.

---

## Phase 2: Authentication & User Management

**Goal:** Secure login for all three account types with correct permission enforcement.

- [ ] User model: Owner, Manager/Trusted Employee, Barber — with role-based access
- [ ] PIN-based login for barbers (works on any touch station, not device-locked)
- [ ] Username + password login for Owner/Manager station
- [ ] Session management and auto-lock
- [ ] Deactivate (never delete) barbers — preserve historical data
- [ ] Manager/Trusted Employee account provisioning and control (by Owner)
- [ ] Route guards enforcing permissions per role

**Deliverable:** All three account types can log in and see only their allowed features.

---

## Phase 3: Core Domain — Services, Products & Expenses

**Goal:** Manageable catalogs that underpin all other features.

- [ ] **Service catalog:** add / edit / soft-delete with price, name, description
- [ ] **Product catalog:** add / edit / soft-delete with name, **selling price, cost price**, quantity, low-stock threshold
- [ ] **Expense categories:** manageable lookup table (add/edit/soft-delete) with seed values
- [ ] **Operating expenses:** record with category, amount, date, notes; soft-delete + audit log
- [ ] **Audit log:** entity type, entity id, field, old value, new value, changed_by, changed_at — covering expenses, products, services, sales, commission rates
- [ ] Soft-delete pattern (`is_deleted` flag) on all entities; hiding from normal UI, queryable for reports
- [ ] **Domain rules for profitability:** product cost price field; historical cost preservation requirement on sale lines; service/product financial separation

**Deliverable:** All catalogs are fully CRUDable with audit trails; product cost price available; domain foundation for COGS calculation in place.

---

## Phase 4: Inventory Management

**Goal:** Stock tracking with alerts, changes only at Owner/Manager station.

- [ ] Product stock levels tracked per item
- [ ] Low-stock threshold per product (configurable)
- [ ] Inventory adjustments: add/remove stock (manual quantity entry — no supplier tracking)
- [ ] In-app low-stock badge/indicator (icon with count) — not buried in reports
- [ ] Inventory viewed/managed only at Owner/Manager station

**Deliverable:** Products show stock levels and low-stock warnings; inventory changes are logged.

---

## Phase 5: Point of Sale — Owner/Manager Station

**Goal:** Full POS for services + products with cash handling.

- [ ] Service sale: select service, create invoice, cash only
- [ ] Product sale: select product(s), create invoice, cash only — deducts inventory
- [ ] Split invoice lines by service vs. product (commission logic depends on it)
- [ ] Commission calculation at sale time (only on service lines)
- [ ] Sale correction: soft-delete + audit log; automatically reverses inventory deduction and commission
- [ ] Cash drawer tracking (amount in drawer)
- [ ] Invoice totals in IQD, no rounding
- [ ] No receipt printing
- [ ] **Cash handling: Manager collects cash** (applies to both service and product sales)
- [ ] **No receipt/ticket printing**
- [ ] **Preserve applicable product cost price on each product sale line at sale time** (historical COGS)
- [ ] **Maintain service/product line separation** for distinct financial treatment
- [ ] **Ensure commission applies only to service lines** (never product lines)
- [ ] **Ensure sale correction reverses all financial side effects**: inventory, commission, COGS, gross profit
- [ ] **Historical product cost price captured on each product sale line** at sale time (for historical COGS)

**Deliverable:** Full POS workflow — sell services, sell products, correct mistakes, track cash; historical cost preserved on sale lines; financial integrity maintained.

---

## Phase 6: Barber Touch Station (POS)

**Goal:** Service-only POS on 8 touch stations with PIN login.

- [ ] PIN login on any touch station (same PIN works on any device)
- [ ] Service catalog display (fetched from Owner Station or local cache)
- [ ] Create service-sale records tied to logged-in barber
- [ ] Local outbox table for unsynced sales (offline-capable)
- [ ] Barber daily view: services sold today, commission earned today
- [ ] Commission rate display (current rate visible to barber)

**Deliverable:** Any barber can log in, sell services, and see their daily work/earnings — fully offline-capable.

---

## Phase 7: Commission & Barber Management

**Goal:** Effective-dated commission rates and dues tracking.

- [ ] Commission rate per barber with effective date (not a single mutable field)
- [ ] Commission rate history preserved — old rates still apply to old sales
- [ ] Commission earned **only on service portions of sales** (never on products)
- [ ] **Commission applies ONLY to service lines** (never on product lines)
- [ ] Barber dues/amounts owed — computed per period
- [ ] Owner report of barber commissions and dues
- [ ] Commission rate management screen (Owner only)
- [ ] **Barber commissions integrate correctly into shop profitability calculations** (service-only, historically preserved rates)

**Deliverable:** Commission calculations are historically accurate; owner can see what is owed to each barber; commissions flow correctly into Profit/Loss.

---

## Phase 8: End of Day Closing

**Goal:** Daily cash reconciliation.

- [ ] End of Day / shift-closing report per station per day
- [ ] Compare total recorded sales (cash) vs. actual cash counted in drawer
- [ ] Close the day — lock further sales for that period (or allow after-hours corrections)
- [ ] Auto-trigger backup after EOD closing (keep last 30 backups)
- [ ] Backup destination path configurable by owner in Settings
- [ ] Manual "Backup now" and "Restore" actions in Settings
- [ ] **Cash handling: Manager collects cash** (applies to both service and product sales)

**Deliverable:** Manager/Owner can close a shift, reconcile cash, and have a backup created automatically.

---

## Phase 9: Reporting

**Goal:** Sales and barber reports with export and printing.

- [ ] Sales reports: total sales, breakdown by service/product, date-filtered
- [ ] Date filtering: daily, weekly, monthly presets + custom date range
- [ ] Barber reports: work done and commission dues per barber, per period
- [ ] Barber performance comparison report (rank by revenue/services sold)
- [ ] End of Day / shift-closing report (Manager-accessible only)
- [ ] **Shop Profit/Loss report (Owner only):** Revenue (service + product), COGS (historical product cost), Gross Profit, Barber Commissions, Operating Expenses, Net Shop Profit
- [ ] Profit/Loss report supports same date filtering (daily, weekly, monthly, custom)
- [ ] Profit/Loss report: Excel export, A4 printing, smart sortable tables
- [ ] Owner-only access enforced; Manager/Barber excluded from analytical profit reports
- [ ] Smart sortable tables in UI (TanStack Table)
- [ ] Export to Excel (`exceljs`)
- [ ] Printable on A4 via Electron/Chromium print (HTML/CSS)

**Deliverable:** All required reports available, sortable, exportable, and printable; Owner can understand shop profitability for any selected period with full component breakdown.

---

## Phase 10: Sync Mechanism (Multi-Station)

**Goal:** One-directional outbox sync between barber stations and Owner Station.

- [ ] Owner Station runs lightweight embedded server (Node/Express or Fastify) on local Wi-Fi
- [ ] Barber stations queue unsent sales in local outbox table
- [ ] Barber stations push queued sales to Owner Station when reachable
- [ ] Owner Station pushes down service catalog, prices, and active barber list/PINs to touch stations on connection
- [ ] Automatic retry + queuing when network is unreachable
- [ ] System event log records sync events (success/failure)
- [ ] Owner Station is authoritative for conflict resolution

**Deliverable:** 9 stations sync automatically; fully standalone when offline; Owner Station is source of truth.

---

## Phase 10: WhatsApp Integration (Shift-Closing)

**Goal:** Manager can send EOD report to owner via WhatsApp.

- [ ] Configure owner's WhatsApp number in Settings
- [ ] "Send" button on End of Day / shift-closing report
- [ ] WhatsApp Web automation (`whatsapp-web.js`, QR code session)
- [ ] Graceful failure if offline: clear message, no crash, no silent queue
- [ ] Session re-linking handling

**Deliverable:** One-click WhatsApp send of the shift-closing report; fails gracefully without internet.

---

## Phase 11: Dashboard & Polish

**Goal:** Home dashboard and final UX refinement.

- [ ] Owner Station dashboard: sales so far today, inventory alerts count, quick stats
- [ ] Smooth, responsive tab/module switching
- [ ] Final UI/UX pass for Arabic/Kurdish RTL layouts
- [ ] Low-stock badge visible on dashboard
- [ ] Edge case handling and error states throughout

**Deliverable:** Polished, responsive, Arabic/Kurdish-friendly dashboard and navigation.

---

## Phase 11: Testing, Hardening & Launch

**Goal:** Reliability, performance, and deployment readiness.

- [ ] Integration tests for sync scenarios (offline → online, conflicts)
- [ ] End-to-end workflow tests (sale → correction → EOD → report)
- [ ] Performance testing with full dataset (30 days, all 9 stations)
- [ ] Backup/restore verification (restore from backup, data integrity)
- [ ] Build installer for Windows 10+
- [ ] Documentation: user guide for owner/manager and barbers

**Deliverable:** Stable, tested, ready for deployment.

---

## Summary by Priority

| Priority | Phase | Focus |
|---|---|---|
| 🔴 Critical | 1–2 | Foundation, DB, Auth |
| 🔴 Critical | 3–4 | Core domain, inventory |
| 🟠 High | 5–6 | POS (Owner + Barber stations) |
| 🟠 High | 7–8 | Commission, EOD closing |
| 🟡 Medium | 9 | Reporting |
| 🟡 Medium | 10 | Multi-station sync |
| 🟢 Lower | 11 | WhatsApp integration |
| 🟢 Lower | 12 | Dashboard & polish |
| 🟢 Lower | 13 | Testing, hardening & launch |

---

## Financial Dependency Chain

```
Sales (Phase 5)
    ↓
Historical Product Cost on Sale Lines (Phase 5)
    ↓
COGS (Phase 5 → Phase 9)
    ↓
Gross Profit = Sales Revenue − COGS
    ↓
Barber Commissions (Phase 7, service-only)
    ↓
Operating Expenses (Phase 3/4)
    ↓
Net Shop Profit = Gross Profit − Barber Commissions − Operating Expenses
```

**Dependency Chain:**
- Phase 4 (Inventory) → provides stock levels, low-stock alerts for Phase 5
- Phase 5 (POS) → provides sales data, historical cost on sale lines, service/product separation
- Phase 7 (Commission) depends on Phase 5 (service sales data)
- Phase 8 (EOD) depends on Phase 5 (sales) + Phase 7 (commissions)
- Phase 9 (Profit/Loss) depends on Phase 5 (sales/revenue), Phase 7 (commissions), Phase 4 (inventory/COGS)

---

## Phase 3 Migration Note

**Migration Numbering:** Phase 3 uses migration `002_phase3_schema`. This follows `001_initial`. There is NO `002_auth_password_hash` migration — the `password_hash` and `pin_hash` columns are created in `001_initial`. No collision exists. No renumbering is required.