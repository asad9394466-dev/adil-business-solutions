/* =====================================================================
   Adil Business Solutions — Operations (Phase 5)
     • Expenses            — pay an expense; Dr expense account(s),
                             Cr the payment (cash/bank) account.
     • Inventory Transfer  — move stock between warehouses (no ledger).
     • Inventory Adjustment— correct stock counts/value; posts the value
                             change against a chosen account vs Inventory.
     • Claims              — log a customer warranty/return claim.
   Reuses quickModal / newSupplierModal / newItemModal / itemOptions from
   purchasing.js (loaded earlier).
   ===================================================================== */

const Operations = {
  items: [], warehouses: [], stores: [], customers: [], accounts: [],

  async preload() {
    const [items, warehouses, stores, customers, accounts] = await Promise.all([
      API.list('Items'), API.list('Warehouses'), API.list('Stores'),
      API.list('Customers'), API.list('Accounts')
    ]);
    this.items = items; this.warehouses = warehouses; this.stores = stores;
    this.customers = customers; this.accounts = accounts;
    // keep the shared item list (used by itemOptions) in sync
    if (window.Purchasing) Purchasing.items = items;
  },
  customerName(id, f) { const c = this.customers.find(x => String(x.id) === String(id)); return c ? c.name : (f || '—'); },
  storeName(id, f) { const s = this.stores.find(x => String(x.id) === String(id)); return s ? s.store_name : (f || '—'); },
  accountName(id, f) { const a = this.accounts.find(x => String(x.id) === String(id)); return a ? a.account_name : (f || '—'); },
  itemCost(id) { const it = this.items.find(x => String(x.id) === String(id)); return it && it.cost_price !== '' ? Number(it.cost_price || 0) : 0; }
};

function opErr(mount, what, msg) {
  mount.innerHTML = `<div class="card"><div class="empty">${UI.icon('alert')}<h3>Couldn't load ${UI.escape(what)}</h3><p>${UI.escape(msg)}</p></div></div>`;
}
function opItemOptions(sel) {
  return '<option value="">— item —</option>' +
    Operations.items.map(it => `<option value="${UI.escape(it.id)}"${String(it.id) === String(sel) ? ' selected' : ''}>${UI.escape(it.name)}${it.sku ? ' (' + UI.escape(it.sku) + ')' : ''}</option>`).join('') +
    '<option value="__new__">＋ New item…</option>';
}
function whOptions(sel) {
  return '<option value="">— warehouse —</option>' +
    Operations.warehouses.map(w => `<option value="${UI.escape(w.warehouse_name)}"${String(w.warehouse_name) === String(sel) ? ' selected' : ''}>${UI.escape(w.warehouse_name)}</option>`).join('');
}
function storeOptionsOp(sel) {
  return '<option value="">— none —</option>' +
    Operations.stores.map(s => `<option value="${UI.escape(s.id)}"${String(s.id) === String(sel) ? ' selected' : ''}>${UI.escape(s.store_name)}</option>`).join('');
}

// quick customer add (Name / Phone) for the Claims screen
function newCustomerModalOp(onCreated) {
  quickModal('New Customer', `
    <label class="field field--wide"><span class="field-label">Name <span class="req">*</span></span><input id="qc-name"></label>
    <label class="field field--wide"><span class="field-label">Phone</span><input id="qc-phone"></label>`,
    async (modal, close) => {
      const name = modal.querySelector('#qc-name').value.trim();
      if (!name) { UI.toast('Customer name is required.', 'error'); return; }
      UI.loading(true, 'Creating customer…');
      try {
        const rec = await API.create('Customers', { name, phone: modal.querySelector('#qc-phone').value.trim() });
        Operations.customers.push(rec);
        UI.loading(false); UI.toast('Customer created.', 'success'); close(); onCreated(rec);
      } catch (e) { UI.loading(false); throw e; }
    });
}

/* =====================================================================
   GENERIC SIMPLE LIST (used by all four)
   ===================================================================== */
function opList(mount, cfg) {
  return (async () => {
    UI.loading(true);
    let rows;
    try { await Operations.preload(); rows = await API.list(cfg.entity); }
    catch (e) { UI.loading(false); opErr(mount, cfg.plural, e.message); return; }
    UI.loading(false);
    rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

    mount.innerHTML = `
      <div class="page-head"><h1>${UI.escape(cfg.plural)}</h1><span class="page-sub" id="op-count"></span>
        <div class="page-actions">
          <input id="op-search" class="search-input" placeholder="Search ${UI.escape(cfg.plural.toLowerCase())}…">
          <button class="btn btn--primary" id="op-new">+ New ${UI.escape(cfg.singular)}</button>
        </div>
      </div>
      <div class="card no-pad"><div class="table-wrap" id="op-table"></div></div>`;
    mount.querySelector('#op-new').onclick = () => Router.go(cfg.newRoute);

    let q = '';
    const draw = (list) => {
      document.getElementById('op-count').textContent = `${list.length} ${list.length === 1 ? cfg.singular.toLowerCase() : cfg.plural.toLowerCase()}`;
      const t = document.getElementById('op-table');
      if (!list.length) { t.innerHTML = `<div class="empty">${UI.icon('file-text')}<h3>No ${UI.escape(cfg.plural.toLowerCase())}</h3><p>Click “New ${UI.escape(cfg.singular)}” to create one.</p></div>`; return; }
      t.innerHTML = `<table class="data-table"><thead><tr>
          ${cfg.columns.map(c => `<th${c.num ? ' class="num"' : ''}>${UI.escape(c.label)}</th>`).join('')}
          <th class="actions"></th></tr></thead><tbody>${list.map(r => `
          <tr>${cfg.columns.map(c => `<td${c.num ? ' class="num"' : ''}>${c.render ? c.render(r) : UI.escape(r[c.key] != null ? r[c.key] : '')}</td>`).join('')}
            <td class="actions">
              <button class="link-btn" data-edit="${UI.escape(r.id)}">Edit</button>
              <button class="link-btn link-btn--danger" data-del="${UI.escape(r.id)}">Delete</button>
            </td></tr>`).join('')}</tbody></table>`;
      t.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => Router.go(cfg.editRoute + '?id=' + b.dataset.edit));
      t.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
        const r = rows.find(x => String(x.id) === String(b.dataset.del));
        if (!confirm(`Delete ${r[cfg.numberField]}?`)) return;
        UI.loading(true, 'Deleting…');
        try { await API.call(cfg.deleteAction, { id: r.id }); UI.loading(false); UI.toast('Deleted.', 'success'); Router.resolve(); }
        catch (e) { UI.loading(false); UI.toast(e.message, 'error'); }
      });
    };
    const apply = () => {
      let list = rows.slice();
      if (q) list = list.filter(r => JSON.stringify(r).toLowerCase().indexOf(q) !== -1);
      draw(list);
    };
    mount.querySelector('#op-search').oninput = (e) => { q = e.target.value.trim().toLowerCase(); apply(); };
    apply();
  })();
}

