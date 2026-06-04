/* =====================================================================
   Adil Business Solutions — Invoicing (Phase 2)
   Routes: invoices (list), new-invoice / edit-invoice (editor),
           invoice-detail (printable view)
   ===================================================================== */

const Invoices = {
  items: [],
  customers: [],

  // discount helper (ported from the original Diyar logic)
  // amount = base to apply % against; qty used for fixed per-unit discounts
  discountAmount(amount, qty, val, overall) {
    let d = 0;
    const s = (val == null) ? '' : String(val).trim();
    if (s.length) {
      if (s.indexOf('%') !== -1) {
        const num = parseFloat(s);
        if (!isNaN(num)) d = amount * (num / 100);
      } else {
        const num = parseFloat(s);
        if (!isNaN(num)) d = overall ? num : num * qty;
      }
    }
    return d;
  },

  statusBadge(s) {
    const map = { paid: 'ok', partial: 'warn', unpaid: 'bad' };
    return `<span class="badge badge--${map[s] || 'bad'}">${UI.escape((s || 'unpaid').toUpperCase())}</span>`;
  },

  async preload() {
    [this.items, this.customers] = await Promise.all([API.list('Items'), API.list('Customers')]);
  },
  customerName(id) {
    const c = this.customers.find(x => String(x.id) === String(id));
    return c ? c.name : '—';
  }
};

/* ---------------------------------------------------------------------
   LIST
--------------------------------------------------------------------- */
Router.register('invoices', async (mount) => {
  UI.loading(true);
  let invoices;
  try {
    await Invoices.preload();
    invoices = await API.list('Invoices');
  } catch (e) {
    UI.loading(false);
    mount.innerHTML = `<div class="card"><div class="empty">${UI.icon('alert')}<h3>Couldn't load invoices</h3><p>${UI.escape(e.message)}</p></div></div>`;
    return;
  }
  UI.loading(false);
  invoices.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  mount.innerHTML = `
    <div class="page-head">
      <h1>Invoices</h1><span class="page-sub" id="inv-count"></span>
      <div class="page-actions">
        <input id="inv-search" class="search-input" placeholder="Search invoices…">
        <button class="btn btn--primary" id="inv-new">+ New Invoice</button>
      </div>
    </div>
    <div class="card no-pad"><div class="table-wrap" id="inv-table"></div></div>`;

  mount.querySelector('#inv-new').onclick = () => Router.go('new-invoice');

  const draw = (list) => {
    document.getElementById('inv-count').textContent = `${list.length} invoice${list.length === 1 ? '' : 's'}`;
    const t = document.getElementById('inv-table');
    if (!list.length) {
      t.innerHTML = `<div class="empty">${UI.icon('file-text')}<h3>No invoices yet</h3><p>Click “New Invoice” to create your first one.</p></div>`;
      return;
    }
    t.innerHTML = `<table class="data-table"><thead><tr>
        <th>Invoice #</th><th>Date</th><th>Customer</th>
        <th class="num">Total</th><th class="num">Balance</th><th>Status</th><th class="actions"></th>
      </tr></thead><tbody>${list.map(inv => `
        <tr>
          <td><strong>${UI.escape(inv.invoice_no)}</strong></td>
          <td>${UI.escape(UI.date(inv.date))}</td>
          <td>${UI.escape(Invoices.customerName(inv.customer_id))}</td>
          <td class="num">${UI.money(inv.total)}</td>
          <td class="num">${UI.money(inv.balance)}</td>
          <td>${Invoices.statusBadge(inv.status)}</td>
          <td class="actions">
            <button class="link-btn" data-view="${UI.escape(inv.id)}">View</button>
            <button class="link-btn" data-pay="${UI.escape(inv.id)}">Pay</button>
            <button class="link-btn" data-edit="${UI.escape(inv.id)}">Edit</button>
            <button class="link-btn link-btn--danger" data-del="${UI.escape(inv.id)}">Delete</button>
          </td>
        </tr>`).join('')}</tbody></table>`;

    t.querySelectorAll('[data-view]').forEach(b => b.onclick = () => Router.go('invoice-detail?id=' + b.dataset.view));
    t.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => Router.go('edit-invoice?id=' + b.dataset.edit));
    t.querySelectorAll('[data-pay]').forEach(b => b.onclick = () => {
      const inv = list.find(x => String(x.id) === String(b.dataset.pay));
      PaymentModal.open(inv, () => Router.resolve());
    });
    t.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      const inv = list.find(x => String(x.id) === String(b.dataset.del));
      if (!confirm(`Delete invoice ${inv.invoice_no}?`)) return;
      UI.loading(true, 'Deleting…');
      try { await API.call('deleteInvoice', { id: inv.id }); UI.loading(false); UI.toast('Invoice deleted.', 'success'); Router.resolve(); }
      catch (e) { UI.loading(false); UI.toast(e.message, 'error'); }
    });
  };

  draw(invoices);
  const search = mount.querySelector('#inv-search');
  search.oninput = () => {
    const q = search.value.trim().toLowerCase();
    draw(!q ? invoices : invoices.filter(inv =>
      (inv.invoice_no + ' ' + Invoices.customerName(inv.customer_id) + ' ' + inv.status).toLowerCase().indexOf(q) !== -1));
  };
});

