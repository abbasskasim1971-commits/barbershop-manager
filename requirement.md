# Barbershop Management System — Requirements

## 1. Overview

A simple, practical, offline-first desktop application for managing a single barbershop (one location, no multi-branch support planned). Runs on Windows 10 and above. Built from scratch — this is a new project, not a continuation of any prior prototype.

## 2. Deployment Architecture

**Nine physical stations on one local Wi-Fi network** (a local router — no internet required, no wired LAN needed):

| Station | Count | User | Role |
|---|---|---|---|
| **Owner/Manager Station** | 1 (owner's laptop) | Shop owner / Manager | Full POS (services **and** products) + back-office. This is the **authoritative (master) device** — the source of truth, including the only live inventory. |
| **Barber Touch Station** | 8 (one per barber, ~8 barbers currently) | Barbers | Touch-screen only, **services only** (see 3.1). Any barber can log into **any** of the 8 stations using their personal PIN — logins are not locked to a specific device. |

Requirements:
- **Each station must work fully standalone** — the app must remain fully usable on every machine even if others are unreachable or the network is down.
- All stations sync automatically over the local Wi-Fi network when reachable.
- **The Owner/Manager station is authoritative for conflict resolution.** If the same period produced records on multiple stations, the owner device's data wins / is the reference used to reconcile.
- See Section 11 for the decided sync mechanism.

## 3. Functional Scope

### 3.1 Point of Sale
- **Barber Touch Stations sell services only.** Barbers do not sell products — customers who want a product go to the Owner/Manager desk.
- **Owner/Manager Station sells both services and products.** It is also the only station with live, authoritative inventory — this means there is never a risk of a barber station overselling out-of-stock products while offline, since barber stations never touch inventory at all.
- Cash payments only — no card or credit/deferred payment methods.
- No customer record is created or required for a sale (anonymous, walk-in style transactions).
- No receipt/ticket printing is required after a sale.
- **Cash handling:** the barber never physically holds cash from a service sale — the **Manager** collects the cash. This applies to product sales too, since those only happen at the Owner/Manager desk anyway. This makes End of Day cash reconciliation (3.8) straightforward: one cash total, held by the Manager (or Owner), reconciled against everything recorded across all 9 stations.

### 3.2 Barber & Commission Management
- Two account types: **Shop Owner** and **Barber**.
- Each barber logs in via their personal PIN on any Barber Touch Station (see Section 2 and 13).
- Commission is a **percentage, set individually per barber**.
- Commission applies **only to services** — barbers do **not** earn commission on product sales.
- Commission percentage **can change over time** based on the barber's performance. The system must preserve which rate applied to which sale historically (i.e., changing a barber's rate today must not retroactively change commission already earned on past sales) — this implies effective-dated commission rates, not a single mutable field.
- Barbers can view their own daily work/earnings via a dedicated screen/button on the touch station.
- Owner needs reports of barber dues/amounts owed (see Reports).

### 3.3 Service Catalog Management
- The list of services (haircuts, etc.) and their prices must be fully manageable: add / edit / (soft-)delete, exactly like products (see Section 7).
- Prices are **fixed** — no discounts on invoices; the price charged is always the catalog price.

### 3.4 Product Catalog & Cost Management
- Products must have both a **selling price** and a **cost price** (per unit, in IQD).
- Cost price is manageable: add / edit / (soft-)delete alongside selling price.
- Changing a product's cost price must **not** retroactively alter COGS on historical sales — the applicable cost price at the time of sale is preserved on the sale line.

### 3.5 Sale Correction
- If a sale/invoice was entered wrong (wrong service/product or wrong price), it must be correctable the same way as expenses/products: **soft-delete + audit log** (old value → new value, who, when). A sale is never silently, permanently erased.
- **Correcting/voiding a sale automatically reverses its side effects**: any product quantity it deducted is restored to inventory, and any barber commission it generated is automatically cancelled — both happen as part of the same correction, not as separate manual steps.

### 3.6 Inventory Management
- Track stock for products (shampoo, tools, consumables, etc.).
- Low-stock alert when quantity drops below a configurable threshold (per product).

### 3.7 Operating Expenses
- Record general shop operating expenses (rent, utilities, supplies, etc. — exact categories TBD).

### 3.8 End of Day Closing
- Daily cash closing/reconciliation: compare total recorded sales (cash) against the actual cash counted in the drawer, per station/day.

### 3.9 Reporting
- Simple sales reports.
- Barber reports: work done and commission dues per barber, per period.
- **Date filtering:** quick presets (daily / weekly / monthly) plus a fully custom manual date range.
- **Barber performance comparison report:** ranks barbers side by side (e.g. by revenue/services sold) for a given period.
- **Shop Profit/Loss report (Owner only):** calculates and displays shop profitability for a selected period with the following components:
  - Total sales revenue (split: service revenue + product revenue)
  - Cost of Goods Sold (COGS) — using historical product cost prices preserved at sale time
  - Gross Profit = Sales Revenue − COGS
  - Barber commissions (service lines only)
  - Operating expenses
  - Net Shop Profit = Gross Profit − Barber Commissions − Operating Expenses
