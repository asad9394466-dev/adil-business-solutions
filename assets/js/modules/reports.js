/* =====================================================================
   Adil Business Solutions — Reports
   All Reports directory, category pages, and report screens for
   Company & Financial, Receivables, Payables and Accounts.
   ===================================================================== */

const REPORT_TREE = [
  { category: "Company & Financial", route: "reports-company-financial", reports: [
    { name: "Profit and Loss Standard", route: "report-pl" },
    { name: "Balance Sheet Standard", route: "report-balance-sheet" },
    { name: "Trial Balance", route: "report-trial-balance" },
    { name: "Income By Customer Summary", route: "report-income-customer" },
    { name: "Transactions Summary", route: "report-transactions-summary" }
  ]},
  { category: "Receivables", route: "reports-receivables", reports: [
    { name: "Customer Balance Summary", route: "report-customer-balances" },
    { name: "Payment Collection Summary", route: "report-payment-collection" },
    { name: "Customer Statement", route: "report-customer-statement" },
    { name: "Account Statement", route: "report-account-statement" }
  ]},
  { category: "Payables", route: "reports-payables", reports: [
    { name: "Supplier Balance Summary", route: "report-supplier-balances" },
    { name: "Supplier Statement", route: "report-supplier-statement" }
  ]},
  { category: "Accounts", route: "reports-accounts", reports: [
    { name: "Journal", route: "report-journal" },
    { name: "General Ledger", route: "report-general-ledger" }
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
  ]}
];

function reportChips(cat) {
  return `<div class="report-chips">${cat.reports.map(r => r.route
    ? `<button class="report-chip" data-route="${UI.escape(r.route)}">${UI.escape(r.name)}</button>`
    : `<span class="report-chip report-chip--soon">${UI.escape(r.name)}<em>soon</em></span>`).join("")}</div>`;
}

Router.register("all-reports", (mount) => {
  mount.innerHTML = `
    <div class="page-head"><h1>All Reports</h1><span class="page-sub">Choose a report to run</span></div>
    ${REPORT_TREE.map(cat => `<div class="card"><div class="card-head"><h2>${UI.escape(cat.category)}</h2></div>${reportChips(cat)}</div>`).join("")}`;
  mount.querySelectorAll(".report-chip[data-route]").forEach(b => b.onclick = () => Router.go(b.dataset.route));
});

// category landing pages
function reportCategoryPage(mount, categoryName) {
  const cat = REPORT_TREE.find(c => c.category === categoryName);
  mount.innerHTML = `
    <div class="page-head"><h1>${UI.escape(categoryName)}</h1><span class="page-sub">Reports</span></div>
    <div class="card">${reportChips(cat)}</div>`;
  mount.querySelectorAll(".report-chip[data-route]").forEach(b => b.onclick = () => Router.go(b.dataset.route));
}
Router.register("reports-company-financial", (m) => reportCategoryPage(m, "Company & Financial"));
Router.register("reports-receivables", (m) => reportCategoryPage(m, "Receivables"));
Router.register("reports-payables", (m) => reportCategoryPage(m, "Payables"));
Router.register("reports-accounts", (m) => reportCategoryPage(m, "Accounts"));