/* ---------------------------------------------------------------------
   EDITOR (create + edit)
--------------------------------------------------------------------- */
const InvoiceEditor = {
  async open(mount, id) {
    UI.loading(true);
    let existing = null;
    try {
      await Invoices.preload();
      if (id) existing = await API.call('invoiceDetail', { id });
    } catch (e) {
      UI.loading(false);
      mount.innerHTML = `<div class="card"><div class="empty">${UI.icon('alert')}<h3>Couldn't open editor</h3><p>${UI.escape(e.message)}</p></div></div>`;
      return;
    }
    UI.loading(false);

    const inv = existing ? existing.invoice : {};
    const state = {
      id: id || null,
      customer_id: inv.customer_id || '',
      date: inv.date ? String(inv.date).slice(0, 10) : new Date().toISOString().slice(0, 10),
      notes: inv.notes || '',
      overallDiscount: inv.discount ? String(inv.discount) : '',
      taxPct: window.ABS_CONFIG.COMPANY.tax_percent || 0,
      lines: (existing && existing.items.length) ? existing.items.map(it => ({
        item_id: it.item_id, description: it.description, qty: it.qty,
        unit_price: it.unit_price, discount: it.discount, line_total: it.line_total
      })) : [this.blankLine()]
    };

    const custOpts = '<option value="">— select customer —</option>' +
      Invoices.customers.map(c => `<option value="${UI.escape(c.id)}"${String(c.id) === String(state.customer_id) ? ' selected' : ''}>${UI.escape(c.name)}</option>`).join('');

    mount.innerHTML = `
      <div class="page-head">
        <h1>${id ? 'Edit Invoice ' + UI.escape(inv.invoice_no) : 'New Invoice'}</h1>
        <div class="page-actions">
          <button class="btn" id="inv-cancel">Cancel</button>
          <button class="btn btn--primary" id="inv-save">${id ? 'Save changes' : 'Create invoice'}</button>
        </div>
      </div>
      <div class="card">
        <div class="form-grid">
          <label class="field"><span class="field-label">Customer <span class="req">*</span></span>
            <select id="inv-customer">${custOpts}</select></label>
          <label class="field"><span class="field-label">Date</span>
            <input type="date" id="inv-date" value="${UI.escape(state.date)}"></label>
        </div>
      </div>
      <div class="card no-pad">
        <div class="table-wrap"><table class="data-table line-table">
          <thead><tr>
            <th style="min-width:180px;">Item</th><th>Description</th>
            <th class="num">Qty</th><th class="num">Unit Price</th><th>Discount</th>
            <th class="num">Line Total</th><th class="actions"></th>
          </tr></thead>
          <tbody id="inv-lines"></tbody>
        </table></div>
        <div class="line-add"><button class="btn" id="inv-add-line">+ Add line</button></div>
      </div>
      <div class="totals-row">
        <label class="field"><span class="field-label">Notes</span>
          <textarea id="inv-notes" rows="4">${UI.escape(state.notes)}</textarea></label>
        <div class="totals-box">
          <div class="totals-line"><span>Subtotal</span><span id="t-subtotal" class="num">0.00</span></div>
          <div class="totals-line"><span>Discount <input id="inv-discount" class="mini-input" placeholder="0 or 5%" value="${UI.escape(state.overallDiscount)}"></span><span id="t-discount" class="num">0.00</span></div>
          <div class="totals-line"><span>Tax <input id="inv-tax" class="mini-input" type="number" step="0.01" value="${UI.escape(state.taxPct)}">%</span><span id="t-tax" class="num">0.00</span></div>
          <div class="totals-line totals-grand"><span>Total</span><span id="t-total" class="num">0.00</span></div>
        </div>
      </div>`;

    const linesEl = mount.querySelector('#inv-lines');

    const itemOptions = (sel) => '<option value="">— item —</option>' +
      Invoices.items.map(it => `<option value="${UI.escape(it.id)}"${String(it.id) === String(sel) ? ' selected' : ''}>${UI.escape(it.name)}${it.sku ? ' (' + UI.escape(it.sku) + ')' : ''}</option>`).join('');

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

    const recompute = () => {
      let subtotal = 0;
      state.lines.forEach((ln, i) => {
        const gross = Number(ln.qty || 0) * Number(ln.unit_price || 0);
        const disc = Invoices.discountAmount(gross, Number(ln.qty || 0), ln.discount, false);
        ln.line_total = Math.max(0, gross - disc);
        subtotal += ln.line_total;
        const cell = linesEl.querySelector(`tr[data-i="${i}"] .ln-total`);
        if (cell) cell.textContent = UI.money(ln.line_total);
      });
      const overall = Invoices.discountAmount(subtotal, 1, state.overallDiscount, true);
      const taxable = Math.max(0, subtotal - overall);
      const tax = taxable * (Number(state.taxPct) || 0) / 100;
      const total = taxable + tax;
      state._totals = { subtotal, discount: overall, tax, total };
      mount.querySelector('#t-subtotal').textContent = UI.money(subtotal);
      mount.querySelector('#t-discount').textContent = UI.money(overall);
      mount.querySelector('#t-tax').textContent = UI.money(tax);
      mount.querySelector('#t-total').textContent = UI.money(total);
    };

    renderLines();

    mount.querySelector('#inv-add-line').onclick = () => { state.lines.push(this.blankLine()); renderLines(); };
    mount.querySelector('#inv-customer').onchange = (e) => { state.customer_id = e.target.value; };
    mount.querySelector('#inv-date').onchange = (e) => { state.date = e.target.value; };
    mount.querySelector('#inv-notes').oninput = (e) => { state.notes = e.target.value; };
    mount.querySelector('#inv-discount').oninput = (e) => { state.overallDiscount = e.target.value; recompute(); };
    mount.querySelector('#inv-tax').oninput = (e) => { state.taxPct = e.target.value; recompute(); };
    mount.querySelector('#inv-cancel').onclick = () => Router.go('invoices');
    mount.querySelector('#inv-save').onclick = () => this.save(state);
  },

  blankLine() { return { item_id: '', description: '', qty: 1, unit_price: '', discount: '', line_total: 0 }; },

  wireLine(tr, state, recompute, renderLines) {
    const i = Number(tr.dataset.i);
    const itemSel = tr.querySelector('.ln-item');
    const desc = tr.querySelector('.ln-desc');
    const qty = tr.querySelector('.ln-qty');
    const price = tr.querySelector('.ln-price');
    const disc = tr.querySelector('.ln-disc');

    itemSel.onchange = () => {
      state.lines[i].item_id = itemSel.value;
      const it = Invoices.items.find(x => String(x.id) === String(itemSel.value));
      if (it) {
        desc.value = it.name; state.lines[i].description = it.name;
        if (it.regular_price !== '' && it.regular_price != null) { price.value = it.regular_price; state.lines[i].unit_price = it.regular_price; }
      }
      recompute();
    };
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
    if (!state.customer_id) { UI.toast('Please select a customer.', 'error'); return; }
    const lines = state.lines.filter(l => (l.item_id || l.description) && Number(l.line_total) >= 0 && Number(l.qty) > 0);
    if (!lines.length) { UI.toast('Add at least one line with a quantity.', 'error'); return; }
    const t = state._totals || { subtotal: 0, discount: 0, tax: 0, total: 0 };

    const data = {
      customer_id: state.customer_id, date: state.date, notes: state.notes,
      subtotal: t.subtotal, discount: t.discount, tax: t.tax, total: t.total,
      lines: lines.map(l => ({
        item_id: l.item_id, description: l.description,
        qty: Number(l.qty || 0), unit_price: Number(l.unit_price || 0),
        discount: l.discount, line_total: Number(l.line_total || 0)
      }))
    };

    UI.loading(true, state.id ? 'Saving…' : 'Creating invoice…');
    try {
      const res = state.id
        ? await API.call('updateInvoice', { id: state.id, data })
        : await API.call('createInvoice', { data });
      UI.loading(false);
      UI.toast(state.id ? 'Invoice saved.' : 'Invoice created.', 'success');
      Router.go('invoice-detail?id=' + res.id);
    } catch (e) {
      UI.loading(false);
      UI.toast(e.message, 'error');
    }
  }
};

