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
  Items:          ['id','sku','name','category_id','brand_id','uom_id','cost_price','regular_price','wholesale_price','tax_type_id','reorder_level','expiry_date','status','created_at','item_type','supplier_id','cogs_account_id','income_account_id','asset_account_id','purchase_description','sale_description','size','attributes','max_order_qty','commission','opening_qty','unique_id'],
  Customers:      ['id','name','phone','email','address','area','opening_balance','credit_limit','price_list','status','created_at','customer_code','customer_type','cnic','payment_day','representative_id','customer_care_manager','photo'],
  Suppliers:      ['id','name','phone','email','address','opening_balance','status','created_at','code'],
  PurchaseOrders:     ['id','po_no','date','supplier_id','store_id','description','reference_no','subtotal','discount','total','status','created_by','created_at'],
  PurchaseOrderItems: ['id','po_id','item_id','description','qty','unit','cost','discount','line_total'],
  Bills:              ['id','bill_no','bill_type','date','due_date','supplier_id','store_id','po_id','reference_no','description','subtotal','discount','discount_type','shipping_charges','total','paid','balance','status','created_by','created_at'],
  BillItems:          ['id','bill_id','item_id','description','warehouse','qty','unit','multiplier','cost','discount','line_total'],
  SalesOrders:        ['id','so_no','date','customer_id','subtotal','discount','tax','total','status','notes','due_date','reference_no','created_by','created_at'],
  SalesOrderItems:    ['id','so_id','item_id','description','qty','unit_price','discount','line_total'],
  Quotations:         ['id','quote_no','date','customer_id','subtotal','discount','tax','total','status','notes','due_date','reference_no','created_by','created_at'],
  QuotationItems:     ['id','quote_id','item_id','description','qty','unit_price','discount','line_total'],
  CreditMemos:        ['id','memo_no','date','customer_id','subtotal','discount','tax','total','status','notes','reference_no','created_by','created_at'],
  CreditMemoItems:    ['id','memo_id','item_id','description','qty','unit_price','discount','line_total'],
  Expenses:           ['id','expense_no','date','payee','payment_account_id','reference_no','description','total','status','created_by','created_at'],
  ExpenseItems:       ['id','expense_id','account_id','description','amount'],
  InventoryTransfers:     ['id','transfer_no','date','store_id','from_warehouse','to_warehouse','description','status','created_by','created_at'],
  InventoryTransferItems: ['id','transfer_id','item_id','description','qty','unit'],
  InventoryAdjustments:     ['id','adjustment_no','reference_no','adjustment_type','date','store_id','warehouse','adjustment_account_id','description','total_value','status','created_by','created_at'],
  InventoryAdjustmentItems: ['id','adjustment_id','item_id','description','on_hand','new_qty','qty_diff','cost','value_diff'],
  Claims:             ['id','claim_no','date','customer_id','store_id','reference_no','description','status','created_by','created_at'],
  ClaimItems:         ['id','claim_id','item_id','description','serial_no','qty','unit'],
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
  upsertCounter_('credit_memo', 'CM-1-');
  upsertCounter_('expense', 'EXP-1-');
  upsertCounter_('inventory_transfer', 'IT-1-');
  upsertCounter_('inventory_adjustment', 'IA-1-');
  upsertCounter_('claim', 'CLM-1-');

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
      case 'salesSummary': return out_({ ok: true, data: salesSum_(p.from, p.to) });
      case 'weeklySummary': return out_({ ok: true, data: weeklySummary_() });
      case 'dashboardExtra': return out_({ ok: true, data: dashboardExtra_() });
      case 'inventoryAlerts': return out_({ ok: true, data: inventoryAlerts_() });
      case 'reportTrialBalance': return out_({ ok: true, data: reportTrialBalance_(p) });
      case 'reportProfitLoss': return out_({ ok: true, data: plData_(p.from, p.to) });
      case 'reportBalanceSheet': return out_({ ok: true, data: reportBalanceSheet_(p) });
      case 'reportIncomeByCustomer': return out_({ ok: true, data: reportIncomeByCustomer_(p) });
      case 'reportTransactionsSummary': return out_({ ok: true, data: reportTransactionsSummary_(p) });
      case 'reportCustomerBalances': return out_({ ok: true, data: reportCustomerBalances_(p) });
      case 'reportPaymentCollection': return out_({ ok: true, data: reportPaymentCollection_(p) });
      case 'reportCustomerStatement': return out_({ ok: true, data: reportCustomerStatement_(p) });
      case 'reportAccountStatement': return out_({ ok: true, data: reportAccountStatement_(p) });
      case 'reportSupplierBalances': return out_({ ok: true, data: reportSupplierBalances_(p) });
      case 'reportSupplierStatement': return out_({ ok: true, data: reportSupplierStatement_(p) });
      case 'reportJournal': return out_({ ok: true, data: reportJournal_(p) });
      case 'reportGeneralLedger': return out_({ ok: true, data: reportGeneralLedger_(p) });
      case 'searchDocuments': return out_({ ok: true, data: searchDocs_(p.q) });
      case 'itemCard': return out_({ ok: true, data: itemCard_(p.item_id) });
      case 'updatePrices': return out_({ ok: true, data: updatePrices_(p.updates) });
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
      case 'paymentDetail': return out_({ ok: true, data: paymentDetail_(p.id) });
      case 'deletePayment': return out_({ ok: true, data: deletePayment_(p) });
      case 'depositDetail': return out_({ ok: true, data: depositDetail_(p.id) });
      case 'deleteDeposit': return out_({ ok: true, data: deleteDeposit_(p) });
      case 'savePurchaseOrder': return out_({ ok: true, data: savePurchaseOrder_(p) });
      case 'purchaseOrderDetail': return out_({ ok: true, data: purchaseOrderDetail_(p.id) });
      case 'deletePurchaseOrder': return out_({ ok: true, data: deletePurchaseOrder_(p.id) });
      case 'setPurchaseOrderStatus': return out_({ ok: true, data: setPurchaseOrderStatus_(p.id, p.status) });
      case 'saveBill': return out_({ ok: true, data: saveBill_(p) });
      case 'billDetail': return out_({ ok: true, data: billDetail_(p.id) });
      case 'deleteBill': return out_({ ok: true, data: deleteBill_(p.id) });
      case 'supplierBalance': return out_({ ok: true, data: { balance: supplierBalance_(p.supplier_id, p.exclude_id) } });
      case 'createSalesOrder': return out_({ ok: true, data: saveSimpleSalesDoc_('SalesOrders','SalesOrderItems','sales_order','so_no','so_id',p) });
      case 'updateSalesOrder': return out_({ ok: true, data: saveSimpleSalesDoc_('SalesOrders','SalesOrderItems','sales_order','so_no','so_id',p) });
      case 'salesOrderDetail': return out_({ ok: true, data: simpleDocDetail_('SalesOrders','SalesOrderItems','so_id',p.id) });
      case 'deleteSalesOrder': return out_({ ok: true, data: deleteSimpleDoc_('SalesOrders','SalesOrderItems','so_id',p.id) });
      case 'createQuotation': return out_({ ok: true, data: saveSimpleSalesDoc_('Quotations','QuotationItems','quotation','quote_no','quote_id',p) });
      case 'updateQuotation': return out_({ ok: true, data: saveSimpleSalesDoc_('Quotations','QuotationItems','quotation','quote_no','quote_id',p) });
      case 'quotationDetail': return out_({ ok: true, data: simpleDocDetail_('Quotations','QuotationItems','quote_id',p.id) });
      case 'deleteQuotation': return out_({ ok: true, data: deleteSimpleDoc_('Quotations','QuotationItems','quote_id',p.id) });
      case 'createCreditMemo': return out_({ ok: true, data: saveCreditMemo_(p) });
      case 'updateCreditMemo': return out_({ ok: true, data: saveCreditMemo_(p) });
      case 'creditMemoDetail': return out_({ ok: true, data: simpleDocDetail_('CreditMemos','CreditMemoItems','memo_id',p.id) });
      case 'deleteCreditMemo': return out_({ ok: true, data: deleteCreditMemo_(p.id) });
      case 'saveExpense': case 'updateExpense': return out_({ ok: true, data: saveExpense_(p) });
      case 'expenseDetail': return out_({ ok: true, data: expenseDetail_(p.id) });
      case 'deleteExpense': return out_({ ok: true, data: deleteExpense_(p.id) });
      case 'saveInventoryTransfer': case 'updateInventoryTransfer': return out_({ ok: true, data: saveInventoryTransfer_(p) });
      case 'inventoryTransferDetail': return out_({ ok: true, data: inventoryTransferDetail_(p.id) });
      case 'deleteInventoryTransfer': return out_({ ok: true, data: deleteInventoryTransfer_(p.id) });
      case 'saveInventoryAdjustment': case 'updateInventoryAdjustment': return out_({ ok: true, data: saveInventoryAdjustment_(p) });
      case 'inventoryAdjustmentDetail': return out_({ ok: true, data: inventoryAdjustmentDetail_(p.id) });
      case 'deleteInventoryAdjustment': return out_({ ok: true, data: deleteInventoryAdjustment_(p.id) });
      case 'inventoryOnHand': return out_({ ok: true, data: { item_id: p.item_id, on_hand: onHand_(p.item_id) } });
      case 'saveClaim': case 'updateClaim': return out_({ ok: true, data: saveClaim_(p) });
      case 'claimDetail': return out_({ ok: true, data: claimDetail_(p.id) });
      case 'deleteClaim': return out_({ ok: true, data: deleteClaim_(p.id) });
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
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(entity);
  if (!sh) {
    // Create the tab on demand so a freshly added module works even if
    // migrate() has not been run yet for it.
    sh = ss.insertSheet(entity);
    var headers = SCHEMA[entity];
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
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
  if (entity === 'Items' && (data.sku == null || String(data.sku).trim() === '')) {
    data.sku = nextUpc_();
  }
  var sh = sheet_(entity);
  var headers = SCHEMA[entity];
  var rec = {};
  headers.forEach(function (h) { rec[h] = (h in data) ? data[h] : ''; });
  if (headers.indexOf('id') !== -1 && !rec.id) rec.id = newId_();
  if (headers.indexOf('created_at') !== -1 && !rec.created_at) rec.created_at = new Date().toISOString();
  if (headers.indexOf('status') !== -1 && !rec.status) rec.status = 'active';
  sh.appendRow(headers.map(function (h) { return safeCell_(rec[h]); }));
  if (entity === 'Items' && Number(rec.opening_qty) > 0) {
    create_('StockMovements', { date: new Date().toISOString().slice(0, 10), item_id: rec.id, type: 'in', qty: Number(rec.opening_qty), reference_type: 'opening', reference_id: rec.id, notes: 'Opening stock' });
  }
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

// default prefixes so a counter created on first use still numbers correctly
var COUNTER_PREFIX = {
  invoice: 'INV-1-', sales_receipt: 'SAL-1-', quotation: 'QUO-1-', sales_order: 'SO-1-',
  credit_memo: 'CM-1-', journal: 'JE-', deposit: 'DEP-', purchase_order: 'PO-1-', bill: 'B-1-',
  expense: 'EXP-1-', inventory_transfer: 'IT-1-', inventory_adjustment: 'IA-1-', claim: 'CLM-1-'
};

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
  var prefix = COUNTER_PREFIX[name] || '';
  sh.appendRow([name, 1, prefix]);
  return prefix + String(1).padStart(5, '0');
}

