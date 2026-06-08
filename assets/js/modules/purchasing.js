/* =====================================================================
   Adil Business Solutions — Purchasing (Phase 4)
   Two supplier-side documents:
     • Purchase Order — a request to a supplier. NON-POSTING: it does not
       touch the ledger or stock. Has Open / Closed / Rejected status.
     • Bill           — records a purchase on credit. POSTS to the ledger
       (Dr Inventory, Cr Accounts Payable) and moves stock IN. A
       "Credit (Normal)" bill is a supplier return (the reverse).
   Both forms can quick-add a Supplier (Code/Name/Address/Contact) and an
   Item (Name/Category/UPC/Purchase Price/Sale Price) inline.
   ===================================================================== */

const Purchasing = {
  suppliers: [], items: [], stores: [], warehouses: [], categories: [],

  async preload() {
    const [suppliers, items, stores, warehouses, categories] = await Promise.all([
      API.list('Suppliers'), API.list('Items'), API.list('Stores'),
      API.list('Warehouses'), API.list('Categories')
    ]);
    this.suppliers = suppliers; this.items = items;
    this.stores = stores; this.warehouses = warehouses; this.categories = categories;
  },

  supplierName(id, fallback) {
    const s = this.suppliers.find(x => String(x.id) === String(id));
    return s ? s.name : (fallback || '—');
  },
  storeName(id, fallback) {
    const s = this.stores.find(x => String(x.id) === String(id));
    return s ? s.store_name : (fallback || '—');
  },

  // per-line discount: "5%" => percent of gross, plain number => amount per unit
  lineDiscount(gross, qty, val) {
    const s = (val == null) ? '' : String(val).trim();
    if (!s) return 0;
    if (s.indexOf('%') !== -1) { const n = parseFloat(s); return isNaN(n) ? 0 : gross * (n / 100); }
    const n = parseFloat(s); return isNaN(n) ? 0 : n * qty;
  },
  overallDiscount(base, type, val) {
    const num = parseFloat(val);
    if (isNaN(num)) return 0;
    return type === 'Discount Value' ? num : base * (num / 100);
  },
  poStatusBadge(s) {
    const map = { open: 'warn', closed: 'ok', rejected: 'bad' };
    return `<span class="badge badge--${map[s] || 'warn'}">${UI.escape((s || 'open').toUpperCase())}</span>`;
  },
  billStatusBadge(s) {
    const map = { paid: 'ok', partial: 'warn', unpaid: 'bad' };
    return `<span class="badge badge--${map[s] || 'bad'}">${UI.escape((s || 'unpaid').toUpperCase())}</span>`;
  }
};

function purchErr(mount, what, msg) {
  mount.innerHTML = `<div class="card"><div class="empty">${UI.icon('alert')}<h3>Couldn't load ${UI.escape(what)}</h3><p>${UI.escape(msg)}</p></div></div>`;
}

/* =====================================================================
   INLINE QUICK-ADD MODALS
   ===================================================================== */
