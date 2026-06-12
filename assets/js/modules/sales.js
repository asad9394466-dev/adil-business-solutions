/* =====================================================================
   Adil Business Solutions — Sales (Phase 2, revised)
   Two document types share one engine:
     • Invoice       — wholesale; can be part-paid, balance carries to the
                       customer's account; has Due Date, Reference No and a
                       Balance Forward line.
     • Sales Receipt — walk-in; paid in full on the spot; no due balance.
   ===================================================================== */

const Sales = {
  items: [], customers: [], reps: [],

  async preload() {
    const [items, customers, reps] = await Promise.all([
      API.list('Items'), API.list('Customers'), API.list('SalesRepresentatives')
    ]);
    this.items = items; this.customers = customers; this.reps = reps;
  },

  customerName(id, fallback) {
    const c = this.customers.find(x => String(x.id) === String(id));
    return c ? c.name : (fallback || '—');
  },

  // overall discount: type is "Discount Percent" or "Discount Value"
  overallDiscount(base, type, val) {
    const num = parseFloat(val);
    if (isNaN(num)) return 0;
    return type === 'Discount Value' ? num : base * (num / 100);
  },

  // per-line discount: "5%" => percent of gross, plain number => amount per unit
  lineDiscount(gross, qty, val) {
    const s = (val == null) ? '' : String(val).trim();
    if (!s) return 0;
    if (s.indexOf('%') !== -1) { const n = parseFloat(s); return isNaN(n) ? 0 : gross * (n / 100); }
    const n = parseFloat(s); return isNaN(n) ? 0 : n * qty;
  },

  statusBadge(s) {
    const map = { paid: 'ok', partial: 'warn', unpaid: 'bad' };
    return `<span class="badge badge--${map[s] || 'bad'}">${UI.escape((s || 'unpaid').toUpperCase())}</span>`;
  }
};

const DOC = {
  invoice: {
    key: 'invoice', entity: 'Invoices', numberField: 'invoice_no', numberLabel: 'Invoice No',
    title: 'Invoice', singular: 'Invoice', plural: 'Invoices',
    listRoute: 'invoices', newRoute: 'new-invoice', editRoute: 'edit-invoice', detailRoute: 'invoice-detail',
    createAction: 'createInvoice', updateAction: 'updateInvoice', detailAction: 'invoiceDetail', deleteAction: 'deleteInvoice',
    hasDueDate: true, hasReference: true, hasBalanceForward: true,
    walkIn: false, customerRequired: true, canPay: true, statusTabs: true, docTitle: 'INVOICE'
  },
  receipt: {
    key: 'receipt', entity: 'SalesReceipts', numberField: 'receipt_no', numberLabel: 'Sales Receipt No',
    title: 'Sales Receipt', singular: 'Sales Receipt', plural: 'Sales Receipts',
    listRoute: 'sales-receipts', newRoute: 'new-sales-receipt', editRoute: 'edit-sales-receipt', detailRoute: 'sales-receipt-detail',
    createAction: 'createSalesReceipt', updateAction: 'updateSalesReceipt', detailAction: 'salesReceiptDetail', deleteAction: 'deleteSalesReceipt',
    hasDueDate: false, hasReference: false, hasBalanceForward: false,
    walkIn: true, customerRequired: false, canPay: false, statusTabs: false, docTitle: 'SALES RECEIPT'
  },
  salesorder: {
    key: 'salesorder', entity: 'SalesOrders', numberField: 'so_no', numberLabel: 'SO No',
    title: 'Sales Order', singular: 'Sales Order', plural: 'Sales Orders',
    listRoute: 'sales-orders', newRoute: 'new-sales-order', editRoute: 'edit-sales-order', detailRoute: 'edit-sales-order',
    createAction: 'createSalesOrder', updateAction: 'updateSalesOrder', detailAction: 'salesOrderDetail', deleteAction: 'deleteSalesOrder',
    hasDueDate: true, hasReference: true, hasBalanceForward: false,
    walkIn: false, customerRequired: true, canPay: false, statusTabs: false, docTitle: 'SALES ORDER'
  },
  quotation: {
    key: 'quotation', entity: 'Quotations', numberField: 'quote_no', numberLabel: 'Quotation No',
    title: 'Quotation', singular: 'Quotation', plural: 'Quotations',
    listRoute: 'quotations', newRoute: 'new-quotation', editRoute: 'edit-quotation', detailRoute: 'edit-quotation',
    createAction: 'createQuotation', updateAction: 'updateQuotation', detailAction: 'quotationDetail', deleteAction: 'deleteQuotation',
    hasDueDate: true, hasReference: true, hasBalanceForward: false,
    walkIn: false, customerRequired: true, canPay: false, statusTabs: false, docTitle: 'QUOTATION'
  },
  creditmemo: {
    key: 'creditmemo', entity: 'CreditMemos', numberField: 'memo_no', numberLabel: 'Credit Memo No',
    title: 'Credit Memo', singular: 'Credit Memo', plural: 'Credit Memos',
    listRoute: 'credit-memos', newRoute: 'new-credit-memo', editRoute: 'edit-credit-memo', detailRoute: 'edit-credit-memo',
    createAction: 'createCreditMemo', updateAction: 'updateCreditMemo', detailAction: 'creditMemoDetail', deleteAction: 'deleteCreditMemo',
    hasDueDate: false, hasReference: true, hasBalanceForward: false,
    walkIn: false, customerRequired: true, canPay: false, statusTabs: false, docTitle: 'CREDIT MEMO'
  }
};