- The Manager/Trusted Employee role **must not** have access to the Profit/Loss report or any analytical profit reports. Barbers have no access.
- The Profit/Loss report must support the same date filtering presets (daily, weekly, monthly, custom range).
- Reports must be:
  - **Printable on A4 paper** (a standard laser/inkjet printer is already available at the shop — not the thermal XP-80C).
  - **Exportable to Excel.**
  - Displayed in **smart, sortable tables** in the UI.

## 4. Non-Functional Requirements
- **Platform:** Windows 10 and above, desktop application.
- **Offline-first:** No internet dependency for core operation. Local network only used for syncing the two stations.
- **Currency:** Iraqi Dinar (IQD) only for this project (no dual-currency requirement here).
- **Simplicity:** Keep the app lean and practical — avoid unnecessary complexity or features beyond the scope above.
- **Timezone:** All timestamps (sales, commissions, audit log, end-of-day closing, etc.) must be recorded and displayed in **Baghdad time**, regardless of the host machine's system timezone setting.
- **System Activity/Event Log:** Beyond the entity-level audit log (Section 7), the app should keep a general activity log of key system events — logins/logouts, sync events between the two stations, and similar operational events — for troubleshooting.
- **UI/UX — Navigation:** Smooth, responsive switching between tabs/modules (POS, Inventory, Expenses, Reports, etc.) with no noticeable lag.
- **Language & Locale:** Arabic and Kurdish Sorani UI, both RTL. Latin/Western numerals (0123456789). Gregorian calendar.
- **Dashboard:** Owner Station opens to a home dashboard summarizing the day at a glance — sales so far, inventory alerts, etc.
- **Low-stock alerts:** Shown as an in-app indicator/badge (icon with count), not only buried inside the inventory report.

## 5. Explicitly Out of Scope
- Multi-branch / multi-location support.
- Card or deferred/credit payments.
- Customer records (name, phone, visit history).
- Per-sale receipt/ticket printing.
- Appointments/booking system.
- Supplier management (purchasing is manual quantity entry only, no supplier tracking).

## 6. Accounts & Permissions
- **Owner account:** full access — POS, inventory, expenses, reports, commission rate management, and full control over the Manager/Trusted Employee account.
- **Manager / Trusted Employee account (secondary admin-type role):** can add/edit/(soft-)delete **operating expenses** and **sellable products/services**, and can also **process POS sales** (take cash, ring up invoices) on the Owner Station when the owner is absent. **Report access is limited to the End of Day / shift-closing report only** — no access to analytical reports (commission dues, barber performance comparisons, profit reports, etc.).
- **Barber account:** touch-only access on any of the 8 touch stations, via a **personal PIN tied to their identity** (not locked to a specific device) — select a service for a sale, view own daily work/earnings. No access to reports, inventory, or other barbers' data.
- **Barber departure:** when a barber leaves, their account is **deactivated (disabled), never deleted** — all historical sales/commission data remains fully intact and reportable.

## 7. Data Integrity, Corrections & Auditability

This is a first-class requirement: the owner (and the Manager role, within their scope) must have **full control to add/edit/delete operating expenses and sellable products**, with safe recovery from human error.

- **Soft delete only** — deleting an expense or a product never removes it from the database. It's hidden from normal UI lists but remains queryable for reports/reconciliation. No "undo/restore to active list" UI is needed — visibility through reports is enough.
- **Audit log** required for all edits and deletes on **expenses** and **products**: what changed (old value → new value), when, and by whom (owner or which Manager account). Read-only, for review purposes — not tied to the undo requirement above.
- Edits (not just deletes) must also be fully correctable — the owner/manager can change any field of an expense or product after the fact; the audit log is what preserves the trail.

## 8. Data Model Notes for Implementation
- Commission rates must be **effective-dated** (rate + start date, per barber), not a single overwritable field, so historical commission calculations stay correct after a rate change.
- Commission is earned **only on the service portion** of a sale — a sale that also includes a product (rung up at the Owner/Manager Station) must split cleanly so commission calculation only ever touches the service line items, never product line items.
- Inventory items need a **low-stock threshold** field per item. Inventory only ever changes at the Owner/Manager Station (see 3.1), so there is no cross-station inventory conflict to resolve.
- Sales records need a clear **service vs. product** split, since commission logic depends on it.
- Voiding/correcting a sale must be a single transaction that (a) soft-deletes the sale, (b) restores any deducted inventory, and (c) cancels any commission it generated — see 3.5.
- **Product cost price must be preserved on each product sale line** at the time of sale so that historical COGS and profit calculations remain stable even if the product's current cost price is later changed.
- **Sale correction must also reverse financial side effects**: restoring inventory, cancelling commission, and reversing COGS/gross profit impact — all as a single atomic operation.
- Sync design must account for **records created independently across all 9 stations while offline**, then reconciled with the Owner station as the authority once reconnected.
- **Expenses**, **products**, **services**, and **sales/invoices** all need an `is_deleted` (soft-delete) flag rather than physical deletion.
- A dedicated **audit log table** (entity type, entity id, field, old value, new value, changed_by, changed_at) covering expenses, products, services, sales edits/deletes, and commission rate changes.
- Store timestamps in a consistent, unambiguous form (e.g. UTC internally) and always render in **Baghdad time** in the UI and reports — avoids issues if a machine's system timezone is ever misconfigured.
- A separate **system event log table** (event type, details, station, timestamp) for logins/logouts, sync events, etc. — distinct from the entity audit log.
- Invoice/sale totals in IQD are stored and displayed **exactly as calculated, with no rounding** to a currency denomination.
- **Historical financial integrity:** Changing any of the following must NOT retroactively alter previously calculated Profit/Loss results: product selling price, product cost price, barber commission percentage, service price. The sale must preserve all financial values needed to reconstruct the result at the time of sale.
- **Owner withdrawals/distributions** are explicitly excluded from operating expenses and from Net Shop Profit calculations. They are equity distributions, not operating expenses.