function quickModal(title, bodyHtml, onSave) {
  const modal = UI.el(`<div class="modal-overlay"><div class="modal">
    <div class="modal-head"><h2>${UI.escape(title)}</h2>
      <button class="icon-btn modal-close" title="Close">✕</button></div>
    <form class="modal-body">${bodyHtml}</form>
    <div class="modal-foot">
      <button type="button" class="btn modal-close">Close</button>
      <button type="button" class="btn btn--primary" id="qm-save">Create</button>
    </div>
  </div></div>`);
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelectorAll('.modal-close').forEach(b => b.onclick = close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  const first = modal.querySelector('input,select,textarea'); if (first) first.focus();
  modal.querySelector('#qm-save').onclick = async () => {
    try { await onSave(modal, close); }
    catch (e) { UI.toast(e.message, 'error'); }
  };
  return modal;
}

// New Supplier (Code / Name / Address / Contact)
function newSupplierModal(onCreated) {
  quickModal('New Supplier', `
    <label class="field field--wide"><span class="field-label">Code</span><input id="qs-code" placeholder="Supplier Code"></label>
    <label class="field field--wide"><span class="field-label">Name <span class="req">*</span></span><input id="qs-name" placeholder="Supplier Name"></label>
    <label class="field field--wide"><span class="field-label">Address</span><input id="qs-address" placeholder="Address"></label>
    <label class="field field--wide"><span class="field-label">Contact</span><input id="qs-contact" placeholder="Contact"></label>`,
    async (modal, close) => {
      const name = modal.querySelector('#qs-name').value.trim();
      if (!name) { UI.toast('Supplier name is required.', 'error'); return; }
      UI.loading(true, 'Creating supplier…');
      try {
        const rec = await API.create('Suppliers', {
          code: modal.querySelector('#qs-code').value.trim(),
          name, address: modal.querySelector('#qs-address').value.trim(),
          phone: modal.querySelector('#qs-contact').value.trim()
        });
        Purchasing.suppliers.push(rec);
        UI.loading(false); UI.toast('Supplier created.', 'success');
        close(); onCreated(rec);
      } catch (e) { UI.loading(false); throw e; }
    });
}

// New Item (Name / Category / UPC / Purchase Price / Sale Price)
function newItemModal(onCreated) {
  const catOpts = '<option value="">Select Category</option>' +
    Purchasing.categories.map(c => `<option value="${UI.escape(c.id)}">${UI.escape(c.name)}</option>`).join('');
  quickModal('New Item', `
    <label class="field field--wide"><span class="field-label">Item Name <span class="req">*</span></span><input id="qi-name" placeholder="Item Name"></label>
    <label class="field field--wide"><span class="field-label">Category</span><select id="qi-cat">${catOpts}</select></label>
    <label class="field field--wide"><span class="field-label">UPC</span><input id="qi-upc" placeholder="UPC"></label>
    <label class="field"><span class="field-label">Purchase Price</span><input id="qi-cost" type="number" step="0.01" placeholder="0.00"></label>
    <label class="field"><span class="field-label">Sale Price</span><input id="qi-price" type="number" step="0.01" placeholder="0.00"></label>`,
    async (modal, close) => {
      const name = modal.querySelector('#qi-name').value.trim();
      if (!name) { UI.toast('Item name is required.', 'error'); return; }
      UI.loading(true, 'Creating item…');
      try {
        const rec = await API.create('Items', {
          name, sku: modal.querySelector('#qi-upc').value.trim(),
          category_id: modal.querySelector('#qi-cat').value,
          cost_price: modal.querySelector('#qi-cost').value || 0,
          regular_price: modal.querySelector('#qi-price').value || 0
        });
        Purchasing.items.push(rec);
        UI.loading(false); UI.toast('Item created.', 'success');
        close(); onCreated(rec);
      } catch (e) { UI.loading(false); throw e; }
    });
}

/* =====================================================================
   SHARED LINE-ITEM HELPERS
   ===================================================================== */
function itemOptions(sel) {
  return '<option value="">— item —</option>' +
    Purchasing.items.map(it => `<option value="${UI.escape(it.id)}"${String(it.id) === String(sel) ? ' selected' : ''}>${UI.escape(it.name)}${it.sku ? ' (' + UI.escape(it.sku) + ')' : ''}</option>`).join('') +
    '<option value="__new__">＋ New item…</option>';
}

/* =====================================================================
   PURCHASE ORDER — LIST
   ===================================================================== */
async function buildPOList(mount) {
  UI.loading(true);
  let rows;
  try { await Purchasing.preload(); rows = await API.list('PurchaseOrders'); }
  catch (e) { UI.loading(false); purchErr(mount, 'Purchase Orders', e.message); return; }
  UI.loading(false);
  rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  const count = (st) => rows.filter(r => String(r.status) === st).length;
  mount.innerHTML = `
    <div class="page-head"><h1>Purchase Orders</h1><span class="page-sub" id="po-count"></span>
      <div class="page-actions">
        <input id="po-search" class="search-input" placeholder="Search purchase orders…">
        <button class="btn btn--primary" id="po-new">+ New Purchase Order</button>
      </div>
    </div>
    <div class="filter-tabs">
      <button class="ftab active" data-f="all">All</button>
      <button class="ftab" data-f="open">Open <b>${count('open')}</b></button>
      <button class="ftab" data-f="closed">Closed <b>${count('closed')}</b></button>
      <button class="ftab" data-f="rejected">Rejected <b>${count('rejected')}</b></button>
    </div>
    <div class="card no-pad"><div class="table-wrap" id="po-table"></div></div>`;

  mount.querySelector('#po-new').onclick = () => Router.go('new-purchase-order');

  let filter = 'all', q = '';
  const draw = (list) => {
    document.getElementById('po-count').textContent = `${list.length} order${list.length === 1 ? '' : 's'}`;
    const t = document.getElementById('po-table');
    if (!list.length) {
      t.innerHTML = `<div class="empty">${UI.icon('file-text')}<h3>No purchase orders</h3><p>Click “New Purchase Order” to create one.</p></div>`;
      return;
    }
    t.innerHTML = `<table class="data-table"><thead><tr>
        <th>PO No.</th><th>Supplier</th><th>Store</th><th>Date</th>
        <th class="num">Amount</th><th>Status</th><th class="actions"></th>
      </tr></thead><tbody>${list.map(r => `
        <tr>
          <td><strong>${UI.escape(r.po_no)}</strong></td>
          <td>${UI.escape(Purchasing.supplierName(r.supplier_id))}</td>
          <td>${UI.escape(Purchasing.storeName(r.store_id, '—'))}</td>
          <td>${UI.escape(UI.date(r.date))}</td>
          <td class="num">${UI.money(r.total)}</td>
          <td>${Purchasing.poStatusBadge(r.status)}</td>
          <td class="actions">
            <button class="link-btn" data-edit="${UI.escape(r.id)}">Edit</button>
            ${r.status === 'open' ? `<button class="link-btn" data-close="${UI.escape(r.id)}">Close</button>
            <button class="link-btn" data-reject="${UI.escape(r.id)}">Reject</button>` : `<button class="link-btn" data-reopen="${UI.escape(r.id)}">Reopen</button>`}
            <button class="link-btn link-btn--danger" data-del="${UI.escape(r.id)}">Delete</button>
          </td>
        </tr>`).join('')}</tbody></table>`;

    t.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => Router.go('edit-purchase-order?id=' + b.dataset.edit));
    const setStatus = async (id, status) => {
      UI.loading(true, 'Updating…');
      try { await API.call('setPurchaseOrderStatus', { id, status }); UI.loading(false); UI.toast('Updated.', 'success'); Router.resolve(); }
      catch (e) { UI.loading(false); UI.toast(e.message, 'error'); }
    };
    t.querySelectorAll('[data-close]').forEach(b => b.onclick = () => setStatus(b.dataset.close, 'closed'));
    t.querySelectorAll('[data-reject]').forEach(b => b.onclick = () => setStatus(b.dataset.reject, 'rejected'));
    t.querySelectorAll('[data-reopen]').forEach(b => b.onclick = () => setStatus(b.dataset.reopen, 'open'));
    t.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      const r = rows.find(x => String(x.id) === String(b.dataset.del));
      if (!confirm(`Delete ${r.po_no}?`)) return;
      UI.loading(true, 'Deleting…');
      try { await API.call('deletePurchaseOrder', { id: r.id }); UI.loading(false); UI.toast('Deleted.', 'success'); Router.resolve(); }
      catch (e) { UI.loading(false); UI.toast(e.message, 'error'); }
    });
  };
  const apply = () => {
    let list = rows.slice();
    if (filter !== 'all') list = list.filter(r => String(r.status) === filter);
    if (q) list = list.filter(r => (r.po_no + ' ' + Purchasing.supplierName(r.supplier_id) + ' ' + (r.status || '')).toLowerCase().indexOf(q) !== -1);
    draw(list);
  };
  mount.querySelectorAll('.ftab').forEach(b => b.onclick = () => {
    mount.querySelectorAll('.ftab').forEach(x => x.classList.toggle('active', x === b));
    filter = b.dataset.f; apply();
  });
  mount.querySelector('#po-search').oninput = (e) => { q = e.target.value.trim().toLowerCase(); apply(); };
  apply();
}