function salesErr(mount, what, msg) {
  mount.innerHTML = `<div class="card"><div class="empty">${UI.icon('alert')}<h3>Couldn't load ${UI.escape(what)}</h3><p>${UI.escape(msg)}</p></div></div>`;
}
function docCustomer(doc, r) {
  return doc.key === 'receipt' ? (r.customer_name || Sales.customerName(r.customer_id, 'Walk-in Customer')) : Sales.customerName(r.customer_id);
}

const ORDER_TYPES = ['Local', 'Mobile', 'Web', 'App'];

/* =====================================================================
   LIST
   ===================================================================== */
async function buildSalesList(mount, doc) {
  UI.loading(true);
  let rows;
  try { await Sales.preload(); rows = await API.list(doc.entity); }
  catch (e) { UI.loading(false); salesErr(mount, doc.plural, e.message); return; }
  UI.loading(false);
  rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  const tabs = doc.statusTabs ? `
    <div class="filter-tabs">
      <button class="ftab active" data-f="all">All</button>
      <button class="ftab" data-f="unpaid">Unpaid</button>
      <button class="ftab" data-f="partial">Partial</button>
      <button class="ftab" data-f="paid">Paid</button>
    </div>` : '';

  mount.innerHTML = `
    <div class="page-head"><h1>${UI.escape(doc.plural)}</h1><span class="page-sub" id="s-count"></span>
      <div class="page-actions">
        <input id="s-search" class="search-input" placeholder="Search ${UI.escape(doc.plural.toLowerCase())}…">
        <button class="btn btn--primary" id="s-new">+ New ${UI.escape(doc.singular)}</button>
      </div>
    </div>
    ${tabs}
    <div class="card no-pad"><div class="table-wrap" id="s-table"></div></div>`;

  mount.querySelector('#s-new').onclick = () => Router.go(doc.newRoute);

  let filter = 'all', q = '';
  const draw = (list) => {
    document.getElementById('s-count').textContent = `${list.length} ${list.length === 1 ? doc.singular.toLowerCase() : doc.plural.toLowerCase()}`;
    const t = document.getElementById('s-table');
    if (!list.length) {
      t.innerHTML = `<div class="empty">${UI.icon('file-text')}<h3>No ${UI.escape(doc.plural.toLowerCase())} yet</h3><p>Click “New ${UI.escape(doc.singular)}” to create one.</p></div>`;
      return;
    }
    const dueH = doc.hasDueDate ? '<th>Due</th>' : '';
    const balH = doc.canPay ? '<th class="num">Balance</th>' : '';
    const stH = doc.canPay ? '<th>Status</th>' : '';
    t.innerHTML = `<table class="data-table"><thead><tr>
        <th>${UI.escape(doc.numberLabel)}</th><th>Date</th><th>Customer</th>${dueH}
        <th class="num">Total</th>${balH}${stH}<th class="actions"></th>
      </tr></thead><tbody>${list.map(r => {
        const due = doc.hasDueDate ? `<td>${UI.escape(UI.date(r.due_date))}</td>` : '';
        const bal = doc.canPay ? `<td class="num">${UI.money(r.balance)}</td>` : '';
        const st = doc.canPay ? `<td>${Sales.statusBadge(r.status)}</td>` : '';
        const pay = doc.canPay ? `<button class="link-btn" data-pay="${UI.escape(r.id)}">Pay</button>` : '';
        return `<tr>
          <td><strong>${UI.escape(r[doc.numberField])}</strong></td>
          <td>${UI.escape(UI.date(r.date))}</td>
          <td>${UI.escape(docCustomer(doc, r))}</td>${due}
          <td class="num">${UI.money(r.total)}</td>${bal}${st}
          <td class="actions">
            <button class="link-btn" data-view="${UI.escape(r.id)}">View</button>${pay}
            <button class="link-btn" data-edit="${UI.escape(r.id)}">Edit</button>
            <button class="link-btn link-btn--danger" data-del="${UI.escape(r.id)}">Delete</button>
          </td></tr>`;
      }).join('')}</tbody></table>`;

    t.querySelectorAll('[data-view]').forEach(b => b.onclick = () => Router.go(doc.detailRoute + '?id=' + b.dataset.view));
    t.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => Router.go(doc.editRoute + '?id=' + b.dataset.edit));
    t.querySelectorAll('[data-pay]').forEach(b => b.onclick = () => {
      const r = rows.find(x => String(x.id) === String(b.dataset.pay));
      PaymentModal.open(r, () => Router.resolve());
    });
    t.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      const r = rows.find(x => String(x.id) === String(b.dataset.del));
      if (!confirm(`Delete ${r[doc.numberField]}?`)) return;
      UI.loading(true, 'Deleting…');
      try { await API.call(doc.deleteAction, { id: r.id }); UI.loading(false); UI.toast('Deleted.', 'success'); Router.resolve(); }
      catch (e) { UI.loading(false); UI.toast(e.message, 'error'); }
    });
  };

  const apply = () => {
    let list = rows.slice();
    if (doc.statusTabs && filter !== 'all') list = list.filter(r => String(r.status) === filter);
    if (q) list = list.filter(r => (r[doc.numberField] + ' ' + docCustomer(doc, r) + ' ' + (r.status || '')).toLowerCase().indexOf(q) !== -1);
    draw(list);
  };

  if (doc.statusTabs) mount.querySelectorAll('.ftab').forEach(b => b.onclick = () => {
    mount.querySelectorAll('.ftab').forEach(x => x.classList.toggle('active', x === b));
    filter = b.dataset.f; apply();
  });
  const search = mount.querySelector('#s-search');
  search.oninput = () => { q = search.value.trim().toLowerCase(); apply(); };
  apply();
}