/* ---- shared report screen ---- */
function reportScreen(mount, opt) {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + "01";
  const state = { from: opt.mode === "asof" ? "" : monthStart, to: today, pick: opt.picker && opt.picker.options[0] ? opt.picker.options[0].value : "" };

  const dateFilter = opt.mode === "asof"
    ? `<label class="field"><span class="field-label">As of</span><input type="date" id="r-to" value="${state.to}"></label>`
    : `<label class="field"><span class="field-label">From</span><input type="date" id="r-from" value="${state.from}"></label>
       <label class="field"><span class="field-label">To</span><input type="date" id="r-to" value="${state.to}"></label>`;
  const pickFilter = opt.picker
    ? `<label class="field"><span class="field-label">${UI.escape(opt.picker.label)}</span><select id="r-pick">${opt.picker.options.map(o => `<option value="${UI.escape(o.value)}">${UI.escape(o.label)}</option>`).join("")}</select></label>`
    : "";

  mount.innerHTML = `
    <div class="page-head"><h1>${UI.escape(opt.title)}</h1>
      <div class="page-actions"><button class="btn" id="r-print">Print</button></div>
    </div>
    <div class="card no-print"><div class="form-grid">
      ${pickFilter}${dateFilter}
      <div class="field" style="align-self:end"><button class="btn btn--primary" id="r-run">Run report</button></div>
    </div></div>
    <div class="card"><div id="r-body"><div class="empty"><p>Set the filters and run the report.</p></div></div></div>`;

  const run = async () => {
    const body = mount.querySelector("#r-body");
    body.innerHTML = `<div class="conn-status"><span class="dot dot--wait"></span> Running…</div>`;
    const fromEl = mount.querySelector("#r-from"), toEl = mount.querySelector("#r-to"), pickEl = mount.querySelector("#r-pick");
    if (fromEl) state.from = fromEl.value; if (toEl) state.to = toEl.value; if (pickEl) state.pick = pickEl.value;
    const params = { from: state.from, to: state.to };
    if (opt.picker) params[opt.picker.paramKey] = state.pick;
    try {
      const data = await API.call(opt.action, params);
      const co = window.ABS_CONFIG.COMPANY;
      const period = opt.mode === "asof" ? `As of ${UI.date(state.to)}` : `${UI.date(state.from)} — ${UI.date(state.to)}`;
      body.innerHTML = `<div class="report-doc">
        <div class="report-head"><div class="report-co">${UI.escape(co.name)}</div>
          <div class="report-title">${UI.escape(opt.title)}${data.name ? " — " + UI.escape(data.name) : ""}</div>
          <div class="report-period">${UI.escape(period)}</div></div>
        ${data.need_pick ? `<div class="empty"><p>Please choose a ${UI.escape(opt.picker.label.toLowerCase())} above.</p></div>` : opt.render(data)}
      </div>`;
    } catch (e) { body.innerHTML = `<div class="empty">${UI.icon("alert")}<p>${UI.escape(e.message)}</p></div>`; }
  };
  mount.querySelector("#r-run").onclick = run;
  mount.querySelector("#r-print").onclick = () => window.print();
  run();
}

const moneyR = v => UI.money(v || 0);
const rptRows = lines => lines.map(l => `<tr><td>${UI.escape(l.account)}</td><td class="num">${moneyR(l.amount)}</td></tr>`).join("");
const stmtRows = lines => lines.map(l => `<tr><td>${UI.escape(UI.date(l.date))}</td><td>${UI.escape(l.type || l.number || "")}</td><td>${UI.escape(l.number || "")}</td><td class="num">${l.debit ? moneyR(l.debit) : ""}</td><td class="num">${l.credit ? moneyR(l.credit) : ""}</td><td class="num">${moneyR(l.balance)}</td></tr>`).join("");

/* picker loaders */
async function customerOptions() { const c = await API.list("Customers"); return c.map(x => ({ value: x.id, label: x.name })); }
async function supplierOptions() { const s = await API.list("Suppliers"); return s.map(x => ({ value: x.id, label: x.name })); }
async function accountOptions() { const a = await API.list("Accounts"); return a.map(x => ({ value: x.id, label: x.account_name })); }