/* =====================================================================
   PURCHASE ORDER — EDITOR
   ===================================================================== */
async function buildPOEditor(mount, id) {
  UI.loading(true);
  let existing = null;
  try { await Purchasing.preload(); if (id) existing = await API.call('purchaseOrderDetail', { id }); }
  catch (e) { UI.loading(false); purchErr(mount, 'Purchase Order', e.message); return; }
  UI.loading(false);

  const rec = existing ? existing.po : {};
  const exItems = existing ? existing.items : [];
  const today = new Date().toISOString().slice(0, 10);
  const state = {
    id: id || null,
    supplier_id: rec.supplier_id || '',
    store_id: rec.store_id || '',
    date: rec.date ? String(rec.date).slice(0, 10) : today,
    reference_no: rec.reference_no || '',
    description: rec.description || '',
    lines: (exItems && exItems.length)
      ? exItems.map(it => ({ item_id: it.item_id, description: it.description, qty: it.qty, unit: it.unit, cost: it.cost, discount: it.discount, line_total: it.line_total }))
      : [blankPoLine()],
    _totals: { subtotal: 0, total: 0 }
  };

  const supplierSelect = () => `<select id="po-supplier"><option value="">— select supplier —</option>` +
    Purchasing.suppliers.map(s => `<option value="${UI.escape(s.id)}"${String(s.id) === String(state.supplier_id) ? ' selected' : ''}>${UI.escape(s.name)}</option>`).join('') + `</select>`;
  const storeOpts = `<option value="">— none —</option>` +
    Purchasing.stores.map(s => `<option value="${UI.escape(s.id)}"${String(s.id) === String(state.store_id) ? ' selected' : ''}>${UI.escape(s.store_name)}</option>`).join('');

  mount.innerHTML = `
    <div class="page-head">
      <h1>${id ? 'Edit Purchase Order ' + UI.escape(rec.po_no || '') : 'New Purchase Order'}</h1>
      <span class="page-sub">${id ? '' : 'PO No. assigned on save'}</span>
    </div>
    <div class="card">
      <div class="form-grid">
        <label class="field"><span class="field-label">Supplier</span>
          <span class="input-with-btn">${supplierSelect()}<button type="button" class="btn" id="po-add-supplier" title="New supplier">＋</button></span></label>
        <label class="field"><span class="field-label">Date</span><input type="date" id="po-date" value="${UI.escape(state.date)}"></label>
        <label class="field"><span class="field-label">Store</span><select id="po-store">${storeOpts}</select></label>
        <label class="field"><span class="field-label">Reference No</span><input id="po-ref" value="${UI.escape(state.reference_no)}"></label>
        <label class="field field--wide"><span class="field-label">Description</span><textarea id="po-desc" rows="2">${UI.escape(state.description)}</textarea></label>
      </div>
    </div>
    <div class="card no-pad">
      <div class="table-wrap"><table class="data-table line-table">
        <thead><tr>
          <th style="min-width:180px;">Item</th><th>Description</th>
          <th class="num">Qty</th><th>Unit</th><th class="num">Cost</th>
          <th class="num">Amount</th><th class="actions"></th>
        </tr></thead><tbody id="po-lines"></tbody>
      </table></div>
      <div class="line-add"><button class="btn" id="po-add-line">+ Add line</button></div>
    </div>
    <div class="totals-row">
      <div></div>
      <div class="totals-box">
        <div class="totals-line totals-grand"><span>Subtotal</span><span id="po-total" class="num">0.00</span></div>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn" id="po-cancel">Cancel</button>
      <button class="btn btn--primary" id="po-save">${id ? 'Save changes' : 'Create purchase order'}</button>
    </div>`;

  const linesEl = mount.querySelector('#po-lines');
  const recompute = () => {
    let subtotal = 0;
    state.lines.forEach((ln, i) => {
      const gross = Number(ln.qty || 0) * Number(ln.cost || 0);
      ln.line_total = Math.max(0, gross - Purchasing.lineDiscount(gross, Number(ln.qty || 0), ln.discount));
      subtotal += ln.line_total;
      const cell = linesEl.querySelector(`tr[data-i="${i}"] .ln-total`);
      if (cell) cell.textContent = UI.money(ln.line_total);
    });
    state._totals = { subtotal, total: subtotal };
    mount.querySelector('#po-total').textContent = UI.money(subtotal);
  };
  const renderLines = () => {
    linesEl.innerHTML = state.lines.map((ln, i) => `
      <tr data-i="${i}">
        <td><select class="ln-item">${itemOptions(ln.item_id)}</select></td>
        <td><input class="ln-desc" value="${UI.escape(ln.description || '')}"></td>
        <td><input class="ln-qty num" type="number" step="any" value="${UI.escape(ln.qty || '')}"></td>
        <td><input class="ln-unit" value="${UI.escape(ln.unit || '')}" style="max-width:70px;"></td>
        <td><input class="ln-cost num" type="number" step="0.01" value="${UI.escape(ln.cost || '')}"></td>
        <td class="num ln-total">${UI.money(ln.line_total || 0)}</td>
        <td class="actions"><button class="link-btn link-btn--danger ln-del" title="Remove">✕</button></td>
      </tr>`).join('');
    linesEl.querySelectorAll('tr').forEach(tr => wirePoLine(tr, state, recompute, renderLines));
    recompute();
  };
  renderLines();

  const rewireSupplier = () => {
    mount.querySelector('#po-supplier').onchange = (e) => { state.supplier_id = e.target.value; };
  };
  rewireSupplier();
  mount.querySelector('#po-add-supplier').onclick = () => newSupplierModal((rec) => {
    state.supplier_id = rec.id;
    mount.querySelector('label .input-with-btn #po-supplier').outerHTML = (() => {
      const tmp = document.createElement('div');
      tmp.innerHTML = `<select id="po-supplier"><option value="">— select supplier —</option>` +
        Purchasing.suppliers.map(s => `<option value="${UI.escape(s.id)}"${String(s.id) === String(state.supplier_id) ? ' selected' : ''}>${UI.escape(s.name)}</option>`).join('') + `</select>`;
      return tmp.firstChild.outerHTML;
    })();
    rewireSupplier();
  });
  mount.querySelector('#po-add-line').onclick = () => { state.lines.push(blankPoLine()); renderLines(); };
  mount.querySelector('#po-date').onchange = (e) => { state.date = e.target.value; };
  mount.querySelector('#po-store').onchange = (e) => { state.store_id = e.target.value; };
  mount.querySelector('#po-ref').oninput = (e) => { state.reference_no = e.target.value; };
  mount.querySelector('#po-desc').oninput = (e) => { state.description = e.target.value; };
  mount.querySelector('#po-cancel').onclick = () => Router.go('purchase-orders');
  mount.querySelector('#po-save').onclick = () => savePO(state);
}