/* =====================================================================
   EDITOR (create + edit, both document types)
   ===================================================================== */
const SalesEditor = {
  async open(mount, doc, id) {
    UI.loading(true);
    let existing = null;
    try { await Sales.preload(); if (id) existing = await API.call(doc.detailAction, { id }); }
    catch (e) { UI.loading(false); salesErr(mount, doc.singular, e.message); return; }
    UI.loading(false);

    const rec = existing ? (existing.invoice || existing.receipt || existing.record) : {};
    const exItems = existing ? existing.items : [];
    const today = new Date().toISOString().slice(0, 10);
    const state = {
      doc, id: id || null,
      customer_id: rec.customer_id || (doc.walkIn ? 'walkin' : ''),
      date: rec.date ? String(rec.date).slice(0, 10) : today,
      due_date: rec.due_date ? String(rec.due_date).slice(0, 10) : today,
      reference_no: rec.reference_no || '',
      sales_rep: rec.sales_rep || '',
      order_type: rec.order_type || 'Local',
      notes: rec.notes || '',
      discType: rec.discount ? 'Discount Value' : 'Discount Percent',
      discVal: rec.discount ? String(rec.discount) : '',
      lines: (exItems && exItems.length)
        ? exItems.map(it => ({ item_id: it.item_id, description: it.description, qty: it.qty, unit_price: it.unit_price, discount: it.discount, line_total: it.line_total }))
        : [this.blankLine()],
      balanceForward: 0,
      _totals: { subtotal: 0, discount: 0, total: 0 }
    };

    // customer dropdown
    const custOpts = (doc.walkIn ? `<option value="walkin">Walk-in Customer</option>` : `<option value="">— select customer —</option>`)
      + Sales.customers.map(c => `<option value="${UI.escape(c.id)}"${String(c.id) === String(state.customer_id) ? ' selected' : ''}>${UI.escape(c.name)}</option>`).join('');
    const repOpts = `<option value="">— none —</option>` +
      Sales.reps.map(r => `<option value="${UI.escape(r.id)}"${String(r.id) === String(state.sales_rep) ? ' selected' : ''}>${UI.escape(r.name)}</option>`).join('');
    const otOpts = ORDER_TYPES.map(o => `<option${o === state.order_type ? ' selected' : ''}>${o}</option>`).join('');

    const dueField = doc.hasDueDate ? `<label class="field"><span class="field-label">Due Date</span><input type="date" id="s-due" value="${UI.escape(state.due_date)}"></label>` : '';
    const refField = doc.hasReference ? `<label class="field"><span class="field-label">Reference No</span><input id="s-ref" value="${UI.escape(state.reference_no)}"></label>` : '';

    mount.innerHTML = `
      <div class="page-head">
        <h1>${id ? 'Edit ' + UI.escape(doc.singular) + ' ' + UI.escape(rec[doc.numberField] || '') : 'New ' + UI.escape(doc.singular)}</h1>
        <span class="page-sub">${id ? '' : doc.numberLabel + ' assigned on save'}</span>
      </div>

      <div class="card">
        <div class="form-grid">
          <label class="field${doc.hasDueDate ? '' : ' field--wide'}"><span class="field-label">Customer${doc.customerRequired ? ' <span class="req">*</span>' : ''}</span>
            <span class="input-with-btn"><select id="s-customer">${custOpts}</select><button type="button" class="btn" id="s-add-customer" title="New customer">＋</button></span></label>
          <label class="field"><span class="field-label">${doc.hasDueDate ? 'Invoice Date' : 'Sale Date'}</span><input type="date" id="s-date" value="${UI.escape(state.date)}"></label>
          ${dueField}
          ${refField}
          <label class="field"><span class="field-label">Sales Representative</span><select id="s-rep">${repOpts}</select></label>
          <label class="field"><span class="field-label">Order Type</span><select id="s-ot">${otOpts}</select></label>
          <label class="field field--wide"><span class="field-label">Description</span><textarea id="s-notes" rows="2">${UI.escape(state.notes)}</textarea></label>
        </div>
      </div>

      <div class="card no-pad">
        <div class="table-wrap"><table class="data-table line-table">
          <thead><tr>
            <th style="min-width:180px;">Item</th><th>Description</th>
            <th class="num">Qty</th><th class="num">Unit Price</th><th>Discount</th>
            <th class="num">Line Total</th><th class="actions"></th>
          </tr></thead><tbody id="s-lines"></tbody>
        </table></div>
        <div class="line-add"><button class="btn" id="s-add-line">+ Add line</button></div>
      </div>

      <div class="totals-row">
        <div></div>
        <div class="totals-box">
          <div class="totals-line"><span>Subtotal</span><span id="t-sub" class="num">0.00</span></div>
          <div class="totals-line">
            <span><select id="s-disc-type" class="mini-select"><option>Discount Percent</option><option>Discount Value</option></select>
              <input id="s-disc-val" class="mini-input" value="${UI.escape(state.discVal)}"></span>
            <span id="t-disc" class="num">0.00</span>
          </div>
          ${doc.hasBalanceForward ? `
          <div class="totals-line"><span>New Charges</span><span id="t-new" class="num">0.00</span></div>
          <div class="totals-line"><span>Balance Forward</span><span id="t-bf" class="num">0.00</span></div>` : ''}
          <div class="totals-line totals-grand"><span>Total Amount Due</span><span id="t-total" class="num">0.00</span></div>
        </div>
      </div>

      <div class="form-actions">
        <button class="btn" id="s-cancel">Cancel</button>
        <button class="btn btn--primary" id="s-save">${id ? 'Save changes' : 'Create ' + doc.singular.toLowerCase()}</button>
      </div>`;

    if (state.discType === 'Discount Value') mount.querySelector('#s-disc-type').value = 'Discount Value';

    const linesEl = mount.querySelector('#s-lines');
    const itemOptions = (sel) => '<option value="">— item —</option>' +
      Sales.items.map(it => `<option value="${UI.escape(it.id)}"${String(it.id) === String(sel) ? ' selected' : ''}>${UI.escape(it.name)}${it.sku ? ' (' + UI.escape(it.sku) + ')' : ''}</option>`).join('');

    const recompute = () => {
      let subtotal = 0;
      state.lines.forEach((ln, i) => {
        const gross = Number(ln.qty || 0) * Number(ln.unit_price || 0);
        ln.line_total = Math.max(0, gross - Sales.lineDiscount(gross, Number(ln.qty || 0), ln.discount));
        subtotal += ln.line_total;
        const cell = linesEl.querySelector(`tr[data-i="${i}"] .ln-total`);
        if (cell) cell.textContent = UI.money(ln.line_total);
      });
      const disc = Sales.overallDiscount(subtotal, state.discType, state.discVal);
      const newCharges = Math.max(0, subtotal - disc);
      state._totals = { subtotal, discount: disc, total: newCharges };
      const due = newCharges + (doc.hasBalanceForward ? Number(state.balanceForward || 0) : 0);
      mount.querySelector('#t-sub').textContent = UI.money(subtotal);
      mount.querySelector('#t-disc').textContent = UI.money(disc);
      if (doc.hasBalanceForward) {
        mount.querySelector('#t-new').textContent = UI.money(newCharges);
        mount.querySelector('#t-bf').textContent = UI.money(state.balanceForward);
      }
      mount.querySelector('#t-total').textContent = UI.money(due);
    };

    const renderLines = () => {
      linesEl.innerHTML = state.lines.map((ln, i) => `
        <tr data-i="${i}">
          <td><select class="ln-item">${itemOptions(ln.item_id)}</select></td>
          <td><input class="ln-desc" value="${UI.escape(ln.description || '')}"></td>
          <td><input class="ln-qty num" type="number" step="any" value="${UI.escape(ln.qty || '')}"></td>
          <td><input class="ln-price num" type="number" step="0.01" value="${UI.escape(ln.unit_price || '')}"></td>
          <td><input class="ln-disc" value="${UI.escape(ln.discount || '')}" placeholder="0 or 5%"></td>
          <td class="num ln-total">${UI.money(ln.line_total || 0)}</td>
          <td class="actions"><button class="link-btn link-btn--danger ln-del" title="Remove">✕</button></td>
        </tr>`).join('');
      linesEl.querySelectorAll('tr').forEach(tr => this.wireLine(tr, state, recompute, renderLines));
      recompute();
    };
    renderLines();

    // balance forward (invoices only)
    const refreshBalance = async () => {
      if (!doc.hasBalanceForward) return;
      const cid = state.customer_id;
      if (!cid || cid === 'walkin') { state.balanceForward = 0; recompute(); return; }
      try {
        const res = await API.call('customerBalance', { customer_id: cid, exclude_id: state.id || '' });
        state.balanceForward = res.balance || 0;
      } catch { state.balanceForward = 0; }
      recompute();
    };
    refreshBalance();

    mount.querySelector('#s-add-line').onclick = () => { state.lines.push(this.blankLine()); renderLines(); };
    mount.querySelector('#s-customer').onchange = (e) => { state.customer_id = e.target.value; refreshBalance(); };
    const addCustBtn = mount.querySelector('#s-add-customer');
    if (addCustBtn) addCustBtn.onclick = () => CRUD.quickAdd('Customers', (rec) => {
      Sales.customers.push(rec);
      const sel = mount.querySelector('#s-customer');
      const opt = document.createElement('option');
      opt.value = rec.id; opt.textContent = rec.name; sel.appendChild(opt); sel.value = rec.id;
      state.customer_id = rec.id; refreshBalance();
    });
    mount.querySelector('#s-date').onchange = (e) => { state.date = e.target.value; };
    if (doc.hasDueDate) mount.querySelector('#s-due').onchange = (e) => { state.due_date = e.target.value; };
    if (doc.hasReference) mount.querySelector('#s-ref').oninput = (e) => { state.reference_no = e.target.value; };
    mount.querySelector('#s-rep').onchange = (e) => { state.sales_rep = e.target.value; };
    mount.querySelector('#s-ot').onchange = (e) => { state.order_type = e.target.value; };
    mount.querySelector('#s-notes').oninput = (e) => { state.notes = e.target.value; };
    mount.querySelector('#s-disc-type').onchange = (e) => { state.discType = e.target.value; recompute(); };
    mount.querySelector('#s-disc-val').oninput = (e) => { state.discVal = e.target.value; recompute(); };
    mount.querySelector('#s-cancel').onclick = () => Router.go(doc.listRoute);
    mount.querySelector('#s-save').onclick = () => this.save(state);
  },

  blankLine() { return { item_id: '', description: '', qty: 1, unit_price: '', discount: '', line_total: 0 }; },

  wireLine(tr, state, recompute, renderLines) {
    const i = Number(tr.dataset.i);
    const itemSel = tr.querySelector('.ln-item');
    const desc = tr.querySelector('.ln-desc');
    const qty = tr.querySelector('.ln-qty');
    const price = tr.querySelector('.ln-price');
    const disc = tr.querySelector('.ln-disc');

    const setQtyHint = async (itemId) => {
      if (!itemId) { qty.title = ''; return; }
      try { const r = await API.call('inventoryOnHand', { item_id: itemId }); qty.title = 'Quantity in hand: ' + (r.on_hand != null ? r.on_hand : 0); }
      catch { qty.title = ''; }
    };

    itemSel.onchange = () => {
      state.lines[i].item_id = itemSel.value;
      const it = Sales.items.find(x => String(x.id) === String(itemSel.value));
      if (it) {
        desc.value = it.name; state.lines[i].description = it.name;
        if (it.regular_price !== '' && it.regular_price != null) { price.value = it.regular_price; state.lines[i].unit_price = it.regular_price; }
        price.title = 'Cost: ' + UI.money(it.cost_price || 0);
      }
      setQtyHint(itemSel.value);
      recompute();
    };
    if (state.lines[i].item_id) {
      setQtyHint(state.lines[i].item_id);
      const it0 = Sales.items.find(x => String(x.id) === String(state.lines[i].item_id));
      if (it0) price.title = 'Cost: ' + UI.money(it0.cost_price || 0);
    }
    desc.oninput = () => { state.lines[i].description = desc.value; };
    qty.oninput = () => { state.lines[i].qty = qty.value; recompute(); };
    price.oninput = () => { state.lines[i].unit_price = price.value; recompute(); };
    disc.oninput = () => { state.lines[i].discount = disc.value; recompute(); };
    tr.querySelector('.ln-del').onclick = () => {
      if (state.lines.length === 1) state.lines[0] = this.blankLine();
      else state.lines.splice(i, 1);
      renderLines();
    };
  },

  async save(state) {
    const doc = state.doc;
    if (doc.customerRequired && (!state.customer_id || state.customer_id === 'walkin')) {
      UI.toast('Please select a customer.', 'error'); return;
    }
    const lines = state.lines.filter(l => (l.item_id || l.description) && Number(l.qty) > 0);
    if (!lines.length) { UI.toast('Add at least one line with a quantity.', 'error'); return; }
    const t = state._totals;

    const data = {
      date: state.date, notes: state.notes,
      sales_rep: state.sales_rep, order_type: state.order_type,
      subtotal: t.subtotal, discount: t.discount, tax: 0, total: t.total,
      lines: lines.map(l => ({
        item_id: l.item_id, description: l.description,
        qty: Number(l.qty || 0), unit_price: Number(l.unit_price || 0),
        discount: l.discount, line_total: Number(l.line_total || 0)
      }))
    };

    if (doc.walkIn) {
      const real = state.customer_id && state.customer_id !== 'walkin';
      data.customer_id = real ? state.customer_id : '';
      data.customer_name = real ? Sales.customerName(state.customer_id) : 'Walk-in Customer';
    } else {
      data.customer_id = state.customer_id;
      data.due_date = state.due_date;
      data.reference_no = state.reference_no;
    }

    UI.loading(true, state.id ? 'Saving…' : 'Creating…');
    try {
      const res = state.id
        ? await API.call(doc.updateAction, { id: state.id, data })
        : await API.call(doc.createAction, { data });
      UI.loading(false);
      UI.toast(state.id ? 'Saved.' : doc.singular + ' created.', 'success');
      Router.go(doc.detailRoute + '?id=' + res.id);
    } catch (e) { UI.loading(false); UI.toast(e.message, 'error'); }
  }
};

