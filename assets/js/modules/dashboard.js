/* =====================================================================
   Adil Business Solutions — Dashboard (Phase 0)
   Shows a live connection test to the backend plus placeholder KPIs.
   In later phases this fills with real sales / stock figures.
   ===================================================================== */

Router.register("home", async (mount) => {
  const cfg = window.ABS_CONFIG;

  mount.innerHTML = `
    <div class="page-head">
      <h1>Dashboard</h1>
      <span class="page-sub">${UI.escape(cfg.COMPANY.name)}</span>
    </div>

    <div class="kpi-grid">
      ${kpiCard("Today's Sales", UI.money(0), "file-text")}
      ${kpiCard("Items", "0", "box")}
      ${kpiCard("Customers", "0", "users")}
      ${kpiCard("Low Stock Alerts", "0", "alert")}
    </div>

    <div class="card">
      <div class="card-head"><h2>System status</h2></div>
      <div id="conn-status" class="conn-status">
        <span class="dot dot--wait"></span> Checking backend connection…
      </div>
      <div id="conn-detail" class="conn-detail"></div>
    </div>

    <div class="card">
      <div class="card-head"><h2>Welcome</h2></div>
      <p class="muted">Adil Business Solutions is live and well past the foundation stage.
      The shell, login and Google Sheets backend are wired up, and the core modules are built:
      Items, Customers &amp; Suppliers; Invoices and Sales Receipts; the full double-entry
      Accounts engine (Chart of Accounts, journal, payments, deposits, transfers); and now
      <strong>Purchasing</strong> — Purchase Orders and Bills. Use the menu to jump into any module.</p>
    </div>`;

  // live connection test
  const status = mount.querySelector("#conn-status");
  const detail = mount.querySelector("#conn-detail");

  if (!API.configured()) {
    status.innerHTML = `<span class="dot dot--bad"></span> Backend not configured`;
    detail.innerHTML = `Set <code>API_URL</code> in <code>assets/js/config.js</code> to your
      deployed Web App URL. See <code>docs/SETUP.md</code>.`;
    return;
  }

  try {
    const data = await API.ping();
    status.innerHTML = `<span class="dot dot--ok"></span> Connected`;
    detail.innerHTML = `Backend: <strong>${UI.escape(data.app || "API")}</strong> ·
      version ${UI.escape(data.version || "?")} ·
      server time ${UI.escape(UI.date(data.time))}`;
    // try to fill KPIs if the dashboard endpoint is available
    try {
      const d = await API.dashboard();
      setKpi(mount, 0, UI.money(d.todays_sales || 0));
      setKpi(mount, 1, String(d.items_count || 0));
      setKpi(mount, 2, String(d.customers_count || 0));
      setKpi(mount, 3, String(d.low_stock_count || 0));
    } catch { /* dashboard data optional in Phase 0 */ }
  } catch (e) {
    status.innerHTML = `<span class="dot dot--bad"></span> Not connected`;
    detail.innerHTML = UI.escape(e.message);
  }
});

function kpiCard(label, value, icon) {
  return `<div class="kpi">
    <div class="kpi-icon">${UI.icon(icon)}</div>
    <div class="kpi-body"><div class="kpi-value">${value}</div><div class="kpi-label">${label}</div></div>
  </div>`;
}
function setKpi(mount, i, value) {
  const v = mount.querySelectorAll(".kpi-value")[i];
  if (v) v.textContent = value;
}
