/* =====================================================================
   Adil Business Solutions — Reports
   "All Reports" directory + Company & Financial reports
   (Profit & Loss, Balance Sheet, Trial Balance, Income by Customer,
    Transactions Summary).
   ===================================================================== */

const REPORT_TREE = [
  { category: "Company & Financial", reports: [
    { name: "Profit and Loss Standard", route: "report-pl" },
    { name: "Balance Sheet Standard", route: "report-balance-sheet" },
    { name: "Trial Balance", route: "report-trial-balance" },
    { name: "Income By Customer Summary", route: "report-income-customer" },
    { name: "Transactions Summary", route: "report-transactions-summary" }
  ]},
  { category: "Receivables", reports: [
    { name: "Customer Balance Summary" }, { name: "Payment Collection Summary" },
    { name: "Customer Statement" }, { name: "Account Statement" }
  ]},
  { category: "Payables", reports: [
    { name: "Supplier Balance Summary" }, { name: "Supplier Statement" }
  ]},
  { category: "Accounts", reports: [
    { name: "Journal", route: "general-journal" }, { name: "General Ledger", route: "account-ledger" }
  ]},
  { category: "Inventory", reports: [
    { name: "Items List", route: "items" }, { name: "Quantity On-hand by Warehouse" },
    { name: "Inventory Valuation by Warehouse" }, { name: "Damaged/Expired Inventory Valuation" },
    { name: "Inventory Movement Summary" }, { name: "Stock Status by Vendor" }, { name: "Physical Inventory Worksheet" }
  ]},
  { category: "Sales", reports: [
    { name: "Purchases by Suppliers Summary" }, { name: "Sales by Category Summary" }, { name: "Sales by Items Summary" },
    { name: "Invoices Summary" }, { name: "Sales by Customers Summary" }, { name: "Sales By Representative Summary" },
    { name: "Return Stock By Representative Summary" }, { name: "Sales By Salesman Summary" }, { name: "Invoice Items Summary" },
    { name: "Invoice Batch Print" }, { name: "Customers Items Sales Summary" }, { name: "Customers Discounts Summary" }, { name: "Items Discounts Summary" }
  ]},
  { category: "Sales Orders", reports: [
    { name: "Sales Orders Summary" }, { name: "Open Orders Summary" }
  ]},
  { category: "Other", reports: [
    { name: "Deleted Transactions" }, { name: "Updated Transactions" }
  ]}
];

Router.register("all-reports", (mount) => {
  mount.innerHTML = `
    <div class="page-head"><h1>All Reports</h1><span class="page-sub">Choose a report to run</span></div>
    ${REPORT_TREE.map(cat => `
      <div class="card">
        <div class="card-head"><h2>${UI.escape(cat.category)}</h2></div>
        <div class="report-chips">
          ${cat.reports.map(r => r.route
            ? `<button class="report-chip" data-route="${UI.escape(r.route)}">${UI.escape(r.name)}</button>`
            : `<span class="report-chip report-chip--soon">${UI.escape(r.name)}<em>soon</em></span>`).join("")}
        </div>
      </div>`).join("")}`;
  mount.querySelectorAll(".report-chip[data-route]").forEach(b => b.onclick = () => Router.go(b.dataset.route));
});

/* ---- shared report screen (filter bar + print + render) ---- */
function reportScreen(mount, opt) {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + "01";
  const state = { from: opt.mode === "asof" ? "" : monthStart, to: today };

  const filter = opt.mode === "asof"
    ? `<label class="field"><span class="field-label">As of</span><input type="date" id="r-to" value="${state.to}"></label>`
    : `<label class="field"><span class="field-label">From</span><input type="date" id="r-from" value="${state.from}"></label>
       <label class="field"><span class="field-label">To</span><input type="date" id="r-to" value="${state.to}"></label>`;

  mount.innerHTML = `
    <div class="page-head"><h1>${UI.escape(opt.title)}</h1>
      <div class="page-actions"><button class="btn" id="r-print">Print</button></div>
    </div>
    <div class="card no-print"><div class="form-grid">
      ${filter}
      <div class="field" style="align-self:end"><button class="btn btn--primary" id="r-run">Run report</button></div>
    </div></div>
    <div class="card"><div id="r-body"><div class="empty"><p>Set the dates and run the report.</p></div></div></div>`;

  const run = async () => {
    const body = mount.querySelector("#r-body");
    body.innerHTML = `<div class="conn-status"><span class="dot dot--wait"></span> Running…</div>`;
    const fromEl = mount.querySelector("#r-from"), toEl = mount.querySelector("#r-to");
    if (fromEl) state.from = fromEl.value; if (toEl) state.to = toEl.value;
    try {
      const data = await API.call(opt.action, { from: state.from, to: state.to });
      const co = window.ABS_CONFIG.COMPANY;
      const period = opt.mode === "asof"
        ? `As of ${UI.date(state.to)}`
        : `${UI.date(state.from)} — ${UI.date(state.to)}`;
      body.innerHTML = `<div class="report-doc">
        <div class="report-head"><div class="report-co">${UI.escape(co.name)}</div>
          <div class="report-title">${UI.escape(opt.title)}</div>
          <div class="report-period">${UI.escape(period)}</div></div>
        ${opt.render(data)}
      </div>`;
    } catch (e) { body.innerHTML = `<div class="empty">${UI.icon("alert")}<p>${UI.escape(e.message)}</p></div>`; }
  };
  mount.querySelector("#r-run").onclick = run;
  mount.querySelector("#r-print").onclick = () => window.print();
  run();
}