/* =====================================================================
   EXPENSES
   ===================================================================== */
function expensesList(mount) {
  return opList(mount, {
    entity: 'Expenses', singular: 'Expense', plural: 'Expenses', numberField: 'expense_no',
    newRoute: 'new-expense', editRoute: 'edit-expense', deleteAction: 'deleteExpense',
    columns: [
      { key: 'expense_no', label: 'Expense No' },
      { key: 'date', label: 'Date', render: r => UI.escape(UI.date(r.date)) },
      { key: 'payee', label: 'Payee' },
      { key: 'payment_account_id', label: 'Paid From', render: r => UI.escape(Operations.accountName(r.payment_account_id)) },
      { key: 'total', label: 'Amount', num: true, render: r => UI.money(r.total) }
    ]
  });
}
async function expensesEditor(mount, id) {
  UI.loading(true);
  let ex = null;
  try { await Operations.preload(); if (id) ex = await API.call('expenseDetail', { id }); }
  catch (e) { UI.loading(false); opErr(mount, 'Expense', e.message); return; }
  UI.loading(false);
  const rec = ex ? ex.record : {};
  const today = new Date().toISOString().slice(0, 10);
  const state = {
    id: id || null, date: rec.date ? String(rec.date).slice(0, 10) : today,
    payee: rec.payee || '', payment_account_id: rec.payment_account_id || '',
    reference_no: rec.reference_no || '', description: rec.description || '',
    lines: (ex && ex.items && ex.items.length) ? ex.items.map(l => ({ account_id: l.account_id, description: l.description, amount: l.amount })) : [{ account_id: '', description: '', amount: '' }]
  };
  const payAccts = Operations.accounts.filter(a => a.account_type === 'Bank');
  const expAccts = Operations.accounts.filter(a => a.account_type === 'Expense' || a.account_type === 'Cost of Goods Sold');
  const payOpts = '<option value="">— select account —</option>' + payAccts.map(a => `<option value="${UI.escape(a.id)}"${String(a.id) === String(state.payment_account_id) ? ' selected' : ''}>${UI.escape(a.account_name)}</option>`).join('');
  const acctOptsFor = (sel) => '<option value="">— expense account —</option>' + expAccts.map(a => `<option value="${UI.escape(a.id)}"${String(a.id) === String(sel) ? ' selected' : ''}>${UI.escape(a.account_name)}</option>`).join('');

  mount.innerHTML = `
    <div class="page-head"><h1>${id ? 'Edit Expense ' + UI.escape(rec.expense_no || '') : 'New Expense'}</h1>
      <span class="page-sub">${id ? '' : 'Expense No. assigned on save'}</span></div>
    <div class="card"><div class="form-grid">
      <label class="field"><span class="field-label">Payee</span><input id="ex-payee" value="${UI.escape(state.payee)}" placeholder="Who was paid"></label>
      <label class="field"><span class="field-label">Paid From (account) <span class="req">*</span></span><select id="ex-pay">${payOpts}</select></label>
      <label class="field"><span class="field-label">Date</span><input type="date" id="ex-date" value="${UI.escape(state.date)}"></label>
      <label class="field"><span class="field-label">Reference No</span><input id="ex-ref" value="${UI.escape(state.reference_no)}"></label>
      <label class="field field--wide"><span class="field-label">Description</span><textarea id="ex-desc" rows="2">${UI.escape(state.description)}</textarea></label>
    </div></div>
    <div class="card no-pad">
      <div class="table-wrap"><table class="data-table line-table"><thead><tr>
        <th style="min-width:220px;">Expense Account</th><th>Description</th><th class="num">Amount</th><th class="actions"></th>
      </tr></thead><tbody id="ex-lines"></tbody></table></div>
      <div class="line-add"><button class="btn" id="ex-add">+ Add line</button></div>
    </div>
    <div class="totals-row"><div></div><div class="totals-box">
      <div class="totals-line totals-grand"><span>Total</span><span id="ex-total" class="num">0.00</span></div>
    </div></div>
    <div class="form-actions">
      <button class="btn" id="ex-cancel">Cancel</button>
      <button class="btn btn--primary" id="ex-save">${id ? 'Save changes' : 'Create expense'}</button>
    </div>`;

  const linesEl = mount.querySelector('#ex-lines');
  const recompute = () => {
    const total = state.lines.reduce((s, l) => s + Number(l.amount || 0), 0);
    mount.querySelector('#ex-total').textContent = UI.money(total);
  };
  const render = () => {
    linesEl.innerHTML = state.lines.map((l, i) => `
      <tr data-i="${i}">
        <td><select class="ex-acct">${acctOptsFor(l.account_id)}</select></td>
        <td><input class="ex-d" value="${UI.escape(l.description || '')}"></td>
        <td><input class="ex-a num" type="number" step="0.01" value="${UI.escape(l.amount || '')}"></td>
        <td class="actions"><button class="link-btn link-btn--danger ex-del">✕</button></td>
      </tr>`).join('');
    linesEl.querySelectorAll('tr').forEach(tr => {
      const i = Number(tr.dataset.i);
      tr.querySelector('.ex-acct').onchange = (e) => { state.lines[i].account_id = e.target.value; };
      tr.querySelector('.ex-d').oninput = (e) => { state.lines[i].description = e.target.value; };
      tr.querySelector('.ex-a').oninput = (e) => { state.lines[i].amount = e.target.value; recompute(); };
      tr.querySelector('.ex-del').onclick = () => { if (state.lines.length === 1) state.lines[0] = { account_id: '', description: '', amount: '' }; else state.lines.splice(i, 1); render(); recompute(); };
    });
    recompute();
  };
  render();
  mount.querySelector('#ex-add').onclick = () => { state.lines.push({ account_id: '', description: '', amount: '' }); render(); };
  mount.querySelector('#ex-payee').oninput = (e) => { state.payee = e.target.value; };
  mount.querySelector('#ex-pay').onchange = (e) => { state.payment_account_id = e.target.value; };
  mount.querySelector('#ex-date').onchange = (e) => { state.date = e.target.value; };
  mount.querySelector('#ex-ref').oninput = (e) => { state.reference_no = e.target.value; };
  mount.querySelector('#ex-desc').oninput = (e) => { state.description = e.target.value; };
  mount.querySelector('#ex-cancel').onclick = () => Router.go('expenses');
  mount.querySelector('#ex-save').onclick = async () => {
    if (!state.payment_account_id) { UI.toast('Choose the account this was paid from.', 'error'); return; }
    const lines = state.lines.filter(l => l.account_id && Number(l.amount) > 0);
    if (!lines.length) { UI.toast('Add at least one expense line with an amount.', 'error'); return; }
    const data = { date: state.date, payee: state.payee, payment_account_id: state.payment_account_id, reference_no: state.reference_no, description: state.description, lines };
    UI.loading(true, state.id ? 'Saving…' : 'Creating…');
    try { await API.call(state.id ? 'updateExpense' : 'saveExpense', state.id ? { id: state.id, data } : { data }); UI.loading(false); UI.toast(state.id ? 'Saved.' : 'Expense created.', 'success'); Router.go('expenses'); }
    catch (e) { UI.loading(false); UI.toast(e.message, 'error'); }
  };
}

