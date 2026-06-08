/* =====================================================================
   Adil Business Solutions — Backend (Google Apps Script)
   ---------------------------------------------------------------------
   HOW TO USE (full steps in docs/SETUP.md):
     1. Create a Google Sheet.
     2. Extensions > Apps Script. Delete the sample, paste THIS file.
     3. Run  setup()  once (authorise when asked). It builds every tab
        and creates the default admin login.
     4. Deploy > New deployment > Web app:
          Execute as : Me
          Who has access : Anyone
        Copy the /exec URL into assets/js/config.js (API_URL).

   Default login created by setup():  admin / admin123   (CHANGE IT)
   ===================================================================== */

// ---- Table definitions (tab name -> header columns) -------------------
var SCHEMA = {
  Settings:       ['key','value'],
  Users:          ['id','username','password_hash','name','role','status','created_at'],
  Counters:       ['name','value','prefix'],
  Categories:     ['id','name','parent_id','status','created_at'],
  Brands:         ['id','name','status','created_at'],
  UOM:            ['id','name','abbreviation','status','created_at'],
  TaxTypes:       ['id','name','rate_percent','status','created_at'],
  Areas:          ['id','name','region','status','created_at'],
  SalesRepresentatives: ['id','name','phone','email','status','created_at'],
  Stores:         ['id','store_name','region_id','description','ecommerce_eligibility','status','created_at'],
  Warehouses:     ['id','warehouse_name','description','status','created_at'],
  PriceLists:     ['id','list_date','list_type','list_image','status','created_at'],
  Items:          ['id','sku','name','category_id','brand_id','uom_id','cost_price','regular_price','wholesale_price','tax_type_id','reorder_level','expiry_date','status','created_at'],
  Customers:      ['id','name','phone','email','address','area','opening_balance','credit_limit','price_list','status','created_at','customer_code','customer_type','cnic','payment_day','representative_id','customer_care_manager','photo'],
  Suppliers:      ['id','name','phone','email','address','opening_balance','status','created_at','code'],
  PurchaseOrders:     ['id','po_no','date','supplier_id','store_id','description','reference_no','subtotal','discount','total','status','created_by','created_at'],
  PurchaseOrderItems: ['id','po_id','item_id','description','qty','unit','cost','discount','line_total'],
  Bills:              ['id','bill_no','bill_type','date','due_date','supplier_id','store_id','po_id','reference_no','description','subtotal','discount','discount_type','shipping_charges','total','paid','balance','status','created_by','created_at'],
  BillItems:          ['id','bill_id','item_id','description','warehouse','qty','unit','multiplier','cost','discount','line_total'],
  Invoices:       ['id','invoice_no','date','customer_id','subtotal','discount','tax','total','paid','balance','status','notes','created_by','created_at','due_date','reference_no'],
  InvoiceItems:   ['id','invoice_id','item_id','description','qty','unit_price','discount','line_total'],
  SalesReceipts:     ['id','receipt_no','date','customer_id','customer_name','subtotal','discount','tax','total','paid','balance','status','notes','sales_rep','order_type','created_by','created_at'],
  SalesReceiptItems: ['id','receipt_id','item_id','description','qty','unit_price','discount','line_total'],
  Payments:       ['id','date','customer_id','invoice_id','amount','method','reference','notes','created_at','is_deposited','deposit_id'],
  Accounts:       ['id','account_number','account_name','account_type','system_key','parent_account_id','is_active','description','created_at'],
  Journal:        ['id','entry_id','entry_no','date','account_id','debit','credit','name','memo','source_type','source_id','created_by','created_at'],
  Deposits:       ['id','deposit_no','date','account_id','memo','total','created_by','created_at'],
  FundTransfers:  ['id','date','from_account_id','to_account_id','amount','memo','created_by','created_at'],
  StockMovements: ['id','date','item_id','type','qty','reference_type','reference_id','notes']
};

// =====================================================================
//  ONE-TIME SETUP  — run this from the editor after pasting the script
// =====================================================================
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  Object.keys(SCHEMA).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    var headers = SCHEMA[name];
    // write headers only if the first row is empty
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
  });

  // remove the default "Sheet1" if still present and empty
  var def = ss.getSheetByName('Sheet1');
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(def);

  // seed Settings
  if (sheet_('Settings').getLastRow() <= 1) {
    var s = sheet_('Settings');
    [['company_name','Adil Business Solutions'],
     ['address','Your address, City, Country'],
     ['phone','00 000 0000000'],
     ['email','info@adilbusiness.example'],
     ['currency','PKR'],
     ['currency_symbol','Rs'],
     ['tax_percent','0'],
     ['invoice_prefix','INV-']
    ].forEach(function (r) { s.appendRow(r); });
  }

  // seed default admin
  if (sheet_('Users').getLastRow() <= 1) {
    create_('Users', {
      username: 'admin',
      password_hash: hash_('admin', 'admin123'),
      name: 'Administrator',
      role: 'admin',
      status: 'active'
    });
  }

  // seed counters
  if (sheet_('Counters').getLastRow() <= 1) {
    sheet_('Counters').appendRow(['invoice', 0, 'INV-']);
    sheet_('Counters').appendRow(['quotation', 0, 'QUO-']);
    sheet_('Counters').appendRow(['sales_order', 0, 'SO-']);
  }

  Logger.log('Setup complete. Default login: admin / admin123');
}