const moneyR = v => UI.money(v || 0);
function rptRows(lines) {
  return lines.map(l => `<tr><td>${UI.escape(l.account)}</td><td class="num">${moneyR(l.amount)}</td></tr>`).join("");
}

/* ---- Profit & Loss ---- */
Router.register("report-pl", (m) => reportScreen(m, {
  title: "Profit and Loss Standard", action: "reportProfitLoss", mode: "range",
  render: (d) => `<table class="data-table report-table">
    <tbody>
      <tr class="rpt-section"><td colspan="2">Income</td></tr>
      ${rptRows(d.income.lines)}
      <tr class="rpt-subtotal"><td>Total Income</td><td class="num">${moneyR(d.income.total)}</td></tr>
      <tr class="rpt-section"><td colspan="2">Cost of Goods Sold</td></tr>
      ${rptRows(d.cogs.lines)}
      <tr class="rpt-subtotal"><td>Total COGS</td><td class="num">${moneyR(d.cogs.total)}</td></tr>
      <tr class="rpt-total"><td>Gross Profit</td><td class="num">${moneyR(d.gross_profit)}</td></tr>
      <tr class="rpt-section"><td colspan="2">Expenses</td></tr>
      ${rptRows(d.expense.lines)}
      <tr class="rpt-subtotal"><td>Total Expenses</td><td class="num">${moneyR(d.expense.total)}</td></tr>
      <tr class="rpt-total rpt-grand"><td>Net Income</td><td class="num">${moneyR(d.net_income)}</td></tr>
    </tbody></table>`
}));

/* ---- Balance Sheet ---- */
Router.register("report-balance-sheet", (m) => reportScreen(m, {
  title: "Balance Sheet Standard", action: "reportBalanceSheet", mode: "asof",
  render: (d) => `<table class="data-table report-table"><tbody>
      <tr class="rpt-section"><td colspan="2">Assets</td></tr>
      ${rptRows(d.assets.lines)}
      <tr class="rpt-total"><td>Total Assets</td><td class="num">${moneyR(d.total_assets)}</td></tr>
      <tr class="rpt-section"><td colspan="2">Liabilities</td></tr>
      ${rptRows(d.liabilities.lines)}
      <tr class="rpt-subtotal"><td>Total Liabilities</td><td class="num">${moneyR(d.liabilities.total)}</td></tr>
      <tr class="rpt-section"><td colspan="2">Equity</td></tr>
      ${rptRows(d.equity.lines)}
      <tr class="rpt-subtotal"><td>Total Equity</td><td class="num">${moneyR(d.equity.total)}</td></tr>
      <tr class="rpt-total rpt-grand"><td>Total Liabilities &amp; Equity</td><td class="num">${moneyR(d.total_liab_equity)}</td></tr>
    </tbody></table>
    ${Math.abs(d.total_assets - d.total_liab_equity) > 0.5 ? `<p class="muted" style="padding:8px 0">Note: assets and liabilities+equity differ by ${moneyR(d.total_assets - d.total_liab_equity)} — check for unposted opening balances.</p>` : ""}`
}));

/* ---- Trial Balance ---- */
Router.register("report-trial-balance", (m) => reportScreen(m, {
  title: "Trial Balance", action: "reportTrialBalance", mode: "asof",
  render: (d) => `<table class="data-table report-table">
    <thead><tr><th>Account</th><th class="num">Debit</th><th class="num">Credit</th></tr></thead>
    <tbody>${d.lines.map(l => `<tr><td>${UI.escape(l.account)}</td><td class="num">${l.debit ? moneyR(l.debit) : ""}</td><td class="num">${l.credit ? moneyR(l.credit) : ""}</td></tr>`).join("")}
      <tr class="rpt-total rpt-grand"><td>Total</td><td class="num">${moneyR(d.total_debit)}</td><td class="num">${moneyR(d.total_credit)}</td></tr>
    </tbody></table>`
}));

/* ---- Income by Customer ---- */
Router.register("report-income-customer", (m) => reportScreen(m, {
  title: "Income By Customer Summary", action: "reportIncomeByCustomer", mode: "range",
  render: (d) => `<table class="data-table report-table">
    <thead><tr><th>Customer</th><th class="num">Amount</th></tr></thead>
    <tbody>${d.lines.length ? d.lines.map(l => `<tr><td>${UI.escape(l.customer)}</td><td class="num">${moneyR(l.amount)}</td></tr>`).join("") : `<tr><td colspan="2" class="muted">No sales in this period.</td></tr>`}
      <tr class="rpt-total rpt-grand"><td>Total</td><td class="num">${moneyR(d.total)}</td></tr>
    </tbody></table>`
}));

/* ---- Transactions Summary ---- */
Router.register("report-transactions-summary", (m) => reportScreen(m, {
  title: "Transactions Summary", action: "reportTransactionsSummary", mode: "range",
  render: (d) => `<table class="data-table report-table">
    <thead><tr><th>Transaction Type</th><th class="num">Count</th><th class="num">Amount</th></tr></thead>
    <tbody>${d.rows.map(r => `<tr><td>${UI.escape(r.label)}</td><td class="num">${r.count}</td><td class="num">${moneyR(r.total)}</td></tr>`).join("")}</tbody></table>`
}));
