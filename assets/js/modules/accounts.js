/* =====================================================================
   Adil Business Solutions — Accounts (double-entry ledger)
   ===================================================================== */

const ACCOUNT_TYPES = ['Income', 'Expense', 'Bank', 'Equity', 'Accounts Receivable', 'Accounts Payable',
  'Other Current Asset', 'Other Asset', 'Fixed Asset', 'Other Current Liability', 'Long Term Liability',
  'Cost of Goods Sold', 'Other Income', 'Other Expense'];
const PAY_METHODS = ['Cash', 'Check', 'Credit Memo Adjusted', 'Credit Adjusted', 'Online/Bank'];

const Accounts = {
  list: [],
  async load() { this.list = await API.call('accountsList'); return this.list; },
  byId(id) { return this.list.find(a => String(a.id) === String(id)); },
  options(selected, filterType) {
    const items = filterType ? this.list.filter(a => a.account_type === filterType) : this.list;
    return '<option value="">— select —</option>' + items.map(a =>
      `<option value="${UI.escape(a.id)}"${String(a.id) === String(selected) ? ' selected' : ''}>${UI.escape(a.account_name)}</option>`).join('');
  }
};
window.Accounts = Accounts;

function acctErr(mount, what, msg) {
  mount.innerHTML = `<div class="card"><div class="empty">${UI.icon('alert')}<h3>Couldn't load ${UI.escape(what)}</h3><p>${UI.escape(msg)}</p></div></div>`;
}

/* ---------------------------------------------------------------------
   CHART OF ACCOUNTS
--------------------------------------------------------------------- */
Router.register('accounts', async (mount) => {
  UI.loading(true);
  try { await Accounts.load(); } catch (e) { UI.loading(false); acctErr(mount, 'accounts', e.message); return; }
  UI.loading(false);

  mount.innerHTML = `
    <div class="page-head"><h1>Chart of Accounts</h1><span class="page-sub">${Accounts.list.length} accounts</span>
      <div class="page-actions">
        <input id="ac-search" class="search-input" placeholder="Search accounts…">
        <button class="btn btn--primary" id="ac-new">+ New Account</button>
      </div>
    </div>
    <div class="card no-pad"><div class="table-wrap" id="ac-table"></div></div>`;

  const draw = (list) => {
    const t = mount.querySelector('#ac-table');
    t.innerHTML = `<table class="data-table"><thead><tr>
        <th>Num</th><th>Account</th><th>Type</th><th>Active</th><th class="num">Balance</th><th class="actions"></th>
      </tr></thead><tbody>${list.map(a => `
        <tr>
          <td>${UI.escape(a.account_number)}</td>
          <td><button class="link-btn" data-ledger="${UI.escape(a.id)}">${UI.escape(a.account_name)}</button></td>
          <td>${UI.escape(a.account_type)}</td>
          <td>${UI.escape(a.is_active || 'Yes')}</td>
          <td class="num">${UI.money(a.balance)}</td>
          <td class="actions">
            <button class="link-btn" data-edit="${UI.escape(a.id)}">Edit</button>
            <button class="link-btn link-btn--danger" data-del="${UI.escape(a.id)}">Delete</button>
          </td></tr>`).join('')}</tbody></table>`;
    t.querySelectorAll('[data-ledger]').forEach(b => b.onclick = () => Router.go('account-ledger?id=' + b.dataset.ledger));
    t.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => accountForm(Accounts.byId(b.dataset.edit)));
    t.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      if (!confirm('Delete this account?')) return;
      UI.loading(true, 'Deleting…');
      try { await API.call('deleteAccount', { id: b.dataset.del }); UI.loading(false); UI.toast('Deleted.', 'success'); Router.resolve(); }
      catch (e) { UI.loading(false); UI.toast(e.message, 'error'); }
    });
  };
  draw(Accounts.list);
  mount.querySelector('#ac-new').onclick = () => accountForm(null);
  const s = mount.querySelector('#ac-search');
  s.oninput = () => { const q = s.value.trim().toLowerCase(); draw(!q ? Accounts.list : Accounts.list.filter(a => (a.account_name + ' ' + a.account_type + ' ' + a.account_number).toLowerCase().indexOf(q) !== -1)); };
});