// =====================================================================
//  DASHBOARD
// =====================================================================
function tz_() { return Session.getScriptTimeZone() || 'Asia/Karachi'; }
function todayKey_() { return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd'); }

// normalise any stored date (Date object, ISO, dd-mm-yyyy, localized) to yyyy-MM-dd
function dayKey_(v) {
  if (v == null || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
  var s = String(v).trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = s.match(/^(\d{2})-(\d{2})-(\d{4})/); if (m) return m[3] + '-' + m[2] + '-' + m[1];
  var d = new Date(s); if (!isNaN(d.getTime())) return Utilities.formatDate(d, tz_(), 'yyyy-MM-dd');
  return s.slice(0, 10);
}

// Monday-anchored week range; offset 0 = this week, -1 = last week
function weekRange_(offsetWeeks) {
  var tz = tz_(), now = new Date();
  var dow = Number(Utilities.formatDate(now, tz, 'u')); // 1=Mon .. 7=Sun
  var monday = new Date(now.getTime() - (dow - 1) * 86400000 + offsetWeeks * 7 * 86400000);
  var sunday = new Date(monday.getTime() + 6 * 86400000);
  return { from: Utilities.formatDate(monday, tz, 'yyyy-MM-dd'), to: Utilities.formatDate(sunday, tz, 'yyyy-MM-dd') };
}

// total sales (invoices + receipts) with day-key between from..to inclusive
function salesSum_(fromKey, toKey) {
  var f = dayKey_(fromKey) || '0000-00-00', t = dayKey_(toKey) || '9999-99-99';
  var sum = 0, count = 0;
  ['Invoices', 'SalesReceipts'].forEach(function (e) {
    list_(e, {}).forEach(function (r) {
      var k = dayKey_(r.date);
      if (k && k >= f && k <= t) { sum += Number(r.total || 0); count++; }
    });
  });
  return { total: sum, count: count, from: f, to: t };
}

function dashboard_() {
  var today = todayKey_();
  var tw = weekRange_(0), lw = weekRange_(-1);
  return {
    items_count: list_('Items', {}).length,
    customers_count: list_('Customers', {}).length,
    low_stock_count: inventoryAlerts_().length,
    today_sales: salesSum_(today, today).total,
    this_week_sales: salesSum_(tw.from, tw.to).total,
    last_week_sales: salesSum_(lw.from, lw.to).total,
    ranges: { today: { from: today, to: today }, this_week: tw, last_week: lw }
  };
}

function nameMap_(entity) {
  var m = {}; rows_(entity).forEach(function (r) { m[String(r.id)] = r.name; }); return m;
}

// global document search by number / party name / reference
function searchDocs_(q) {
  q = String(q || '').trim().toLowerCase();
  if (!q) return [];
  var cust = nameMap_('Customers'), supp = nameMap_('Suppliers'), res = [];
  function scan(entity, numField, partyField, names, label, route) {
    list_(entity, {}).forEach(function (r) {
      var num = String(r[numField] || ''), nm = names ? (names[String(r[partyField])] || '') : '';
      if (num.toLowerCase().indexOf(q) !== -1 || nm.toLowerCase().indexOf(q) !== -1 || String(r.reference_no || '').toLowerCase().indexOf(q) !== -1) {
        res.push({ type: label, id: r.id, number: num, name: nm, date: dayKey_(r.date), total: Number(r.total || 0), route: route });
      }
    });
  }
  scan('Invoices', 'invoice_no', 'customer_id', cust, 'Invoice', 'invoice-detail');
  scan('SalesReceipts', 'receipt_no', 'customer_id', cust, 'Receipt', 'sales-receipt-detail');
  scan('CreditMemos', 'memo_no', 'customer_id', cust, 'Credit Memo', 'edit-credit-memo');
  scan('SalesOrders', 'so_no', 'customer_id', cust, 'Sales Order', 'edit-sales-order');
  scan('Quotations', 'quote_no', 'customer_id', cust, 'Quotation', 'edit-quotation');
  scan('Bills', 'bill_no', 'supplier_id', supp, 'Bill', 'edit-bill');
  scan('PurchaseOrders', 'po_no', 'supplier_id', supp, 'Purchase Order', 'edit-purchase-order');
  res.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
  return res.slice(0, 25);
}

// numeric UPC/barcode generator, Diyar-style (1000001, 1000002, …)
function nextUpc_() {
  var sh = sheet_('Counters');
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === 'upc') {
      var next = Number(values[i][1] || 0) + 1;
      sh.getRange(i + 1, 2).setValue(next);
      return String(1000000 + next);
    }
  }
  sh.appendRow(['upc', 1, '']);
  return String(1000001);
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

// =====================================================================
//  SALES ORDERS & QUOTATIONS  (non-posting customer documents)
//  Both share the invoice-style line structure but never touch the
//  ledger or stock — they are commitments, not transactions.
// =====================================================================
function writeSimpleLines_(itemsEntity, fk, docId, lines) {
  (lines || []).forEach(function (ln) {
    var rec = { item_id: ln.item_id || '', description: ln.description || '',
      qty: Number(ln.qty || 0), unit_price: Number(ln.unit_price || 0),
      discount: ln.discount || '', line_total: Number(ln.line_total || 0) };
    rec[fk] = docId;
    create_(itemsEntity, rec);
  });
}

function saveSimpleSalesDoc_(entity, itemsEntity, counterName, numberField, fk, p) {
  var d = p.data || {};
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var lines = d.lines || [];
    var subtotal = lines.reduce(function (s, l) { return s + Number(l.line_total || 0); }, 0);
    var total = Number(d.total != null ? d.total : subtotal);
    if (p.id) {
      var ex = rows_(entity).filter(function (r) { return String(r.id) === String(p.id); })[0];
      if (!ex) throw new Error('Document not found.');
      deleteWhere_(itemsEntity, fk, p.id);
      update_(entity, p.id, {
        date: d.date || ex.date, customer_id: d.customer_id || '', subtotal: subtotal,
        discount: Number(d.discount || 0), tax: 0, total: total,
        due_date: d.due_date || ex.due_date || '', reference_no: d.reference_no || '', notes: d.notes || ''
      });
      writeSimpleLines_(itemsEntity, fk, p.id, lines);
      return { id: p.id, number: ex[numberField] };
    }
    var no = incrementCounter_(counterName);
    var id = newId_();
    var rec = {
      id: id, date: d.date || new Date().toISOString().slice(0, 10), customer_id: d.customer_id || '',
      subtotal: subtotal, discount: Number(d.discount || 0), tax: 0, total: total, status: 'open',
      notes: d.notes || '', due_date: d.due_date || '', reference_no: d.reference_no || '',
      created_by: userFromToken_(p.token), created_at: new Date().toISOString()
    };
    rec[numberField] = no;
    sheet_(entity).appendRow(SCHEMA[entity].map(function (h) { return safeCell_(rec[h]); }));
    writeSimpleLines_(itemsEntity, fk, id, lines);
    return { id: id, number: no };
  } finally { lock.releaseLock(); }
}