/* =====================================================================
   INVENTORY TRANSFER
   ===================================================================== */
function transferList(mount) {
  return opList(mount, {
    entity: 'InventoryTransfers', singular: 'Inventory Transfer', plural: 'Inventory Transfers', numberField: 'transfer_no',
    newRoute: 'new-inventory-transfer', editRoute: 'edit-inventory-transfer', deleteAction: 'deleteInventoryTransfer',
    columns: [
      { key: 'transfer_no', label: 'ID' },
      { key: 'date', label: 'Date', render: r => UI.escape(UI.date(r.date)) },
      { key: 'store_id', label: 'Store', render: r => UI.escape(Operations.storeName(r.store_id, '—')) },
      { key: 'description', label: 'Description' },
      { key: 'from_warehouse', label: 'From Warehouse' },
      { key: 'to_warehouse', label: 'To Warehouse' }
    ]
  });
}
async function transferEditor(mount, id) {
  UI.loading(true);
  let ex = null;
  try { await Operations.preload(); if (id) ex = await API.call('inventoryTransferDetail', { id }); }
  catch (e) { UI.loading(false); opErr(mount, 'Inventory Transfer', e.message); return; }
  UI.loading(false);
  const rec = ex ? ex.record : {};
  const today = new Date().toISOString().slice(0, 10);
  const state = {
    id: id || null, date: rec.date ? String(rec.date).slice(0, 10) : today,
    store_id: rec.store_id || '', from_warehouse: rec.from_warehouse || '', to_warehouse: rec.to_warehouse || '',
    description: rec.description || '',
    lines: (ex && ex.items && ex.items.length) ? ex.items.map(l => ({ item_id: l.item_id, description: l.description, qty: l.qty, unit: l.unit })) : [{ item_id: '', description: '', qty: 1, unit: '' }]
  };
  mount.innerHTML = `
    <div class="page-head"><h1>${id ? 'Edit Inventory Transfer ' + UI.escape(rec.transfer_no || '') : 'New Inventory Transfer'}</h1>
      <span class="page-sub">${id ? '' : 'ID assigned on save'}</span></div>
    <div class="card"><div class="form-grid">
      <label class="field"><span class="field-label">Date</span><input type="date" id="tr-date" value="${UI.escape(state.date)}"></label>
      <label class="field"><span class="field-label">Store</span><select id="tr-store">${storeOptionsOp(state.store_id)}</select></label>
      <label class="field"><span class="field-label">From Warehouse <span class="req">*</span></span><select id="tr-from">${whOptions(state.from_warehouse)}</select></label>
      <label class="field"><span class="field-label">To Warehouse <span class="req">*</span></span><select id="tr-to">${whOptions(state.to_warehouse)}</select></label>
      <label class="field field--wide"><span class="field-label">Description</span><textarea id="tr-desc" rows="2">${UI.escape(state.description)}</textarea></label>
    </div></div>
    <div class="card no-pad">
      <div class="table-wrap"><table class="data-table line-table"><thead><tr>
        <th style="min-width:200px;">Item</th><th>Description</th><th class="num">Qty on hand</th><th class="num">Qty to transfer</th><th class="actions"></th>
      </tr></thead><tbody id="tr-lines"></tbody></table></div>
      <div class="line-add"><button class="btn" id="tr-add">+ Add line</button></div>
    </div>
    <div class="form-actions">
      <button class="btn" id="tr-cancel">Cancel</button>
      <button class="btn btn--primary" id="tr-save">${id ? 'Save changes' : 'Create transfer'}</button>
    </div>`;
  const linesEl = mount.querySelector('#tr-lines');
  const render = () => {
    linesEl.innerHTML = state.lines.map((l, i) => `
      <tr data-i="${i}">
        <td><select class="tr-item">${opItemOptions(l.item_id)}</select></td>
        <td><input class="tr-d" value="${UI.escape(l.description || '')}"></td>
        <td class="num tr-onhand">${l.item_id ? '' : '—'}</td>
        <td><input class="tr-q num" type="number" step="any" value="${UI.escape(l.qty || '')}"></td>
        <td class="actions"><button class="link-btn link-btn--danger tr-del">✕</button></td>
      </tr>`).join('');
    linesEl.querySelectorAll('tr').forEach(tr => {
      const i = Number(tr.dataset.i);
      const sel = tr.querySelector('.tr-item');
      const onhandCell = tr.querySelector('.tr-onhand');
      const fillOnHand = async () => {
        if (!state.lines[i].item_id) { onhandCell.textContent = '—'; return; }
        onhandCell.textContent = '…';
        try { const r = await API.call('inventoryOnHand', { item_id: state.lines[i].item_id }); onhandCell.textContent = Number(r.on_hand || 0); }
        catch { onhandCell.textContent = '—'; }
      };
      sel.onchange = () => {
        if (sel.value === '__new__') { sel.value = state.lines[i].item_id || ''; newItemModal((rec) => { Operations.items.push(rec); state.lines[i].item_id = rec.id; render(); }); return; }
        state.lines[i].item_id = sel.value;
        const it = Operations.items.find(x => String(x.id) === String(sel.value));
        if (it) { tr.querySelector('.tr-d').value = it.name; state.lines[i].description = it.name; }
        fillOnHand();
      };
      tr.querySelector('.tr-d').oninput = (e) => { state.lines[i].description = e.target.value; };
      tr.querySelector('.tr-q').oninput = (e) => { state.lines[i].qty = e.target.value; };
      tr.querySelector('.tr-del').onclick = () => { if (state.lines.length === 1) state.lines[0] = { item_id: '', description: '', qty: 1, unit: '' }; else state.lines.splice(i, 1); render(); };
      if (state.lines[i].item_id) fillOnHand();
    });
  };
  render();
  mount.querySelector('#tr-add').onclick = () => { state.lines.push({ item_id: '', description: '', qty: 1, unit: '' }); render(); };
  mount.querySelector('#tr-date').onchange = (e) => { state.date = e.target.value; };
  mount.querySelector('#tr-store').onchange = (e) => { state.store_id = e.target.value; };
  mount.querySelector('#tr-from').onchange = (e) => { state.from_warehouse = e.target.value; };
  mount.querySelector('#tr-to').onchange = (e) => { state.to_warehouse = e.target.value; };
  mount.querySelector('#tr-desc').oninput = (e) => { state.description = e.target.value; };
  mount.querySelector('#tr-cancel').onclick = () => Router.go('inventory-transfer');
  mount.querySelector('#tr-save').onclick = async () => {
    if (!state.from_warehouse || !state.to_warehouse) { UI.toast('Choose both warehouses.', 'error'); return; }
    if (state.from_warehouse === state.to_warehouse) { UI.toast('From and To warehouses must differ.', 'error'); return; }
    const lines = state.lines.filter(l => l.item_id && Number(l.qty) > 0);
    if (!lines.length) { UI.toast('Add at least one item to transfer.', 'error'); return; }
    const data = { date: state.date, store_id: state.store_id, from_warehouse: state.from_warehouse, to_warehouse: state.to_warehouse, description: state.description, lines };
    UI.loading(true, state.id ? 'Saving…' : 'Creating…');
    try { await API.call(state.id ? 'updateInventoryTransfer' : 'saveInventoryTransfer', state.id ? { id: state.id, data } : { data }); UI.loading(false); UI.toast(state.id ? 'Saved.' : 'Transfer created.', 'success'); Router.go('inventory-transfer'); }
    catch (e) { UI.loading(false); UI.toast(e.message, 'error'); }
  };
}