function accountForm(acct) {
  const isEdit = !!acct;
  const typeOpts = ACCOUNT_TYPES.map(t => `<option${acct && acct.account_type === t ? ' selected' : ''}>${t}</option>`).join('');
  const parentOpts = '<option value="">— none —</option>' + Accounts.list.map(a =>
    `<option value="${UI.escape(a.id)}"${acct && String(acct.parent_account_id) === String(a.id) ? ' selected' : ''}>${UI.escape(a.account_name)}</option>`).join('');
  const modal = UI.el(`<div class="modal-overlay"><div class="modal">
    <div class="modal-head"><h2>${isEdit ? 'Edit' : 'New'} Account</h2><button class="icon-btn modal-close">✕</button></div>
    <form class="modal-body"><div class="form-grid">
      <label class="field field--wide"><span class="field-label">Account Name <span class="req">*</span></span><input id="af-name" value="${acct ? UI.escape(acct.account_name) : ''}"></label>
      <label class="field"><span class="field-label">Type</span><select id="af-type">${typeOpts}</select></label>
      <label class="field"><span class="field-label">Active</span><select id="af-active"><option${!acct || acct.is_active !== 'No' ? ' selected' : ''}>Yes</option><option${acct && acct.is_active === 'No' ? ' selected' : ''}>No</option></select></label>
      <label class="field field--wide"><span class="field-label">Description</span><input id="af-desc" value="${acct ? UI.escape(acct.description || '') : ''}"></label>
      <label class="field field--wide"><span class="field-label">Sub-account of</span><select id="af-parent">${parentOpts}</select></label>
      ${isEdit ? '' : `<label class="field"><span class="field-label">Opening Balance</span><input id="af-ob" type="number" step="0.01" value="0"></label>
      <label class="field"><span class="field-label">Opening Date</span><input id="af-obdate" type="date" value="${new Date().toISOString().slice(0,10)}"></label>`}
    </div></form>
    <div class="modal-foot"><button class="btn modal-close">Cancel</button><button class="btn btn--primary" id="af-save">${isEdit ? 'Save' : 'Create'}</button></div>
  </div></div>`);
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelectorAll('.modal-close').forEach(b => b.onclick = close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  modal.querySelector('#af-save').onclick = async () => {
    const name = modal.querySelector('#af-name').value.trim();
    if (!name) { UI.toast('Enter an account name.', 'error'); return; }
    const data = { account_name: name, account_type: modal.querySelector('#af-type').value, is_active: modal.querySelector('#af-active').value, description: modal.querySelector('#af-desc').value, parent_account_id: modal.querySelector('#af-parent').value };
    if (!isEdit) { data.opening_balance = modal.querySelector('#af-ob').value; data.opening_date = modal.querySelector('#af-obdate').value; }
    UI.loading(true, 'Saving…');
    try {
      if (isEdit) await API.call('updateAccount', { id: acct.id, data });
      else await API.call('createAccount', { data });
      UI.loading(false); close(); UI.toast('Saved.', 'success'); Router.resolve();
    } catch (e) { UI.loading(false); UI.toast(e.message, 'error'); }
  };
}

/* ---------------------------------------------------------------------
   ACCOUNT LEDGER  (also used by Check Register)
--------------------------------------------------------------------- */
Router.register('account-ledger', async (mount, params) => {
  if (!params.id) { mount.innerHTML = '<div class="card">No account specified.</div>'; return; }
  UI.loading(true);
  let d;
  try { d = await API.call('accountLedger', { id: params.id }); } catch (e) { UI.loading(false); acctErr(mount, 'ledger', e.message); return; }
  UI.loading(false);
  const a = d.account;
  mount.innerHTML = `
    <div class="page-head"><h1>${UI.escape(a.account_name)}</h1><span class="page-sub">${UI.escape(a.account_type)} · balance ${UI.money(d.balance)}</span>
      <div class="page-actions"><button class="btn" onclick="location.hash='#accounts'">← Accounts</button></div>
    </div>
    <div class="card no-pad"><div class="table-wrap">${d.lines.length ? `<table class="data-table"><thead><tr>
      <th>Date</th><th>Entry</th><th>Name</th><th>Memo</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Balance</th>
      </tr></thead><tbody>${d.lines.map(l => `<tr>
        <td>${UI.escape(UI.date(l.date))}</td><td>${UI.escape(l.entry_no)}</td><td>${UI.escape(l.name || '')}</td><td>${UI.escape(l.memo || '')}</td>
        <td class="num">${l.debit ? UI.money(l.debit) : ''}</td><td class="num">${l.credit ? UI.money(l.credit) : ''}</td><td class="num">${UI.money(l.balance)}</td>
      </tr>`).join('')}</tbody></table>` : `<div class="empty">${UI.icon('file-text')}<h3>No transactions</h3><p>This account has no journal entries yet.</p></div>`}</div></div>`;
});

/* ---------------------------------------------------------------------
   GENERAL JOURNAL
--------------------------------------------------------------------- */
Router.register('general-journal', async (mount) => {
  UI.loading(true);
  let lines;
  try { lines = await API.call('journalList'); } catch (e) { UI.loading(false); acctErr(mount, 'general journal', e.message); return; }
  UI.loading(false);
  mount.innerHTML = `
    <div class="page-head"><h1>General Journal</h1><span class="page-sub">${lines.length} lines</span>
      <div class="page-actions"><button class="btn btn--primary" id="gj-new">+ New Entry</button></div></div>
    <div class="card no-pad"><div class="table-wrap">${lines.length ? `<table class="data-table"><thead><tr>
      <th>Date</th><th>Entry No.</th><th>Account</th><th>Name</th><th>Memo</th><th class="num">Debit</th><th class="num">Credit</th>
      </tr></thead><tbody>${lines.map(l => `<tr>
        <td>${UI.escape(UI.date(l.date))}</td><td>${UI.escape(l.entry_no)}</td><td>${UI.escape(l.account_name)}</td>
        <td>${UI.escape(l.name || '')}</td><td>${UI.escape(l.memo || '')}</td>
        <td class="num">${l.debit ? UI.money(l.debit) : ''}</td><td class="num">${l.credit ? UI.money(l.credit) : ''}</td>
      </tr>`).join('')}</tbody></table>` : `<div class="empty">${UI.icon('file-text')}<h3>No journal entries</h3><p>Click “New Entry” to post one.</p></div>`}</div></div>`;
  mount.querySelector('#gj-new').onclick = () => Router.go('new-general-journal-entry');
});

Router.register('new-general-journal-entry', async (mount) => {
  UI.loading(true);
  try { await Accounts.load(); } catch (e) { UI.loading(false); acctErr(mount, 'journal entry', e.message); return; }
  UI.loading(false);
  const state = { date: new Date().toISOString().slice(0, 10), memo: '', lines: [blankJL(), blankJL()] };
  function blankJL() { return { account_id: '', debit: '', credit: '', name: '', memo: '' }; }

  mount.innerHTML = `
    <div class="page-head"><h1>General Journal Entry</h1>
      <div class="page-actions"><button class="btn" id="je-cancel">Cancel</button><button class="btn btn--primary" id="je-save">Save</button></div></div>
    <div class="card"><div class="form-grid">
      <label class="field"><span class="field-label">Transaction Date</span><input type="date" id="je-date" value="${state.date}"></label>
      <label class="field field--wide"><span class="field-label">Memo</span><input id="je-memo"></label>
    </div></div>
    <div class="card no-pad"><div class="table-wrap"><table class="data-table line-table">
      <thead><tr><th style="min-width:200px;">Account</th><th class="num">Debit</th><th class="num">Credit</th><th>Name</th><th>Memo</th><th class="actions"></th></tr></thead>
      <tbody id="je-lines"></tbody>
      <tfoot><tr><th>Totals</th><th class="num" id="je-totDr">0.00</th><th class="num" id="je-totCr">0.00</th><th colspan="3" id="je-balmsg"></th></tr></tfoot>
    </table></div><div class="line-add"><button class="btn" id="je-add">+ Add line</button></div></div>`;

  const linesEl = mount.querySelector('#je-lines');
  const recompute = () => {
    let dr = 0, cr = 0;
    state.lines.forEach(l => { dr += Number(l.debit || 0); cr += Number(l.credit || 0); });
    mount.querySelector('#je-totDr').textContent = UI.money(dr);
    mount.querySelector('#je-totCr').textContent = UI.money(cr);
    mount.querySelector('#je-balmsg').innerHTML = Math.abs(dr - cr) < 0.01 ? '<span class="badge badge--ok">BALANCED</span>' : '<span class="badge badge--bad">OUT BY ' + UI.money(Math.abs(dr - cr)) + '</span>';
  };
  const render = () => {
    linesEl.innerHTML = state.lines.map((l, i) => `<tr data-i="${i}">
      <td><select class="jl-acct">${Accounts.options(l.account_id)}</select></td>
      <td><input class="jl-dr num" type="number" step="0.01" value="${UI.escape(l.debit)}"></td>
      <td><input class="jl-cr num" type="number" step="0.01" value="${UI.escape(l.credit)}"></td>
      <td><input class="jl-name" value="${UI.escape(l.name)}"></td>
      <td><input class="jl-memo" value="${UI.escape(l.memo)}"></td>
      <td class="actions"><button class="link-btn link-btn--danger jl-del">✕</button></td></tr>`).join('');
    linesEl.querySelectorAll('tr').forEach(tr => {
      const i = Number(tr.dataset.i);
      tr.querySelector('.jl-acct').onchange = e => state.lines[i].account_id = e.target.value;
      tr.querySelector('.jl-dr').oninput = e => { state.lines[i].debit = e.target.value; if (e.target.value) { state.lines[i].credit = ''; tr.querySelector('.jl-cr').value = ''; } recompute(); };
      tr.querySelector('.jl-cr').oninput = e => { state.lines[i].credit = e.target.value; if (e.target.value) { state.lines[i].debit = ''; tr.querySelector('.jl-dr').value = ''; } recompute(); };
      tr.querySelector('.jl-name').oninput = e => state.lines[i].name = e.target.value;
      tr.querySelector('.jl-memo').oninput = e => state.lines[i].memo = e.target.value;
      tr.querySelector('.jl-del').onclick = () => { if (state.lines.length <= 2) { state.lines[i] = blankJL(); } else { state.lines.splice(i, 1); } render(); };
    });
    recompute();
  };
  render();
  mount.querySelector('#je-add').onclick = () => { state.lines.push(blankJL()); render(); };
  mount.querySelector('#je-date').onchange = e => state.date = e.target.value;
  mount.querySelector('#je-memo').oninput = e => state.memo = e.target.value;
  mount.querySelector('#je-cancel').onclick = () => Router.go('general-journal');
  mount.querySelector('#je-save').onclick = async () => {
    const lines = state.lines.filter(l => l.account_id && (Number(l.debit) > 0 || Number(l.credit) > 0));
    if (lines.length < 2) { UI.toast('Add at least two account lines.', 'error'); return; }
    let dr = 0, cr = 0; lines.forEach(l => { dr += Number(l.debit || 0); cr += Number(l.credit || 0); });
    if (Math.abs(dr - cr) > 0.01) { UI.toast('Debits must equal credits.', 'error'); return; }
    UI.loading(true, 'Posting…');
    try { await API.call('createJournalEntry', { data: { date: state.date, memo: state.memo, lines } }); UI.loading(false); UI.toast('Entry posted.', 'success'); Router.go('general-journal'); }
    catch (e) { UI.loading(false); UI.toast(e.message, 'error'); }
  };
});

/* ---------------------------------------------------------------------
   RECEIVE PAYMENTS  +  VIEW PAYMENTS
--------------------------------------------------------------------- */
function paymentTabs(active) {
  const tabs = [['receive-payments', 'Receive Payment'], ['view-payments', 'View Payments'], ['show-undeposited-list', 'Record Deposit'], ['view-deposits', 'View Deposits']];
  return `<div class="sub-tabs no-print">${tabs.map(([r, l]) => `<button class="sub-tab${r === active ? ' active' : ''}" data-r="${r}">${l}</button>`).join('')}</div>`;
}
function wireSubTabs(mount) { mount.querySelectorAll('.sub-tab[data-r]').forEach(b => b.onclick = () => Router.go(b.dataset.r)); }
// "Customer Payments" groups the four screens; opening it shows Receive Payment.
Router.register('customer-payments', (m, p) => Router.routes['receive-payments'](m, p));

function acctModal(title, bodyHtml) {
  const modal = UI.el(`<div class="modal-overlay"><div class="modal"><div class="modal-head"><h2>${UI.escape(title)}</h2><button class="icon-btn modal-close">✕</button></div><div class="modal-body">${bodyHtml}</div><div class="modal-foot"><button class="btn modal-close">Close</button></div></div></div>`);
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelectorAll('.modal-close').forEach(b => b.onclick = close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
}
function printReceipt(title, innerHtml) {
  const w = window.open('', '_blank', 'width=440,height=660');
  if (!w) { UI.toast('Allow pop-ups to print.', 'error'); return; }
  w.document.write(`<html><head><title>${UI.escape(title)}</title><style>body{font-family:-apple-system,Segoe UI,Arial,sans-serif;padding:20px;color:#111}table{width:100%;border-collapse:collapse;margin-top:8px}td,th{padding:5px 6px;text-align:left}.num{text-align:right}h2{margin:0 0 2px}.muted{color:#666;font-size:12px}hr{border:none;border-top:1px solid #ddd;margin:10px 0}.tot td{border-top:1px solid #000;font-weight:700}</style></head><body>${innerHtml}<script>window.onload=function(){window.print()};<\/script></body></html>`);
  w.document.close();
}
async function paymentView(id) {
  try {
    const d = await API.call('paymentDetail', { id });
    acctModal('Payment', `<p><strong>${UI.escape(d.customer ? d.customer.name : '')}</strong></p>
      <p class="muted">${UI.escape(UI.date(d.payment.date))} · ${UI.escape(d.payment.method || '')}${d.payment.reference ? ' · Ref ' + UI.escape(d.payment.reference) : ''}</p>
      <table class="data-table"><tbody><tr><td>Invoice</td><td class="num">${UI.escape(d.invoice ? d.invoice.invoice_no : '—')}</td></tr>
      <tr><td>Amount</td><td class="num">${UI.money(d.payment.amount)}</td></tr>
      <tr><td>Status</td><td class="num">${d.payment.is_deposited ? 'Deposited' : 'Undeposited'}</td></tr></tbody></table>
      ${d.payment.notes ? `<p class="muted">${UI.escape(d.payment.notes)}</p>` : ''}`);
  } catch (e) { UI.toast(e.message, 'error'); }
}
async function paymentPrint(id) {
  try {
    const d = await API.call('paymentDetail', { id }), co = window.ABS_CONFIG.COMPANY;
    printReceipt('Payment Receipt', `<h2>${UI.escape(co.name)}</h2><div class="muted">Payment Receipt</div><hr>
      <p>Received from <strong>${UI.escape(d.customer ? d.customer.name : '')}</strong><br>
      Date: ${UI.escape(UI.date(d.payment.date))}<br>Method: ${UI.escape(d.payment.method || '')}${d.payment.reference ? ' · Ref ' + UI.escape(d.payment.reference) : ''}<br>
      Invoice: ${UI.escape(d.invoice ? d.invoice.invoice_no : '—')}</p>
      <table><tr class="tot"><td>Amount Received</td><td class="num">${UI.money(d.payment.amount)}</td></tr></table>`);
  } catch (e) { UI.toast(e.message, 'error'); }
}
async function depositView(id) {
  try {
    const d = await API.call('depositDetail', { id });
    acctModal('Deposit ' + (d.deposit.deposit_no || ''), `<p class="muted">${UI.escape(UI.date(d.deposit.date))} · into ${UI.escape(d.account)}</p>
      <table class="data-table"><thead><tr><th>Customer</th><th>Reference</th><th class="num">Amount</th></tr></thead>
      <tbody>${d.payments.map(p => `<tr><td>${UI.escape(p.customer)}</td><td>${UI.escape(p.reference || '')}</td><td class="num">${UI.money(p.amount)}</td></tr>`).join('')}
      <tr class="rpt-grand"><td colspan="2"><strong>Total</strong></td><td class="num"><strong>${UI.money(d.deposit.total)}</strong></td></tr></tbody></table>`);
  } catch (e) { UI.toast(e.message, 'error'); }
}
async function depositPrint(id) {
  try {
    const d = await API.call('depositDetail', { id }), co = window.ABS_CONFIG.COMPANY;
    printReceipt('Deposit Slip', `<h2>${UI.escape(co.name)}</h2><div class="muted">Deposit Slip ${UI.escape(d.deposit.deposit_no || '')}</div><hr>
      <p>Date: ${UI.escape(UI.date(d.deposit.date))}<br>Deposited to: ${UI.escape(d.account)}</p>
      <table><thead><tr><th>Customer</th><th class="num">Amount</th></tr></thead>
      <tbody>${d.payments.map(p => `<tr><td>${UI.escape(p.customer)}</td><td class="num">${UI.money(p.amount)}</td></tr>`).join('')}
      <tr class="tot"><td>Total</td><td class="num">${UI.money(d.deposit.total)}</td></tr></tbody></table>`);
  } catch (e) { UI.toast(e.message, 'error'); }
}

Router.register('receive-payments', async (mount) => {
  UI.loading(true);
  let customers, invoices;
  try { [customers, invoices] = await Promise.all([API.list('Customers'), API.list('Invoices')]); }
  catch (e) { UI.loading(false); acctErr(mount, 'payments', e.message); return; }
  UI.loading(false);
  const custOpts = '<option value="">— select customer —</option>' + customers.map(c => `<option value="${UI.escape(c.id)}">${UI.escape(c.name)}</option>`).join('');
  const methodOpts = PAY_METHODS.map(m => `<option>${m}</option>`).join('');

  mount.innerHTML = `
    ${paymentTabs('receive-payments')}
    <div class="page-head"><h1>Receive Payment</h1></div>
    <div class="card"><div class="form-grid">
      <label class="field"><span class="field-label">Received From</span><select id="rp-cust">${custOpts}</select></label>
      <label class="field"><span class="field-label">Date</span><input type="date" id="rp-date" value="${new Date().toISOString().slice(0,10)}"></label>
      <label class="field"><span class="field-label">Payment Method</span><select id="rp-method">${methodOpts}</select></label>
      <label class="field"><span class="field-label">Reference No.</span><input id="rp-ref"></label>
      <label class="field field--wide"><span class="field-label">Memo</span><input id="rp-memo"></label>
    </div></div>
    <div class="card no-pad"><div class="table-wrap" id="rp-table"><div class="empty">${UI.icon('users')}<h3>Select a customer</h3><p>Their unpaid invoices will appear here.</p></div></div></div>
    <div class="totals-row"><div></div><div class="totals-box">
      <div class="totals-line"><span>Lump sum (split equally)</span><span><input id="rp-lump" class="mini-input" type="number" step="0.01" placeholder="0.00"><button class="btn" id="rp-split" style="margin-left:6px">Split</button></span></div>
      <div class="totals-line totals-grand"><span>Total Received</span><span id="rp-total" class="num">0.00</span></div>
      <div class="line-add" style="border:none;padding:8px 0 0;"><button class="btn btn--primary btn--block" id="rp-save">Receive Payment</button></div>
    </div></div>`;
  wireSubTabs(mount);

  const tableEl = mount.querySelector('#rp-table');
  let rows = [];
  const recompute = () => {
    let total = 0;
    tableEl.querySelectorAll('.rp-amt').forEach(inp => { total += Number(inp.value || 0); });
    mount.querySelector('#rp-total').textContent = UI.money(total);
  };
  mount.querySelector('#rp-cust').onchange = (e) => {
    const cid = e.target.value;
    rows = invoices.filter(inv => String(inv.customer_id) === String(cid) && Number(inv.balance) > 0 && String(inv.status) !== 'deleted');
    if (!rows.length) { tableEl.innerHTML = `<div class="empty">${UI.icon('check')}<h3>No unpaid invoices</h3></div>`; recompute(); return; }
    tableEl.innerHTML = `<table class="data-table"><thead><tr>
      <th>Date</th><th>Invoice No.</th><th class="num">Total</th><th class="num">Paid</th><th class="num">Amount Due</th><th class="num">Amount to Pay</th>
      </tr></thead><tbody>${rows.map(inv => `<tr>
        <td>${UI.escape(UI.date(inv.date))}</td><td>${UI.escape(inv.invoice_no)}</td>
        <td class="num">${UI.money(inv.total)}</td><td class="num">${UI.money(inv.paid)}</td><td class="num">${UI.money(inv.balance)}</td>
        <td><input class="rp-amt num" data-inv="${UI.escape(inv.id)}" data-bal="${UI.escape(inv.balance)}" type="number" step="0.01" value="${UI.escape(inv.balance)}"></td>
      </tr>`).join('')}</tbody></table>`;
    tableEl.querySelectorAll('.rp-amt').forEach(inp => inp.oninput = recompute);
    recompute();
  };

  mount.querySelector('#rp-split').onclick = () => {
    const lump = Number(mount.querySelector('#rp-lump').value || 0);
    const inputs = Array.from(tableEl.querySelectorAll('.rp-amt'));
    if (lump <= 0) { UI.toast('Enter a lump sum amount first.', 'error'); return; }
    if (!inputs.length) { UI.toast('Select a customer with unpaid invoices.', 'error'); return; }
    const bals = inputs.map(inp => Number(inp.dataset.bal || 0));
    const alloc = inputs.map(() => 0);
    let remaining = lump, active = inputs.map((_, i) => i);
    while (remaining > 0.005 && active.length) {
      const share = remaining / active.length;
      let progressed = false; const next = [];
      active.forEach(i => {
        const room = bals[i] - alloc[i];
        const give = Math.min(share, room);
        alloc[i] += give; remaining -= give;
        if (bals[i] - alloc[i] > 0.005) next.push(i);
        if (give > 0.0001) progressed = true;
      });
      active = next; if (!progressed) break;
    }
    inputs.forEach((inp, i) => inp.value = alloc[i].toFixed(2));
    recompute();
    if (remaining > 0.5) UI.toast(`Note: ${UI.money(remaining)} exceeds the total due and was not allocated.`, 'info');
  };

  mount.querySelector('#rp-save').onclick = async () => {
    const cid = mount.querySelector('#rp-cust').value;
    if (!cid) { UI.toast('Select a customer.', 'error'); return; }
    const allocations = [];
    tableEl.querySelectorAll('.rp-amt').forEach(inp => { const amt = Number(inp.value || 0); if (amt > 0) allocations.push({ invoice_id: inp.dataset.inv, amount: amt }); });
    if (!allocations.length) { UI.toast('Enter an amount to pay.', 'error'); return; }
    UI.loading(true, 'Recording payment…');
    try {
      await API.call('recordPayment', { data: { customer_id: cid, date: mount.querySelector('#rp-date').value, method: mount.querySelector('#rp-method').value, reference: mount.querySelector('#rp-ref').value, memo: mount.querySelector('#rp-memo').value, allocations } });
      UI.loading(false); UI.toast('Payment recorded.', 'success'); Router.go('view-payments');
    } catch (e) { UI.loading(false); UI.toast(e.message, 'error'); }
  };
});

Router.register('view-payments', async (mount) => {
  UI.loading(true);
  let pays;
  try { pays = await API.call('paymentsList'); } catch (e) { UI.loading(false); acctErr(mount, 'payments', e.message); return; }
  UI.loading(false);
  mount.innerHTML = `
    ${paymentTabs('view-payments')}
    <div class="page-head"><h1>View Payments</h1><span class="page-sub">${pays.length}</span>
      <div class="page-actions"><button class="btn btn--primary" onclick="location.hash='#receive-payments'">Receive Payment</button></div></div>
    <div class="card no-pad"><div class="table-wrap">${pays.length ? `<table class="data-table"><thead><tr>
      <th>Date</th><th>Reference</th><th>Customer</th><th>Method</th><th class="num">Amount</th><th>Deposited</th><th class="actions"></th>
      </tr></thead><tbody>${pays.map(p => `<tr>
        <td>${UI.escape(UI.date(p.date))}</td><td>${UI.escape(p.reference || '')}</td><td>${UI.escape(p.customer)}</td>
        <td>${UI.escape(p.method || '')}</td><td class="num">${UI.money(p.amount)}</td>
        <td>${p.is_deposited ? '<span class="badge badge--ok">Deposited</span>' : '<span class="badge badge--warn">Undeposited</span>'}</td>
        <td class="actions">
          <button class="link-btn" data-view="${UI.escape(p.id)}">View</button>
          <button class="link-btn" data-edit="${UI.escape(p.id)}">Edit</button>
          <button class="link-btn" data-print="${UI.escape(p.id)}">Print</button>
          <button class="link-btn link-btn--danger" data-del="${UI.escape(p.id)}">Delete</button>
        </td>
      </tr>`).join('')}</tbody></table>` : `<div class="empty">${UI.icon('file-text')}<h3>No payments yet</h3></div>`}</div></div>`;
  wireSubTabs(mount);
  mount.querySelectorAll('[data-view]').forEach(b => b.onclick = () => paymentView(b.dataset.view));
  mount.querySelectorAll('[data-print]').forEach(b => b.onclick = () => paymentPrint(b.dataset.print));
  mount.querySelectorAll('[data-edit]').forEach(b => b.onclick = async () => {
    if (!confirm('Editing removes this payment so you can re-enter it correctly. Continue?')) return;
    UI.loading(true, 'Removing…');
    try { await API.call('deletePayment', { id: b.dataset.edit }); UI.loading(false); UI.toast('Removed — please re-enter the payment.', 'success'); Router.go('receive-payments'); }
    catch (e) { UI.loading(false); UI.toast(e.message, 'error'); }
  });
  mount.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (!confirm('Delete this payment? Its ledger posting will be reversed and the invoice balance restored.')) return;
    UI.loading(true, 'Deleting…');
    try { await API.call('deletePayment', { id: b.dataset.del }); UI.loading(false); UI.toast('Payment deleted.', 'success'); Router.resolve(); }
    catch (e) { UI.loading(false); UI.toast(e.message, 'error'); }
  });
});