function simpleDocDetail_(entity, itemsEntity, fk, id) {
  var record = get_(entity, id);
  if (!record) throw new Error('Document not found.');
  var items = rows_(itemsEntity).filter(function (r) { return String(r[fk]) === String(id); }).map(strip_);
  var customer = record.customer_id ? get_('Customers', record.customer_id) : null;
  return { record: record, items: items, customer: customer };
}

function deleteSimpleDoc_(entity, itemsEntity, fk, id) {
  update_(entity, id, { status: 'deleted' });
  deleteWhere_(itemsEntity, fk, id);
  return { id: id, deleted: true };
}

// =====================================================================
//  CREDIT MEMO / REFUNDS  (posting: reverses a sale)
//     Dr Sales      Cr Accounts Receivable      and stock back IN
// =====================================================================
function saveCreditMemo_(p) {
  var d = p.data || {};
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var lines = d.lines || [];
    var subtotal = lines.reduce(function (s, l) { return s + Number(l.line_total || 0); }, 0);
    var total = Number(d.total != null ? d.total : subtotal);
    var existingNo = null, id = p.id;
    if (p.id) {
      var ex = rows_('CreditMemos').filter(function (r) { return String(r.id) === String(p.id); })[0];
      if (!ex) throw new Error('Credit memo not found.');
      existingNo = ex.memo_no;
      deleteWhere_('CreditMemoItems', 'memo_id', p.id);
      deleteWhere_('StockMovements', 'reference_id', p.id);
      reverseSource_('credit_memo', p.id);
      update_('CreditMemos', p.id, {
        date: d.date || ex.date, customer_id: d.customer_id || '', subtotal: subtotal,
        discount: Number(d.discount || 0), tax: 0, total: total,
        reference_no: d.reference_no || '', notes: d.notes || ''
      });
    } else {
      existingNo = incrementCounter_('credit_memo');
      id = newId_();
      var rec = {
        id: id, memo_no: existingNo, date: d.date || new Date().toISOString().slice(0, 10),
        customer_id: d.customer_id || '', subtotal: subtotal, discount: Number(d.discount || 0),
        tax: 0, total: total, status: 'open', notes: d.notes || '', reference_no: d.reference_no || '',
        created_by: userFromToken_(p.token), created_at: new Date().toISOString()
      };
      sheet_('CreditMemos').appendRow(SCHEMA.CreditMemos.map(function (h) { return safeCell_(rec[h]); }));
    }
    // lines + stock back in
    (lines || []).forEach(function (ln) {
      create_('CreditMemoItems', { memo_id: id, item_id: ln.item_id || '', description: ln.description || '',
        qty: Number(ln.qty || 0), unit_price: Number(ln.unit_price || 0), discount: ln.discount || '', line_total: Number(ln.line_total || 0) });
      if (ln.item_id) create_('StockMovements', { date: d.date || new Date().toISOString().slice(0, 10),
        item_id: ln.item_id, type: 'in', qty: Number(ln.qty || 0), reference_type: 'credit_memo', reference_id: id, notes: existingNo });
    });
    if (total > 0) {
      try {
        postEntry_({ date: d.date, memo: 'Credit memo ' + existingNo, source_type: 'credit_memo', source_id: id,
          created_by: userFromToken_(p.token),
          lines: [{ account_id: acctId_('sales'), debit: total, credit: 0 }, { account_id: acctId_('ar'), debit: 0, credit: total }] });
      } catch (e) {}
    }
    return { id: id, number: existingNo };
  } finally { lock.releaseLock(); }
}