/* =====================================================================
   DETAIL / PRINT
   ===================================================================== */
async function buildSalesDetail(mount, doc, id) {
  if (!id) { mount.innerHTML = '<div class="card">Nothing specified.</div>'; return; }
  UI.loading(true);
  let detail;
  try { detail = await API.call(doc.detailAction, { id }); }
  catch (e) { UI.loading(false); salesErr(mount, doc.singular, e.message); return; }
  UI.loading(false);

  const co = window.ABS_CONFIG.COMPANY;
  const rec = detail.invoice || detail.receipt;
  const cust = detail.customer;
  const items = detail.items || [];
  const payments = detail.payments || [];
  const custName = doc.key === 'receipt' ? (rec.customer_name || (cust ? cust.name : 'Walk-in Customer')) : (cust ? cust.name : '—');

  const payBtn = doc.canPay ? `<button class="btn" id="pay-btn">Record Payment</button>` : '';
  const dueRow = doc.hasDueDate ? `<div class="inv-date">Due: ${UI.escape(UI.date(rec.due_date))}</div>` : '';
  const paidRows = doc.canPay ? `
    <div class="totals-line"><span>Paid</span><span class="num">${UI.money(rec.paid)}</span></div>
    <div class="totals-line totals-due"><span>Balance Due</span><span class="num">${UI.money(rec.balance)}</span></div>` :
    `<div class="totals-line totals-due" style="color:var(--ok);"><span>Paid in full</span><span class="num">${UI.money(rec.total)}</span></div>`;

  mount.innerHTML = `
    <div class="page-head no-print">
      <h1>${UI.escape(doc.singular)} ${UI.escape(rec[doc.numberField])}</h1>
      <div class="page-actions">
        <button class="btn" id="back-btn">← Back</button>
        <button class="btn" id="edit-btn">Edit</button>
        ${payBtn}
        <button class="btn btn--primary" id="print-btn">Print</button>
      </div>
    </div>

    <div class="card invoice-doc">
      <div class="inv-top">
        <div class="inv-company">
          ${co.logo ? `<img src="${co.logo}" alt="" class="inv-logo">` : ''}
          <div class="inv-company-text">
            <div class="inv-co-name">${UI.escape(co.name)}</div>
            <div class="inv-co-meta">${UI.escape(co.address || '')}<br>${UI.escape(co.phone || '')}${co.mobile ? ' · ' + UI.escape(co.mobile) : ''}${co.email ? ' · ' + UI.escape(co.email) : ''}</div>
          </div>
        </div>
        <div class="inv-title">
          <h2>${UI.escape(doc.docTitle)}</h2>
          <div class="inv-no">${UI.escape(rec[doc.numberField])}</div>
          <div class="inv-date">${UI.escape(UI.date(rec.date))}</div>
          ${dueRow}
          ${doc.canPay ? `<div>${Sales.statusBadge(rec.status)}</div>` : ''}
        </div>
      </div>

      <div class="inv-billto">
        <div class="inv-label">${doc.key === 'receipt' ? 'CUSTOMER' : 'BILL TO'}</div>
        <div class="inv-cust-name">${UI.escape(custName)}</div>
        <div class="inv-co-meta">${cust ? UI.escape(cust.address || '') : ''}${cust && cust.phone ? '<br>' + UI.escape(cust.phone) : ''}</div>
      </div>

      <table class="data-table inv-items">
        <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit Price</th><th class="num">Discount</th><th class="num">Amount</th></tr></thead>
        <tbody>${items.map(it => `<tr>
          <td>${UI.escape(it.description || '')}</td>
          <td class="num">${UI.escape(it.qty)}</td>
          <td class="num">${UI.money(it.unit_price)}</td>
          <td class="num">${UI.escape(it.discount || '—')}</td>
          <td class="num">${UI.money(it.line_total)}</td></tr>`).join('')}</tbody>
      </table>

      <div class="inv-totals">
        <div class="totals-line"><span>Subtotal</span><span class="num">${UI.money(rec.subtotal)}</span></div>
        <div class="totals-line"><span>Discount</span><span class="num">${UI.money(rec.discount)}</span></div>
        <div class="totals-line totals-grand"><span>Total</span><span class="num">${UI.money(rec.total)}</span></div>
        ${paidRows}
      </div>

      ${rec.notes ? `<div class="inv-notes"><div class="inv-label">NOTES</div>${UI.escape(rec.notes)}</div>` : ''}
      ${co.terms ? `<div class="inv-terms" dir="rtl"><div class="inv-label">TERMS &amp; CONDITIONS</div><div class="inv-terms-body">${UI.escape(co.terms)}</div></div>` : ''}

      ${payments.length ? `<div class="inv-payments no-print">
        <div class="inv-label">PAYMENTS</div>
        <table class="data-table"><thead><tr><th>Date</th><th>Method</th><th>Reference</th><th class="num">Amount</th></tr></thead>
        <tbody>${payments.map(p => `<tr><td>${UI.escape(UI.date(p.date))}</td><td>${UI.escape(p.method || '')}</td><td>${UI.escape(p.reference || '')}</td><td class="num">${UI.money(p.amount)}</td></tr>`).join('')}</tbody></table>
      </div>` : ''}
    </div>`;

  mount.querySelector('#back-btn').onclick = () => Router.go(doc.listRoute);
  mount.querySelector('#edit-btn').onclick = () => Router.go(doc.editRoute + '?id=' + rec.id);
  mount.querySelector('#print-btn').onclick = () => window.print();
  if (doc.canPay) mount.querySelector('#pay-btn').onclick = () => PaymentModal.open(rec, () => Router.resolve());
}

