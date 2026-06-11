/* =====================================================================
   Adil Business Solutions — Dashboard
   Sales windows, weekly summary, account balances, recent transactions,
   and two monthly trend charts.
   ===================================================================== */

Router.register("home", async (mount) => {
  const cfg = window.ABS_CONFIG;

  mount.innerHTML = `
    <div class="page-head"><h1>Dashboard</h1><span class="page-sub">${UI.escape(cfg.COMPANY.name)}</span></div>

    <div class="kpi-grid" id="sales-kpis">
      ${salesCard("today", "Today's Sales")}
      ${salesCard("this_week", "This Week Sales")}
      ${salesCard("last_week", "Last Week Sales")}
    </div>

    <div class="kpi-grid">
      ${kpiLink("Items", "0", "box", "items")}
      ${kpiLink("Customers", "0", "users", "customers")}
      ${kpiLink("Low Stock Alerts", "0", "alert", "inventory-alert")}
    </div>

    <div class="card no-pad" id="weekly-summary"></div>

    <div class="dash-two">
      <div class="card no-pad" id="acct-balances"></div>
      <div class="card no-pad" id="recent-tx"></div>
    </div>

    <div class="dash-two" id="dash-charts"></div>

    <div class="card">
      <div id="conn-status" class="conn-status"><span class="dot dot--wait"></span> Checking connection…</div>
    </div>`;

  // clickable KPI cards
  mount.querySelectorAll(".kpi[data-route]").forEach(c => c.onclick = () => Router.go(c.dataset.route));

  const status = mount.querySelector("#conn-status");
  if (!API.configured()) { status.innerHTML = `<span class="dot dot--bad"></span> Backend not configured`; return; }

  const ranges = {};
  try {
    await API.ping();
    status.innerHTML = `<span class="dot dot--ok"></span> Connected`;

    const d = await API.dashboard();
    ranges.today = d.ranges.today; ranges.this_week = d.ranges.this_week; ranges.last_week = d.ranges.last_week;
    setSales(mount, "today", d.today_sales, ranges.today);
    setSales(mount, "this_week", d.this_week_sales, ranges.this_week);
    setSales(mount, "last_week", d.last_week_sales, ranges.last_week);
    setKpiByLabel(mount, "Items", String(d.items_count || 0));
    setKpiByLabel(mount, "Customers", String(d.customers_count || 0));
    setKpiByLabel(mount, "Low Stock Alerts", String(d.low_stock_count || 0));

    mount.querySelectorAll(".sales-edit").forEach(btn => btn.onclick = () => {
      const key = btn.dataset.key;
      openRangeEditor(ranges[key], async (from, to) => {
        mount.querySelector(`.kpi[data-key="${key}"] .kpi-value`).textContent = "…";
        try { const r = await API.salesSummary(from, to); ranges[key] = { from, to }; setSales(mount, key, r.total, ranges[key]); }
        catch (e) { UI.toast(e.message, "error"); setSales(mount, key, 0, ranges[key]); }
      });
    });

    // weekly summary
    try {
      const w = await API.weeklySummary();
      const money = { "Customer Payments": 1, "Supplier Payments": 1 };
      mount.querySelector("#weekly-summary").innerHTML = `
        <div class="card-head" style="padding:14px 16px 0;"><h2>Weekly Transactions Summary</h2></div>
        <div class="table-wrap"><table class="data-table summary-table">
          <thead><tr><th>Title</th>${w.days.map((dd, i) => `<th class="num${i === w.days.length - 1 ? ' col-today' : ''}">${UI.escape(dd)}</th>`).join("")}</tr></thead>
          <tbody>${w.rows.map(r => `<tr><td><strong>${UI.escape(r.title)}</strong></td>${r.values.map((v, i) => `<td class="num${i === w.days.length - 1 ? ' col-today' : ''}">${money[r.title] || Number(v) ? UI.money(v) : 0}</td>`).join("")}</tr>`).join("")}</tbody>
        </table></div>`;
    } catch (e) { mount.querySelector("#weekly-summary").innerHTML = `<div class="empty"><p>Weekly summary unavailable.</p></div>`; }

    // account balances + recent transactions + charts
    try {
      const x = await API.dashboardExtra();

      mount.querySelector("#acct-balances").innerHTML = `
        <div class="card-head" style="padding:14px 16px 0;"><h2>Account Balances</h2></div>
        ${x.accounts.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Account</th><th>Type</th><th class="num">Balance</th></tr></thead>
          <tbody>${x.accounts.map(a => `<tr><td>${UI.escape(a.name)}</td><td>${UI.escape(a.type)}</td><td class="num">${UI.money(a.balance)}</td></tr>`).join("")}</tbody></table></div>`
          : `<div class="empty"><p>No account activity yet.</p></div>`}`;

      const rt = mount.querySelector("#recent-tx");
      rt.innerHTML = `
        <div class="card-head" style="padding:14px 16px 0;"><h2>Recent Transactions</h2></div>
        ${x.recent.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Type</th><th>No.</th><th>Name</th><th class="num">Amount</th></tr></thead>
          <tbody>${x.recent.map(t => `<tr class="rt-row" data-doc="${UI.escape(t.doc || '')}" data-id="${UI.escape(t.id)}"${t.doc ? ' style="cursor:pointer"' : ''}>
            <td>${UI.escape(UI.date(t.date))}</td><td>${UI.escape(t.type)}</td><td>${UI.escape(t.number || '')}</td><td>${UI.escape(t.name || '')}</td><td class="num">${UI.money(t.amount)}</td>
          </tr>`).join("")}</tbody></table></div>`
          : `<div class="empty"><p>No transactions yet.</p></div>`}`;
      rt.querySelectorAll(".rt-row[data-doc]").forEach(r => { if (r.dataset.doc) r.onclick = () => Router.go((r.dataset.doc === "receipt" ? "sales-receipt-detail" : "invoice-detail") + "?id=" + r.dataset.id); });

      const c = x.charts;
      mount.querySelector("#dash-charts").innerHTML =
        dashChart("Sales vs Receivables Collection", c.labels, { name: "Sales", color: "#0f766e", values: c.sales }, { name: "Collection", color: "#f59e0b", values: c.collection }) +
        dashChart("Gross Profit vs Net Income", c.labels, { name: "Gross Profit", color: "#2563eb", values: c.gross_profit }, { name: "Net Income", color: "#16a34a", values: c.net_income });
    } catch (e) { mount.querySelector("#dash-charts").innerHTML = `<div class="card"><div class="empty"><p>Charts unavailable: ${UI.escape(e.message)}</p></div></div>`; }

  } catch (e) {
    status.innerHTML = `<span class="dot dot--bad"></span> Not connected`;
  }
});