/* ===================== Company & Financial ===================== */
Router.register("report-pl", (m) => reportScreen(m, { title: "Profit and Loss Standard", action: "reportProfitLoss", mode: "range",
  render: (d) => `<table class="data-table report-table"><tbody>
    <tr class="rpt-section"><td colspan="2">Income</td></tr>${rptRows(d.income.lines)}
    <tr class="rpt-subtotal"><td>Total Income</td><td class="num">${moneyR(d.income.total)}</td></tr>
    <tr class="rpt-section"><td colspan="2">Cost of Goods Sold</td></tr>${rptRows(d.cogs.lines)}
    <tr class="rpt-subtotal"><td>Total COGS</td><td class="num">${moneyR(d.cogs.total)}</td></tr>
    <tr class="rpt-total"><td>Gross Profit</td><td class="num">${moneyR(d.gross_profit)}</td></tr>
    <tr class="rpt-section"><td colspan="2">Expenses</td></tr>${rptRows(d.expense.lines)}
    <tr class="rpt-subtotal"><td>Total Expenses</td><td class="num">${moneyR(d.expense.total)}</td></tr>
    <tr class="rpt-total rpt-grand"><td>Net Income</td><td class="num">${moneyR(d.net_income)}</td></tr></tbody></table>` }));

Router.register("report-balance-sheet", (m) => reportScreen(m, { title: "Balance Sheet Standard", action: "reportBalanceSheet", mode: "asof",
  render: (d) => `<table class="data-table report-table"><tbody>
    <tr class="rpt-section"><td colspan="2">Assets</td></tr>${rptRows(d.assets.lines)}
    <tr class="rpt-total"><td>Total Assets</td><td class="num">${moneyR(d.total_assets)}</td></tr>
    <tr class="rpt-section"><td colspan="2">Liabilities</td></tr>${rptRows(d.liabilities.lines)}
    <tr class="rpt-subtotal"><td>Total Liabilities</td><td class="num">${moneyR(d.liabilities.total)}</td></tr>
    <tr class="rpt-section"><td colspan="2">Equity</td></tr>${rptRows(d.equity.lines)}
    <tr class="rpt-subtotal"><td>Total Equity</td><td class="num">${moneyR(d.equity.total)}</td></tr>
    <tr class="rpt-total rpt-grand"><td>Total Liabilities &amp; Equity</td><td class="num">${moneyR(d.total_liab_equity)}</td></tr></tbody></table>` }));

Router.register("report-trial-balance", (m) => reportScreen(m, { title: "Trial Balance", action: "reportTrialBalance", mode: "asof",
  render: (d) => `<table class="data-table report-table"><thead><tr><th>Account</th><th class="num">Debit</th><th class="num">Credit</th></tr></thead>
    <tbody>${d.lines.map(l => `<tr><td>${UI.escape(l.account)}</td><td class="num">${l.debit ? moneyR(l.debit) : ""}</td><td class="num">${l.credit ? moneyR(l.credit) : ""}</td></tr>`).join("")}
    <tr class="rpt-total rpt-grand"><td>Total</td><td class="num">${moneyR(d.total_debit)}</td><td class="num">${moneyR(d.total_credit)}</td></tr></tbody></table>` }));

Router.register("report-income-customer", (m) => reportScreen(m, { title: "Income By Customer Summary", action: "reportIncomeByCustomer", mode: "range",
  render: (d) => `<table class="data-table report-table"><thead><tr><th>Customer</th><th class="num">Amount</th></tr></thead>
    <tbody>${d.lines.length ? d.lines.map(l => `<tr><td>${UI.escape(l.customer)}</td><td class="num">${moneyR(l.amount)}</td></tr>`).join("") : `<tr><td colspan="2" class="muted">No sales in this period.</td></tr>`}
    <tr class="rpt-total rpt-grand"><td>Total</td><td class="num">${moneyR(d.total)}</td></tr></tbody></table>` }));

Router.register("report-transactions-summary", (m) => reportScreen(m, { title: "Transactions Summary", action: "reportTransactionsSummary", mode: "range",
  render: (d) => `<table class="data-table report-table"><thead><tr><th>Transaction Type</th><th class="num">Count</th><th class="num">Amount</th></tr></thead>
    <tbody>${d.rows.map(r => `<tr><td>${UI.escape(r.label)}</td><td class="num">${r.count}</td><td class="num">${moneyR(r.total)}</td></tr>`).join("")}</tbody></table>` }));