function deleteCreditMemo_(id) {
  update_('CreditMemos', id, { status: 'deleted' });
  deleteWhere_('CreditMemoItems', 'memo_id', id);
  deleteWhere_('StockMovements', 'reference_id', id);
  reverseSource_('credit_memo', id);
  return { id: id, deleted: true };
}

// =====================================================================
//  STOCK ON HAND  (global per item, from StockMovements)
// =====================================================================
function onHand_(itemId) {
  if (!itemId) return 0;
  return rows_('StockMovements').filter(function (r) { return String(r.item_id) === String(itemId); })
    .reduce(function (s, r) { return s + (String(r.type) === 'out' ? -1 : 1) * Number(r.qty || 0); }, 0);
}

// =====================================================================
//  EXPENSES  (posts: Dr expense account(s), Cr the payment account)
// =====================================================================
function saveExpense_(p) {
  var d = p.data || {}; var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var lines = (d.lines || []).filter(function (l) { return l.account_id || Number(l.amount || 0) !== 0; });
    var total = lines.reduce(function (s, l) { return s + Number(l.amount || 0); }, 0);
    var id = p.id, no;
    if (p.id) {
      var ex = rows_('Expenses').filter(function (r) { return String(r.id) === String(p.id); })[0];
      if (!ex) throw new Error('Expense not found.');
      no = ex.expense_no;
      deleteWhere_('ExpenseItems', 'expense_id', p.id);
      reverseSource_('expense', p.id);
      update_('Expenses', p.id, { date: d.date || ex.date, payee: d.payee || '', payment_account_id: d.payment_account_id || '', reference_no: d.reference_no || '', description: d.description || '', total: total });
    } else {
      no = incrementCounter_('expense'); id = newId_();
      var rec = { id: id, expense_no: no, date: d.date || new Date().toISOString().slice(0, 10), payee: d.payee || '', payment_account_id: d.payment_account_id || '', reference_no: d.reference_no || '', description: d.description || '', total: total, status: 'recorded', created_by: userFromToken_(p.token), created_at: new Date().toISOString() };
      sheet_('Expenses').appendRow(SCHEMA.Expenses.map(function (h) { return safeCell_(rec[h]); }));
    }
    lines.forEach(function (l) { create_('ExpenseItems', { expense_id: id, account_id: l.account_id || '', description: l.description || '', amount: Number(l.amount || 0) }); });
    if (total > 0 && d.payment_account_id) {
      var jlines = lines.map(function (l) { return { account_id: l.account_id, debit: Number(l.amount || 0), credit: 0, memo: l.description || '' }; });
      jlines.push({ account_id: d.payment_account_id, debit: 0, credit: total });
      try { postEntry_({ date: d.date, memo: 'Expense ' + no, source_type: 'expense', source_id: id, created_by: userFromToken_(p.token), lines: jlines }); } catch (e) {}
    }
    return { id: id, number: no };
  } finally { lock.releaseLock(); }
}
function expenseDetail_(id) {
  var record = get_('Expenses', id); if (!record) throw new Error('Expense not found.');
  var items = rows_('ExpenseItems').filter(function (r) { return String(r.expense_id) === String(id); }).map(strip_);
  return { record: record, items: items };
}
function deleteExpense_(id) { update_('Expenses', id, { status: 'deleted' }); deleteWhere_('ExpenseItems', 'expense_id', id); reverseSource_('expense', id); return { id: id, deleted: true }; }

// =====================================================================
//  INVENTORY TRANSFER  (non-posting; stock out of one WH, into another)
// =====================================================================
function saveInventoryTransfer_(p) {
  var d = p.data || {}; var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var lines = (d.lines || []).filter(function (l) { return l.item_id && Number(l.qty || 0) > 0; });
    var id = p.id, no, date = d.date || new Date().toISOString().slice(0, 10);
    if (p.id) {
      var ex = rows_('InventoryTransfers').filter(function (r) { return String(r.id) === String(p.id); })[0];
      if (!ex) throw new Error('Transfer not found.');
      no = ex.transfer_no;
      deleteWhere_('InventoryTransferItems', 'transfer_id', p.id);
      deleteWhere_('StockMovements', 'reference_id', p.id);
      update_('InventoryTransfers', p.id, { date: date, store_id: d.store_id || '', from_warehouse: d.from_warehouse || '', to_warehouse: d.to_warehouse || '', description: d.description || '' });
    } else {
      no = incrementCounter_('inventory_transfer'); id = newId_();
      var rec = { id: id, transfer_no: no, date: date, store_id: d.store_id || '', from_warehouse: d.from_warehouse || '', to_warehouse: d.to_warehouse || '', description: d.description || '', status: 'completed', created_by: userFromToken_(p.token), created_at: new Date().toISOString() };
      sheet_('InventoryTransfers').appendRow(SCHEMA.InventoryTransfers.map(function (h) { return safeCell_(rec[h]); }));
    }
    lines.forEach(function (l) {
      create_('InventoryTransferItems', { transfer_id: id, item_id: l.item_id, description: l.description || '', qty: Number(l.qty || 0), unit: l.unit || '' });
      create_('StockMovements', { date: date, item_id: l.item_id, type: 'out', qty: Number(l.qty || 0), reference_type: 'transfer', reference_id: id, notes: no + ' from ' + (d.from_warehouse || '') });
      create_('StockMovements', { date: date, item_id: l.item_id, type: 'in', qty: Number(l.qty || 0), reference_type: 'transfer', reference_id: id, notes: no + ' to ' + (d.to_warehouse || '') });
    });
    return { id: id, number: no };
  } finally { lock.releaseLock(); }
}
function inventoryTransferDetail_(id) {
  var record = get_('InventoryTransfers', id); if (!record) throw new Error('Transfer not found.');
  var items = rows_('InventoryTransferItems').filter(function (r) { return String(r.transfer_id) === String(id); }).map(strip_);
  return { record: record, items: items };
}
function deleteInventoryTransfer_(id) { update_('InventoryTransfers', id, { status: 'deleted' }); deleteWhere_('InventoryTransferItems', 'transfer_id', id); deleteWhere_('StockMovements', 'reference_id', id); return { id: id, deleted: true }; }