function blankPoLine() { return { item_id: '', description: '', qty: 1, unit: '', cost: '', discount: '', line_total: 0 }; }

function wirePoLine(tr, state, recompute, renderLines) {
  const i = Number(tr.dataset.i);
  const itemSel = tr.querySelector('.ln-item');
  const desc = tr.querySelector('.ln-desc');
  const qty = tr.querySelector('.ln-qty');
  const unit = tr.querySelector('.ln-unit');
  const cost = tr.querySelector('.ln-cost');

  itemSel.onchange = () => {
    if (itemSel.value === '__new__') {
      itemSel.value = state.lines[i].item_id || '';
      newItemModal((rec) => { state.lines[i].item_id = rec.id; renderLines(); });
      return;
    }
    state.lines[i].item_id = itemSel.value;
    const it = Purchasing.items.find(x => String(x.id) === String(itemSel.value));
    if (it) {
      desc.value = it.name; state.lines[i].description = it.name;
      if (it.cost_price !== '' && it.cost_price != null) { cost.value = it.cost_price; state.lines[i].cost = it.cost_price; }
    }
    recompute();
  };
  desc.oninput = () => { state.lines[i].description = desc.value; };
  qty.oninput = () => { state.lines[i].qty = qty.value; recompute(); };
  unit.oninput = () => { state.lines[i].unit = unit.value; };
  cost.oninput = () => { state.lines[i].cost = cost.value; recompute(); };
  tr.querySelector('.ln-del').onclick = () => {
    if (state.lines.length === 1) state.lines[0] = blankPoLine();
    else state.lines.splice(i, 1);
    renderLines();
  };
}