/* ---------------------------------------------------------------------
   RECORD DEPOSIT  +  VIEW DEPOSITS
--------------------------------------------------------------------- */
Router.register('show-undeposited-list', async (mount) => {
  UI.loading(true);
  let undeposited;
  try { await Accounts.load(); undeposited = await API.call('undepositedList'); } catch (e) { UI.loading(false); acctErr(mount, 'deposits', e.message); return; }
  UI.loading(false);
  const bankOpts = Accounts.list.filter(a => a.account_type === 'Bank').map(a => `<option value="${UI.escape(a.id)}">${UI.escape(a.account_name)}</option>`).join('');

  if (!undeposited.length) {
    mount.innerHTML = `${paymentTabs('show-undeposited-list')}<div class="page-head"><h1>Payments to Deposit</h1></div><div class="card"><div class="empty">${UI.icon('check')}<h3>No payments to deposit</h3><p>Recorded customer payments awaiting deposit appear here.</p></div></div>`;
    wireSubTabs(mount);
    return;
  }
  mount.innerHTML = `
    ${paymentTabs('show-undeposited-list')}
    <div class="page-head"><h1>Payments to Deposit</h1></div>
    <div class="card"><div class="form-grid">
      <label class="field"><span class="field-label">Deposit To</span><select id="dp-acct">${bankOpts}</select></label>
      <label class="field"><span class="field-label">Date</span><input type="date" id="dp-date" value="${new Date().toISOString().slice(0,10)}"></label>
      <label class="field field--wide"><span class="field-label">Memo</span><input id="dp-memo"></label>
    </div></div>
    <div class="card no-pad"><div class="table-wrap"><table class="data-table"><thead><tr>
      <th><input type="checkbox" id="dp-all"></th><th>Date</th><th>Customer</th><th>Reference</th><th class="num">Amount</th>
      </tr></thead><tbody>${undeposited.map(p => `<tr>
        <td><input type="checkbox" class="dp-line" data-id="${UI.escape(p.id)}" data-amt="${UI.escape(p.amount)}"></td>
        <td>${UI.escape(UI.date(p.date))}</td><td>${UI.escape(p.customer)}</td><td>${UI.escape(p.reference || '')}</td><td class="num">${UI.money(p.amount)}</td>
      </tr>`).join('')}</tbody></table></div></div>
    <div class="totals-row"><div></div><div class="totals-box">
      <div class="totals-line totals-grand"><span>Total to Deposit</span><span id="dp-total" class="num">0.00</span></div>
      <div class="line-add" style="border:none;padding:8px 0 0;"><button class="btn btn--primary btn--block" id="dp-save">Deposit</button></div>
    </div></div>`;

  const recompute = () => {
    let t = 0; mount.querySelectorAll('.dp-line:checked').forEach(c => t += Number(c.dataset.amt || 0));
    mount.querySelector('#dp-total').textContent = UI.money(t);
  };
  mount.querySelectorAll('.dp-line').forEach(c => c.onchange = recompute);
  wireSubTabs(mount);
  mount.querySelector('#dp-all').onchange = (e) => { mount.querySelectorAll('.dp-line').forEach(c => c.checked = e.target.checked); recompute(); };
  mount.querySelector('#dp-save').onclick = async () => {
    const ids = Array.from(mount.querySelectorAll('.dp-line:checked')).map(c => c.dataset.id);
    if (!ids.length) { UI.toast('Select payments to deposit.', 'error'); return; }
    const acct = mount.querySelector('#dp-acct').value;
    if (!acct) { UI.toast('Select a bank account.', 'error'); return; }
    UI.loading(true, 'Depositing…');
    try { await API.call('recordDeposit', { data: { account_id: acct, date: mount.querySelector('#dp-date').value, memo: mount.querySelector('#dp-memo').value, payment_ids: ids } }); UI.loading(false); UI.toast('Deposited.', 'success'); Router.go('view-deposits'); }
    catch (e) { UI.loading(false); UI.toast(e.message, 'error'); }
  };
});