/* =====================================================================
   PAYMENT MODAL (invoices only)
   ===================================================================== */
const PaymentModal = {
  open(inv, onDone) {
    const modal = UI.el(`<div class="modal-overlay"><div class="modal">
      <div class="modal-head"><h2>Record Payment — ${UI.escape(inv.invoice_no)}</h2>
        <button class="icon-btn modal-close">✕</button></div>
      <form class="modal-body"><div class="form-grid">
        <label class="field"><span class="field-label">Date</span><input type="date" name="date" value="${new Date().toISOString().slice(0,10)}"></label>
        <label class="field"><span class="field-label">Amount <span class="req">*</span></span><input type="number" step="0.01" name="amount" value="${UI.escape(inv.balance)}"></label>
        <label class="field"><span class="field-label">Method</span>
          <select name="method"><option>Cash</option><option>Bank Transfer</option><option>Card</option><option>Cheque</option><option>Other</option></select></label>
        <label class="field"><span class="field-label">Reference</span><input name="reference"></label>
        <label class="field field--wide"><span class="field-label">Notes</span><input name="notes"></label>
      </div></form>
      <div class="modal-foot">
        <button class="btn modal-close">Cancel</button>
        <button class="btn btn--primary" id="pay-save">Save payment</button>
      </div></div></div>`);
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelectorAll('.modal-close').forEach(b => b.onclick = close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });

    modal.querySelector('#pay-save').onclick = async () => {
      const f = modal.querySelector('form');
      const amount = parseFloat(f.amount.value);
      if (isNaN(amount) || amount <= 0) { UI.toast('Enter a valid amount.', 'error'); return; }
      UI.loading(true, 'Saving payment…');
      try {
        await API.call('recordPayment', { data: {
          invoice_id: inv.id, date: f.date.value, amount: amount,
          method: f.method.value, reference: f.reference.value, notes: f.notes.value
        }});
        UI.loading(false); close(); UI.toast('Payment recorded.', 'success');
        if (onDone) onDone();
      } catch (e) { UI.loading(false); UI.toast(e.message, 'error'); }
    };
  }
};