// =====================================================================
//  MIGRATION — run once after updating the script with new fields/tables.
//  Creates any new tabs and appends any new columns to existing tabs,
//  without touching existing data.
// =====================================================================
function migrate() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SCHEMA).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    var want = SCHEMA[name];
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, want.length).setValues([want]);
      sh.getRange(1, 1, 1, want.length).setFontWeight('bold');
      sh.setFrozenRows(1);
      return;
    }
    var have = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    var missing = want.filter(function (h) { return have.indexOf(h) === -1; });
    if (missing.length) {
      sh.getRange(1, have.length + 1, 1, missing.length).setValues([missing]);
      sh.getRange(1, have.length + 1, 1, missing.length).setFontWeight('bold');
    }
  });
  // ensure counters exist with the right prefixes (matches Diyar numbering)
  upsertCounter_('invoice', 'INV-1-');
  upsertCounter_('sales_receipt', 'SAL-1-');
  upsertCounter_('quotation', 'QUO-1-');
  upsertCounter_('sales_order', 'SO-1-');
  upsertCounter_('journal', 'JE-');
  upsertCounter_('deposit', 'DEP-');
  upsertCounter_('purchase_order', 'PO-1-');
  upsertCounter_('bill', 'B-1-');

  // seed the standard chart of accounts (only if empty)
  if (sheet_('Accounts').getLastRow() <= 1) {
    [
      ['1001','Sales','Income','sales'],
      ['1002','Sales Discount','Income','sales_discount'],
      ['1003','Cost of Goods Sold','Cost of Goods Sold','cogs'],
      ['1004','Inventory Asset','Other Current Asset','inventory'],
      ['1005','Accounts Receivable','Accounts Receivable','ar'],
      ['1006','Accounts Payable','Accounts Payable','ap'],
      ['1007','Cash in-hand','Bank','cash'],
      ['1008','POS Drawer','Bank','pos_drawer'],
      ['1009','Undeposited Funds','Other Current Asset','undeposited'],
      ['1010','Opening Balance Equity','Equity','ob_equity'],
      ['1011','Sales Tax Payable','Other Current Liability','sales_tax'],
      ['1012','Rent','Expense',''],
      ['1013','Salaries','Expense',''],
      ['1014','Bilty Charges','Expense','']
    ].forEach(function (a) {
      create_('Accounts', { account_number: a[0], account_name: a[1], account_type: a[2], system_key: a[3], is_active: 'Yes' });
    });
  }

  Logger.log('Migration complete: tabs and columns are in sync with SCHEMA.');
}

// set/refresh a counter's prefix without resetting its running value
function upsertCounter_(name, prefix) {
  var sh = sheet_('Counters');
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(name)) {
      sh.getRange(i + 1, 3).setValue(prefix);
      return;
    }
  }
  sh.appendRow([name, 0, prefix]);
}

// =====================================================================
//  WEB APP ENTRY POINTS
// =====================================================================
function doGet(e)  { return handle_(e); }
function doPost(e) { return handle_(e); }