// =====================================================================
//  INVENTORY ADJUSTMENT  (stock +/- and a value entry to the chosen
//  adjustment account vs Inventory Asset)
// =====================================================================
function saveInventoryAdjustment_(p) {
  var d = p.data || {}; var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var lines = (d.lines || []).filter(function (l) { return l.item_id; });
    var totalValue = lines.reduce(function (s, l) { return s + Number(l.value_diff || 0); }, 0);
    var id = p.id, no, date = d.date || new Date().toISOString().slice(0, 10);
    if (p.id) {
      var ex = rows_('InventoryAdjustments').filter(function (r) { return String(r.id) === String(p.id); })[0];
      if (!ex) throw new Error('Adjustment not found.');
      no = ex.adjustment_no;
      deleteWhere_('InventoryAdjustmentItems', 'adjustment_id', p.id);
      deleteWhere_('StockMovements', 'reference_id', p.id);
      reverseSource_('adjustment', p.id);
      update_('InventoryAdjustments', p.id, { reference_no: d.reference_no || '', adjustment_type: d.adjustment_type || ex.adjustment_type, date: date, store_id: d.store_id || '', warehouse: d.warehouse || '', adjustment_account_id: d.adjustment_account_id || '', description: d.description || '', total_value: totalValue });
    } else {
      no = incrementCounter_('inventory_adjustment'); id = newId_();
      var rec = { id: id, adjustment_no: no, reference_no: d.reference_no || '', adjustment_type: d.adjustment_type || 'Quantity', date: date, store_id: d.store_id || '', warehouse: d.warehouse || '', adjustment_account_id: d.adjustment_account_id || '', description: d.description || '', total_value: totalValue, status: 'completed', created_by: userFromToken_(p.token), created_at: new Date().toISOString() };
      sheet_('InventoryAdjustments').appendRow(SCHEMA.InventoryAdjustments.map(function (h) { return safeCell_(rec[h]); }));
    }
    lines.forEach(function (l) {
      var qd = Number(l.qty_diff || 0);
      create_('InventoryAdjustmentItems', { adjustment_id: id, item_id: l.item_id, description: l.description || '', on_hand: Number(l.on_hand || 0), new_qty: Number(l.new_qty || 0), qty_diff: qd, cost: Number(l.cost || 0), value_diff: Number(l.value_diff || 0) });
      if (l.new_cost != null && l.new_cost !== '' && Number(l.new_cost) > 0) update_('Items', l.item_id, { cost_price: Number(l.new_cost) });
      if (qd !== 0) create_('StockMovements', { date: date, item_id: l.item_id, type: qd > 0 ? 'in' : 'out', qty: Math.abs(qd), reference_type: 'adjustment', reference_id: id, notes: no });
    });
    if (Math.abs(totalValue) > 0.001 && d.adjustment_account_id) {
      var inv = acctId_('inventory');
      var jlines = totalValue > 0
        ? [{ account_id: inv, debit: totalValue, credit: 0 }, { account_id: d.adjustment_account_id, debit: 0, credit: totalValue }]
        : [{ account_id: d.adjustment_account_id, debit: -totalValue, credit: 0 }, { account_id: inv, debit: 0, credit: -totalValue }];
      try { postEntry_({ date: date, memo: 'Inventory adjustment ' + no, source_type: 'adjustment', source_id: id, created_by: userFromToken_(p.token), lines: jlines }); } catch (e) {}
    }
    return { id: id, number: no };
  } finally { lock.releaseLock(); }
}
function inventoryAdjustmentDetail_(id) {
  var record = get_('InventoryAdjustments', id); if (!record) throw new Error('Adjustment not found.');
  var items = rows_('InventoryAdjustmentItems').filter(function (r) { return String(r.adjustment_id) === String(id); }).map(strip_);
  return { record: record, items: items };
}
function deleteInventoryAdjustment_(id) { update_('InventoryAdjustments', id, { status: 'deleted' }); deleteWhere_('InventoryAdjustmentItems', 'adjustment_id', id); deleteWhere_('StockMovements', 'reference_id', id); reverseSource_('adjustment', id); return { id: id, deleted: true }; }

// =====================================================================
//  CLAIMS  (customer warranty/return record; non-posting, no stock)
// =====================================================================
function saveClaim_(p) {
  var d = p.data || {}; var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var lines = (d.lines || []).filter(function (l) { return l.item_id || l.description; });
    var id = p.id, no;
    if (p.id) {
      var ex = rows_('Claims').filter(function (r) { return String(r.id) === String(p.id); })[0];
      if (!ex) throw new Error('Claim not found.');
      no = ex.claim_no;
      deleteWhere_('ClaimItems', 'claim_id', p.id);
      update_('Claims', p.id, { date: d.date || ex.date, customer_id: d.customer_id || '', store_id: d.store_id || '', reference_no: d.reference_no || '', description: d.description || '' });
    } else {
      no = incrementCounter_('claim'); id = newId_();
      var rec = { id: id, claim_no: no, date: d.date || new Date().toISOString().slice(0, 10), customer_id: d.customer_id || '', store_id: d.store_id || '', reference_no: d.reference_no || '', description: d.description || '', status: 'open', created_by: userFromToken_(p.token), created_at: new Date().toISOString() };
      sheet_('Claims').appendRow(SCHEMA.Claims.map(function (h) { return safeCell_(rec[h]); }));
    }
    lines.forEach(function (l) { create_('ClaimItems', { claim_id: id, item_id: l.item_id || '', description: l.description || '', serial_no: l.serial_no || '', qty: Number(l.qty || 0), unit: l.unit || '' }); });
    return { id: id, number: no };
  } finally { lock.releaseLock(); }
}
function claimDetail_(id) {
  var record = get_('Claims', id); if (!record) throw new Error('Claim not found.');
  var items = rows_('ClaimItems').filter(function (r) { return String(r.claim_id) === String(id); }).map(strip_);
  var customer = record.customer_id ? get_('Customers', record.customer_id) : null;
  return { record: record, items: items, customer: customer };
}
function deleteClaim_(id) { update_('Claims', id, { status: 'deleted' }); deleteWhere_('ClaimItems', 'claim_id', id); return { id: id, deleted: true }; }

// =====================================================================
//  ITEM SEARCH (item card: stock on hand + movement history)
// =====================================================================
function itemCard_(itemId) {
  var item = get_('Items', itemId);
  if (!item) throw new Error('Item not found.');
  var moves = rows_('StockMovements').filter(function (r) { return String(r.item_id) === String(itemId); })
    .map(strip_).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
  return { item: item, on_hand: onHand_(itemId), movements: moves.slice(0, 50) };
}

// =====================================================================
//  PRICE MANAGER (bulk update regular / wholesale prices)
// =====================================================================
function updatePrices_(updates) {
  var n = 0;
  (updates || []).forEach(function (u) {
    if (!u.id) return;
    var patch = {};
    if (u.regular_price !== '' && u.regular_price != null) patch.regular_price = Number(u.regular_price);
    if (u.wholesale_price !== '' && u.wholesale_price != null) patch.wholesale_price = Number(u.wholesale_price);
    if (Object.keys(patch).length) { update_('Items', u.id, patch); n++; }
  });
  return { updated: n };
}

// =====================================================================
//  WEEKLY TRANSACTIONS SUMMARY  (last 7 days, by document category)
// =====================================================================
function weeklySummary_() {
  var tz = tz_(), now = new Date(), days = [];
  for (var k = 6; k >= 0; k--) days.push(Utilities.formatDate(new Date(now.getTime() - k * 86400000), tz, 'yyyy-MM-dd'));
  var idx = {}; days.forEach(function (d, i) { idx[d] = i; });
  var blank = function () { return days.map(function () { return 0; }); };
  var rows = {
    'Purchases': blank(), 'Purchase Returns': blank(), 'Sales': blank(), 'Sale Returns': blank(),
    'Cash Sales': blank(), 'POS': blank(), 'Reverse POS': blank(), 'Customer Payments': blank(), 'Supplier Payments': blank()
  };
  function add(title, entity, filter, amountField) {
    list_(entity, {}).forEach(function (r) {
      if (filter && !filter(r)) return;
      var key = dayKey_(r.date);
      if (idx[key] === undefined) return;
      rows[title][idx[key]] += Number(r[amountField || 'total'] || 0);
    });
  }
  add('Purchases', 'Bills', function (r) { return r.bill_type !== 'Credit'; });
  add('Purchase Returns', 'Bills', function (r) { return r.bill_type === 'Credit'; });
  add('Sales', 'Invoices', null);
  add('Sale Returns', 'CreditMemos', null);
  add('Cash Sales', 'SalesReceipts', null);
  add('Customer Payments', 'Payments', null, 'amount');
  var order = ['Purchases', 'Purchase Returns', 'Sales', 'Sale Returns', 'Cash Sales', 'POS', 'Reverse POS', 'Customer Payments', 'Supplier Payments'];
  return { days: days, rows: order.map(function (t) { return { title: t, values: rows[t] }; }) };
}