/* =====================================================================
   ROUTES
   ===================================================================== */
Router.register('invoices',            (m) => buildSalesList(m, DOC.invoice));
Router.register('new-invoice',         (m) => SalesEditor.open(m, DOC.invoice, null));
Router.register('edit-invoice',        (m, p) => SalesEditor.open(m, DOC.invoice, p.id));
Router.register('invoice-detail',      (m, p) => buildSalesDetail(m, DOC.invoice, p.id));

Router.register('sales-receipts',      (m) => buildSalesList(m, DOC.receipt));
Router.register('new-sales-receipt',   (m) => SalesEditor.open(m, DOC.receipt, null));
Router.register('edit-sales-receipt',  (m, p) => SalesEditor.open(m, DOC.receipt, p.id));
Router.register('sales-receipt-detail',(m, p) => buildSalesDetail(m, DOC.receipt, p.id));

Router.register('sales-orders',        (m) => buildSalesList(m, DOC.salesorder));
Router.register('new-sales-order',     (m) => SalesEditor.open(m, DOC.salesorder, null));
Router.register('edit-sales-order',    (m, p) => SalesEditor.open(m, DOC.salesorder, p.id));

Router.register('quotations',          (m) => buildSalesList(m, DOC.quotation));
Router.register('new-quotation',       (m) => SalesEditor.open(m, DOC.quotation, null));
Router.register('edit-quotation',      (m, p) => SalesEditor.open(m, DOC.quotation, p.id));

