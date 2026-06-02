# Adil Business Solutions

A lightweight invoicing & inventory system. Static front-end (hostable on GitHub Pages),
Google Sheets backend via Google Apps Script. Rebuilt and rebranded from the Diyar system,
designed to migrate to a real domain + database later without rewriting the front-end.

**This is Phase 0 — Foundations:** app shell, login, hash router, and a working backend with
a one-click setup and a live connection test on the dashboard.

## Quick start

See **[docs/SETUP.md](docs/SETUP.md)** for the full 15-minute setup.

Short version:
1. Create a Google Sheet → Extensions → Apps Script → paste `backend/Code.gs` → run `setup()`.
2. Deploy as a Web app ("Anyone") and copy the `/exec` URL.
3. Paste that URL into `assets/js/config.js` (`API_URL`).
4. Push to GitHub, enable Pages, open the site, sign in (`admin` / `admin123`).

## Structure

```
index.html              app shell entry point
assets/
  css/app.css           refined admin theme + print scaffold
  js/
    config.js           API URL, company details, branding, menu   ← you edit this
    api.js              the only module that talks to the backend
    router.js           hash routing
    ui.js               shared helpers (icons, toasts, formatting)
    app.js              bootstrap: login / app chrome
    modules/
      dashboard.js      Phase 0 dashboard + connection test
backend/
  Code.gs               Google Apps Script (setup + JSON API)
docs/
  SETUP.md              step-by-step deployment
  Adil-Business-Solutions-Blueprint.md   the full project plan
```

## Roadmap

- **Phase 0** ✅ Foundations (this)
- **Phase 1** Items, Customers, Suppliers
- **Phase 2** Invoicing (create, list, print, payments)
- **Phase 3** Inventory (stock movements, alerts)
- **Phase 4** Quotations, Sales Orders, Purchases, Bills, Expenses
- **Phase 5** Reports
- **Phase 6** Migration to own domain / database; optional accounting

## Notes

- No build step. Plain HTML/CSS/JS — edit and push.
- The front-end never touches the Sheet directly; it only calls the API in `api.js`.
  That's what makes the future backend swap easy.