async function savePO(state) {
  if (!state.supplier_id) { UI.toast('Please select a supplier.', 'error'); return; }
  const lines = state.lines.filter(l => (l.item_id || l.description) && Number(l.qty) > 0);
  if (!lines.length) { UI.toast('Add at least one line with a quantity.', 'error'); return; }
  const data = {
    date: state.date, supplier_id: state.supplier_id, store_id: state.store_id,
    description: state.description, reference_no: state.reference_no,
    subtotal: state._totals.subtotal, total: state._totals.total,
    lines: lines.map(l => ({
      item_id: l.item_id, description: l.description, qty: Number(l.qty || 0),
      unit: l.unit, cost: Number(l.cost || 0), discount: l.discount, line_total: Number(l.line_total || 0)
    }))
  };
  UI.loading(true, state.id ? 'Saving…' : 'Creating…');
  try {
    await API.call('savePurchaseOrder', state.id ? { id: state.id, data } : { data });
    UI.loading(false);
    UI.toast(state.id ? 'Saved.' : 'Purchase order created.', 'success');
    Router.go('purchase-orders');
  } catch (e) { UI.loading(false); UI.toast(e.message, 'error'); }
}

/* =====================================================================
   BILLS — LIST
   ===================================================================== */
async function buildBillList(mount) {
  UI.loading(true);
  let rows;
  try { await Purchasing.preload(); rows = await API.list('Bills'); }
  catch (e) { UI.loading(false); purchErr(mount, 'Bills', e.message); return; }
  UI.loading(false);
  rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  const count = (st) => rows.filter(r => String(r.status) === st).length;
  mount.innerHTML = `
    <div class="page-head"><h1>Bills</h1><span class="page-sub" id="bl-count"></span>
      <div class="page-actions">
        <input id="bl-search" class="search-input" placeholder="Search bills…">
        <button class="btn btn--primary" id="bl-new">+ New Bill</button>
      </div>
    </div>
    <div class="filter-tabs">
      <button class="ftab active" data-f="all">All</button>
      <button class="ftab" data-f="unpaid">Unpaid <b>${count('unpaid') + count('partial')}</b></button>
      <button class="ftab" data-f="paid">Paid <b>${count('paid')}</b></button>
    </div>
    <div class="card no-pad"><div class="table-wrap" id="bl-table"></div></div>`;

  mount.querySelector('#bl-new').onclick = () => Router.go('new-bill');

  let filter = 'all', q = '';
  const draw = (list) => {
    document.getElementById('bl-count').textContent = `${list.length} bill${list.length === 1 ? '' : 's'}`;
    const t = document.getElementById('bl-table');
    if (!list.length) {
      t.innerHTML = `<div class="empty">${UI.icon('file-text')}<h3>No bills</h3><p>Click “New Bill” to record one.</p></div>`;
      return;
    }
    t.innerHTML = `<table class="data-table"><thead><tr>
        <th>Bill No</th><th>Type</th><th>Ref. No.</th><th>Supplier</th><th>Store</th>
        <th>Bill Date</th><th>Due Date</th><th class="num">Amount</th><th>Status</th><th class="actions"></th>
      </tr></thead><tbody>${list.map(r => `
        <tr>
          <td><strong>${UI.escape(r.bill_no)}</strong></td>
          <td>${UI.escape(r.bill_type || 'Bill')}</td>
          <td>${UI.escape(r.reference_no || '—')}</td>
          <td>${UI.escape(Purchasing.supplierName(r.supplier_id))}</td>
          <td>${UI.escape(Purchasing.storeName(r.store_id, '—'))}</td>
          <td>${UI.escape(UI.date(r.date))}</td>
          <td>${UI.escape(UI.date(r.due_date))}</td>
          <td class="num">${UI.money(r.total)}</td>
          <td>${Purchasing.billStatusBadge(r.status)}</td>
          <td class="actions">
            <button class="link-btn" data-edit="${UI.escape(r.id)}">Edit</button>
            <button class="link-btn link-btn--danger" data-del="${UI.escape(r.id)}">Delete</button>
          </td>
        </tr>`).join('')}</tbody></table>`;

    t.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => Router.go('edit-bill?id=' + b.dataset.edit));
    t.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      const r = rows.find(x => String(x.id) === String(b.dataset.del));
      if (!confirm(`Delete ${r.bill_no}? This reverses its ledger posting and stock.`)) return;
      UI.loading(true, 'Deleting…');
      try { await API.call('deleteBill', { id: r.id }); UI.loading(false); UI.toast('Deleted.', 'success'); Router.resolve(); }
      catch (e) { UI.loading(false); UI.toast(e.message, 'error'); }
    });
  };
  const apply = () => {
    let list = rows.slice();
    if (filter === 'unpaid') list = list.filter(r => r.status === 'unpaid' || r.status === 'partial');
    else if (filter === 'paid') list = list.filter(r => r.status === 'paid');
    if (q) list = list.filter(r => (r.bill_no + ' ' + (r.reference_no || '') + ' ' + Purchasing.supplierName(r.supplier_id)).toLowerCase().indexOf(q) !== -1);
    draw(list);
  };
  mount.querySelectorAll('.ftab').forEach(b => b.onclick = () => {
    mount.querySelectorAll('.ftab').forEach(x => x.classList.toggle('active', x === b));
    filter = b.dataset.f; apply();
  });
  mount.querySelector('#bl-search').oninput = (e) => { q = e.target.value.trim().toLowerCase(); apply(); };
  apply();
}