/* ===================== Receivables ===================== */
Router.register("report-customer-balances", (m) => reportScreen(m, { title: "Customer Balance Summary", action: "reportCustomerBalances", mode: "range",
  render: (d) => `<table class="data-table report-table"><thead><tr><th>Customer</th><th class="num">Invoiced</th><th class="num">Paid</th><th class="num">Balance</th></tr></thead>
    <tbody>${d.lines.map(l => `<tr><td>${UI.escape(l.customer)}</td><td class="num">${moneyR(l.invoiced)}</td><td class="num">${moneyR(l.paid)}</td><td class="num">${moneyR(l.balance)}</td></tr>`).join("")}
    <tr class="rpt-total rpt-grand"><td>Total</td><td class="num">${moneyR(d.total_invoiced)}</td><td class="num">${moneyR(d.total_paid)}</td><td class="num">${moneyR(d.total_balance)}</td></tr></tbody></table>` }));

Router.register("report-payment-collection", (m) => reportScreen(m, { title: "Payment Collection Summary", action: "reportPaymentCollection", mode: "range",
  render: (d) => `<table class="data-table report-table"><thead><tr><th>Date</th><th>Customer</th><th>Reference</th><th>Method</th><th class="num">Amount</th></tr></thead>
    <tbody>${d.lines.length ? d.lines.map(l => `<tr><td>${UI.escape(UI.date(l.date))}</td><td>${UI.escape(l.customer)}</td><td>${UI.escape(l.reference)}</td><td>${UI.escape(l.method)}</td><td class="num">${moneyR(l.amount)}</td></tr>`).join("") : `<tr><td colspan="5" class="muted">No payments in this period.</td></tr>`}
    <tr class="rpt-total rpt-grand"><td colspan="4">Total Collected</td><td class="num">${moneyR(d.total)}</td></tr></tbody></table>` }));

async function customerStatementRoute(m) { reportScreen(m, { title: "Customer Statement", action: "reportCustomerStatement", mode: "range",
  picker: { label: "Customer", paramKey: "id", options: await customerOptions() },
  render: (d) => `<p class="muted">Opening balance: ${moneyR(d.opening)}</p>
    <table class="data-table report-table"><thead><tr><th>Date</th><th>Type</th><th>No.</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Balance</th></tr></thead>
    <tbody>${d.lines.length ? stmtRows(d.lines) : `<tr><td colspan="6" class="muted">No activity in this period.</td></tr>`}
    <tr class="rpt-total rpt-grand"><td colspan="5">Closing Balance</td><td class="num">${moneyR(d.closing)}</td></tr></tbody></table>` }); }
Router.register("report-customer-statement", customerStatementRoute);

async function accountStatementRoute(m) { reportScreen(m, { title: "Account Statement", action: "reportAccountStatement", mode: "range",
  picker: { label: "Account", paramKey: "id", options: await accountOptions() },
  render: (d) => `<p class="muted">Opening balance: ${moneyR(d.opening)}</p>
    <table class="data-table report-table"><thead><tr><th>Date</th><th>Entry</th><th>Memo</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Balance</th></tr></thead>
    <tbody>${d.lines.length ? d.lines.map(l => `<tr><td>${UI.escape(UI.date(l.date))}</td><td>${UI.escape(l.number || "")}</td><td>${UI.escape(l.memo || "")}</td><td class="num">${l.debit ? moneyR(l.debit) : ""}</td><td class="num">${l.credit ? moneyR(l.credit) : ""}</td><td class="num">${moneyR(l.balance)}</td></tr>`).join("") : `<tr><td colspan="6" class="muted">No entries in this period.</td></tr>`}
    <tr class="rpt-total rpt-grand"><td colspan="5">Closing Balance</td><td class="num">${moneyR(d.closing)}</td></tr></tbody></table>` }); }
Router.register("report-account-statement", accountStatementRoute);

