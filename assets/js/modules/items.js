/* =====================================================================
   Adil Business Solutions — Items, Item Search, Price Manager
   ===================================================================== */

const itemsCfg = {
  entity: 'Items',
  title: 'Items',
  singular: 'Item',
  columns: [
    { key: 'sku',           label: 'UPC' },
    { key: 'name',          label: 'Name' },
    { key: 'category_id',   label: 'Category', ref: 'Categories' },
    { key: 'brand_id',      label: 'Brand',    ref: 'Brands' },
    { key: 'regular_price', label: 'Price',    type: 'money' },
    { key: 'reorder_level', label: 'Reorder',  type: 'number' }
  ],
  tabs: [
    { label: 'General' },
    { label: 'Pricing & Accounts' },
    { label: 'Inventory' }
  ],
  fields: [
    { key: 'item_type',   label: 'Type', type: 'select', tab: 'General', default: 'Inventory Item',
      options: [{ value: 'Inventory Item', label: 'Inventory Item' }, { value: 'Service', label: 'Service' }, { value: 'Non-Inventory', label: 'Non-Inventory' }] },
    { key: 'name',        label: 'Item Name / Number', required: true, wide: true, tab: 'General' },
    { key: 'sku',         label: 'UPC / Code (auto-assigned if left blank)', tab: 'General' },
    { key: 'unique_id',   label: 'Unique ID (your own searchable code, optional)', tab: 'General' },
    { key: 'category_id', label: 'Category',  type: 'select', ref: 'Categories', tab: 'General' },
    { key: 'brand_id',    label: 'Brand',     type: 'select', ref: 'Brands', quickAdd: 'Brands', tab: 'General' },
    { key: 'supplier_id', label: 'Supplier',  type: 'select', ref: 'Suppliers', quickAdd: 'Suppliers', tab: 'General' },
    { key: 'uom_id',      label: 'UOM',       type: 'select', ref: 'UOM', tab: 'General' },
    { key: 'size',        label: 'Size', tab: 'General' },
    { key: 'attributes',  label: 'Attributes', tab: 'General' },
    { key: 'expiry_date', label: 'Expiry date', type: 'date', tab: 'General' },
    { key: 'cost_price',      label: 'Purchase Price',  type: 'number', step: '0.01', tab: 'Pricing & Accounts' },
    { key: 'regular_price',   label: 'Regular Price',   type: 'number', step: '0.01', tab: 'Pricing & Accounts' },
    { key: 'wholesale_price', label: 'Wholesale Price', type: 'number', step: '0.01', tab: 'Pricing & Accounts' },
    { key: 'commission',      label: 'Commission',      type: 'number', step: '0.01', tab: 'Pricing & Accounts' },
    { key: 'cogs_account_id',   label: 'COGS Account',   type: 'select', ref: 'Accounts', labelKey: 'account_name', tab: 'Pricing & Accounts' },
    { key: 'income_account_id', label: 'Income Account', type: 'select', ref: 'Accounts', labelKey: 'account_name', tab: 'Pricing & Accounts' },
    { key: 'asset_account_id',  label: 'Asset Account',  type: 'select', ref: 'Accounts', labelKey: 'account_name', tab: 'Pricing & Accounts' },
    { key: 'purchase_description', label: 'Purchase Description', type: 'textarea', wide: true, tab: 'Pricing & Accounts' },
    { key: 'sale_description',     label: 'Sale Description',     type: 'textarea', wide: true, tab: 'Pricing & Accounts' },
    { key: 'reorder_level',  label: 'Reorder Point',          type: 'number', tab: 'Inventory' },
    { key: 'max_order_qty',  label: 'Maximum Order Quantity', type: 'number', tab: 'Inventory' },
    { key: 'opening_qty',    label: 'Opening Qty on-hand (set once, when creating)', type: 'number', tab: 'Inventory' }
  ]
};

Router.register('items',    (m) => CRUD.page(m, itemsCfg));
Router.register('new-item', (m) => CRUD.page(m, itemsCfg, { openNew: true }));