/* =====================================================================
   INVENTORY ADJUSTMENT
   ===================================================================== */
const ADJ_TYPES = ['Quantity', 'Value', 'Quantity and Value'];
function adjustmentList(mount) {
  return opList(mount, {
    entity: 'InventoryAdjustments', singular: 'Inventory Adjustment', plural: 'Inventory Adjustments', numberField: 'adjustment_no',
    newRoute: 'new-inventory-adjustment', editRoute: 'edit-inventory-adjustment', deleteAction: 'deleteInventoryAdjustment',
    columns: [
      { key: 'reference_no', label: 'Reference No', render: r => UI.escape(r.reference_no || r.adjustment_no) },
      { key: 'adjustment_type', label: 'Type' },
      { key: 'store_id', label: 'Store Name', render: r => UI.escape(Operations.storeName(r.store_id, '—')) },
      { key: 'warehouse', label: 'Warehouse' },
      { key: 'date', label: 'Date', render: r => UI.escape(UI.date(r.date)) },
      { key: 'description', label: 'Description' }
    ]
  });
}
async function adjustmentEditor(mount, id) {
  UI.loading(true);
  let ex = null;
  try { await Operations.preload(); if (id) ex = await API.call('inventoryAdjustmentDetail', { id }); }
  catch (e) { UI.loading(false); opErr(mount, 'Inventory Adjustment', e.message); return; }
  UI.loading(false);
  const rec = ex ? ex.record : {};
  const today = new Date().toISOString().slice(0, 10);
  const state = {
    id: id || null, adjustment_type: rec.adjustment_type || 'Quantity',
    date: rec.date ? String(rec.date).slice(0, 10) : today, reference_no: rec.reference_no || '',
    store_id: rec.store_id || '', warehouse: rec.warehouse || '', adjustment_account_id: rec.adjustment_account_id || '',
    description: rec.description || '',
    lines: (ex && ex.items && ex.items.length) ? ex.items.map(l => ({ item_id: l.item_id, description: l.description, on_hand: Number(l.on_hand || 0), new_qty: l.new_qty, cost: Number(l.cost || 0), new_value: '', qty_diff: Number(l.qty_diff || 0), value_diff: Number(l.value_diff || 0) })) : [blankAdjLine()]
  };
  const acctOpts = '<option value="">— select account —</option>' + Operations.accounts.map(a => `<option value="${UI.escape(a.id)}"${String(a.id) === String(state.adjustment_account_id) ? ' selected' : ''}>${UI.escape(a.account_name)} (${UI.escape(a.account_type)})</option>`).join('');
  const typeOpts = ADJ_TYPES.map(t => `<option${t === state.adjustment_type ? ' selected' : ''}>${t}</option>`).join('');

  mount.innerHTML = `
    <div class="page-head"><h1>${id ? 'Edit Inventory Adjustment ' + UI.escape(rec.adjustment_no || '') : 'New Inventory Adjustment'}</h1>
      <span class="page-sub">${id ? '' : 'Reference assigned on save'}</span></div>
    <div class="card"><div class="form-grid">
      <label class="field"><span class="field-label">Adjustment Type</span><select id="aj-type">${typeOpts}</select></label>
      <label class="field"><span class="field-label">Date</span><input type="date" id="aj-date" value="${UI.escape(state.date)}"></label>
      <label class="field"><span class="field-label">Adjustment Account</span><select id="aj-acct">${acctOpts}</select></label>
      <label class="field"><span class="field-label">Warehouse</span><select id="aj-wh">${whOptions(state.warehouse)}</select></label>
      <label class="field"><span class="field-label">Store</span><select id="aj-store">${storeOptionsOp(state.store_id)}</select></label>
      <label class="field"><span class="field-label">Reference No</span><input id="aj-ref" value="${UI.escape(state.reference_no)}"></label>
      <label class="field field--wide"><span class="field-label">Description</span><textarea id="aj-desc" rows="2">${UI.escape(state.description)}</textarea></label>
    </div></div>
    <div class="card no-pad">
      <div class="table-wrap"><table class="data-table line-table"><thead><tr>
        <th style="min-width:200px;">Item</th><th>Description</th><th class="num">Qty on hand</th>
        <th class="num">Current Value</th><th class="num">New Qty</th><th class="num">New Value</th><th class="num">Value Diff.</th><th class="actions"></th>
      </tr></thead><tbody id="aj-lines"></tbody></table></div>
      <div class="line-add"><button class="btn" id="aj-add">+ Add line</button></div>
    </div>
    <div class="totals-row"><div></div><div class="totals-box">
      <div class="totals-line totals-grand"><span>Total Value of Adjustment</span><span id="aj-total" class="num">0.00</span></div>
    </div></div>
    <div class="form-actions">
      <button class="btn" id="aj-cancel">Cancel</button>
      <button class="btn btn--primary" id="aj-save">${id ? 'Save changes' : 'Create adjustment'}</button>
    </div>`;

  const linesEl = mount.querySelector('#aj-lines');
  const computeLine = (l) => {
    const type = state.adjustment_type;
    if (type === 'Value') {
      l.qty_diff = 0;
      const nv = parseFloat(l.new_value);
      l.value_diff = isNaN(nv) ? 0 : (nv - l.on_hand * l.cost);
      l.new_cost = (!isNaN(nv) && l.on_hand > 0) ? nv / l.on_hand : '';
    } else if (type === 'Quantity and Value') {
      l.qty_diff = (l.new_qty === '' || l.new_qty == null) ? 0 : (Number(l.new_qty) - l.on_hand);
      const nv = parseFloat(l.new_value);
      l.value_diff = isNaN(nv) ? l.qty_diff * l.cost : (nv - l.on_hand * l.cost);
      const finalQty = (l.new_qty === '' || l.new_qty == null) ? l.on_hand : Number(l.new_qty);
      l.new_cost = (!isNaN(nv) && finalQty > 0) ? nv / finalQty : '';
    } else { // Quantity
      l.qty_diff = (l.new_qty === '' || l.new_qty == null) ? 0 : (Number(l.new_qty) - l.on_hand);
      l.value_diff = l.qty_diff * l.cost;
      l.new_cost = '';
    }
  };
  const recompute = () => {
    let total = 0;
    state.lines.forEach((l, i) => {
      computeLine(l); total += Number(l.value_diff || 0);
      const cell = linesEl.querySelector(`tr[data-i="${i}"] .aj-vd`);
      if (cell) cell.textContent = UI.money(l.value_diff || 0);
    });
    mount.querySelector('#aj-total').textContent = UI.money(total);
  };
  const render = () => {
    const valueMode = state.adjustment_type !== 'Quantity';
    const qtyMode = state.adjustment_type !== 'Value';
    linesEl.innerHTML = state.lines.map((l, i) => `
      <tr data-i="${i}">
        <td><select class="aj-item">${opItemOptions(l.item_id)}</select></td>
        <td><input class="aj-d" value="${UI.escape(l.description || '')}"></td>
        <td class="num aj-onhand">${l.item_id ? l.on_hand : '—'}</td>
        <td class="num aj-curval">${l.item_id ? UI.money(l.on_hand * l.cost) : '—'}</td>
        <td><input class="aj-nq num" type="number" step="any" value="${UI.escape(l.new_qty != null ? l.new_qty : '')}"${qtyMode ? '' : ' disabled'}></td>
        <td><input class="aj-nv num" type="number" step="0.01" value="${UI.escape(l.new_value != null ? l.new_value : '')}"${valueMode ? '' : ' disabled'}></td>
        <td class="num aj-vd">${UI.money(l.value_diff || 0)}</td>
        <td class="actions"><button class="link-btn link-btn--danger aj-del">✕</button></td>
      </tr>`).join('');
    linesEl.querySelectorAll('tr').forEach(tr => {
      const i = Number(tr.dataset.i);
      const sel = tr.querySelector('.aj-item');
      const onhandCell = tr.querySelector('.aj-onhand');
      const curvalCell = tr.querySelector('.aj-curval');
      const loadItem = async () => {
        const l = state.lines[i];
        if (!l.item_id) { onhandCell.textContent = '—'; if (curvalCell) curvalCell.textContent = '—'; return; }
        l.cost = Operations.itemCost(l.item_id);
        onhandCell.textContent = '…';
        try { const r = await API.call('inventoryOnHand', { item_id: l.item_id }); l.on_hand = Number(r.on_hand || 0); }
        catch { l.on_hand = 0; }
        onhandCell.textContent = l.on_hand;
        if (curvalCell) curvalCell.textContent = UI.money(l.on_hand * l.cost);
        if (qtyMode && (l.new_qty === '' || l.new_qty == null)) { l.new_qty = l.on_hand; tr.querySelector('.aj-nq').value = l.on_hand; }
        if (state.adjustment_type !== 'Quantity' && (l.new_value === '' || l.new_value == null)) { l.new_value = (l.on_hand * l.cost).toFixed(2); tr.querySelector('.aj-nv').value = l.new_value; }
        recompute();
      };
      sel.onchange = () => {
        if (sel.value === '__new__') { sel.value = state.lines[i].item_id || ''; newItemModal((rec) => { Operations.items.push(rec); state.lines[i].item_id = rec.id; render(); }); return; }
        state.lines[i].item_id = sel.value;
        const it = Operations.items.find(x => String(x.id) === String(sel.value));
        if (it) { tr.querySelector('.aj-d').value = it.name; state.lines[i].description = it.name; }
        loadItem();
      };
      tr.querySelector('.aj-d').oninput = (e) => { state.lines[i].description = e.target.value; };
      tr.querySelector('.aj-nq').oninput = (e) => { state.lines[i].new_qty = e.target.value; recompute(); };
      tr.querySelector('.aj-nv').oninput = (e) => { state.lines[i].new_value = e.target.value; recompute(); };
      tr.querySelector('.aj-del').onclick = () => { if (state.lines.length === 1) state.lines[0] = blankAdjLine(); else state.lines.splice(i, 1); render(); recompute(); };
      if (state.lines[i].item_id && !state.lines[i].on_hand) loadItem();
    });
    recompute();
  };
  render();
  mount.querySelector('#aj-add').onclick = () => { state.lines.push(blankAdjLine()); render(); };
  mount.querySelector('#aj-type').onchange = (e) => { state.adjustment_type = e.target.value; render(); };
  mount.querySelector('#aj-date').onchange = (e) => { state.date = e.target.value; };
  mount.querySelector('#aj-acct').onchange = (e) => { state.adjustment_account_id = e.target.value; };
  mount.querySelector('#aj-wh').onchange = (e) => { state.warehouse = e.target.value; };
  mount.querySelector('#aj-store').onchange = (e) => { state.store_id = e.target.value; };
  mount.querySelector('#aj-ref').oninput = (e) => { state.reference_no = e.target.value; };
  mount.querySelector('#aj-desc').oninput = (e) => { state.description = e.target.value; };
  mount.querySelector('#aj-cancel').onclick = () => Router.go('inventory-adjustments');
  mount.querySelector('#aj-save').onclick = async () => {
    const lines = state.lines.filter(l => l.item_id);
    if (!lines.length) { UI.toast('Add at least one item.', 'error'); return; }
    lines.forEach(computeLine);
    const data = {
      adjustment_type: state.adjustment_type, date: state.date, reference_no: state.reference_no,
      store_id: state.store_id, warehouse: state.warehouse, adjustment_account_id: state.adjustment_account_id,
      description: state.description,
      lines: lines.map(l => ({ item_id: l.item_id, description: l.description, on_hand: l.on_hand, new_qty: Number(l.new_qty || l.on_hand || 0), qty_diff: Number(l.qty_diff || 0), cost: l.cost, value_diff: Number(l.value_diff || 0), new_cost: l.new_cost }))
    };
    UI.loading(true, state.id ? 'Saving…' : 'Creating…');
    try { await API.call(state.id ? 'updateInventoryAdjustment' : 'saveInventoryAdjustment', state.id ? { id: state.id, data } : { data }); UI.loading(false); UI.toast(state.id ? 'Saved.' : 'Adjustment created.', 'success'); Router.go('inventory-adjustments'); }
    catch (e) { UI.loading(false); UI.toast(e.message, 'error'); }
  };
}
function blankAdjLine() { return { item_id: '', description: '', on_hand: 0, new_qty: '', cost: 0, new_value: '', qty_diff: 0, value_diff: 0 }; }