function handle_(e) {
  var p = {};
  try {
    if (e && e.postData && e.postData.contents) p = JSON.parse(e.postData.contents);
    else if (e && e.parameter) p = e.parameter;
  } catch (err) { return out_({ ok: false, error: 'Bad request body.' }); }

  var action = p.action;
  try {
    // public actions
    if (action === 'ping')  return out_({ ok: true, data: { app: 'Adil Business Solutions API', version: '0.1', status: 'connected', time: new Date().toISOString() } });
    if (action === 'login') return out_(login_(p));

    // everything below requires a valid session token
    if (!validToken_(p.token)) return out_({ ok: false, error: 'Unauthorized. Please sign in again.' });

    switch (action) {
      case 'list':       return out_({ ok: true, data: list_(p.entity, p) });
      case 'get':        return out_({ ok: true, data: get_(p.entity, p.id) });
      case 'create':     return out_({ ok: true, data: create_(p.entity, p.data || {}) });
      case 'update':     return out_({ ok: true, data: update_(p.entity, p.id, p.data || {}) });
      case 'delete':     return out_({ ok: true, data: del_(p.entity, p.id) });
      case 'nextNumber': return out_({ ok: true, data: { number: nextNumber_(p.name) } });
      case 'dashboard':  return out_({ ok: true, data: dashboard_() });
      case 'createInvoice': return out_({ ok: true, data: createInvoice_(p) });
      case 'updateInvoice': return out_({ ok: true, data: updateInvoice_(p) });
      case 'invoiceDetail': return out_({ ok: true, data: invoiceDetail_(p.id) });
      case 'recordPayment': return out_({ ok: true, data: recordPayment_(p) });
      case 'deleteInvoice': return out_({ ok: true, data: deleteInvoice_(p.id) });
      case 'createSalesReceipt': return out_({ ok: true, data: createSalesReceipt_(p) });
      case 'updateSalesReceipt': return out_({ ok: true, data: updateSalesReceipt_(p) });
      case 'salesReceiptDetail': return out_({ ok: true, data: salesReceiptDetail_(p.id) });
      case 'deleteSalesReceipt': return out_({ ok: true, data: deleteSalesReceipt_(p.id) });
      case 'customerBalance': return out_({ ok: true, data: { balance: customerBalance_(p.customer_id, p.exclude_id) } });
      case 'getSettings': return out_({ ok: true, data: getSettings_() });
      case 'saveSettings': return out_({ ok: true, data: saveSettings_(p.data) });
      case 'allTransactions': return out_({ ok: true, data: allTransactions_() });
      case 'accountsList': return out_({ ok: true, data: accountsWithBalances_() });
      case 'createAccount': return out_({ ok: true, data: createAccount_(p) });
      case 'updateAccount': return out_({ ok: true, data: update_('Accounts', p.id, p.data || {}) });
      case 'deleteAccount': return out_({ ok: true, data: deleteAccount_(p.id) });
      case 'journalList': return out_({ ok: true, data: journalList_() });
      case 'createJournalEntry': return out_({ ok: true, data: createJournalEntry_(p) });
      case 'accountLedger': return out_({ ok: true, data: accountLedger_(p.id) });
      case 'transferFunds': return out_({ ok: true, data: transferFunds_(p) });
      case 'transfersList': return out_({ ok: true, data: transfersList_() });
      case 'undepositedList': return out_({ ok: true, data: undepositedList_() });
      case 'recordDeposit': return out_({ ok: true, data: recordDeposit_(p) });
      case 'depositsList': return out_({ ok: true, data: depositsList_() });
      case 'paymentsList': return out_({ ok: true, data: paymentsList_() });
      case 'savePurchaseOrder': return out_({ ok: true, data: savePurchaseOrder_(p) });
      case 'purchaseOrderDetail': return out_({ ok: true, data: purchaseOrderDetail_(p.id) });
      case 'deletePurchaseOrder': return out_({ ok: true, data: deletePurchaseOrder_(p.id) });
      case 'setPurchaseOrderStatus': return out_({ ok: true, data: setPurchaseOrderStatus_(p.id, p.status) });
      case 'saveBill': return out_({ ok: true, data: saveBill_(p) });
      case 'billDetail': return out_({ ok: true, data: billDetail_(p.id) });
      case 'deleteBill': return out_({ ok: true, data: deleteBill_(p.id) });
      case 'supplierBalance': return out_({ ok: true, data: { balance: supplierBalance_(p.supplier_id, p.exclude_id) } });
      default:           return out_({ ok: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return out_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

// =====================================================================
//  AUTH
// =====================================================================
function login_(p) {
  var username = String(p.username || '').trim();
  var password = String(p.password || '');
  if (!username || !password) return { ok: false, error: 'Enter username and password.' };

  var users = rows_('Users');
  var u = users.filter(function (r) {
    return String(r.username).toLowerCase() === username.toLowerCase()
        && String(r.status) === 'active';
  })[0];

  if (!u || u.password_hash !== hash_(u.username, password)) {
    return { ok: false, error: 'Invalid username or password.' };
  }

  var token = Utilities.getUuid();
  CacheService.getScriptCache().put(token, u.username, 21600); // 6 hours
  return { ok: true, data: { token: token, user: { id: u.id, username: u.username, name: u.name, role: u.role } } };
}

function validToken_(token) {
  if (!token) return false;
  return !!CacheService.getScriptCache().get(token);
}

function hash_(username, password) {
  var raw = String(username).toLowerCase() + ':' + String(password);
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}

// =====================================================================
//  GENERIC CRUD
// =====================================================================
function sheet_(entity) {
  if (!SCHEMA[entity]) throw new Error('Unknown entity: ' + entity);
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(entity);
  if (!sh) throw new Error('Tab "' + entity + '" not found. Run setup() first.');
  return sh;
}

function rows_(entity) {
  var sh = sheet_(entity);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var obj = {};
    for (var c = 0; c < headers.length; c++) obj[headers[c]] = values[i][c];
    obj.__row = i + 1; // 1-based sheet row for updates
    out.push(obj);
  }
  return out;
}

function list_(entity, p) {
  var data = rows_(entity).filter(function (r) {
    return !('status' in r) || String(r.status) !== 'deleted';
  });
  // optional simple text search
  var q = (p && p.search ? String(p.search).toLowerCase() : '');
  if (q) {
    data = data.filter(function (r) {
      return Object.keys(r).some(function (k) {
        return k !== '__row' && String(r[k]).toLowerCase().indexOf(q) !== -1;
      });
    });
  }
  return data.map(strip_);
}

function get_(entity, id) {
  var r = rows_(entity).filter(function (x) { return String(x.id) === String(id); })[0];
  return r ? strip_(r) : null;
}

function create_(entity, data) {
  if (entity === 'Users' && data && data.password) {
    data.password_hash = hash_(data.username || '', data.password);
  }
  var sh = sheet_(entity);
  var headers = SCHEMA[entity];
  var rec = {};
  headers.forEach(function (h) { rec[h] = (h in data) ? data[h] : ''; });
  if (headers.indexOf('id') !== -1 && !rec.id) rec.id = newId_();
  if (headers.indexOf('created_at') !== -1 && !rec.created_at) rec.created_at = new Date().toISOString();
  if (headers.indexOf('status') !== -1 && !rec.status) rec.status = 'active';
  sh.appendRow(headers.map(function (h) { return safeCell_(rec[h]); }));
  return rec;
}

function update_(entity, id, data) {
  if (entity === 'Users' && data && data.password) {
    var uname = data.username;
    if (!uname) { var ex = rows_('Users').filter(function (r) { return String(r.id) === String(id); })[0]; uname = ex ? ex.username : ''; }
    data.password_hash = hash_(uname, data.password);
  }
  var sh = sheet_(entity);
  var headers = SCHEMA[entity];
  var match = rows_(entity).filter(function (x) { return String(x.id) === String(id); })[0];
  if (!match) throw new Error('Record not found.');
  headers.forEach(function (h, c) {
    if (h in data) sh.getRange(match.__row, c + 1).setValue(safeCell_(data[h]));
  });
  return get_(entity, id);
}

function del_(entity, id) {
  var headers = SCHEMA[entity];
  if (headers.indexOf('status') !== -1) {
    update_(entity, id, { status: 'deleted' });
    return { id: id, deleted: true };
  }
  // hard delete for tables without status
  var sh = sheet_(entity);
  var match = rows_(entity).filter(function (x) { return String(x.id) === String(id); })[0];
  if (match) sh.deleteRow(match.__row);
  return { id: id, deleted: true };
}

function strip_(r) { var o = {}; Object.keys(r).forEach(function (k) { if (k !== '__row') o[k] = r[k]; }); return o; }
function newId_() { return 'R' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// Stop Sheets from treating strings like "+92...", "=x", "-y", "@z" as formulas.
function safeCell_(v) {
  if (typeof v === 'string' && /^[=+\-@]/.test(v)) return "'" + v;
  return v;
}

// =====================================================================
//  COUNTERS (atomic, lock-protected)
// =====================================================================
function nextNumber_(name) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { return incrementCounter_(name); }
  finally { lock.releaseLock(); }
}

// no-lock version, used inside operations that already hold the lock
function incrementCounter_(name) {
  var sh = sheet_('Counters');
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(name)) {
      var next = Number(values[i][1] || 0) + 1;
      sh.getRange(i + 1, 2).setValue(next);
      return (values[i][2] || '') + String(next).padStart(5, '0');
    }
  }
  sh.appendRow([name, 1, '']);
  return String(1).padStart(5, '0');
}

// =====================================================================
//  DASHBOARD
// =====================================================================
function dashboard_() {
  var items = list_('Items', {});
  var customers = list_('Customers', {});
  var invoices = list_('Invoices', {});
  var receipts = list_('SalesReceipts', {});
  var today = new Date().toISOString().slice(0, 10);
  var sum = function (arr) {
    return arr.filter(function (i) { return String(i.date).slice(0, 10) === today; })
              .reduce(function (s, i) { return s + Number(i.total || 0); }, 0);
  };
  return {
    items_count: items.length,
    customers_count: customers.length,
    invoices_count: invoices.length,
    todays_sales: sum(invoices) + sum(receipts),
    low_stock_count: 0 // populated once live stock tracking lands (Phase 3)
  };
}

// =====================================================================
//  INVOICES
// =====================================================================
function userFromToken_(token) {
  return token ? (CacheService.getScriptCache().get(token) || '') : '';
}

function deleteWhere_(entity, field, value) {
  var sh = sheet_(entity);
  var matches = rows_(entity).filter(function (r) { return String(r[field]) === String(value); });
  matches.map(function (r) { return r.__row; })
         .sort(function (a, b) { return b - a; })   // bottom-up so row indexes stay valid
         .forEach(function (row) { sh.deleteRow(row); });
}

function writeInvoiceLines_(invId, invoiceNo, lines, dateStr) {
  (lines || []).forEach(function (ln) {
    create_('InvoiceItems', {
      invoice_id: invId, item_id: ln.item_id || '', description: ln.description || '',
      qty: Number(ln.qty || 0), unit_price: Number(ln.unit_price || 0),
      discount: ln.discount || '', line_total: Number(ln.line_total || 0)
    });
    if (ln.item_id) {
      create_('StockMovements', {
        date: dateStr || new Date().toISOString().slice(0, 10),
        item_id: ln.item_id, type: 'out', qty: Number(ln.qty || 0),
        reference_type: 'invoice', reference_id: invId, notes: invoiceNo
      });
    }
  });
}

function createInvoice_(p) {
  var d = p.data || {};
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var invoiceNo = incrementCounter_('invoice');
    var id = newId_();
    var total = Number(d.total || 0);
    var rec = {
      id: id, invoice_no: invoiceNo, date: d.date || new Date().toISOString().slice(0, 10),
      due_date: d.due_date || '', reference_no: d.reference_no || '',
      customer_id: d.customer_id || '', subtotal: Number(d.subtotal || 0), discount: Number(d.discount || 0),
      tax: Number(d.tax || 0), total: total, paid: 0, balance: total,
      status: (total <= 0 ? 'paid' : 'unpaid'), notes: d.notes || '',
      created_by: userFromToken_(p.token), created_at: new Date().toISOString()
    };
    sheet_('Invoices').appendRow(SCHEMA.Invoices.map(function (h) { return safeCell_(rec[h]); }));
    writeInvoiceLines_(id, invoiceNo, d.lines, d.date);
    postSaleJournal_('invoice', id, invoiceNo, rec, p.token, 'ar');
    return { id: id, invoice_no: invoiceNo };
  } finally {
    lock.releaseLock();
  }
}

function updateInvoice_(p) {
  var id = p.id, d = p.data || {};
  var inv = rows_('Invoices').filter(function (r) { return String(r.id) === String(id); })[0];
  if (!inv) throw new Error('Invoice not found.');
  deleteWhere_('InvoiceItems', 'invoice_id', id);
  deleteWhere_('StockMovements', 'reference_id', id);
  var total = Number(d.total || 0);
  var paid = Number(inv.paid || 0);
  update_('Invoices', id, {
    date: d.date || inv.date, customer_id: d.customer_id || '', subtotal: Number(d.subtotal || 0),
    discount: Number(d.discount || 0), tax: Number(d.tax || 0), total: total,
    due_date: d.due_date || inv.due_date || '', reference_no: d.reference_no || '',
    balance: total - paid, status: paid >= total ? 'paid' : (paid > 0 ? 'partial' : 'unpaid'),
    notes: d.notes || ''
  });
  writeInvoiceLines_(id, inv.invoice_no, d.lines, d.date || inv.date);
  reverseSource_('invoice', id);
  postSaleJournal_('invoice', id, inv.invoice_no, get_('Invoices', id), p.token, 'ar');
  return { id: id, invoice_no: inv.invoice_no };
}

function invoiceDetail_(id) {
  var inv = get_('Invoices', id);
  if (!inv) throw new Error('Invoice not found.');
  var items = rows_('InvoiceItems').filter(function (r) { return String(r.invoice_id) === String(id); }).map(strip_);
  var payments = rows_('Payments').filter(function (r) { return String(r.invoice_id) === String(id); }).map(strip_);
  var customer = inv.customer_id ? get_('Customers', inv.customer_id) : null;
  return { invoice: inv, items: items, payments: payments, customer: customer };
}

function recordPayment_(p) {
  var d = p.data || {};
  var allocs = d.allocations;
  if (!allocs) allocs = [{ invoice_id: d.invoice_id, amount: Number(d.amount || 0) }];
  var date = d.date || new Date().toISOString().slice(0, 10);
  var total = 0;
  allocs.forEach(function (a) {
    var amt = Number(a.amount || 0);
    if (amt <= 0 || !a.invoice_id) return;
    var inv = rows_('Invoices').filter(function (r) { return String(r.id) === String(a.invoice_id); })[0];
    if (!inv) return;
    create_('Payments', { date: date, customer_id: inv.customer_id, invoice_id: a.invoice_id, amount: amt, method: d.method || '', reference: d.reference || '', notes: d.memo || d.notes || '', is_deposited: '', deposit_id: '' });
    var paid = rows_('Payments').filter(function (r) { return String(r.invoice_id) === String(a.invoice_id); }).reduce(function (s, r) { return s + Number(r.amount || 0); }, 0);
    var t = Number(inv.total || 0);
    update_('Invoices', a.invoice_id, { paid: paid, balance: t - paid, status: paid >= t ? 'paid' : (paid > 0 ? 'partial' : 'unpaid') });
    total += amt;
  });
  if (total > 0) {
    try {
      postEntry_({ date: date, memo: 'Customer payment', source_type: 'payment', source_id: 'PMT' + Date.now(), created_by: userFromToken_(p.token),
        lines: [{ account_id: acctId_('undeposited'), debit: total, credit: 0 }, { account_id: acctId_('ar'), debit: 0, credit: total }] });
    } catch (e) {}
  }
  return { ok: true, total: total };
}

function deleteInvoice_(id) {
  update_('Invoices', id, { status: 'deleted' });
  deleteWhere_('InvoiceItems', 'invoice_id', id);
  deleteWhere_('StockMovements', 'reference_id', id);
  reverseSource_('invoice', id);
  return { id: id, deleted: true };
}

// outstanding balance across a customer's invoices (optionally excluding one)
function customerBalance_(customerId, excludeId) {
  if (!customerId) return 0;
  return rows_('Invoices')
    .filter(function (r) {
      return String(r.customer_id) === String(customerId)
          && String(r.status) !== 'deleted'
          && String(r.id) !== String(excludeId || '');
    })
    .reduce(function (s, r) { return s + Number(r.balance || 0); }, 0);
}

// =====================================================================
//  SALES RECEIPTS  (walk-in, paid in full)
// =====================================================================
function writeReceiptLines_(rId, receiptNo, lines, dateStr) {
  (lines || []).forEach(function (ln) {
    create_('SalesReceiptItems', {
      receipt_id: rId, item_id: ln.item_id || '', description: ln.description || '',
      qty: Number(ln.qty || 0), unit_price: Number(ln.unit_price || 0),
      discount: ln.discount || '', line_total: Number(ln.line_total || 0)
    });
    if (ln.item_id) {
      create_('StockMovements', {
        date: dateStr || new Date().toISOString().slice(0, 10),
        item_id: ln.item_id, type: 'out', qty: Number(ln.qty || 0),
        reference_type: 'receipt', reference_id: rId, notes: receiptNo
      });
    }
  });
}

function createSalesReceipt_(p) {
  var d = p.data || {};
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var receiptNo = incrementCounter_('sales_receipt');
    var id = newId_();
    var total = Number(d.total || 0);
    var rec = {
      id: id, receipt_no: receiptNo, date: d.date || new Date().toISOString().slice(0, 10),
      customer_id: d.customer_id || '', customer_name: d.customer_name || 'Walk-in Customer',
      subtotal: Number(d.subtotal || 0), discount: Number(d.discount || 0), tax: Number(d.tax || 0),
      total: total, paid: total, balance: 0, status: 'paid', notes: d.notes || '',
      sales_rep: d.sales_rep || '', order_type: d.order_type || 'Local',
      created_by: userFromToken_(p.token), created_at: new Date().toISOString()
    };
    sheet_('SalesReceipts').appendRow(SCHEMA.SalesReceipts.map(function (h) { return safeCell_(rec[h]); }));
    writeReceiptLines_(id, receiptNo, d.lines, d.date);
    postSaleJournal_('receipt', id, receiptNo, rec, p.token, 'cash');
    return { id: id, receipt_no: receiptNo };
  } finally {
    lock.releaseLock();
  }
}