/* =====================================================================
   BILLS — EDITOR
   ===================================================================== */
async function buildBillEditor(mount, id) {
  UI.loading(true);
  let existing = null;
  try { await Purchasing.preload(); if (id) existing = await API.call('billDetail', { id }); }
  catch (e) { UI.loading(false); purchErr(mount, 'Bill', e.message); return; }
  UI.loading(false);

  const rec = existing ? existing.bill : {};
  const exItems = existing ? existing.items : [];
  const today = new Date().toISOString().slice(0, 10);
  const state = {
    id: id || null,
    bill_type: rec.bill_type === 'Credit' ? 'Credit' : 'Bill',
    supplier_id: rec.supplier_id || '',
    store_id: rec.store_id || '',
    date: rec.date ? String(rec.date).slice(0, 10) : today,
    due_date: rec.due_date ? String(rec.due_date).slice(0, 10) : today,
    reference_no: rec.reference_no || '',
    description: rec.description || '',
    discType: rec.discount_type || 'Discount Percent',
    discVal: rec.discount ? String(rec.discount) : '',
    spreadShipping: Number(rec.shipping_charges || 0) > 0,
    shipping: rec.shipping_charges ? String(rec.shipping_charges) : '',
    lines: (exItems && exItems.length)
      ? exItems.map(it => ({ item_id: it.item_id, description: it.description, warehouse: it.warehouse, qty: it.qty, unit: it.unit, multiplier: it.multiplier, cost: it.cost, discount: it.discount, line_total: it.line_total }))
      : [blankBillLine()],
    _totals: { subtotal: 0, discount: 0, total: 0 }
  };

  const supplierSelect = () => `<select id="b-supplier"><option value="">— select supplier —</option>` +
    Purchasing.suppliers.map(s => `<option value="${UI.escape(s.id)}"${String(s.id) === String(state.supplier_id) ? ' selected' : ''}>${UI.escape(s.name)}</option>`).join('') + `</select>`;
  const storeOpts = `<option value="">— none —</option>` +
    Purchasing.stores.map(s => `<option value="${UI.escape(s.id)}"${String(s.id) === String(state.store_id) ? ' selected' : ''}>${UI.escape(s.store_name)}</option>`).join('');

  mount.innerHTML = `
    <div class="page-head">
      <h1>${id ? 'Edit Bill ' + UI.escape(rec.bill_no || '') : 'New Bill'}</h1>
      <span class="page-sub">${id ? '' : 'Bill No. assigned on save'}</span>
    </div>
    <div class="card">
      <div class="radio-row">
        <label><input type="radio" name="b-type" value="Bill"${state.bill_type === 'Bill' ? ' checked' : ''}> Bill</label>
        <label><input type="radio" name="b-type" value="Credit"${state.bill_type === 'Credit' ? ' checked' : ''}> Credit (Normal)</label>
      </div>
      <div class="form-grid">
        <label class="field"><span class="field-label">Supplier</span>
          <span class="input-with-btn">${supplierSelect()}<button type="button" class="btn" id="b-add-supplier" title="New supplier">＋</button></span></label>
        <label class="field"><span class="field-label">Store</span><select id="b-store">${storeOpts}</select></label>
        <label class="field"><span class="field-label">Bill Date</span><input type="date" id="b-date" value="${UI.escape(state.date)}"></label>
        <label class="field"><span class="field-label">Due Date</span><input type="date" id="b-due" value="${UI.escape(state.due_date)}"></label>
        <label class="field"><span class="field-label">Reference No</span><input id="b-ref" value="${UI.escape(state.reference_no)}"></label>
        <label class="field field--wide"><span class="field-label">Description</span><textarea id="b-desc" rows="2">${UI.escape(state.description)}</textarea></label>
      </div>
    </div>
    <div class="card no-pad">
      <div class="table-wrap"><table class="data-table line-table">
        <thead><tr>
          <th style="min-width:170px;">Item</th><th>Description</th><th>Warehouse</th>
          <th class="num">Qty</th><th>Unit</th><th class="num">Mult.</th>
          <th class="num">Cost</th><th>Discount</th><th class="num">Amount</th><th class="actions"></th>
        </tr></thead><tbody id="b-lines"></tbody>
      </table></div>
      <div class="line-add"><button class="btn" id="b-add-line">+ Add line</button></div>
    </div>
    <div class="totals-row">
      <div></div>
      <div class="totals-box">
        <div class="totals-line"><span>Subtotal</span><span id="bt-sub" class="num">0.00</span></div>
        <div class="totals-line">
          <span><select id="b-disc-type" class="mini-select"><option>Discount Percent</option><option>Discount Value</option></select>
            <input id="b-disc-val" class="mini-input" value="${UI.escape(state.discVal)}"></span>
          <span id="bt-disc" class="num">0.00</span>
        </div>
        <div class="totals-line">
          <span><label style="font-weight:normal;"><input type="checkbox" id="b-ship-on"${state.spreadShipping ? ' checked' : ''}> Shipping charges</label>
            <input id="b-ship-val" class="mini-input" value="${UI.escape(state.shipping)}"${state.spreadShipping ? '' : ' disabled'}></span>
          <span id="bt-ship" class="num">0.00</span>
        </div>
        <div class="totals-line totals-grand"><span>Total</span><span id="bt-total" class="num">0.00</span></div>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn" id="b-cancel">Cancel</button>
      <button class="btn btn--primary" id="b-save">${id ? 'Save changes' : 'Create bill'}</button>
    </div>`;

  if (state.discType === 'Discount Value') mount.querySelector('#b-disc-type').value = 'Discount Value';

  const linesEl = mount.querySelector('#b-lines');
  const recompute = () => {
    let subtotal = 0;
    state.lines.forEach((ln, i) => {
      const gross = Number(ln.qty || 0) * Number(ln.multiplier || 1) * Number(ln.cost || 0);
      ln.line_total = Math.max(0, gross - Purchasing.lineDiscount(gross, Number(ln.qty || 0), ln.discount));
      subtotal += ln.line_total;
      const cell = linesEl.querySelector(`tr[data-i="${i}"] .ln-total`);
      if (cell) cell.textContent = UI.money(ln.line_total);
    });
    const disc = Purchasing.overallDiscount(subtotal, state.discType, state.discVal);
    const ship = state.spreadShipping ? (parseFloat(state.shipping) || 0) : 0;
    const total = Math.max(0, subtotal - disc + ship);
    state._totals = { subtotal, discount: disc, total };
    mount.querySelector('#bt-sub').textContent = UI.money(subtotal);
    mount.querySelector('#bt-disc').textContent = UI.money(disc);
    mount.querySelector('#bt-ship').textContent = UI.money(ship);
    mount.querySelector('#bt-total').textContent = UI.money(total);
  };
  const renderLines = () => {
    const whOpts = (sel) => '<option value="">—</option>' +
      Purchasing.warehouses.map(w => `<option value="${UI.escape(w.warehouse_name)}"${String(w.warehouse_name) === String(sel) ? ' selected' : ''}>${UI.escape(w.warehouse_name)}</option>`).join('');
    linesEl.innerHTML = state.lines.map((ln, i) => `
      <tr data-i="${i}">
        <td><select class="ln-item">${itemOptions(ln.item_id)}</select></td>
        <td><input class="ln-desc" value="${UI.escape(ln.description || '')}"></td>
        <td><select class="ln-wh">${whOpts(ln.warehouse)}</select></td>
        <td><input class="ln-qty num" type="number" step="any" value="${UI.escape(ln.qty || '')}"></td>
        <td><input class="ln-unit" value="${UI.escape(ln.unit || '')}" style="max-width:60px;"></td>
        <td><input class="ln-mult num" type="number" step="any" value="${UI.escape(ln.multiplier || 1)}" style="max-width:60px;"></td>
        <td><input class="ln-cost num" type="number" step="0.01" value="${UI.escape(ln.cost || '')}"></td>
        <td><input class="ln-disc" value="${UI.escape(ln.discount || '')}" placeholder="0 or 5%" style="max-width:80px;"></td>
        <td class="num ln-total">${UI.money(ln.line_total || 0)}</td>
        <td class="actions"><button class="link-btn link-btn--danger ln-del" title="Remove">✕</button></td>
      </tr>`).join('');
    linesEl.querySelectorAll('tr').forEach(tr => wireBillLine(tr, state, recompute, renderLines));
    recompute();
  };
  renderLines();

  const rewireSupplier = () => {
    mount.querySelector('#b-supplier').onchange = (e) => { state.supplier_id = e.target.value; };
  };
  rewireSupplier();
  mount.querySelector('#b-add-supplier').onclick = () => newSupplierModal((rec) => {
    state.supplier_id = rec.id;
    const sel = mount.querySelector('#b-supplier');
    sel.innerHTML = `<option value="">— select supplier —</option>` +
      Purchasing.suppliers.map(s => `<option value="${UI.escape(s.id)}"${String(s.id) === String(state.supplier_id) ? ' selected' : ''}>${UI.escape(s.name)}</option>`).join('');
    rewireSupplier();
  });
  mount.querySelectorAll('input[name="b-type"]').forEach(r => r.onchange = (e) => { state.bill_type = e.target.value; });
  mount.querySelector('#b-add-line').onclick = () => { state.lines.push(blankBillLine()); renderLines(); };
  mount.querySelector('#b-store').onchange = (e) => { state.store_id = e.target.value; };
  mount.querySelector('#b-date').onchange = (e) => { state.date = e.target.value; };
  mount.querySelector('#b-due').onchange = (e) => { state.due_date = e.target.value; };
  mount.querySelector('#b-ref').oninput = (e) => { state.reference_no = e.target.value; };
  mount.querySelector('#b-desc').oninput = (e) => { state.description = e.target.value; };
  mount.querySelector('#b-disc-type').onchange = (e) => { state.discType = e.target.value; recompute(); };
  mount.querySelector('#b-disc-val').oninput = (e) => { state.discVal = e.target.value; recompute(); };
  mount.querySelector('#b-ship-on').onchange = (e) => {
    state.spreadShipping = e.target.checked;
    mount.querySelector('#b-ship-val').disabled = !e.target.checked;
    recompute();
  };
  mount.querySelector('#b-ship-val').oninput = (e) => { state.shipping = e.target.value; recompute(); };
  mount.querySelector('#b-cancel').onclick = () => Router.go('bills');
  mount.querySelector('#b-save').onclick = () => saveBill(state);
}