/* =====================================================================
   CLAIMS
   ===================================================================== */
function claimsList(mount) {
  return opList(mount, {
    entity: 'Claims', singular: 'Claim', plural: 'Claims', numberField: 'claim_no',
    newRoute: 'new-claim', editRoute: 'edit-claim', deleteAction: 'deleteClaim',
    columns: [
      { key: 'claim_no', label: 'ID' },
      { key: 'customer_id', label: 'Customer', render: r => UI.escape(Operations.customerName(r.customer_id)) },
      { key: 'reference_no', label: 'Ref. No.' },
      { key: 'store_id', label: 'Store', render: r => UI.escape(Operations.storeName(r.store_id, '—')) },
      { key: 'date', label: 'Date', render: r => UI.escape(UI.date(r.date)) }
    ]
  });
}
async function claimEditor(mount, id) {
  UI.loading(true);
  let ex = null;
  try { await Operations.preload(); if (id) ex = await API.call('claimDetail', { id }); }
  catch (e) { UI.loading(false); opErr(mount, 'Claim', e.message); return; }
  UI.loading(false);
  const rec = ex ? ex.record : {};
  const today = new Date().toISOString().slice(0, 10);
  const state = {
    id: id || null, customer_id: rec.customer_id || '', store_id: rec.store_id || '',
    date: rec.date ? String(rec.date).slice(0, 10) : today, reference_no: rec.reference_no || '', description: rec.description || '',
    lines: (ex && ex.items && ex.items.length) ? ex.items.map(l => ({ item_id: l.item_id, description: l.description, serial_no: l.serial_no, qty: l.qty, unit: l.unit })) : [blankClaimLine()]
  };
  const custSelect = () => `<select id="cl-cust"><option value="">— select customer —</option>` +
    Operations.customers.map(c => `<option value="${UI.escape(c.id)}"${String(c.id) === String(state.customer_id) ? ' selected' : ''}>${UI.escape(c.name)}</option>`).join('') + `</select>`;

  mount.innerHTML = `
    <div class="page-head"><h1>${id ? 'Edit Claim ' + UI.escape(rec.claim_no || '') : 'New Claim'}</h1>
      <span class="page-sub">${id ? '' : 'ID assigned on save'}</span></div>
    <div class="card"><div class="form-grid">
      <label class="field"><span class="field-label">Customer</span>
        <span class="input-with-btn">${custSelect()}<button type="button" class="btn" id="cl-add-cust" title="New customer">＋</button></span></label>
      <label class="field"><span class="field-label">Claim Date</span><input type="date" id="cl-date" value="${UI.escape(state.date)}"></label>
      <label class="field"><span class="field-label">Store</span><select id="cl-store">${storeOptionsOp(state.store_id)}</select></label>
      <label class="field"><span class="field-label">Reference No</span><input id="cl-ref" value="${UI.escape(state.reference_no)}"></label>
      <label class="field field--wide"><span class="field-label">Description</span><textarea id="cl-desc" rows="2">${UI.escape(state.description)}</textarea></label>
    </div></div>
    <div class="card no-pad">
      <div class="table-wrap"><table class="data-table line-table"><thead><tr>
        <th style="min-width:200px;">Item</th><th>Description</th><th>Serial No.</th><th class="num">Qty</th><th>Unit</th><th class="actions"></th>
      </tr></thead><tbody id="cl-lines"></tbody></table></div>
      <div class="line-add"><button class="btn" id="cl-add">+ Add line</button></div>
    </div>
    <div class="form-actions">
      <button class="btn" id="cl-cancel">Cancel</button>
      <button class="btn btn--primary" id="cl-save">${id ? 'Save changes' : 'Create claim'}</button>
    </div>`;
  const linesEl = mount.querySelector('#cl-lines');
  const render = () => {
    linesEl.innerHTML = state.lines.map((l, i) => `
      <tr data-i="${i}">
        <td><select class="cl-item">${opItemOptions(l.item_id)}</select></td>
        <td><input class="cl-d" value="${UI.escape(l.description || '')}"></td>
        <td><input class="cl-s" value="${UI.escape(l.serial_no || '')}"></td>
        <td><input class="cl-q num" type="number" step="any" value="${UI.escape(l.qty || '')}"></td>
        <td><input class="cl-u" value="${UI.escape(l.unit || '')}" style="max-width:70px;"></td>
        <td class="actions"><button class="link-btn link-btn--danger cl-del">✕</button></td>
      </tr>`).join('');
    linesEl.querySelectorAll('tr').forEach(tr => {
      const i = Number(tr.dataset.i);
      const sel = tr.querySelector('.cl-item');
      sel.onchange = () => {
        if (sel.value === '__new__') { sel.value = state.lines[i].item_id || ''; newItemModal((rec) => { Operations.items.push(rec); state.lines[i].item_id = rec.id; render(); }); return; }
        state.lines[i].item_id = sel.value;
        const it = Operations.items.find(x => String(x.id) === String(sel.value));
        if (it) { tr.querySelector('.cl-d').value = it.name; state.lines[i].description = it.name; }
      };
      tr.querySelector('.cl-d').oninput = (e) => { state.lines[i].description = e.target.value; };
      tr.querySelector('.cl-s').oninput = (e) => { state.lines[i].serial_no = e.target.value; };
      tr.querySelector('.cl-q').oninput = (e) => { state.lines[i].qty = e.target.value; };
      tr.querySelector('.cl-u').oninput = (e) => { state.lines[i].unit = e.target.value; };
      tr.querySelector('.cl-del').onclick = () => { if (state.lines.length === 1) state.lines[0] = blankClaimLine(); else state.lines.splice(i, 1); render(); };
    });
  };
  render();
  const rewireCust = () => { mount.querySelector('#cl-cust').onchange = (e) => { state.customer_id = e.target.value; }; };
  rewireCust();
  mount.querySelector('#cl-add-cust').onclick = () => newCustomerModalOp((rec) => {
    state.customer_id = rec.id;
    const sel = mount.querySelector('#cl-cust');
    sel.innerHTML = `<option value="">— select customer —</option>` + Operations.customers.map(c => `<option value="${UI.escape(c.id)}"${String(c.id) === String(state.customer_id) ? ' selected' : ''}>${UI.escape(c.name)}</option>`).join('');
    rewireCust();
  });
  mount.querySelector('#cl-add').onclick = () => { state.lines.push(blankClaimLine()); render(); };
  mount.querySelector('#cl-date').onchange = (e) => { state.date = e.target.value; };
  mount.querySelector('#cl-store').onchange = (e) => { state.store_id = e.target.value; };
  mount.querySelector('#cl-ref').oninput = (e) => { state.reference_no = e.target.value; };
  mount.querySelector('#cl-desc').oninput = (e) => { state.description = e.target.value; };
  mount.querySelector('#cl-cancel').onclick = () => Router.go('claims');
  mount.querySelector('#cl-save').onclick = async () => {
    if (!state.customer_id) { UI.toast('Please select a customer.', 'error'); return; }
    const lines = state.lines.filter(l => l.item_id || l.description);
    if (!lines.length) { UI.toast('Add at least one claimed item.', 'error'); return; }
    const data = { date: state.date, customer_id: state.customer_id, store_id: state.store_id, reference_no: state.reference_no, description: state.description, lines };
    UI.loading(true, state.id ? 'Saving…' : 'Creating…');
    try { await API.call(state.id ? 'updateClaim' : 'saveClaim', state.id ? { id: state.id, data } : { data }); UI.loading(false); UI.toast(state.id ? 'Saved.' : 'Claim created.', 'success'); Router.go('claims'); }
    catch (e) { UI.loading(false); UI.toast(e.message, 'error'); }
  };
}
function blankClaimLine() { return { item_id: '', description: '', serial_no: '', qty: 1, unit: '' }; }