// =====================================================================
//  INVENTORY ALERTS  (items at or below their re-order point)
// =====================================================================
function onHandMap_() {
  var m = {};
  rows_('StockMovements').forEach(function (r) {
    var k = String(r.item_id);
    m[k] = (m[k] || 0) + (String(r.type) === 'out' ? -1 : 1) * Number(r.qty || 0);
  });
  return m;
}
function inventoryAlerts_() {
  var oh = onHandMap_();
  var cats = nameMap_('Categories'), brands = nameMap_('Brands'), supps = nameMap_('Suppliers');
  var res = [];
  list_('Items', {}).forEach(function (it) {
    var onhand = oh[String(it.id)] || 0;
    var reorder = Number(it.reorder_level || 0);
    if (onhand <= reorder) {
      res.push({ id: it.id, upc: it.sku || '', name: it.name, brand: brands[String(it.brand_id)] || '',
        category: cats[String(it.category_id)] || '', supplier: supps[String(it.supplier_id)] || '',
        size: it.size || '', on_hand: onhand, reorder: reorder });
    }
  });
  res.sort(function (a, b) { return (a.on_hand - a.reorder) - (b.on_hand - b.reorder); });
  return res;
}

// =====================================================================
//  DASHBOARD EXTRAS  (account balances, recent docs, monthly charts)
// =====================================================================
function monthsBack_(n) {
  var tz = tz_(), out = [], now = new Date();
  for (var k = n - 1; k >= 0; k--) {
    var d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    out.push({ key: Utilities.formatDate(d, tz, 'yyyy-MM'), label: Utilities.formatDate(d, tz, 'MMM yy') });
  }
  return out;
}
function monthKey_(v) { var k = dayKey_(v); return k ? k.slice(0, 7) : ''; }

function dashboardCharts_() {
  var months = monthsBack_(6), idx = {};
  months.forEach(function (m, i) { idx[m.key] = i; });
  var z = function () { return months.map(function () { return 0; }); };
  var sales = z(), collection = z(), revenue = z(), cogs = z(), expense = z();
  list_('Invoices', {}).forEach(function (r) { var i = idx[monthKey_(r.date)]; if (i !== undefined) sales[i] += Number(r.total || 0); });
  list_('SalesReceipts', {}).forEach(function (r) { var i = idx[monthKey_(r.date)]; if (i !== undefined) sales[i] += Number(r.total || 0); });
  list_('Payments', {}).forEach(function (r) { var i = idx[monthKey_(r.date)]; if (i !== undefined) collection[i] += Number(r.amount || 0); });
  var typeById = {}; rows_('Accounts').forEach(function (a) { typeById[String(a.id)] = a.account_type; });
  rows_('Journal').forEach(function (r) {
    var i = idx[monthKey_(r.date)]; if (i === undefined) return;
    var t = typeById[String(r.account_id)], net = Number(r.credit || 0) - Number(r.debit || 0);
    if (t === 'Income' || t === 'Other Income') revenue[i] += net;
    else if (t === 'Cost of Goods Sold') cogs[i] += -net;
    else if (t === 'Expense' || t === 'Other Expense') expense[i] += -net;
  });
  return {
    labels: months.map(function (m) { return m.label; }),
    sales: sales, collection: collection,
    gross_profit: months.map(function (m, i) { return revenue[i] - cogs[i]; }),
    net_income: months.map(function (m, i) { return revenue[i] - cogs[i] - expense[i]; })
  };
}

function dashboardExtra_() {
  var accounts = accountsWithBalances_()
    .filter(function (a) { return Math.abs(Number(a.balance || 0)) > 0.001; })
    .map(function (a) { return { name: a.account_name, type: a.account_type, balance: Number(a.balance || 0) }; });
  return { accounts: accounts, recent: allTransactions_().slice(0, 8), charts: dashboardCharts_() };
}

// =====================================================================
//  REPORTS — Company & Financial
// =====================================================================
var RPT_ASSET = ['Bank', 'Other Current Asset', 'Accounts Receivable', 'Fixed Asset', 'Other Asset'];
var RPT_LIAB = ['Accounts Payable', 'Other Current Liability', 'Long Term Liability', 'Other Liability', 'Credit Card'];
var RPT_INCOME = ['Income', 'Other Income'];
var RPT_EXPENSE = ['Expense', 'Other Expense'];
var RPT_COGS = ['Cost of Goods Sold'];

// raw debit-minus-credit per account, optionally bounded by date
function balancesByAccount_(fromKey, toKey) {
  var bal = {};
  rows_('Journal').forEach(function (r) {
    var k = dayKey_(r.date);
    if (fromKey && k < fromKey) return;
    if (toKey && k > toKey) return;
    var a = String(r.account_id);
    bal[a] = (bal[a] || 0) + Number(r.debit || 0) - Number(r.credit || 0);
  });
  return bal;
}
// sign: 'debit' => amount = raw ; 'credit' => amount = -raw
function rptSection_(bal, types, sign) {
  var lines = [], total = 0;
  rows_('Accounts').forEach(function (a) {
    if (types.indexOf(a.account_type) === -1) return;
    var raw = bal[String(a.id)] || 0;
    var amt = sign === 'credit' ? -raw : raw;
    if (Math.abs(amt) < 0.005) return;
    lines.push({ account: a.account_name, amount: amt });
    total += amt;
  });
  return { lines: lines, total: total };
}

function reportTrialBalance_(p) {
  var asOf = p.to ? dayKey_(p.to) : null;
  var bal = balancesByAccount_(null, asOf);
  var lines = [], totDr = 0, totCr = 0;
  rows_('Accounts').forEach(function (a) {
    var raw = bal[String(a.id)] || 0;
    if (Math.abs(raw) < 0.005) return;
    var dr = raw > 0 ? raw : 0, cr = raw < 0 ? -raw : 0;
    totDr += dr; totCr += cr;
    lines.push({ account: a.account_name, type: a.account_type, debit: dr, credit: cr });
  });
  lines.sort(function (a, b) { return String(a.type).localeCompare(b.type) || String(a.account).localeCompare(b.account); });
  return { as_of: asOf, lines: lines, total_debit: totDr, total_credit: totCr };
}

function plData_(from, to) {
  var f = from ? dayKey_(from) : null, t = to ? dayKey_(to) : null;
  var bal = balancesByAccount_(f, t);
  var income = rptSection_(bal, RPT_INCOME, 'credit');
  var cogs = rptSection_(bal, RPT_COGS, 'debit');
  var expense = rptSection_(bal, RPT_EXPENSE, 'debit');
  var gross = income.total - cogs.total;
  return { from: f, to: t, income: income, cogs: cogs, gross_profit: gross, expense: expense, net_income: gross - expense.total };
}