function updateSalesReceipt_(p) {
  var id = p.id, d = p.data || {};
  var r = rows_('SalesReceipts').filter(function (x) { return String(x.id) === String(id); })[0];
  if (!r) throw new Error('Sales receipt not found.');
  deleteWhere_('SalesReceiptItems', 'receipt_id', id);
  deleteWhere_('StockMovements', 'reference_id', id);
  var total = Number(d.total || 0);
  update_('SalesReceipts', id, {
    date: d.date || r.date, customer_id: d.customer_id || '',
    customer_name: d.customer_name || 'Walk-in Customer',
    subtotal: Number(d.subtotal || 0), discount: Number(d.discount || 0), tax: Number(d.tax || 0),
    total: total, paid: total, balance: 0, status: 'paid', notes: d.notes || '',
    sales_rep: d.sales_rep || '', order_type: d.order_type || 'Local'
  });
  writeReceiptLines_(id, r.receipt_no, d.lines, d.date || r.date);
  reverseSource_('receipt', id);
  postSaleJournal_('receipt', id, r.receipt_no, get_('SalesReceipts', id), p.token, 'cash');
  return { id: id, receipt_no: r.receipt_no };
}

function salesReceiptDetail_(id) {
  var r = get_('SalesReceipts', id);
  if (!r) throw new Error('Sales receipt not found.');
  var items = rows_('SalesReceiptItems').filter(function (x) { return String(x.receipt_id) === String(id); }).map(strip_);
  var customer = r.customer_id ? get_('Customers', r.customer_id) : null;
  return { receipt: r, items: items, customer: customer };
}

