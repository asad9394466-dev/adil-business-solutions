/* =====================================================================
   Adil Business Solutions — Settings screens
   Company Information (feeds printed documents) + Stores, Warehouses,
   Price Lists, Users.
   ===================================================================== */

const CompanySettings = {
  // pull settings from the Sheet and merge into the live company config
  async loadCompany() {
    try {
      const s = await API.call('getSettings');
      const co = window.ABS_CONFIG.COMPANY;
      if (s.company_name) co.name = s.company_name;
      const addr = [s.address1, s.address2].filter(Boolean).join(', ');
      if (addr) co.address = addr; else if (s.address) co.address = s.address;
      if (s.phone) co.phone = s.phone;
      co.mobile = s.mobile || '';
      co.terms = s.terms || '';
      co.name_urdu = s.name_urdu || '';
      co.ticker = s.ticker || '';
      if (s.email) co.email = s.email;
      if (s.currency) co.currency = s.currency;
      if (s.currency_symbol) co.currency_symbol = s.currency_symbol;
      if (s.invoice_prefix) co.invoice_prefix = s.invoice_prefix;
      return s;
    } catch (e) { return null; }
  }
};
window.CompanySettings = CompanySettings;

// ---- Company Information screen ---------------------------------------
Router.register('company-information', async (mount) => {
  UI.loading(true);
  let s;
  try { s = await API.call('getSettings'); }
  catch (e) { UI.loading(false); mount.innerHTML = `<div class="card"><div class="empty">${UI.icon('alert')}<h3>Couldn't load settings</h3><p>${UI.escape(e.message)}</p></div></div>`; return; }
  UI.loading(false);

  const v = (k) => UI.escape(s[k] != null ? s[k] : '');
  mount.innerHTML = `
    <div class="page-head"><h1>Company Information</h1>
      <span class="page-sub">Shown on your printed invoices & receipts</span>
      <div class="page-actions"><button class="btn btn--primary" id="ci-save">Save</button></div>
    </div>
    <div class="card">
      <div class="form-grid">
        <label class="field field--wide"><span class="field-label">Company Name</span><input id="ci-company_name" value="${v('company_name')}"></label>
        <label class="field field--wide"><span class="field-label">Company Name (Urdu)</span><input id="ci-name_urdu" value="${v('name_urdu')}" dir="rtl"></label>
        <label class="field"><span class="field-label">Address 1</span><input id="ci-address1" value="${v('address1')}"></label>
        <label class="field"><span class="field-label">Address 2</span><input id="ci-address2" value="${v('address2')}"></label>
        <label class="field"><span class="field-label">Phone</span><input id="ci-phone" value="${v('phone')}"></label>
        <label class="field"><span class="field-label">Mobile No.</span><input id="ci-mobile" value="${v('mobile')}"></label>
        <label class="field"><span class="field-label">Email</span><input id="ci-email" value="${v('email')}"></label>
        <label class="field"><span class="field-label">Currency Symbol</span><input id="ci-currency_symbol" value="${v('currency_symbol')}"></label>
        <label class="field"><span class="field-label">Currency Code</span><input id="ci-currency" value="${v('currency')}"></label>
        <label class="field"><span class="field-label">Invoice Prefix</span><input id="ci-invoice_prefix" value="${v('invoice_prefix')}"></label>
        <label class="field field--wide"><span class="field-label">Terms & Conditions (printed on documents)</span><textarea id="ci-terms" rows="3">${v('terms')}</textarea></label>
        <label class="field field--wide"><span class="field-label">Ticker Text</span><input id="ci-ticker" value="${v('ticker')}"></label>
      </div>
    </div>`;

  mount.querySelector('#ci-save').onclick = async () => {
    const keys = ['company_name','name_urdu','address1','address2','phone','mobile','email','currency_symbol','currency','invoice_prefix','terms','ticker'];
    const data = {};
    keys.forEach(k => { data[k] = mount.querySelector('#ci-' + k).value; });
    UI.loading(true, 'Saving…');
    try {
      await API.call('saveSettings', { data });
      await CompanySettings.loadCompany();
      UI.loading(false);
      UI.toast('Company information saved.', 'success');
    } catch (e) { UI.loading(false); UI.toast(e.message, 'error'); }
  };
});

// ---- Stores -----------------------------------------------------------
Router.register('stores', (m) => CRUD.page(m, {
  entity: 'Stores', title: 'Stores', singular: 'Store',
  columns: [
    { key: 'store_name', label: 'Store Name' },
    { key: 'region_id', label: 'Region', ref: 'Areas' },
    { key: 'ecommerce_eligibility', label: 'E-Commerce' }
  ],
  fields: [
    { key: 'store_name', label: 'Store Name', required: true, wide: true },
    { key: 'region_id', label: 'Region', type: 'select', ref: 'Areas' },
    { key: 'description', label: 'Description', type: 'textarea', wide: true },
    { key: 'ecommerce_eligibility', label: 'E-Commerce Eligibility', type: 'select', options: ['No', 'Yes'], default: 'No' }
  ]
}));

// ---- Warehouses -------------------------------------------------------
Router.register('warehouses', (m) => CRUD.page(m, {
  entity: 'Warehouses', title: 'Warehouses', singular: 'Warehouse',
  columns: [ { key: 'warehouse_name', label: 'Name' }, { key: 'description', label: 'Description' } ],
  fields: [
    { key: 'warehouse_name', label: 'Warehouse Name', required: true, wide: true },
    { key: 'description', label: 'Description', type: 'textarea', wide: true }
  ]
}));

// ---- Price Lists ------------------------------------------------------
Router.register('price-lists', (m) => CRUD.page(m, {
  entity: 'PriceLists', title: 'Price Lists', singular: 'Price List',
  columns: [ { key: 'list_date', label: 'Date' }, { key: 'list_type', label: 'Type' } ],
  fields: [
    { key: 'list_date', label: 'List Date', type: 'date' },
    { key: 'list_type', label: 'List Type', type: 'select', options: ['Retail', 'Wholesale', 'Custom'], default: 'Retail' },
    { key: 'list_image', label: 'Image URL (optional)', wide: true }
  ]
}));

// ---- Users ------------------------------------------------------------
Router.register('users', (m) => CRUD.page(m, {
  entity: 'Users', title: 'Users', singular: 'User',
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'username', label: 'Username' },
    { key: 'role', label: 'Role' },
    { key: 'status', label: 'Status' }
  ],
  fields: [
    { key: 'name', label: 'Full Name', required: true, wide: true },
    { key: 'username', label: 'Username', required: true },
    { key: 'password', label: 'Password (blank = keep existing)', type: 'password' },
    { key: 'role', label: 'Role', type: 'select', default: 'Cashier',
      options: ['Super Administrator', 'Administrator', 'Manager', 'Accountant', 'Cashier', 'Delivery Man', 'Order Processor', 'Salesman'] },
    { key: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'], default: 'active' }
  ]
}));