function reportBalanceSheet_(p) {
  var asOf = p.to ? dayKey_(p.to) : null;
  var bal = balancesByAccount_(null, asOf);
  var assets = rptSection_(bal, RPT_ASSET, 'debit');
  var liab = rptSection_(bal, RPT_LIAB, 'credit');
  var equity = rptSection_(bal, ['Equity'], 'credit');
  var pl = plData_(null, asOf);
  equity.lines.push({ account: 'Current Year Earnings', amount: pl.net_income });
  equity.total += pl.net_income;
  return { as_of: asOf, assets: assets, liabilities: liab, equity: equity, total_assets: assets.total, total_liab_equity: liab.total + equity.total };
}

function reportIncomeByCustomer_(p) {
  var f = p.from ? dayKey_(p.from) : null, t = p.to ? dayKey_(p.to) : null;
  var cust = nameMap_('Customers'), agg = {};
  function add(entity, walkLabel) {
    list_(entity, {}).forEach(function (r) {
      var k = dayKey_(r.date); if (f && k < f) return; if (t && k > t) return;
      var name = r.customer_id ? (cust[String(r.customer_id)] || '—') : (r.customer_name || walkLabel || 'Walk-in Customer');
      agg[name] = (agg[name] || 0) + Number(r.total || 0);
    });
  }
  add('Invoices'); add('SalesReceipts', 'Walk-in Customer');
  var lines = Object.keys(agg).map(function (k) { return { customer: k, amount: agg[k] }; }).sort(function (a, b) { return b.amount - a.amount; });
  return { from: f, to: t, lines: lines, total: lines.reduce(function (s, l) { return s + l.amount; }, 0) };
}

function reportTransactionsSummary_(p) {
  var f = p.from ? dayKey_(p.from) : null, t = p.to ? dayKey_(p.to) : null;
  function agg(entity, amountField, filter) {
    var c = 0, sum = 0;
    list_(entity, {}).forEach(function (r) {
      if (filter && !filter(r)) return;
      var k = dayKey_(r.date); if (f && k < f) return; if (t && k > t) return;
      c++; sum += Number(r[amountField || 'total'] || 0);
    });
    return { count: c, total: sum };
  }
  var defs = [
    ['Invoices', 'Invoices', null, null],
    ['Sales Receipts', 'SalesReceipts', null, null],
    ['Credit Memos', 'CreditMemos', null, null],
    ['Sales Orders', 'SalesOrders', null, null],
    ['Quotations', 'Quotations', null, null],
    ['Bills', 'Bills', null, function (r) { return r.bill_type !== 'Credit'; }],
    ['Purchase Returns', 'Bills', null, function (r) { return r.bill_type === 'Credit'; }],
    ['Purchase Orders', 'PurchaseOrders', null, null],
    ['Expenses', 'Expenses', null, null],
    ['Customer Payments', 'Payments', 'amount', null]
  ];
  return { from: f, to: t, rows: defs.map(function (d) { var r = agg(d[1], d[2], d[3]); return { label: d[0], count: r.count, total: r.total }; }) };
}

// =====================================================================
//  REPORTS — Receivables / Payables / Accounts
// =====================================================================
function inRange_(k, f, t) { if (f && k < f) return false; if (t && k > t) return false; return true; }

function reportCustomerBalances_(p) {
  var f = p.from ? dayKey_(p.from) : null, t = p.to ? dayKey_(p.to) : null;
  var cust = nameMap_('Customers'), agg = {};
  list_('Invoices', {}).forEach(function (r) {
    if (!inRange_(dayKey_(r.date), f, t)) return;
    var name = cust[String(r.customer_id)] || '—';
    var a = agg[name] || (agg[name] = { invoiced: 0, balance: 0 });
    a.invoiced += Number(r.total || 0); a.balance += Number(r.balance || 0);
  });
  var lines = Object.keys(agg).map(function (k) { var a = agg[k]; return { customer: k, invoiced: a.invoiced, paid: a.invoiced - a.balance, balance: a.balance }; }).sort(function (a, b) { return b.balance - a.balance; });
  return { from: f, to: t, lines: lines,
    total_invoiced: lines.reduce(function (s, l) { return s + l.invoiced; }, 0),
    total_paid: lines.reduce(function (s, l) { return s + l.paid; }, 0),
    total_balance: lines.reduce(function (s, l) { return s + l.balance; }, 0) };
}

function reportPaymentCollection_(p) {
  var f = p.from ? dayKey_(p.from) : null, t = p.to ? dayKey_(p.to) : null;
  var cust = nameMap_('Customers'), lines = [];
  list_('Payments', {}).forEach(function (r) {
    var k = dayKey_(r.date); if (!inRange_(k, f, t)) return;
    lines.push({ date: k, customer: cust[String(r.customer_id)] || '', amount: Number(r.amount || 0), method: r.method || '', reference: r.reference || '' });
  });
  lines.sort(function (a, b) { return String(a.date).localeCompare(b.date); });
  return { from: f, to: t, lines: lines, total: lines.reduce(function (s, l) { return s + l.amount; }, 0) };
}

function statement_(events, f, t, openingExtra) {
  events.sort(function (a, b) { return String(a.date).localeCompare(b.date); });
  var opening = openingExtra || 0, inrange = [];
  events.forEach(function (e) {
    if (f && e.date < f) { opening += e.debit - e.credit; return; }
    if (t && e.date > t) return;
    inrange.push(e);
  });
  var bal = opening;
  inrange.forEach(function (e) { bal += e.debit - e.credit; e.balance = bal; });
  return { opening: opening, lines: inrange, closing: bal };
}

function reportCustomerStatement_(p) {
  if (!p.id) return { lines: [], need_pick: true };
  var f = p.from ? dayKey_(p.from) : null, t = p.to ? dayKey_(p.to) : null;
  var c = get_('Customers', p.id); if (!c) throw new Error('Customer not found.');
  var ev = [];
  list_('Invoices', {}).forEach(function (r) { if (String(r.customer_id) === String(p.id)) ev.push({ date: dayKey_(r.date), type: 'Invoice', number: r.invoice_no, debit: Number(r.total || 0), credit: 0 }); });
  list_('Payments', {}).forEach(function (r) { if (String(r.customer_id) === String(p.id)) ev.push({ date: dayKey_(r.date), type: 'Payment', number: r.reference || '', debit: 0, credit: Number(r.amount || 0) }); });
  list_('CreditMemos', {}).forEach(function (r) { if (String(r.customer_id) === String(p.id)) ev.push({ date: dayKey_(r.date), type: 'Credit Memo', number: r.memo_no, debit: 0, credit: Number(r.total || 0) }); });
  var s = statement_(ev, f, t, Number(c.opening_balance || 0));
  return { name: c.name, from: f, to: t, opening: s.opening, lines: s.lines, closing: s.closing };
}