/* ---- helpers ---- */
function salesCard(key, label) {
  return `<div class="kpi kpi--sales" data-key="${key}">
    <div class="kpi-icon">${UI.icon("file-text")}</div>
    <div class="kpi-body"><div class="kpi-value">${UI.money(0)}</div><div class="kpi-label">${label}</div><div class="kpi-range"></div></div>
    <button class="btn sales-edit" data-key="${key}" title="Change date range">Edit</button>
  </div>`;
}
function setSales(mount, key, value, range) {
  const card = mount.querySelector(`.kpi[data-key="${key}"]`); if (!card) return;
  card.querySelector(".kpi-value").textContent = UI.money(value || 0);
  const rEl = card.querySelector(".kpi-range");
  if (rEl && range) rEl.textContent = range.from === range.to ? UI.date(range.from) : `${UI.date(range.from)} → ${UI.date(range.to)}`;
}
function kpiLink(label, value, icon, route) {
  return `<div class="kpi kpi--link" data-route="${route}">
    <div class="kpi-icon">${UI.icon(icon)}</div>
    <div class="kpi-body"><div class="kpi-value">${value}</div><div class="kpi-label">${label}</div></div>
    <span class="kpi-go">${UI.icon("chevron-right") || "›"}</span>
  </div>`;
}
function setKpiByLabel(mount, label, value) {
  mount.querySelectorAll(".kpi").forEach(k => { const l = k.querySelector(".kpi-label"); if (l && l.textContent === label) k.querySelector(".kpi-value").textContent = value; });
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
function dashChart(title, labels, sA, sB) {
  const W = 560, H = 240, padL = 8, padR = 8, padT = 12, padB = 26;
  const max = Math.max(1, ...sA.values, ...sB.values);
  const bh = H - padT - padB, gw = (W - padL - padR) / Math.max(1, labels.length);
  const y = v => padT + bh - (v > 0 ? (v / max) * bh : 0);
  let bars = "";
  labels.forEach((lab, i) => {
    const x0 = padL + i * gw, bw = Math.min(16, (gw - 12) / 2);
    const xa = x0 + gw / 2 - bw - 2, xb = x0 + gw / 2 + 2;
    bars += `<rect x="${xa}" y="${y(sA.values[i])}" width="${bw}" height="${padT + bh - y(sA.values[i])}" fill="${sA.color}" rx="2"><title>${UI.escape(lab)} · ${sA.name}: ${UI.money(sA.values[i])}</title></rect>`;
    bars += `<rect x="${xb}" y="${y(sB.values[i])}" width="${bw}" height="${padT + bh - y(sB.values[i])}" fill="${sB.color}" rx="2"><title>${UI.escape(lab)} · ${sB.name}: ${UI.money(sB.values[i])}</title></rect>`;
    bars += `<text x="${x0 + gw / 2}" y="${H - 8}" text-anchor="middle" class="ch-x">${UI.escape(lab)}</text>`;
  });
  return `<div class="card">
    <div class="card-head"><h2>${UI.escape(title)}</h2></div>
    <div class="chart-legend"><span><i style="background:${sA.color}"></i>${UI.escape(sA.name)}</span><span><i style="background:${sB.color}"></i>${UI.escape(sB.name)}</span></div>
    <svg viewBox="0 0 ${W} ${H}" class="dash-chart" preserveAspectRatio="xMidYMid meet">
      <line x1="${padL}" y1="${padT + bh}" x2="${W - padR}" y2="${padT + bh}" class="ch-axis"/>${bars}
    </svg></div>`;
}