## 9. Database & Reliability
- **SQLite with SQLCipher** (encrypted at rest), via `better-sqlite3` + SQLCipher binding — reliable, robust, and fast for a single-shop offline desktop app.

## 10. Technology Stack (Decided)
- **Electron + React + TypeScript**, matching the OmniShop project and the original intended direction for this app.
- **SQLite (better-sqlite3) with SQLCipher** for the local encrypted database.
- **Clean architecture, enforced via tooling**: layered structure (domain / application / infrastructure / presentation), ESLint rules (`max-lines`, `max-lines-per-function`, `complexity`) and Prettier to keep the AI coding agent's output disciplined and consistent.
- **Excel export:** `exceljs`. **Sortable tables:** e.g. TanStack Table. **A4 report printing:** Electron/Chromium's built-in print (HTML/CSS).

## 11. Sync Mechanism (Decided)
- **One-directional outbox pattern**, not full bidirectional sync — justified by the permission model: each Barber Touch Station only *creates* service-sale records (it never edits/deletes, and never touches inventory), so there is no real conflict to resolve.
- Owner Station runs a lightweight embedded local server (Node/Express or Fastify) reachable over the local Wi-Fi network. Each of the 8 Barber Touch Stations queues its own unsent sales locally (outbox table) and pushes them once the Owner Station is reachable.
- Owner Station also pushes down the current **service catalog and prices**, plus the **active barber list/PINs**, to every Barber Touch Station whenever connected, so any touch screen stays usable and accurate even while offline.

## 12. Expense Categories (Decided)
- Expense categories are a **manageable lookup table** (add/edit/soft-delete), not hardcoded.
- Starter seed list: Rent, Utilities (electricity/generator/water), Salaries (non-barber staff), Supplies & consumables, Maintenance, Marketing/advertising, Miscellaneous.

## 13. Authentication (Decided)
- **Barber Touch Stations:** PIN-based login, tied to the barber's identity — the same PIN works on any of the 8 stations (not device-locked). Fast and touch-friendly, appropriate given barbers' limited permissions (create service sales only).
- **Owner/Manager Station:** Username + password — appropriate given access to sensitive financial and reporting data.

## 14. Backup & Restore (Decided)
- **Automatic scheduled local backup** of the encrypted database file (e.g. on each End of Day closing), keeping the **last 30 backups** (roughly a month of daily backups) — the database is small, so this costs negligible disk space while giving a full month of recovery points.
- **Backup/restore destination path is manually chosen by the shop owner** in Settings (not a fixed hardcoded folder) — lets the owner point it at a specific drive/folder, including removable media like a USB stick.
- Manual **"Backup now"** and **"Restore"** actions available in Settings, using that chosen path.
- Cloud sync is a possible future addition, out of scope for v1.

## 15. Shift-Closing Report via WhatsApp (Decided)
- After preparing the End of Day / shift-closing report, the **Manager/Trusted Employee** can send it to the **shop Owner's WhatsApp** via a manual **"Send"** button (not automatic).
- Rationale: the owner often leaves before closing, so the manager closes the shift and forwards the report.
- This is the **one deliberate exception to offline-first**: sending requires an internet connection at the moment of sending. If offline, the send action should fail gracefully with a clear message (e.g. "no internet — try again once connected"), not crash or silently queue indefinitely.
- The owner's WhatsApp number is configured once in Settings.
- **Recommended approach:** use an unofficial WhatsApp Web automation library (e.g. `whatsapp-web.js`, linked via QR code like WhatsApp Web) rather than the official WhatsApp Business API — it's free and simple to set up for a single low-volume manual message, avoiding Meta's Business API approval process and per-message costs that aren't justified for this use case. Trade-off: it's an unofficial integration (session can occasionally need re-linking); acceptable given this is a non-critical, manually-triggered convenience feature.

## 16. Open Questions / Decisions Pending
_None remaining — all major functional, architectural, and calculation decisions have been made as of this version._