function blankBillLine() { return { item_id: '', description: '', warehouse: '', qty: 1, unit: '', multiplier: 1, cost: '', discount: '', line_total: 0 }; }

function wireBillLine(tr, state, recompute, renderLines) {
  const i = Number(tr.dataset.i);
  const itemSel = tr.querySelector('.ln-item');
  const desc = tr.querySelector('.ln-desc');
  const wh = tr.querySelector('.ln-wh');
  const qty = tr.querySelector('.ln-qty');
  const unit = tr.querySelector('.ln-unit');
  const mult = tr.querySelector('.ln-mult');
  const cost = tr.querySelector('.ln-cost');
  const disc = tr.querySelector('.ln-disc');

  itemSel.onchange = () => {
    if (itemSel.value === '__new__') {
      itemSel.value = state.lines[i].item_id || '';
      newItemModal((rec) => { state.lines[i].item_id = rec.id; renderLines(); });
      return;
    }
    state.lines[i].item_id = itemSel.value;
    const it = Purchasing.items.find(x => String(x.id) === String(itemSel.value));
    if (it) {
      desc.value = it.name; state.lines[i].description = it.name;
      if (it.cost_price !== '' && it.cost_price != null) { cost.value = it.cost_price; state.lines[i].cost = it.cost_price; }
    }
    recompute();
  };
  desc.oninput = () => { state.lines[i].description = desc.value; };
  wh.onchange = () => { state.lines[i].warehouse = wh.value; };
  qty.oninput = () => { state.lines[i].qty = qty.value; recompute(); };
  unit.oninput = () => { state.lines[i].unit = unit.value; };
  mult.oninput = () => { state.lines[i].multiplier = mult.value; recompute(); };
  cost.oninput = () => { state.lines[i].cost = cost.value; recompute(); };
  disc.oninput = () => { state.lines[i].discount = disc.value; recompute(); };
  tr.querySelector('.ln-del').onclick = () => {
    if (state.lines.length === 1) state.lines[0] = blankBillLine();
    else state.lines.splice(i, 1);
    renderLines();
  };
}