function deleteSalesReceipt_(id) {
  update_('SalesReceipts', id, { status: 'deleted' });
  deleteWhere_('SalesReceiptItems', 'receipt_id', id);
  deleteWhere_('StockMovements', 'reference_id', id);
  reverseSource_('receipt', id);
  return { id: id, deleted: true };
}

// unified ledger of all transactions (newest first)
function allTransactions_() {
  var custs = {};
  list_('Customers', {}).forEach(function (c) { custs[String(c.id)] = c.name; });
  var out = [];
  list_('Invoices', {}).forEach(function (r) {
    out.push({ date: r.date, name: custs[String(r.customer_id)] || '', type: 'Invoice',
      number: r.invoice_no, amount: Number(r.total || 0), balance: Number(r.balance || 0),
      status: r.status, id: r.id, doc: 'invoice' });
  });
  list_('SalesReceipts', {}).forEach(function (r) {
    out.push({ date: r.date, name: r.customer_name || custs[String(r.customer_id)] || 'Walk-in Customer',
      type: 'Sales Receipt', number: r.receipt_no, amount: Number(r.total || 0), balance: 0,
      status: r.status, id: r.id, doc: 'receipt' });
  });
  out.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)) || String(b.number).localeCompare(String(a.number)); });
  return out;
}

// =====================================================================
//  SETTINGS (key/value)
// =====================================================================
function getSettings_() {
  var o = {};
  rows_('Settings').forEach(function (r) { o[r.key] = r.value; });
  return o;
}

function saveSettings_(data) {
  var sh = sheet_('Settings');
  var values = sh.getDataRange().getValues();
  var idx = {};
  for (var i = 1; i < values.length; i++) idx[String(values[i][0])] = i + 1;
  Object.keys(data || {}).forEach(function (k) {
    if (idx[k]) sh.getRange(idx[k], 2).setValue(safeCell_(data[k]));
    else sh.appendRow([k, safeCell_(data[k])]);
  });
  return getSettings_();
}

// =====================================================================
//  ACCOUNTING — double-entry ledger
// =====================================================================
var DEBIT_NORMAL = ['Bank', 'Other Asset', 'Other Current Asset', 'Accounts Receivable', 'Fixed Asset', 'Cost of Goods Sold', 'Expense', 'Other Expense'];
function acctSign_(type) { return DEBIT_NORMAL.indexOf(type) !== -1 ? 1 : -1; }
function acctByKey_(key) { return rows_('Accounts').filter(function (a) { return String(a.system_key) === String(key); })[0]; }
function acctId_(key) { var a = acctByKey_(key); return a ? a.id : ''; }