/* =====================================================================
   ROUTES
   ===================================================================== */
Router.register('expenses',                 (m) => expensesList(m));
Router.register('new-expense',              (m) => expensesEditor(m, null));
Router.register('edit-expense',             (m, p) => expensesEditor(m, p.id));
Router.register('inventory-transfer',        (m) => transferList(m));
Router.register('new-inventory-transfer',    (m) => transferEditor(m, null));
Router.register('edit-inventory-transfer',   (m, p) => transferEditor(m, p.id));
Router.register('inventory-adjustments',     (m) => adjustmentList(m));
Router.register('new-inventory-adjustment',  (m) => adjustmentEditor(m, null));
Router.register('edit-inventory-adjustment', (m, p) => adjustmentEditor(m, p.id));
Router.register('claims',                    (m) => claimsList(m));
Router.register('new-claim',                 (m) => claimEditor(m, null));
Router.register('edit-claim',                (m, p) => claimEditor(m, p.id));

/* =====================================================================
   BULK SMS — compose a message and target customers by area
   (Sending requires an SMS gateway; see notes in the UI.)
   ===================================================================== */
Router.register('bulk-sms', async (mount) => {
  UI.loading(true);
  let customers, areas = [];
  try {
    customers = await API.list('Customers');
    try { areas = await API.list('Areas'); } catch (e) { areas = []; }
  } catch (e) { UI.loading(false); mount.innerHTML = `<div class="card"><div class="empty">${UI.icon('alert')}<h3>Couldn't load</h3><p>${UI.escape(e.message)}</p></div></div>`; return; }
  UI.loading(false);

  const areaOpts = '<option value="">All areas</option>' + areas.map(a => `<option value="${UI.escape(a.id)}">${UI.escape(a.name)}</option>`).join('');
  mount.innerHTML = `
    <div class="page-head"><h1>Bulk SMS</h1><span class="page-sub">Send a message to your customers</span></div>
    <div class="card"><div class="form-grid">
      <label class="field"><span class="field-label">Region / Area</span><select id="sms-area">${areaOpts}</select></label>
      <label class="field"><span class="field-label">Recipients</span><input id="sms-count" disabled value=""></label>
      <label class="field field--wide"><span class="field-label">Message</span><textarea id="sms-msg" rows="4" placeholder="Type your message…"></textarea></label>
    </div>
    <p class="muted" id="sms-meta">0 characters · 1 SMS segment</p>
    <div class="form-actions"><button class="btn btn--primary" id="sms-send">Send SMS</button></div>
    </div>
    <div class="card no-pad" id="sms-list"></div>`;

  const recipients = () => {
    const area = mount.querySelector('#sms-area').value;
    return customers.filter(c => (c.phone && String(c.phone).trim()) && (!area || String(c.area) === String(area)));
  };
  const refresh = () => {
    const list = recipients();
    mount.querySelector('#sms-count').value = `${list.length} customer(s) with a phone number`;
    const t = mount.querySelector('#sms-list');
    t.innerHTML = list.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Customer</th><th>Phone</th></tr></thead>
      <tbody>${list.slice(0, 200).map(c => `<tr><td>${UI.escape(c.name)}</td><td>${UI.escape(c.phone)}</td></tr>`).join('')}</tbody></table></div>`
      : `<div class="empty"><p>No customers with a phone number in this area.</p></div>`;
  };
  const meta = () => {
    const len = mount.querySelector('#sms-msg').value.length;
    const seg = Math.max(1, Math.ceil(len / 160));
    mount.querySelector('#sms-meta').textContent = `${len} characters · ${seg} SMS segment${seg > 1 ? 's' : ''}`;
  };
  mount.querySelector('#sms-area').onchange = refresh;
  mount.querySelector('#sms-msg').oninput = meta;
  mount.querySelector('#sms-send').onclick = () => {
    const msg = mount.querySelector('#sms-msg').value.trim();
    const list = recipients();
    if (!msg) { UI.toast('Type a message first.', 'error'); return; }
    if (!list.length) { UI.toast('No recipients with phone numbers.', 'error'); return; }
    UI.toast(`Ready to send to ${list.length} customer(s). Connect an SMS gateway to deliver.`, 'info');
    alert(`SMS gateway not connected yet.\n\nThis message is ready for ${list.length} customer(s):\n\n"${msg}"\n\nTo actually deliver these, an SMS provider (e.g. a Telenor corporate SMS account or an aggregator API) needs to be wired into the backend. Ask to set this up and provide the gateway's API URL, sender ID and credentials.`);
  };
  refresh(); meta();
});