Router.register('credit-memos',        (m) => buildSalesList(m, DOC.creditmemo));
Router.register('new-credit-memo',     (m) => SalesEditor.open(m, DOC.creditmemo, null));
Router.register('edit-credit-memo',    (m, p) => SalesEditor.open(m, DOC.creditmemo, p.id));

async function buildAllTransactions(mount) {
  UI.loading(true);
  let rows;
  try { rows = await API.call('allTransactions'); }
  catch (e) { UI.loading(false); salesErr(mount, 'transactions', e.message); return; }
  UI.loading(false);

  mount.innerHTML = `
    <div class="page-head"><h1>All Transactions</h1><span class="page-sub" id="at-count"></span>
      <div class="page-actions"><input id="at-search" class="search-input" placeholder="Search transactions…"></div>
    </div>
    <div class="card no-pad"><div class="table-wrap" id="at-table"></div></div>`;

  const detailRoute = (d) => d === 'receipt' ? 'sales-receipt-detail' : 'invoice-detail';
  const draw = (list) => {
    document.getElementById('at-count').textContent = `${list.length} transaction${list.length === 1 ? '' : 's'}`;
    const t = document.getElementById('at-table');
    if (!list.length) { t.innerHTML = `<div class="empty">${UI.icon('file-text')}<h3>No transactions yet</h3><p>Invoices and sales receipts appear here as you create them.</p></div>`; return; }
    t.innerHTML = `<table class="data-table"><thead><tr>
        <th>Date</th><th>Name</th><th>Type</th><th class="num">Amount</th><th class="num">Balance</th><th class="actions"></th>
      </tr></thead><tbody>${list.map(r => `
        <tr>
          <td>${UI.escape(UI.date(r.date))}</td>
          <td>${UI.escape(r.name || '—')}</td>
          <td><strong>${UI.escape(r.number)}</strong> <span class="muted">${UI.escape(r.type)}</span></td>
          <td class="num">${UI.money(r.amount)}</td>
          <td class="num">${r.doc === 'invoice' ? UI.money(r.balance) : '—'}</td>
          <td class="actions"><button class="link-btn" data-view="${UI.escape(r.id)}" data-doc="${UI.escape(r.doc)}">View</button></td>
        </tr>`).join('')}</tbody></table>`;
    t.querySelectorAll('[data-view]').forEach(b => b.onclick = () => Router.go(detailRoute(b.dataset.doc) + '?id=' + b.dataset.view));
  };
  draw(rows);
  const s = mount.querySelector('#at-search');
  s.oninput = () => { const q = s.value.trim().toLowerCase(); draw(!q ? rows : rows.filter(r => ((r.number || '') + ' ' + (r.name || '') + ' ' + (r.type || '')).toLowerCase().indexOf(q) !== -1)); };
}
Router.register('all-transactions', buildAllTransactions);

window.Sales = Sales;
window.SalesEditor = SalesEditor;
window.PaymentModal = PaymentModal;