function reportSupplierBalances_(p) {
  var f = p.from ? dayKey_(p.from) : null, t = p.to ? dayKey_(p.to) : null;
  var supp = nameMap_('Suppliers'), agg = {};
  list_('Bills', {}).forEach(function (r) {
    if (!inRange_(dayKey_(r.date), f, t)) return;
    var sign = r.bill_type === 'Credit' ? -1 : 1;
    var name = supp[String(r.supplier_id)] || '—';
    var a = agg[name] || (agg[name] = { billed: 0, balance: 0 });
    a.billed += Number(r.total || 0) * sign; a.balance += Number(r.balance || 0) * sign;
  });
  var lines = Object.keys(agg).map(function (k) { var a = agg[k]; return { supplier: k, billed: a.billed, paid: a.billed - a.balance, balance: a.balance }; }).sort(function (a, b) { return b.balance - a.balance; });
  return { from: f, to: t, lines: lines,
    total_billed: lines.reduce(function (s, l) { return s + l.billed; }, 0),
    total_paid: lines.reduce(function (s, l) { return s + l.paid; }, 0),
    total_balance: lines.reduce(function (s, l) { return s + l.balance; }, 0) };
}

function reportSupplierStatement_(p) {
  if (!p.id) return { lines: [], need_pick: true };
  var f = p.from ? dayKey_(p.from) : null, t = p.to ? dayKey_(p.to) : null;
  var s = get_('Suppliers', p.id); if (!s) throw new Error('Supplier not found.');
  var ev = [];
  list_('Bills', {}).forEach(function (r) {
    if (String(r.supplier_id) !== String(p.id)) return;
    if (r.bill_type === 'Credit') ev.push({ date: dayKey_(r.date), type: 'Supplier Credit', number: r.bill_no, debit: Number(r.total || 0), credit: 0 });
    else ev.push({ date: dayKey_(r.date), type: 'Bill', number: r.bill_no, debit: 0, credit: Number(r.total || 0) });
  });
  var st = statement_(ev, f, t, Number(s.opening_balance || 0) * -1);
  // balance is credit-heavy (we owe); flip sign so positive = payable
  return { name: s.name, from: f, to: t, opening: -st.opening, lines: st.lines.map(function (l) { return { date: l.date, type: l.type, number: l.number, debit: l.debit, credit: l.credit, balance: -l.balance }; }), closing: -st.closing };
}

function reportJournal_(p) {
  var f = p.from ? dayKey_(p.from) : null, t = p.to ? dayKey_(p.to) : null;
  var accs = {}; rows_('Accounts').forEach(function (a) { accs[String(a.id)] = a.account_name; });
  var lines = [], totDr = 0, totCr = 0;
  rows_('Journal').forEach(function (r) {
    var k = dayKey_(r.date); if (!inRange_(k, f, t)) return;
    var dr = Number(r.debit || 0), cr = Number(r.credit || 0);
    totDr += dr; totCr += cr;
    lines.push({ date: k, entry_no: r.entry_no, account: accs[String(r.account_id)] || '', debit: dr, credit: cr, memo: r.memo || r.name || '' });
  });
  lines.sort(function (a, b) { return String(a.date + a.entry_no).localeCompare(String(b.date + b.entry_no)); });
  return { from: f, to: t, lines: lines, total_debit: totDr, total_credit: totCr };
}

function reportGeneralLedger_(p) {
  var f = p.from ? dayKey_(p.from) : null, t = p.to ? dayKey_(p.to) : null;
  var byAcct = {};
  rows_('Journal').forEach(function (r) {
    var a = String(r.account_id); (byAcct[a] = byAcct[a] || []).push(r);
  });
  var out = [];
  rows_('Accounts').forEach(function (a) {
    var entries = byAcct[String(a.id)] || []; if (!entries.length) return;
    var ev = entries.map(function (r) { return { date: dayKey_(r.date), number: r.entry_no, memo: r.memo || r.name || '', debit: Number(r.debit || 0), credit: Number(r.credit || 0) }; });
    var s = statement_(ev, f, t, 0);
    if (!s.lines.length && Math.abs(s.opening) < 0.005) return;
    out.push({ account: a.account_name, type: a.account_type, opening: s.opening, lines: s.lines, closing: s.closing });
  });
  return { from: f, to: t, accounts: out };
}

// =====================================================================
//  PAYMENT / DEPOSIT — detail & delete (for View / Edit / Delete / Print)
// =====================================================================
function paymentDetail_(id) {
  var pmt = rows_('Payments').filter(function (r) { return String(r.id) === String(id); })[0];
  if (!pmt) throw new Error('Payment not found.');
  return { payment: strip_(pmt), customer: pmt.customer_id ? get_('Customers', pmt.customer_id) : null, invoice: pmt.invoice_id ? get_('Invoices', pmt.invoice_id) : null };
}
function deletePayment_(p) {
  var id = p.id;
  var pmt = rows_('Payments').filter(function (r) { return String(r.id) === String(id); })[0];
  if (!pmt) throw new Error('Payment not found.');
  if (String(pmt.is_deposited) === '1') throw new Error('This payment is in a deposit. Delete the deposit first.');
  var amt = Number(pmt.amount || 0), invId = pmt.invoice_id;
  deleteWhere_('Payments', 'id', id);
  if (invId) {
    var inv = rows_('Invoices').filter(function (r) { return String(r.id) === String(invId); })[0];
    if (inv) {
      var paid = rows_('Payments').filter(function (r) { return String(r.invoice_id) === String(invId); }).reduce(function (s, r) { return s + Number(r.amount || 0); }, 0);
      var t = Number(inv.total || 0);
      update_('Invoices', invId, { paid: paid, balance: t - paid, status: paid >= t ? 'paid' : (paid > 0 ? 'partial' : 'unpaid') });
    }
  }
  if (amt > 0) try { postEntry_({ date: dayKey_(pmt.date), memo: 'Reverse customer payment', source_type: 'payment_reversal', source_id: 'PMTR' + Date.now(), created_by: userFromToken_(p.token), lines: [{ account_id: acctId_('ar'), debit: amt, credit: 0 }, { account_id: acctId_('undeposited'), debit: 0, credit: amt }] }); } catch (e) {}
  return { id: id, deleted: true };
}
function depositDetail_(id) {
  var dep = rows_('Deposits').filter(function (r) { return String(r.id) === String(id); })[0];
  if (!dep) throw new Error('Deposit not found.');
  var custs = nameMap_('Customers');
  var pays = rows_('Payments').filter(function (r) { return String(r.deposit_id) === String(id); }).map(function (r) { var o = strip_(r); o.customer = custs[String(r.customer_id)] || ''; return o; });
  var acc = dep.account_id ? get_('Accounts', dep.account_id) : null;
  return { deposit: strip_(dep), payments: pays, account: acc ? acc.account_name : '' };
}
function deleteDeposit_(p) {
  var id = p.id;
  var dep = rows_('Deposits').filter(function (r) { return String(r.id) === String(id); })[0];
  if (!dep) throw new Error('Deposit not found.');
  rows_('Payments').forEach(function (r) { if (String(r.deposit_id) === String(id)) update_('Payments', r.id, { is_deposited: '', deposit_id: '' }); });
  deleteWhere_('Deposits', 'id', id);
  try { postEntry_({ date: dayKey_(dep.date), memo: 'Reverse deposit ' + dep.deposit_no, source_type: 'deposit_reversal', source_id: 'DEPR' + Date.now(), created_by: userFromToken_(p.token), lines: [{ account_id: acctId_('undeposited'), debit: Number(dep.total || 0), credit: 0 }, { account_id: dep.account_id, debit: 0, credit: Number(dep.total || 0) }] }); } catch (e) {}
  return { id: id, deleted: true };
}