Router.register('new-invoice', (mount) => InvoiceEditor.open(mount, null));
Router.register('edit-invoice', (mount, params) => InvoiceEditor.open(mount, params.id));

/* ---------------------------------------------------------------------
   DETAIL / PRINT
--------------------------------------------------------------------- */
Router.register('invoice-detail', async (mount, params) => {
  if (!params.id) { mount.innerHTML = '<div class="card">No invoice specified.</div>'; return; }
  UI.loading(true);
  let detail;
  try { detail = await API.call('invoiceDetail', { id: params.id }); }
  catch (e) {
    UI.loading(false);
    mount.innerHTML = `<div class="card"><div class="empty">${UI.icon('alert')}<h3>Couldn't load invoice</h3><p>${UI.escape(e.message)}</p></div></div>`;
    return;
  }
  UI.loading(false);

  const co = window.ABS_CONFIG.COMPANY;
  const inv = detail.invoice, cust = detail.customer, items = detail.items, payments = detail.payments;

  mount.innerHTML = `
    <div class="page-head no-print">
      <h1>Invoice ${UI.escape(inv.invoice_no)}</h1>
      <div class="page-actions">
        <button class="btn" id="back-btn">← Back</button>
        <button class="btn" id="edit-btn">Edit</button>
        <button class="btn" id="pay-btn">Record Payment</button>
        <button class="btn btn--primary" id="print-btn">Print</button>
      </div>
    </div>

    <div class="card invoice-doc">
      <div class="inv-top">
        <div class="inv-company">
          <div class="inv-co-name">${UI.escape(co.name)}</div>
          <div class="inv-co-meta">${UI.escape(co.address || '')}<br>${UI.escape(co.phone || '')}${co.email ? ' · ' + UI.escape(co.email) : ''}</div>
        </div>
        <div class="inv-title">
          <h2>INVOICE</h2>
          <div class="inv-no">${UI.escape(inv.invoice_no)}</div>
          <div class="inv-date">${UI.escape(UI.date(inv.date))}</div>
          <div>${Invoices.statusBadge(inv.status)}</div>
        </div>
      </div>

      <div class="inv-billto">
        <div class="inv-label">BILL TO</div>
        <div class="inv-cust-name">${UI.escape(cust ? cust.name : '—')}</div>
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
        <div class="totals-line"><span>Subtotal</span><span class="num">${UI.money(inv.subtotal)}</span></div>
        <div class="totals-line"><span>Discount</span><span class="num">${UI.money(inv.discount)}</span></div>
        <div class="totals-line"><span>Tax</span><span class="num">${UI.money(inv.tax)}</span></div>
        <div class="totals-line totals-grand"><span>Total</span><span class="num">${UI.money(inv.total)}</span></div>
        <div class="totals-line"><span>Paid</span><span class="num">${UI.money(inv.paid)}</span></div>
        <div class="totals-line totals-due"><span>Balance Due</span><span class="num">${UI.money(inv.balance)}</span></div>
      </div>

      ${inv.notes ? `<div class="inv-notes"><div class="inv-label">NOTES</div>${UI.escape(inv.notes)}</div>` : ''}

      ${payments.length ? `<div class="inv-payments no-print">
        <div class="inv-label">PAYMENTS</div>
        <table class="data-table"><thead><tr><th>Date</th><th>Method</th><th>Reference</th><th class="num">Amount</th></tr></thead>
        <tbody>${payments.map(p => `<tr><td>${UI.escape(UI.date(p.date))}</td><td>${UI.escape(p.method || '')}</td><td>${UI.escape(p.reference || '')}</td><td class="num">${UI.money(p.amount)}</td></tr>`).join('')}</tbody></table>
      </div>` : ''}
    </div>`;

  mount.querySelector('#back-btn').onclick = () => Router.go('invoices');
  mount.querySelector('#edit-btn').onclick = () => Router.go('edit-invoice?id=' + inv.id);
  mount.querySelector('#print-btn').onclick = () => window.print();
  mount.querySelector('#pay-btn').onclick = () => PaymentModal.open(inv, () => Router.resolve());
});

