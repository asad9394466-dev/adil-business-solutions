/* =====================================================================
   Adil Business Solutions — Customers, Suppliers & settings lists
   ===================================================================== */

// ---- Customers --------------------------------------------------------
Router.register('customers', (m) => CRUD.page(m, {
  entity: 'Customers', title: 'Customers', singular: 'Customer',
  columns: [
    { key: 'name',            label: 'Name' },
    { key: 'phone',           label: 'Phone' },
    { key: 'area',            label: 'Area' },
    { key: 'opening_balance', label: 'Opening Balance', type: 'money' }
  ],
  fields: [
    { key: 'name',            label: 'Customer name', required: true, wide: true },
    { key: 'phone',           label: 'Phone' },
    { key: 'email',           label: 'Email' },
    { key: 'address',         label: 'Address', type: 'textarea', wide: true },
    { key: 'area',            label: 'Area / Region' },
    { key: 'opening_balance', label: 'Opening balance', type: 'number', step: '0.01' },
    { key: 'credit_limit',    label: 'Credit limit',    type: 'number', step: '0.01' },
    { key: 'price_list',      label: 'Price list' }
  ]
}));

// ---- Suppliers --------------------------------------------------------
Router.register('suppliers', (m) => CRUD.page(m, {
  entity: 'Suppliers', title: 'Suppliers', singular: 'Supplier',
  columns: [
    { key: 'name',            label: 'Name' },
    { key: 'phone',           label: 'Phone' },
    { key: 'email',           label: 'Email' },
    { key: 'opening_balance', label: 'Opening Balance', type: 'money' }
  ],
  fields: [
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