// post a balanced journal entry; lines: [{account_id, debit, credit, name, memo}]
function postEntry_(o) {
  var lines = (o.lines || []).filter(function (l) { return Number(l.debit || 0) !== 0 || Number(l.credit || 0) !== 0; });
  var totDr = 0, totCr = 0;
  lines.forEach(function (l) { totDr += Number(l.debit || 0); totCr += Number(l.credit || 0); });
  if (Math.abs(totDr - totCr) > 0.01) throw new Error('Journal entry not balanced (Dr ' + totDr + ' vs Cr ' + totCr + ').');
  if (!lines.length) return null;
  var entryId = newId_();
  var entryNo = incrementCounter_('journal');
  var date = o.date || new Date().toISOString().slice(0, 10);
  lines.forEach(function (l) {
    create_('Journal', {
      entry_id: entryId, entry_no: entryNo, date: date, account_id: l.account_id || '',
      debit: Number(l.debit || 0), credit: Number(l.credit || 0),
      name: l.name || '', memo: l.memo || o.memo || '',
      source_type: o.source_type || 'manual', source_id: o.source_id || '', created_by: o.created_by || ''
    });
  });
  return { entry_id: entryId, entry_no: entryNo };
}

// remove all journal lines posted by a given source document (for edit/delete)
function reverseSource_(st, sid) {
  if (!sid) return;
  var sh = sheet_('Journal');
  rows_('Journal')
    .filter(function (r) { return String(r.source_type) === String(st) && String(r.source_id) === String(sid); })
    .map(function (r) { return r.__row; })
    .sort(function (a, b) { return b - a; })
    .forEach(function (row) { sh.deleteRow(row); });
}

// auto-postings from sales documents (revenue side only; COGS/inventory come with the inventory phase)
function postSaleJournal_(sourceType, id, no, rec, token, cashKey) {
  var total = Number(rec.total || 0); if (total <= 0) return;
  var subtotal = Number(rec.subtotal || 0), discount = Number(rec.discount || 0);
  var lines = [
    { account_id: acctId_(cashKey), debit: total, credit: 0 },
    { account_id: acctId_('sales'), debit: 0, credit: subtotal }
  ];
  if (discount > 0) lines.push({ account_id: acctId_('sales_discount'), debit: discount, credit: 0 });
  try {
    postEntry_({ date: rec.date, memo: (sourceType === 'invoice' ? 'Invoice ' : 'Sales Receipt ') + no,
      source_type: sourceType, source_id: id, created_by: userFromToken_(token), lines: lines });
  } catch (e) { /* never block the document on a posting hiccup */ }
}

function accountsWithBalances_() {
  var bal = {};
  rows_('Journal').forEach(function (r) {
    var a = String(r.account_id);
    bal[a] = (bal[a] || 0) + Number(r.debit || 0) - Number(r.credit || 0);
  });
  return rows_('Accounts').map(function (a) {
    var o = strip_(a);
    o.balance = (bal[String(a.id)] || 0) * acctSign_(a.account_type);
    return o;
  });
}

function nextAccountNumber_() {
  var max = 1000;
  rows_('Accounts').forEach(function (a) { var n = parseInt(a.account_number, 10); if (!isNaN(n) && n > max) max = n; });
  return String(max + 1);
}

function createAccount_(p) {
  var d = p.data || {};
  var rec = create_('Accounts', {
    account_number: d.account_number || nextAccountNumber_(),
    account_name: d.account_name, account_type: d.account_type, system_key: '',
    parent_account_id: d.parent_account_id || '', is_active: d.is_active || 'Yes',
    description: d.description || ''
  });
  var ob = Number(d.opening_balance || 0);
  if (ob !== 0) {
    var sign = acctSign_(d.account_type);
    var lines = sign === 1
      ? [{ account_id: rec.id, debit: ob, credit: 0 }, { account_id: acctId_('ob_equity'), debit: 0, credit: ob }]
      : [{ account_id: rec.id, debit: 0, credit: ob }, { account_id: acctId_('ob_equity'), debit: ob, credit: 0 }];
    try { postEntry_({ date: d.opening_date || new Date().toISOString().slice(0, 10), memo: 'Opening balance', source_type: 'opening', source_id: rec.id, created_by: userFromToken_(p.token), lines: lines }); } catch (e) {}
  }
  return rec;
}

function deleteAccount_(id) {
  var hasLines = rows_('Journal').some(function (r) { return String(r.account_id) === String(id); });
  if (hasLines) throw new Error('This account has transactions and cannot be deleted. Mark it inactive instead.');
  var sh = sheet_('Accounts');
  var m = rows_('Accounts').filter(function (r) { return String(r.id) === String(id); })[0];
  if (m) sh.deleteRow(m.__row);
  return { id: id, deleted: true };
}

function createJournalEntry_(p) {
  var d = p.data || {};
  return postEntry_({ date: d.date, memo: d.memo, source_type: 'manual', source_id: newId_(), created_by: userFromToken_(p.token), lines: d.lines || [] });
}

function journalList_() {
  var accs = {}; rows_('Accounts').forEach(function (a) { accs[String(a.id)] = a.account_name; });
  return rows_('Journal').map(function (r) {
    var o = strip_(r); o.account_name = accs[String(r.account_id)] || ''; return o;
  }).sort(function (a, b) { return String(b.date + b.entry_no).localeCompare(String(a.date + a.entry_no)); });
}

function accountLedger_(accountId) {
  var acct = get_('Accounts', accountId);
  if (!acct) throw new Error('Account not found.');
  var sign = acctSign_(acct.account_type);
  var lines = rows_('Journal').filter(function (r) { return String(r.account_id) === String(accountId); })
    .sort(function (a, b) { return String(a.date + a.entry_no).localeCompare(String(b.date + b.entry_no)); });
  var running = 0;
  var out = lines.map(function (r) {
    running += Number(r.debit || 0) - Number(r.credit || 0);
    return { date: r.date, entry_no: r.entry_no, memo: r.memo, name: r.name, debit: Number(r.debit || 0), credit: Number(r.credit || 0), balance: running * sign };
  });
  return { account: acct, lines: out, balance: running * sign };
}

