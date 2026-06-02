# Adil Business Solutions — Project Blueprint

*A rebuilt, lightweight version of the Diyar invoicing/inventory system. Static front-end hosted on GitHub Pages, Google Sheets backend, designed to migrate to a real domain and database later.*

**Status:** Planning. No code written yet. This document is the agreed plan to build against.

---

## 1. Goals

- Recreate the useful core of the Diyar system, rebranded as **Adil Business Solutions**.
- Host the front-end on **GitHub Pages** now (free, static), move to a purchased domain later.
- Use **Google Sheets** as the database for the first version, accessed through a Google Apps Script Web App.
- Build so the backend can be **swapped later** (Sheets → a real database) without rewriting the front-end.

---

## 2. Guiding principles

1. **No build step.** Plain HTML, CSS, and JavaScript so GitHub Pages serves it directly and you can edit any file by hand. No Node build pipeline to maintain.
2. **One clean API contract.** The front-end never talks to Google Sheets directly. It calls a small set of JSON endpoints. When you move to your own server + database later, we keep the same endpoints and only replace what's behind them — the front-end barely changes.
3. **Phased delivery.** Each phase produces something working and usable before we move on. No giant half-finished dump.
4. **Honest scope.** This is a capable invoicing + inventory + customer/supplier system. It is **not** a full double-entry accounting engine (chart of accounts, general ledger, trial balance, balance sheet). That part of Diyar needs a real server and database and is deliberately out of scope for the Sheets version. Flagged again in section 10.

---

## 3. Architecture

```
   ┌─────────────────────────────┐
   │   Browser (your users)      │
   │   GitHub Pages static site  │   ← HTML / CSS / JS
   │   "Adil Business Solutions" │
   └──────────────┬──────────────┘
                  │  HTTPS (fetch, JSON)
                  ▼
   ┌─────────────────────────────┐
   │  Google Apps Script Web App │   ← the "API". One URL.
   │  doGet() / doPost()         │
   └──────────────┬──────────────┘
                  │  reads/writes rows
                  ▼
   ┌─────────────────────────────┐
   │   Google Sheet (the "DB")   │   ← one tab per table
   │   Items, Customers, Invoices…│
   └─────────────────────────────┘
```

- **Front-end:** a single-page app using hash routing (`#home`, `#invoices`, `#new-invoice`, `#customers`, …) exactly like the original Diyar shell. Clicking a menu item loads that screen into a content area.
- **Backend:** one Apps Script Web App bound to one Google Sheet. It exposes a small JSON API. It runs as you (the sheet owner), so users never touch the sheet directly.
- **Config:** a single `config.js` file holds the Web App URL, company defaults, and branding. The only file you edit when the backend URL changes.

---

## 4. Technology choices

| Layer | Choice | Why |
|---|---|---|
| Markup/layout | HTML5 + Bootstrap 5 (via CDN) | Familiar (Diyar used Bootstrap), responsive, no build step |
| Logic | Vanilla JavaScript (ES modules) | Editable by hand, hostable anywhere, no framework lock-in |
| Item/customer pickers | Choices.js or Select2 | Searchable dropdowns like the original |
| Tables/lists | Simple custom render (DataTables optional later) | Keep it light |
| Invoice printing | Browser print + a print stylesheet (jsPDF later if needed) | Clean printed invoices without heavy tooling |
| Backend | Google Apps Script Web App | Free, sits on the Sheet, returns JSON |
| Database | Google Sheet (one tab per table) | Free, you already understand it, easy to inspect/back up |

---

## 5. Data model (Google Sheet tabs)

Each tab is a table. Row 1 is the header. Every record gets an `id` (timestamp- or counter-based). Dates stored as ISO text (`YYYY-MM-DD`).

**Master data**
- **Items** — `id, sku, name, category_id, brand_id, uom_id, cost_price, regular_price, wholesale_price, tax_type_id, reorder_level, expiry_date, status, created_at`
- **Categories** — `id, name, parent_id`
- **Brands** — `id, name`
- **UOM** — `id, name, abbreviation`
- **TaxTypes** — `id, name, rate_percent`
- **Customers** — `id, name, phone, email, address, area, opening_balance, credit_limit, price_list, status, created_at`
- **Suppliers** — `id, name, phone, email, address, opening_balance, status, created_at`

**Transactions**
- **Invoices** — `id, invoice_no, date, customer_id, subtotal, discount, tax, total, paid, balance, status, notes, created_by, created_at`
- **InvoiceItems** — `id, invoice_id, item_id, description, qty, unit_price, discount, line_total`
- **Payments** — `id, date, customer_id, invoice_id, amount, method, reference, notes`
- **StockMovements** — `id, date, item_id, type (in/out/adjust), qty, reference_type, reference_id, notes`

**System**
- **Users** — `id, username, password_hash, name, role, status`
- **Settings** — key/value (company name, address, phone, currency, invoice prefix, default tax, logo URL)
- **Counters** — `name, value` (for sequential invoice numbers, locked on write)

Phases below switch these tabs on progressively — we don't need them all on day one.

---

## 6. API contract (Apps Script)

One Web App URL. Actions passed as parameters / JSON body.

**Generic CRUD (works for any table):**
- `list` — `{ entity }` → all rows (with optional `search`, `page`)
- `get` — `{ entity, id }` → one row
- `create` — `{ entity, data }` → new row + id
- `update` — `{ entity, id, data }` → updated row
- `delete` — `{ entity, id }` → soft-delete (set `status=deleted`)