Router.register('view-deposits', async (mount) => {
  UI.loading(true);
  let deps;
  try { deps = await API.call('depositsList'); } catch (e) { UI.loading(false); acctErr(mount, 'deposits', e.message); return; }
  UI.loading(false);
  mount.innerHTML = `
    ${paymentTabs('view-deposits')}
    <div class="page-head"><h1>View Deposits</h1><span class="page-sub">${deps.length}</span></div>
    <div class="card no-pad"><div class="table-wrap">${deps.length ? `<table class="data-table"><thead><tr>
      <th>Date</th><th>Deposit No.</th><th>Deposited To</th><th>Memo</th><th class="num">Amount</th><th class="actions"></th>
      </tr></thead><tbody>${deps.map(d => `<tr>
        <td>${UI.escape(UI.date(d.date))}</td><td>${UI.escape(d.deposit_no)}</td><td>${UI.escape(d.account_name)}</td><td>${UI.escape(d.memo || '')}</td><td class="num">${UI.money(d.total)}</td>
        <td class="actions">
          <button class="link-btn" data-view="${UI.escape(d.id)}">View</button>
          <button class="link-btn" data-edit="${UI.escape(d.id)}">Edit</button>
          <button class="link-btn" data-print="${UI.escape(d.id)}">Print</button>
          <button class="link-btn link-btn--danger" data-del="${UI.escape(d.id)}">Delete</button>
        </td>
      </tr>`).join('')}</tbody></table>` : `<div class="empty">${UI.icon('file-text')}<h3>No deposits yet</h3></div>`}</div></div>`;
  wireSubTabs(mount);
  mount.querySelectorAll('[data-view]').forEach(b => b.onclick = () => depositView(b.dataset.view));
  mount.querySelectorAll('[data-print]').forEach(b => b.onclick = () => depositPrint(b.dataset.print));
  mount.querySelectorAll('[data-edit]').forEach(b => b.onclick = async () => {
    if (!confirm('Editing removes this deposit (returning its payments to undeposited) so you can redo it. Continue?')) return;
    UI.loading(true, 'Removing…');
    try { await API.call('deleteDeposit', { id: b.dataset.edit }); UI.loading(false); UI.toast('Removed — re-create the deposit.', 'success'); Router.go('show-undeposited-list'); }
    catch (e) { UI.loading(false); UI.toast(e.message, 'error'); }
  });
  mount.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (!confirm('Delete this deposit? Its payments return to undeposited and the ledger posting is reversed.')) return;
    UI.loading(true, 'Deleting…');
    try { await API.call('deleteDeposit', { id: b.dataset.del }); UI.loading(false); UI.toast('Deposit deleted.', 'success'); Router.resolve(); }
    catch (e) { UI.loading(false); UI.toast(e.message, 'error'); }
  });
});