function transferFunds_(p) {
  var d = p.data || {};
  var amount = Number(d.amount || 0);
  if (amount <= 0) throw new Error('Enter a valid amount.');
  if (String(d.from_account_id) === String(d.to_account_id)) throw new Error('Cannot transfer between the same account.');
  var rec = create_('FundTransfers', {
    date: d.date || new Date().toISOString().slice(0, 10), from_account_id: d.from_account_id,
    to_account_id: d.to_account_id, amount: amount, memo: d.memo || '', created_by: userFromToken_(p.token)
  });
  try {
    postEntry_({ date: rec.date, memo: 'Funds transfer' + (d.memo ? ' — ' + d.memo : ''), source_type: 'transfer', source_id: rec.id, created_by: userFromToken_(p.token),
      lines: [{ account_id: d.to_account_id, debit: amount, credit: 0 }, { account_id: d.from_account_id, debit: 0, credit: amount }] });
  } catch (e) {}
  return rec;
}

function transfersList_() {
  var accs = {}; rows_('Accounts').forEach(function (a) { accs[String(a.id)] = a.account_name; });
  return rows_('FundTransfers').map(function (r) {
    var o = strip_(r);
    o.from_account_name = accs[String(r.from_account_id)] || '';
    o.to_account_name = accs[String(r.to_account_id)] || '';
    return o;
  }).sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); });
}

function paymentsList_() {
  var custs = {}; list_('Customers', {}).forEach(function (c) { custs[String(c.id)] = c.name; });
  return rows_('Payments').map(function (r) {
    var o = strip_(r); o.customer = custs[String(r.customer_id)] || ''; return o;
  }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
}

function undepositedList_() {
  var custs = {}; list_('Customers', {}).forEach(function (c) { custs[String(c.id)] = c.name; });
  return rows_('Payments').filter(function (r) { return !r.is_deposited || String(r.is_deposited) === ''; })
    .map(function (r) { var o = strip_(r); o.customer = custs[String(r.customer_id)] || ''; return o; });
}

function recordDeposit_(p) {
  var d = p.data || {};
  var ids = d.payment_ids || [];
  if (!ids.length) throw new Error('Select at least one payment to deposit.');
  var total = 0;
  var depId = newId_();
  var depNo = incrementCounter_('deposit');
  rows_('Payments').forEach(function (r) {
    if (ids.indexOf(r.id) !== -1) {
      total += Number(r.amount || 0);
      update_('Payments', r.id, { is_deposited: '1', deposit_id: depId });
    }
  });
  sheet_('Deposits').appendRow(SCHEMA.Deposits.map(function (h) {
    var m = { id: depId, deposit_no: depNo, date: d.date || new Date().toISOString().slice(0, 10), account_id: d.account_id || '', memo: d.memo || '', total: total, created_by: userFromToken_(p.token), created_at: new Date().toISOString() };
    return safeCell_(m[h]);
  }));
  try {
    postEntry_({ date: d.date, memo: 'Deposit ' + depNo, source_type: 'deposit', source_id: depId, created_by: userFromToken_(p.token),
      lines: [{ account_id: d.account_id, debit: total, credit: 0 }, { account_id: acctId_('undeposited'), debit: 0, credit: total }] });
  } catch (e) {}
  return { id: depId, deposit_no: depNo, total: total };
}

function depositsList_() {
  var accs = {}; rows_('Accounts').forEach(function (a) { accs[String(a.id)] = a.account_name; });
  return rows_('Deposits').map(function (r) {
    var o = strip_(r); o.account_name = accs[String(r.account_id)] || ''; return o;
  }).sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); });
}

// =====================================================================
//  OUTPUT
// =====================================================================
function out_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// =====================================================================
//  PURCHASE ORDERS
//  Non-posting document: no journal entry, no stock movement. A PO is a
//  request to a supplier; inventory/AP only move when it becomes a Bill.
// =====================================================================
function writePoLines_(poId, lines) {
  (lines || []).forEach(function (ln) {
    create_('PurchaseOrderItems', {
      po_id: poId, item_id: ln.item_id || '', description: ln.description || '',
      qty: Number(ln.qty || 0), unit: ln.unit || '', cost: Number(ln.cost || 0),
      discount: ln.discount || '', line_total: Number(ln.line_total || 0)
    });
  });
}

function savePurchaseOrder_(p) {
  var d = p.data || {};
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var lines = d.lines || [];
    var subtotal = lines.reduce(function (s, l) { return s + Number(l.line_total || 0); }, 0);
    var total = Number(d.total != null ? d.total : subtotal);
    if (p.id) {
      var po = rows_('PurchaseOrders').filter(function (r) { return String(r.id) === String(p.id); })[0];
      if (!po) throw new Error('Purchase Order not found.');
      deleteWhere_('PurchaseOrderItems', 'po_id', p.id);
      update_('PurchaseOrders', p.id, {
        date: d.date || po.date, supplier_id: d.supplier_id || '', store_id: d.store_id || '',
        description: d.description || '', reference_no: d.reference_no || '',
        subtotal: subtotal, discount: Number(d.discount || 0), total: total
      });
      writePoLines_(p.id, lines);
      return { id: p.id, po_no: po.po_no };
    }
    var poNo = incrementCounter_('purchase_order');
    var id = newId_();
    var rec = {
      id: id, po_no: poNo, date: d.date || new Date().toISOString().slice(0, 10),
      supplier_id: d.supplier_id || '', store_id: d.store_id || '', description: d.description || '',
      reference_no: d.reference_no || '', subtotal: subtotal, discount: Number(d.discount || 0),
      total: total, status: 'open', created_by: userFromToken_(p.token), created_at: new Date().toISOString()
    };
    sheet_('PurchaseOrders').appendRow(SCHEMA.PurchaseOrders.map(function (h) { return safeCell_(rec[h]); }));
    writePoLines_(id, lines);
    return { id: id, po_no: poNo };
  } finally { lock.releaseLock(); }
}

function purchaseOrderDetail_(id) {
  var po = get_('PurchaseOrders', id);
  if (!po) throw new Error('Purchase Order not found.');
  var items = rows_('PurchaseOrderItems').filter(function (r) { return String(r.po_id) === String(id); }).map(strip_);
  var supplier = po.supplier_id ? get_('Suppliers', po.supplier_id) : null;
  return { po: po, items: items, supplier: supplier };
}

