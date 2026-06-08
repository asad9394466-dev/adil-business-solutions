/* =====================================================================
   Adil Business Solutions — Customers, Suppliers & settings lists
   ===================================================================== */

// ---- Customers (tabbed, matches Diyar New Customer) -------------------
const PAYMENT_DAYS = ['Any Day'].concat(Array.from({ length: 31 }, (_, i) => String(i + 1)));

Router.register('customers', (m) => CRUD.page(m, {
  entity: 'Customers', title: 'Customers', singular: 'Customer',
  columns: [
    { key: 'name',            label: 'Name' },
    { key: 'customer_type',   label: 'Type' },
    { key: 'phone',           label: 'Contact' },
    { key: 'area',            label: 'Area/Zone', ref: 'Areas' },
    { key: 'opening_balance', label: 'Opening Balance', type: 'money' }
  ],
  tabs: [
    { label: 'Basic Info' },
    { label: 'Additional Info' },
    { label: 'E-Commerce Info', note: 'Send a screenshot of this tab and I’ll add its fields.' },
    { label: 'Tax Info',        note: 'Send a screenshot of this tab and I’ll add its fields.' }
  ],
  fields: [
    // --- Basic Info ---
    { key: 'area',            label: 'Area/Zone', type: 'select', ref: 'Areas', tab: 'Basic Info', wide: true },
    { key: 'customer_type',   label: 'Customer Type', type: 'select', tab: 'Basic Info',
      options: ['Hotel', 'Retail', 'Distributor', 'Residential', 'Whole Sale', 'Cash Receivables', 'Technician'], default: 'Retail' },
    { key: 'price_list',      label: 'Price Level', type: 'select', tab: 'Basic Info',
      options: ['Custom', 'MRP', 'Regular', 'Wholesale'], default: 'Regular' },
    { key: 'customer_code',   label: 'Customer Code', tab: 'Basic Info' },
    { key: 'name',            label: 'Name', required: true, wide: true, tab: 'Basic Info' },
    { key: 'address',         label: 'Address', type: 'textarea', wide: true, tab: 'Basic Info' },
    { key: 'phone',           label: 'Contact', tab: 'Basic Info' },
    { key: 'opening_balance', label: 'Opening Balance', type: 'number', step: '0.01', tab: 'Basic Info' },
    { key: 'credit_limit',    label: 'Credit Limit', type: 'number', step: '0.01', default: 0, tab: 'Basic Info' },
    // --- Additional Info ---
    { key: 'cnic',                  label: 'CNIC (without dashes)', tab: 'Additional Info', wide: true },
    { key: 'payment_day',           label: 'Payment Day', type: 'select', options: PAYMENT_DAYS, default: 'Any Day', tab: 'Additional Info' },
    { key: 'representative_id',     label: 'Representative', type: 'select', ref: 'SalesRepresentatives', tab: 'Additional Info' },
    { key: 'customer_care_manager', label: 'Customer Care Manager', type: 'select', ref: 'Users', tab: 'Additional Info' },
    { key: 'photo',                 label: 'Photo URL (optional)', tab: 'Additional Info', wide: true }
  ]
}));

// ---- Regions & Areas --------------------------------------------------
Router.register('areas', (m) => CRUD.page(m, {
  entity: 'Areas', title: 'Regions & Areas', singular: 'Area',
  columns: [ { key: 'name', label: 'Area / Zone' }, { key: 'region', label: 'Region' } ],
  fields: [
    { key: 'name',   label: 'Area / Zone (e.g. Bajauar — Pashat)', required: true, wide: true },
    { key: 'region', label: 'Region (optional)' }
  ]
}));

// ---- Sales Representatives --------------------------------------------
Router.register('sales-representatives', (m) => CRUD.page(m, {
  entity: 'SalesRepresentatives', title: 'Sales Representatives', singular: 'Representative',
  columns: [ { key: 'name', label: 'Name' }, { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' } ],
  fields: [
    { key: 'name',  label: 'Name', required: true, wide: true },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' }
  ]
}));

// ---- Suppliers --------------------------------------------------------
Router.register('suppliers', (m) => CRUD.page(m, {
  entity: 'Suppliers', title: 'Suppliers', singular: 'Supplier',
  columns: [
    { key: 'code',            label: 'Code' },
    { key: 'name',            label: 'Name' },
    { key: 'phone',           label: 'Phone' },
    { key: 'email',           label: 'Email' },
    { key: 'opening_balance', label: 'Opening Balance', type: 'money' }
  ],
  fields: [
    { key: 'code',            label: 'Code' },
    { key: 'name',            label: 'Supplier name', required: true, wide: true },
    { key: 'phone',           label: 'Phone' },
    { key: 'email',           label: 'Email' },
    { key: 'address',         label: 'Address', type: 'textarea', wide: true },
    { key: 'opening_balance', label: 'Opening balance', type: 'number', step: '0.01' }
  ]
}));

// ---- Categories -------------------------------------------------------
Router.register('categories', (m) => CRUD.page(m, {
  entity: 'Categories', title: 'Categories', singular: 'Category',
  columns: [
    { key: 'name',      label: 'Name' },
    { key: 'parent_id', label: 'Parent', ref: 'Categories' }
  ],
  fields: [
    { key: 'name',      label: 'Category name', required: true, wide: true },
    { key: 'parent_id', label: 'Parent category', type: 'select', ref: 'Categories' }
  ]
}));

// ---- Brands -----------------------------------------------------------
Router.register('brands', (m) => CRUD.page(m, {
  entity: 'Brands', title: 'Brands', singular: 'Brand',
  columns: [ { key: 'name', label: 'Name' } ],
  fields:  [ { key: 'name', label: 'Brand name', required: true, wide: true } ]
}));

// ---- Units (UOM) ------------------------------------------------------
Router.register('uom', (m) => CRUD.page(m, {
  entity: 'UOM', title: 'Units (UOM)', singular: 'Unit',
  columns: [
    { key: 'name',         label: 'Name' },
    { key: 'abbreviation', label: 'Abbreviation' }
  ],
  fields: [
    { key: 'name',         label: 'Unit name', required: true, wide: true },
    { key: 'abbreviation', label: 'Abbreviation (e.g. pcs, kg)' }
  ]
}));

// ---- Tax Types --------------------------------------------------------
Router.register('tax-types', (m) => CRUD.page(m, {
  entity: 'TaxTypes', title: 'Tax Types', singular: 'Tax Type',
  columns: [
    { key: 'name',         label: 'Name' },
    { key: 'rate_percent', label: 'Rate %', type: 'number' }
  ],
  fields: [
    { key: 'name',         label: 'Tax name (e.g. GST 17%)', required: true, wide: true },
    { key: 'rate_percent', label: 'Rate (%)', type: 'number', step: '0.01' }
  ]
}));
