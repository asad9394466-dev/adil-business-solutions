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

    <div class="kpi-grid" id="sales-kpis">
      ${salesCard("today", "Today's Sales")}
      ${salesCard("this_week", "This Week Sales")}
      ${salesCard("last_week", "Last Week Sales")}
    </div>

    <div class="kpi-grid">
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
    </div>`;

  const status = mount.querySelector("#conn-status");
  const detail = mount.querySelector("#conn-detail");

  if (!API.configured()) {
    status.innerHTML = `<span class="dot dot--bad"></span> Backend not configured`;
    detail.innerHTML = `Set <code>API_URL</code> in <code>assets/js/config.js</code>.`;
    return;
  }

  // remember each sales window's range so the Edit button can change it
  const ranges = {};

  try {
    const data = await API.ping();
    status.innerHTML = `<span class="dot dot--ok"></span> Connected`;
    detail.innerHTML = `Backend: <strong>${UI.escape(data.app || "API")}</strong> · version ${UI.escape(data.version || "?")} · server time ${UI.escape(UI.date(data.time))}`;

    const d = await API.dashboard();
    ranges.today = d.ranges.today;
    ranges.this_week = d.ranges.this_week;
    ranges.last_week = d.ranges.last_week;
    setSales(mount, "today", d.today_sales, ranges.today);
    setSales(mount, "this_week", d.this_week_sales, ranges.this_week);
    setSales(mount, "last_week", d.last_week_sales, ranges.last_week);
    setKpiByLabel(mount, "Items", String(d.items_count || 0));
    setKpiByLabel(mount, "Customers", String(d.customers_count || 0));
    setKpiByLabel(mount, "Low Stock Alerts", String(d.low_stock_count || 0));

    // Edit a window's date range
    mount.querySelectorAll(".sales-edit").forEach(btn => btn.onclick = () => {
      const key = btn.dataset.key;
      openRangeEditor(ranges[key], async (from, to) => {
        const card = mount.querySelector(`.kpi[data-key="${key}"] .kpi-value`);
        card.textContent = "…";
        try {
          const r = await API.salesSummary(from, to);
          ranges[key] = { from, to };
          setSales(mount, key, r.total, ranges[key]);
        } catch (e) { UI.toast(e.message, "error"); setSales(mount, key, 0, ranges[key]); }
      });
    });
  } catch (e) {
    status.innerHTML = `<span class="dot dot--bad"></span> Not connected`;
    detail.innerHTML = UI.escape(e.message);
  }
});

function salesCard(key, label) {
  return `<div class="kpi kpi--sales" data-key="${key}">
    <div class="kpi-icon">${UI.icon("file-text")}</div>
    <div class="kpi-body">
      <div class="kpi-value">${UI.money(0)}</div>
      <div class="kpi-label">${label}</div>
      <div class="kpi-range"></div>
    </div>
    <button class="btn sales-edit" data-key="${key}" title="Change date range">Edit</button>
  </div>`;
}
function setSales(mount, key, value, range) {
  const card = mount.querySelector(`.kpi[data-key="${key}"]`);
  if (!card) return;
  card.querySelector(".kpi-value").textContent = UI.money(value || 0);
  const rEl = card.querySelector(".kpi-range");
  if (rEl && range) rEl.textContent = range.from === range.to ? UI.date(range.from) : `${UI.date(range.from)} → ${UI.date(range.to)}`;
}
function kpiCard(label, value, icon) {
  return `<div class="kpi">
    <div class="kpi-icon">${UI.icon(icon)}</div>
    <div class="kpi-body"><div class="kpi-value">${value}</div><div class="kpi-label">${label}</div></div>
  </div>`;
}
function setKpiByLabel(mount, label, value) {
  mount.querySelectorAll(".kpi").forEach(k => {
    const l = k.querySelector(".kpi-label");
    if (l && l.textContent === label) k.querySelector(".kpi-value").textContent = value;
  });
}
function openRangeEditor(range, onApply) {
  const modal = UI.el(`<div class="modal-overlay"><div class="modal">
    <div class="modal-head"><h2>Date range</h2><button class="icon-btn modal-close">✕</button></div>
    <div class="modal-body">
      <label class="field"><span class="field-label">From</span><input type="date" id="rg-from" value="${UI.escape((range && range.from) || '')}"></label>
      <label class="field"><span class="field-label">To</span><input type="date" id="rg-to" value="${UI.escape((range && range.to) || '')}"></label>
    </div>
    <div class="modal-foot"><button class="btn modal-close">Cancel</button><button class="btn btn--primary" id="rg-apply">Apply</button></div>
  </div></div>`);
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelectorAll(".modal-close").forEach(b => b.onclick = close);
  modal.addEventListener("click", e => { if (e.target === modal) close(); });
  modal.querySelector("#rg-apply").onclick = () => {
    const from = modal.querySelector("#rg-from").value, to = modal.querySelector("#rg-to").value;
    if (!from || !to) { UI.toast("Pick both dates.", "error"); return; }
    if (from > to) { UI.toast("From must be before To.", "error"); return; }
    close(); onApply(from, to);
  };
}