function deletePurchaseOrder_(id) {
  update_('PurchaseOrders', id, { status: 'deleted' });
  deleteWhere_('PurchaseOrderItems', 'po_id', id);
  return { id: id, deleted: true };
}

function setPurchaseOrderStatus_(id, status) {
  if (['open', 'closed', 'rejected'].indexOf(String(status)) === -1) throw new Error('Invalid status.');
  update_('PurchaseOrders', id, { status: status });
  return { id: id, status: status };
}

// =====================================================================
//  BILLS
//  Posting document. A normal Bill records a purchase on credit:
//     Dr Inventory Asset      Cr Accounts Payable
//  and moves stock IN. A "Credit (Normal)" bill is a supplier return:
//     Dr Accounts Payable     Cr Inventory Asset   (stock OUT)
// =====================================================================
function writeBillLines_(billId, billNo, lines, dateStr, billType) {
  (lines || []).forEach(function (ln) {
    create_('BillItems', {
      bill_id: billId, item_id: ln.item_id || '', description: ln.description || '',
      warehouse: ln.warehouse || '', qty: Number(ln.qty || 0), unit: ln.unit || '',
      multiplier: Number(ln.multiplier || 1), cost: Number(ln.cost || 0),
      discount: ln.discount || '', line_total: Number(ln.line_total || 0)
    });
    if (ln.item_id) {
      create_('StockMovements', {
        date: dateStr || new Date().toISOString().slice(0, 10), item_id: ln.item_id,
        type: billType === 'Credit' ? 'out' : 'in',
        qty: Number(ln.qty || 0) * Number(ln.multiplier || 1),
        reference_type: 'bill', reference_id: billId, notes: billNo
      });
    }
  });
}

function postBillJournal_(id, no, rec, token) {
  var total = Number(rec.total || 0); if (total <= 0) return;
  var inv = acctId_('inventory'), ap = acctId_('ap');
  var lines = (rec.bill_type === 'Credit')
    ? [{ account_id: ap, debit: total, credit: 0 }, { account_id: inv, debit: 0, credit: total }]
    : [{ account_id: inv, debit: total, credit: 0 }, { account_id: ap, debit: 0, credit: total }];
  try {
    postEntry_({ date: rec.date, memo: (rec.bill_type === 'Credit' ? 'Supplier credit ' : 'Bill ') + no,
      source_type: 'bill', source_id: id, created_by: userFromToken_(token), lines: lines });
  } catch (e) { /* never block the document on a posting hiccup */ }
}

function saveBill_(p) {
  var d = p.data || {};
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var lines = d.lines || [];
    var subtotal = lines.reduce(function (s, l) { return s + Number(l.line_total || 0); }, 0);
    var disc = Number(d.discount || 0);
    var shipping = Number(d.shipping_charges || 0);
    var total = Number(d.total != null ? d.total : (subtotal - disc + shipping));
    var billType = d.bill_type === 'Credit' ? 'Credit' : 'Bill';
    if (p.id) {
      var bill = rows_('Bills').filter(function (r) { return String(r.id) === String(p.id); })[0];
      if (!bill) throw new Error('Bill not found.');
      deleteWhere_('BillItems', 'bill_id', p.id);
      deleteWhere_('StockMovements', 'reference_id', p.id);
      reverseSource_('bill', p.id);
      var paid = Number(bill.paid || 0);
      update_('Bills', p.id, {
        bill_type: billType, date: d.date || bill.date, due_date: d.due_date || bill.due_date || '',
        supplier_id: d.supplier_id || '', store_id: d.store_id || '', po_id: d.po_id || '',
        reference_no: d.reference_no || '', description: d.description || '',
        subtotal: subtotal, discount: disc, discount_type: d.discount_type || '',
        shipping_charges: shipping, total: total, balance: total - paid,
        status: paid >= total ? 'paid' : (paid > 0 ? 'partial' : 'unpaid')
      });
      writeBillLines_(p.id, bill.bill_no, lines, d.date || bill.date, billType);
      postBillJournal_(p.id, bill.bill_no, get_('Bills', p.id), p.token);
      return { id: p.id, bill_no: bill.bill_no };
    }
    var billNo = incrementCounter_('bill');
    var id = newId_();
    var rec = {
      id: id, bill_no: billNo, bill_type: billType,
      date: d.date || new Date().toISOString().slice(0, 10), due_date: d.due_date || '',
      supplier_id: d.supplier_id || '', store_id: d.store_id || '', po_id: d.po_id || '',
      reference_no: d.reference_no || '', description: d.description || '',
      subtotal: subtotal, discount: disc, discount_type: d.discount_type || '',
      shipping_charges: shipping, total: total, paid: 0, balance: total,
      status: total <= 0 ? 'paid' : 'unpaid', created_by: userFromToken_(p.token), created_at: new Date().toISOString()
    };
    sheet_('Bills').appendRow(SCHEMA.Bills.map(function (h) { return safeCell_(rec[h]); }));
    writeBillLines_(id, billNo, lines, rec.date, billType);
    postBillJournal_(id, billNo, rec, p.token);
    return { id: id, bill_no: billNo };
  } finally { lock.releaseLock(); }
}

function billDetail_(id) {
  var bill = get_('Bills', id);
  if (!bill) throw new Error('Bill not found.');
  var items = rows_('BillItems').filter(function (r) { return String(r.bill_id) === String(id); }).map(strip_);
  var supplier = bill.supplier_id ? get_('Suppliers', bill.supplier_id) : null;
  return { bill: bill, items: items, supplier: supplier };
}

function deleteBill_(id) {
  update_('Bills', id, { status: 'deleted' });
  deleteWhere_('BillItems', 'bill_id', id);
  deleteWhere_('StockMovements', 'reference_id', id);
  reverseSource_('bill', id);
  return { id: id, deleted: true };
}

// net payable to a supplier (bills minus supplier credits), open balances only
function supplierBalance_(supplierId, excludeId) {
  if (!supplierId) return 0;
  return rows_('Bills').filter(function (r) {
    return String(r.supplier_id) === String(supplierId)
      && String(r.status) !== 'deleted'
      && String(r.id) !== String(excludeId || '');
  }).reduce(function (s, r) {
    var sign = r.bill_type === 'Credit' ? -1 : 1;
    return s + sign * Number(r.balance || 0);
  }, 0);
}