/* ---------------------------------------------------------------------
   TRANSFER FUNDS
--------------------------------------------------------------------- */
Router.register('transfer-funds', async (mount) => {
  UI.loading(true);
  let transfers;
  try { await Accounts.load(); transfers = await API.call('transfersList'); } catch (e) { UI.loading(false); acctErr(mount, 'transfers', e.message); return; }
  UI.loading(false);
  mount.innerHTML = `
    <div class="page-head"><h1>Funds Transfers</h1><span class="page-sub">${transfers.length}</span>
      <div class="page-actions"><button class="btn btn--primary" id="tf-new">+ New Fund Transfer</button></div></div>
    <div class="card no-pad"><div class="table-wrap">${transfers.length ? `<table class="data-table"><thead><tr>
      <th>Date</th><th>From Account</th><th>To Account</th><th>Memo</th><th class="num">Amount</th>
      </tr></thead><tbody>${transfers.map(t => `<tr>
        <td>${UI.escape(UI.date(t.date))}</td><td>${UI.escape(t.from_account_name)}</td><td>${UI.escape(t.to_account_name)}</td><td>${UI.escape(t.memo || '')}</td><td class="num">${UI.money(t.amount)}</td>
      </tr>`).join('')}</tbody></table>` : `<div class="empty">${UI.icon('layers')}<h3>No transfers yet</h3></div>`}</div></div>`;
  mount.querySelector('#tf-new').onclick = () => {
    const opts = Accounts.options('');
    const modal = UI.el(`<div class="modal-overlay"><div class="modal">
      <div class="modal-head"><h2>New Funds Transfer</h2><button class="icon-btn modal-close">✕</button></div>
      <form class="modal-body"><div class="form-grid">
        <label class="field"><span class="field-label">Date</span><input type="date" id="tf-date" value="${new Date().toISOString().slice(0,10)}"></label>
        <label class="field"><span class="field-label">Amount</span><input type="number" step="0.01" id="tf-amt" value="0"></label>
        <label class="field"><span class="field-label">From Account</span><select id="tf-from">${opts}</select></label>
        <label class="field"><span class="field-label">To Account</span><select id="tf-to">${opts}</select></label>
        <label class="field field--wide"><span class="field-label">Memo</span><input id="tf-memo"></label>
      </div></form>
      <div class="modal-foot"><button class="btn modal-close">Cancel</button><button class="btn btn--primary" id="tf-save">Create</button></div>
    </div></div>`);
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelectorAll('.modal-close').forEach(b => b.onclick = close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    modal.querySelector('#tf-save').onclick = async () => {
      UI.loading(true, 'Transferring…');
      try {
        await API.call('transferFunds', { data: { date: modal.querySelector('#tf-date').value, amount: modal.querySelector('#tf-amt').value, from_account_id: modal.querySelector('#tf-from').value, to_account_id: modal.querySelector('#tf-to').value, memo: modal.querySelector('#tf-memo').value } });
        UI.loading(false); close(); UI.toast('Transfer recorded.', 'success'); Router.resolve();
      } catch (e) { UI.loading(false); UI.toast(e.message, 'error'); }
    };
  };
});

/* ---------------------------------------------------------------------
   CHECK REGISTER  (pick an account → its ledger)
--------------------------------------------------------------------- */
Router.register('check-register', async (mount) => {
  UI.loading(true);
  try { await Accounts.load(); } catch (e) { UI.loading(false); acctErr(mount, 'check register', e.message); return; }
  UI.loading(false);
  const bankOpts = Accounts.list.filter(a => a.account_type === 'Bank').map(a => `<option value="${UI.escape(a.id)}">${UI.escape(a.account_name)}</option>`).join('');
  mount.innerHTML = `
    <div class="page-head"><h1>Check Register</h1></div>
    <div class="card"><div class="form-grid">
      <label class="field"><span class="field-label">Account</span><select id="cr-acct">${bankOpts}</select></label>
      <label class="field" style="align-self:end;"><button class="btn btn--primary" id="cr-go">View Register</button></label>
    </div></div>`;
  mount.querySelector('#cr-go').onclick = () => { const id = mount.querySelector('#cr-acct').value; if (id) Router.go('account-ledger?id=' + id); };
});

/* ---------------------------------------------------------------------
   PAY BILLS / VIEW PAID BILLS  — depend on the Bills (Purchases) phase
--------------------------------------------------------------------- */
function billsPending(mount, title) {
  mount.innerHTML = `<div class="page-head"><h1>${title}</h1></div>
    <div class="card"><div class="empty">${UI.icon('truck')}<h3>Arrives with the Purchases phase</h3>
    <p>${title} needs the <strong>Bills</strong> screen, which is built in the Purchases phase. Once bills exist, supplier payments will post to the ledger here.</p></div></div>`;
}
Router.register('pay-bills', (m) => billsPending(m, 'Pay Bills'));
Router.register('view-paid-bills', (m) => billsPending(m, 'View Paid Bills'));