/* ---------------------------------------------------------------------
   PAYMENT MODAL
--------------------------------------------------------------------- */
const PaymentModal = {
  open(inv, onDone) {
    const modal = UI.el(`<div class="modal-overlay"><div class="modal">
      <div class="modal-head"><h2>Record Payment — ${UI.escape(inv.invoice_no)}</h2>
        <button class="icon-btn modal-close">✕</button></div>
      <form class="modal-body form-grid">
        <label class="field"><span class="field-label">Date</span><input type="date" name="date" value="${new Date().toISOString().slice(0,10)}"></label>
        <label class="field"><span class="field-label">Amount <span class="req">*</span></span><input type="number" step="0.01" name="amount" value="${UI.escape(inv.balance)}"></label>
        <label class="field"><span class="field-label">Method</span>
          <select name="method"><option>Cash</option><option>Bank Transfer</option><option>Card</option><option>Cheque</option><option>Other</option></select></label>
        <label class="field"><span class="field-label">Reference</span><input name="reference"></label>
        <label class="field field--wide"><span class="field-label">Notes</span><input name="notes"></label>
      </form>
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
        UI.loading(false); close();
        UI.toast('Payment recorded.', 'success');
        if (onDone) onDone();
      } catch (e) { UI.loading(false); UI.toast(e.message, 'error'); }
    };
  }
};

window.Invoices = Invoices;
window.InvoiceEditor = InvoiceEditor;
window.PaymentModal = PaymentModal;