/* =====================================================================
   ITEM SEARCH — find an item, see stock on hand + movement history
   ===================================================================== */
Router.register('item-search', async (mount) => {
  UI.loading(true);
  let items, cats = {}, brands = {};
  try {
    const [it, c, b] = await Promise.all([API.list('Items'), API.list('Categories'), API.list('Brands')]);
    items = it; c.forEach(x => cats[String(x.id)] = x.name); b.forEach(x => brands[String(x.id)] = x.name);
  } catch (e) { UI.loading(false); mount.innerHTML = `<div class="card"><div class="empty">${UI.icon('alert')}<h3>Couldn't load items</h3><p>${UI.escape(e.message)}</p></div></div>`; return; }
  UI.loading(false);

  mount.innerHTML = `
    <div class="page-head"><h1>Item Search</h1><span class="page-sub">${items.length} items</span></div>
    <div class="card"><input id="is-q" class="search-input" style="width:100%" placeholder="Search by name or UPC…" autofocus></div>
    <div class="item-search-grid">
      <div class="card no-pad"><div class="table-wrap" id="is-results"></div></div>
      <div class="card" id="is-detail"><div class="empty">${UI.icon('box')}<h3>Select an item</h3><p>Search above and pick an item to see its stock and history.</p></div></div>
    </div>`;

  const resultsEl = mount.querySelector('#is-results');
  const drawResults = (list) => {
    if (!list.length) { resultsEl.innerHTML = `<div class="empty"><p>No matching items.</p></div>`; return; }
    resultsEl.innerHTML = `<table class="data-table"><thead><tr><th>UPC</th><th>Name</th><th>Category</th></tr></thead>
      <tbody>${list.slice(0, 100).map(it => `<tr class="is-row" data-id="${UI.escape(it.id)}" style="cursor:pointer">
        <td>${UI.escape(it.sku || '')}</td><td><strong>${UI.escape(it.name)}</strong></td><td>${UI.escape(cats[String(it.category_id)] || '—')}</td>
      </tr>`).join('')}</tbody></table>`;
    resultsEl.querySelectorAll('.is-row').forEach(r => r.onclick = () => { resultsEl.querySelectorAll('.is-row').forEach(x => x.classList.remove('row-active')); r.classList.add('row-active'); showItem(r.dataset.id); });
  };
  const showItem = async (id) => {
    const panel = mount.querySelector('#is-detail');
    panel.innerHTML = `<div class="conn-status"><span class="dot dot--wait"></span> Loading…</div>`;
    try {
      const card = await API.call('itemCard', { item_id: id });
      const it = card.item;
      panel.innerHTML = `
        <div class="card-head"><h2>${UI.escape(it.name)}</h2></div>
        <div class="item-stats">
          <div class="stat"><span class="stat-label">On-hand Qty</span><span class="stat-value">${UI.escape(card.on_hand)}</span></div>
          <div class="stat"><span class="stat-label">Avg. Cost</span><span class="stat-value">${UI.money(it.cost_price)}</span></div>
          <div class="stat"><span class="stat-label">Regular Price</span><span class="stat-value">${UI.money(it.regular_price)}</span></div>
          <div class="stat"><span class="stat-label">Wholesale</span><span class="stat-value">${UI.money(it.wholesale_price)}</span></div>
        </div>
        <p class="muted">UPC ${UI.escape(it.sku || '—')} · ${UI.escape(cats[String(it.category_id)] || 'No category')}${it.brand_id ? ' · ' + UI.escape(brands[String(it.brand_id)] || '') : ''}${it.expiry_date ? ' · Expiry ' + UI.escape(UI.date(it.expiry_date)) : ''} · ${it.status === 'inactive' ? 'Inactive' : 'Active'}</p>
        <div class="card-head"><h2>Stock history</h2></div>
        ${card.movements.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Change</th><th class="num">Qty</th><th>Reference</th></tr></thead>
          <tbody>${card.movements.map(m => `<tr><td>${UI.escape(UI.date(m.date))}</td><td>${m.type === 'out' ? 'Out' : 'In'}</td><td class="num">${m.type === 'out' ? '-' : '+'}${UI.escape(m.qty)}</td><td>${UI.escape((m.reference_type || '') + (m.notes ? ' · ' + m.notes : ''))}</td></tr>`).join('')}</tbody></table></div>`
          : `<p class="muted">No stock movements recorded yet.</p>`}`;
    } catch (e) { panel.innerHTML = `<div class="empty">${UI.icon('alert')}<p>${UI.escape(e.message)}</p></div>`; }
  };

  const q = mount.querySelector('#is-q');
  const apply = () => {
    const s = q.value.trim().toLowerCase();
    drawResults(!s ? items : items.filter(it => (it.name + ' ' + (it.sku || '') + ' ' + (it.unique_id || '')).toLowerCase().indexOf(s) !== -1));
  };
  q.oninput = apply;
  apply();
});

/* =====================================================================
   PRICE MANAGER — bulk edit regular / wholesale prices
   ===================================================================== */
Router.register('price-manager', async (mount) => {
  UI.loading(true);
  let items, categories, brands, suppliers;
  try {
    [items, categories, brands, suppliers] = await Promise.all([API.list('Items'), API.list('Categories'), API.list('Brands'), API.list('Suppliers')]);
  } catch (e) { UI.loading(false); mount.innerHTML = `<div class="card"><div class="empty">${UI.icon('alert')}<h3>Couldn't load</h3><p>${UI.escape(e.message)}</p></div></div>`; return; }
  UI.loading(false);

  const sel = (list, labelKey) => '<option value="">All</option>' + list.map(x => `<option value="${UI.escape(x.id)}">${UI.escape(x[labelKey] || x.name)}</option>`).join('');
  mount.innerHTML = `
    <div class="page-head"><h1>Price Manager</h1><span class="page-sub">Bulk-update prices</span>
      <div class="page-actions"><button class="btn btn--primary" id="pm-save" disabled>Save changes</button></div>
    </div>
    <div class="card"><div class="form-grid">
      <label class="field"><span class="field-label">Category</span><select id="pm-cat">${sel(categories, 'name')}</select></label>
      <label class="field"><span class="field-label">Brand</span><select id="pm-brand">${sel(brands, 'name')}</select></label>
      <label class="field"><span class="field-label">Supplier</span><select id="pm-supp">${sel(suppliers, 'name')}</select></label>
    </div></div>
    <div class="card no-pad"><div class="table-wrap" id="pm-table"></div></div>`;

  const edits = {};
  const saveBtn = mount.querySelector('#pm-save');
  const refreshSaveState = () => { const n = Object.keys(edits).length; saveBtn.disabled = n === 0; saveBtn.textContent = n ? `Save ${n} change(s)` : 'Save changes'; };

  const draw = () => {
    const cat = mount.querySelector('#pm-cat').value, br = mount.querySelector('#pm-brand').value, sp = mount.querySelector('#pm-supp').value;
    const list = items.filter(it => (!cat || String(it.category_id) === cat) && (!br || String(it.brand_id) === br) && (!sp || String(it.supplier_id) === sp));
    const t = mount.querySelector('#pm-table');
    if (!list.length) { t.innerHTML = `<div class="empty"><p>No items match these filters.</p></div>`; return; }
    t.innerHTML = `<table class="data-table"><thead><tr><th>UPC</th><th>Item</th><th class="num">Regular Price</th><th class="num">Wholesale</th></tr></thead>
      <tbody>${list.map(it => `<tr data-id="${UI.escape(it.id)}">
        <td>${UI.escape(it.sku || '')}</td><td>${UI.escape(it.name)}</td>
        <td><input class="pm-r num" type="number" step="0.01" value="${UI.escape(it.regular_price || '')}"></td>
        <td><input class="pm-w num" type="number" step="0.01" value="${UI.escape(it.wholesale_price || '')}"></td>
      </tr>`).join('')}</tbody></table>`;
    t.querySelectorAll('tr[data-id]').forEach(tr => {
      const id = tr.dataset.id;
      const mark = () => { edits[id] = { id, regular_price: tr.querySelector('.pm-r').value, wholesale_price: tr.querySelector('.pm-w').value }; refreshSaveState(); };
      tr.querySelector('.pm-r').oninput = mark;
      tr.querySelector('.pm-w').oninput = mark;
    });
  };
  mount.querySelector('#pm-cat').onchange = draw;
  mount.querySelector('#pm-brand').onchange = draw;
  mount.querySelector('#pm-supp').onchange = draw;
  saveBtn.onclick = async () => {
    const updates = Object.values(edits);
    if (!updates.length) return;
    UI.loading(true, 'Updating prices…');
    try {
      const r = await API.call('updatePrices', { updates });
      updates.forEach(u => { const it = items.find(x => String(x.id) === String(u.id)); if (it) { it.regular_price = u.regular_price; it.wholesale_price = u.wholesale_price; } });
      Object.keys(edits).forEach(k => delete edits[k]);
      refreshSaveState();
      UI.loading(false); UI.toast(`Updated ${r.updated} item(s).`, 'success');
    } catch (e) { UI.loading(false); UI.toast(e.message, 'error'); }
  };
  draw();
});

/* =====================================================================
   INVENTORY ALERT — items at or below their re-order point
   ===================================================================== */
Router.register('inventory-alert', async (mount) => {
  UI.loading(true);
  let rows;
  try { rows = await API.inventoryAlerts(); }
  catch (e) { UI.loading(false); mount.innerHTML = `<div class="card"><div class="empty">${UI.icon('alert')}<h3>Couldn't load alerts</h3><p>${UI.escape(e.message)}</p></div></div>`; return; }
  UI.loading(false);

  mount.innerHTML = `
    <div class="page-head"><h1>Inventory Alert</h1><span class="page-sub" id="ia-count"></span>
      <div class="page-actions"><input id="ia-q" class="search-input" placeholder="Search…"></div>
    </div>
    <div class="card no-pad"><div class="table-wrap" id="ia-table"></div></div>`;

  let q = '';
  const draw = (list) => {
    mount.querySelector('#ia-count').textContent = `${list.length} item${list.length === 1 ? '' : 's'} need attention`;
    const t = mount.querySelector('#ia-table');
    if (!list.length) { t.innerHTML = `<div class="empty">${UI.icon('box')}<h3>All good</h3><p>No items are below their re-order point.</p></div>`; return; }
    t.innerHTML = `<table class="data-table"><thead><tr>
        <th>UPC</th><th>Name</th><th>Brand</th><th>Category</th><th>Supplier</th><th>Size</th>
        <th class="num">Qty On-hand</th><th class="num">Re-order Point</th><th class="actions"></th>
      </tr></thead><tbody>${list.map(r => `<tr>
        <td>${UI.escape(r.upc || '')}</td><td><strong>${UI.escape(r.name)}</strong></td>
        <td>${UI.escape(r.brand || '—')}</td><td>${UI.escape(r.category || '—')}</td>
        <td>${UI.escape(r.supplier || '—')}</td><td>${UI.escape(r.size || '—')}</td>
        <td class="num"><span class="badge badge--${Number(r.on_hand) <= 0 ? 'bad' : 'warn'}">${UI.escape(r.on_hand)}</span></td>
        <td class="num">${UI.escape(r.reorder)}</td>
        <td class="actions"><button class="link-btn" data-id="${UI.escape(r.id)}">View</button></td>
      </tr>`).join('')}</tbody></table>`;
    t.querySelectorAll('[data-id]').forEach(b => b.onclick = () => Router.go('item-search'));
  };
  const apply = () => draw(!q ? rows : rows.filter(r => (r.name + ' ' + (r.upc || '') + ' ' + (r.brand || '') + ' ' + (r.category || '')).toLowerCase().indexOf(q) !== -1));
  mount.querySelector('#ia-q').oninput = (e) => { q = e.target.value.trim().toLowerCase(); apply(); };
  apply();
});