async function saveBill(state) {
  if (!state.supplier_id) { UI.toast('Please select a supplier.', 'error'); return; }
  const lines = state.lines.filter(l => (l.item_id || l.description) && Number(l.qty) > 0);
  if (!lines.length) { UI.toast('Add at least one line with a quantity.', 'error'); return; }
  const t = state._totals;
  const data = {
    bill_type: state.bill_type, date: state.date, due_date: state.due_date,
    supplier_id: state.supplier_id, store_id: state.store_id, reference_no: state.reference_no,
    description: state.description, subtotal: t.subtotal, discount: t.discount,
    discount_type: state.discType, shipping_charges: state.spreadShipping ? (parseFloat(state.shipping) || 0) : 0,
    total: t.total,
    lines: lines.map(l => ({
      item_id: l.item_id, description: l.description, warehouse: l.warehouse,
      qty: Number(l.qty || 0), unit: l.unit, multiplier: Number(l.multiplier || 1),
      cost: Number(l.cost || 0), discount: l.discount, line_total: Number(l.line_total || 0)
    }))
  };
  UI.loading(true, state.id ? 'Saving…' : 'Creating…');
  try {
    await API.call('saveBill', state.id ? { id: state.id, data } : { data });
    UI.loading(false);
    UI.toast(state.id ? 'Saved.' : 'Bill created.', 'success');
    Router.go('bills');
  } catch (e) { UI.loading(false); UI.toast(e.message, 'error'); }
}

/* =====================================================================
   ROUTES
   ===================================================================== */
Router.register('purchase-orders',     (m) => buildPOList(m));
Router.register('new-purchase-order',   (m) => buildPOEditor(m, null));
Router.register('edit-purchase-order',  (m, p) => buildPOEditor(m, p.id));
Router.register('bills',                (m) => buildBillList(m));
Router.register('new-bill',             (m) => buildBillEditor(m, null));
Router.register('edit-bill',            (m, p) => buildBillEditor(m, p.id));
