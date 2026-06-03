/* =====================================================================
   Adil Business Solutions — Items
   ===================================================================== */

const itemsCfg = {
  entity: 'Items',
  title: 'Items',
  singular: 'Item',
  columns: [
    { key: 'sku',           label: 'SKU' },
    { key: 'name',          label: 'Name' },
    { key: 'category_id',   label: 'Category', ref: 'Categories' },
    { key: 'brand_id',      label: 'Brand',    ref: 'Brands' },
    { key: 'regular_price', label: 'Price',    type: 'money' },
    { key: 'reorder_level', label: 'Reorder',  type: 'number' }
  ],
  fields: [
    { key: 'name',            label: 'Item name', required: true, wide: true },
    { key: 'sku',             label: 'SKU / Code' },
    { key: 'category_id',     label: 'Category',  type: 'select', ref: 'Categories' },
    { key: 'brand_id',        label: 'Brand',     type: 'select', ref: 'Brands' },
    { key: 'uom_id',          label: 'Unit (UOM)',type: 'select', ref: 'UOM' },
    { key: 'tax_type_id',     label: 'Tax type',  type: 'select', ref: 'TaxTypes' },
    { key: 'cost_price',      label: 'Cost price',      type: 'number', step: '0.01' },
    { key: 'regular_price',   label: 'Regular price',   type: 'number', step: '0.01' },
    { key: 'wholesale_price', label: 'Wholesale price', type: 'number', step: '0.01' },
    { key: 'reorder_level',   label: 'Reorder level',   type: 'number' },
    { key: 'expiry_date',     label: 'Expiry date',     type: 'date' }
  ]
};

Router.register('items',    (m) => CRUD.page(m, itemsCfg));
Router.register('new-item', (m) => CRUD.page(m, itemsCfg, { openNew: true }));
