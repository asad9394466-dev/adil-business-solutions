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
  Items:          ['id','sku','name','category_id','brand_id','uom_id','cost_price','regular_price','wholesale_price','tax_type_id','reorder_level','expiry_date','status','created_at'],
  Customers:      ['id','name','phone','email','address','area','opening_balance','credit_limit','price_list','status','created_at'],
  Suppliers:      ['id','name','phone','email','address','opening_balance','status','created_at'],
  Invoices:       ['id','invoice_no','date','customer_id','subtotal','discount','tax','total','paid','balance','status','notes','created_by','created_at'],
  InvoiceItems:   ['id','invoice_id','item_id','description','qty','unit_price','discount','line_total'],
  Payments:       ['id','date','customer_id','invoice_id','amount','method','reference','notes','created_at'],
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
  try {
    var sh = sheet_('Counters');
    var values = sh.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0]) === String(name)) {
        var next = Number(values[i][1] || 0) + 1;
        sh.getRange(i + 1, 2).setValue(next);
        var prefix = values[i][2] || '';
        return prefix + String(next).padStart(5, '0');
      }
    }
    // create counter on the fly
    sh.appendRow([name, 1, '']);
    return String(1).padStart(5, '0');
  } finally {
    lock.releaseLock();
  }
}

// =====================================================================
//  DASHBOARD
// =====================================================================
function dashboard_() {
  var items = list_('Items', {});
  var customers = list_('Customers', {});
  var invoices = list_('Invoices', {});
  var today = new Date().toISOString().slice(0, 10);
  var todays = invoices.filter(function (i) { return String(i.date).slice(0, 10) === today; })
                       .reduce(function (sum, i) { return sum + Number(i.total || 0); }, 0);
  return {
    items_count: items.length,
    customers_count: customers.length,
    invoices_count: invoices.length,
    todays_sales: todays,
    low_stock_count: 0 // populated once live stock tracking lands (Phase 3)
  };
}

// =====================================================================
//  OUTPUT
// =====================================================================
function out_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