**Special endpoints (do more than one thing safely):**
- `createInvoice` — writes the Invoice **and** its InvoiceItems **and** StockMovements together, gets the next invoice number under a lock
- `recordPayment` — writes a Payment and updates the invoice's `paid`/`balance`
- `nextNumber` — returns and increments a counter atomically (LockService)
- `dashboard` — returns summary figures (today's sales, low-stock count, receivables, recent invoices)
- `login` — validates username/password against the Users tab, returns a session token

Standard response shape: `{ ok: true, data: ... }` or `{ ok: false, error: "..." }`.

---

## 7. Module map (what's in, what's out)

**In scope (we build these):**
- Dashboard (sales summary, low-stock alerts, recent activity)
- Items / Inventory (list, search, add/edit, stock levels, reorder alerts, expiry)
- Categories, Brands, UOM, Tax Types (settings)
- Customers (list, add/edit, balances, statement)
- Suppliers (list, add/edit, balances)
- Invoices (create, list, view, print, record payment)
- Quotations & Sales Orders (same engine as invoices, different status)
- Sales Receipts & Credit Memos / Refunds
- Purchase Orders, Bills, Expenses (supplier side)
- Stock adjustments and transfers
- Reports: sales by item/customer/date, inventory valuation, customer & supplier balances, statements
- Company settings, users, basic roles

**Out of scope for the Sheets version (need a real database later):**
- Full double-entry accounting: Chart of Accounts, General Journal, General Ledger, Trial Balance, Profit & Loss, Balance Sheet
- Banking (transfer funds, check register, deposits) as true ledger entries
- High-volume / many simultaneous users
- E-commerce configs (slideshow, campaigns) and bulk SMS — only if you actually want them

---

## 8. Phased delivery plan

**Phase 0 — Foundations**
- GitHub repo + Pages turned on
- App shell rebranded "Adil Business Solutions": header, left menu, hash router, content area, login screen
- Google Sheet template created with all tabs
- Apps Script Web App skeleton + connection test (front-end successfully reads/writes one test row)

**Phase 1 — Master data**
- Items (+ Categories, Brands, UOM, Tax Types)
- Customers
- Suppliers
- Full CRUD, search, lists

**Phase 2 — Invoicing (the core)**
- New Invoice screen: pick customer, search-add items, qty/price/line discount, subtotal/discount/tax/total
- Sequential invoice numbers
- Invoice list, view, **printable invoice**
- Record payment + customer balance

**Phase 3 — Inventory**
- Stock movements wired into invoices/purchases
- Inventory alerts (reorder level), expiry tracking
- Stock adjustments and transfers

**Phase 4 — Wider transactions**
- Quotations, Sales Orders, Sales Receipts, Credit Memos
- Purchase Orders, Bills, Expenses

**Phase 5 — Reports**
- Sales (by item/customer/date), inventory valuation, balances, statements

**Phase 6 — Later / optional**
- Accounting-lite or migration to a real database for true accounting
- Multi-store, e-commerce, SMS — only if wanted

---

## 9. Branding — Adil Business Solutions

- Name in the header (replacing the Diyar logo), a placeholder logo, and a favicon.
- A clean, professional palette (proposed: a business blue/slate base with a single accent — easy to change). Tell me if you have brand colours or a logo and I'll build around them.
- English first; Urdu language toggle later (the original had EN/UR), since you may want both.

---

## 10. Security, limits and risks (read this)

- **Tokens are visible.** Anything the front-end uses to call the backend can be seen by a determined user. For real protection we restrict the Web App to specific Google accounts (Google sign-in) rather than a shared password. We'll decide auth style in Phase 0.
- **Customer data lives in a Google Sheet.** Keep sheet sharing locked down, and back it up. Standard data-protection care applies for names/phones/addresses.
- **Apps Script limits:** roughly 6-minute execution cap, daily quotas, and ~1–3 seconds per call. Fine for a small business; not for thousands of rapid operations.
- **No real transactions:** we use `LockService` so two people can't grab the same invoice number or corrupt stock at the same time. Careful sequencing covers the rest.
- **Data volume:** Sheets stay responsive into the low tens of thousands of rows. Beyond that is the signal to move to a real database.

---

## 11. Migration to your own domain later

When you buy hosting:

1. **Keep the front-end as-is** — copy the static files to the new host (or keep them on GitHub Pages pointed at your domain).
2. **Swap the backend** behind the same API contract:
   - Easiest: a hosted database service (e.g. Supabase or Firebase) — minimal front-end change.
   - Or a traditional host (PHP/Node + MySQL) if you want full accounting like the original Diyar.
3. Because the front-end only knows the API (section 6), this is a backend swap, not a rebuild.

---

## 12. Proposed repo structure

```
adil-business-solutions/
├─ index.html              # app shell
├─ login.html              # login screen
├─ assets/
│  ├─ css/  app.css        # styles + print stylesheet
│  ├─ img/  logo, favicon
│  └─ js/
│     ├─ config.js         # Web App URL, company defaults, branding
│     ├─ api.js            # the only file that talks to the backend
│     ├─ router.js         # hash routing
│     ├─ ui.js             # shared helpers (tables, modals, toasts)
│     └─ modules/          # items.js, customers.js, invoices.js, ...
├─ backend/
│  └─ Code.gs              # Apps Script (kept here for version control)
├─ docs/                   # this blueprint + setup notes
└─ README.md
```

---

## 13. What I need from you before Phase 0

1. **Auth style:** shared login (simple, less secure) or Google sign-in restricted to specific accounts (more secure)?
2. **Branding:** any logo/colours for Adil Business Solutions, or shall I propose a clean professional default?
3. **Languages:** English only to start, or English + Urdu toggle from the beginning?
4. **Company details** for the invoice header/footer (name, address, phone, currency, tax %, invoice number prefix).

Once you're happy with this plan and say the word, I'll start **Phase 0** and hand you the files plus exact step-by-step setup (create the Sheet, paste the Apps Script, deploy, drop the URL into `config.js`, push to GitHub).