/* ===================== Payables ===================== */
Router.register("report-supplier-balances", (m) => reportScreen(m, { title: "Supplier Balance Summary", action: "reportSupplierBalances", mode: "range",
  render: (d) => `<table class="data-table report-table"><thead><tr><th>Supplier</th><th class="num">Billed</th><th class="num">Paid</th><th class="num">Balance</th></tr></thead>
    <tbody>${d.lines.map(l => `<tr><td>${UI.escape(l.supplier)}</td><td class="num">${moneyR(l.billed)}</td><td class="num">${moneyR(l.paid)}</td><td class="num">${moneyR(l.balance)}</td></tr>`).join("")}
    <tr class="rpt-total rpt-grand"><td>Total</td><td class="num">${moneyR(d.total_billed)}</td><td class="num">${moneyR(d.total_paid)}</td><td class="num">${moneyR(d.total_balance)}</td></tr></tbody></table>` }));

async function supplierStatementRoute(m) { reportScreen(m, { title: "Supplier Statement", action: "reportSupplierStatement", mode: "range",
  picker: { label: "Supplier", paramKey: "id", options: await supplierOptions() },
  render: (d) => `<p class="muted">Opening balance: ${moneyR(d.opening)}</p>
    <table class="data-table report-table"><thead><tr><th>Date</th><th>Type</th><th>No.</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Balance</th></tr></thead>
    <tbody>${d.lines.length ? stmtRows(d.lines) : `<tr><td colspan="6" class="muted">No activity in this period.</td></tr>`}
    <tr class="rpt-total rpt-grand"><td colspan="5">Closing Balance</td><td class="num">${moneyR(d.closing)}</td></tr></tbody></table>` }); }
Router.register("report-supplier-statement", supplierStatementRoute);

/* ===================== Accounts ===================== */
Router.register("report-journal", (m) => reportScreen(m, { title: "Journal", action: "reportJournal", mode: "range",
  render: (d) => `<table class="data-table report-table"><thead><tr><th>Date</th><th>Entry No</th><th>Account</th><th class="num">Debit</th><th class="num">Credit</th><th>Memo</th></tr></thead>
    <tbody>${d.lines.length ? d.lines.map(l => `<tr><td>${UI.escape(UI.date(l.date))}</td><td>${UI.escape(l.entry_no || "")}</td><td>${UI.escape(l.account)}</td><td class="num">${l.debit ? moneyR(l.debit) : ""}</td><td class="num">${l.credit ? moneyR(l.credit) : ""}</td><td>${UI.escape(l.memo || "")}</td></tr>`).join("") : `<tr><td colspan="6" class="muted">No journal entries in this period.</td></tr>`}
    <tr class="rpt-total rpt-grand"><td colspan="3">Total</td><td class="num">${moneyR(d.total_debit)}</td><td class="num">${moneyR(d.total_credit)}</td><td></td></tr></tbody></table>` }));

Router.register("report-general-ledger", (m) => reportScreen(m, { title: "General Ledger", action: "reportGeneralLedger", mode: "range",
  render: (d) => d.accounts.length ? d.accounts.map(a => `
    <table class="data-table report-table" style="margin-bottom:18px">
      <thead><tr><th colspan="6" class="gl-acct">${UI.escape(a.account)} <span class="muted">(${UI.escape(a.type)}) · opening ${moneyR(a.opening)}</span></th></tr>
      <tr><th>Date</th><th>Entry</th><th>Memo</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Balance</th></tr></thead>
      <tbody>${a.lines.map(l => `<tr><td>${UI.escape(UI.date(l.date))}</td><td>${UI.escape(l.number || "")}</td><td>${UI.escape(l.memo || "")}</td><td class="num">${l.debit ? moneyR(l.debit) : ""}</td><td class="num">${l.credit ? moneyR(l.credit) : ""}</td><td class="num">${moneyR(l.balance)}</td></tr>`).join("")}
      <tr class="rpt-subtotal"><td colspan="5">Closing balance</td><td class="num">${moneyR(a.closing)}</td></tr></tbody>
    </table>`).join("") : `<div class="empty"><p>No ledger activity in this period.</p></div>` }));
