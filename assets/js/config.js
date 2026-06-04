/* =====================================================================
   Adil Business Solutions — Configuration
   ---------------------------------------------------------------------
   This is the ONLY file you edit to connect the app to your backend.
   After you deploy the Google Apps Script Web App (see docs/SETUP.md),
   paste its URL into API_URL below.
   ===================================================================== */

window.ABS_CONFIG = {

  // --- Backend ---------------------------------------------------------
  // Paste your deployed Apps Script Web App URL here (ends with /exec)
  API_URL: "https://script.google.com/macros/s/AKfycbzisUWnDrW15tjB36KM90z5Ab6iZcZsoWki2tIp_1xG2EqeSe8cmYBE63-ADQUYNP5Y/exec",

  // --- Branding --------------------------------------------------------
  APP_NAME: "Adil Business Solutions",
  APP_SHORT: "ABS",
  TAGLINE: "Invoicing & Inventory",

  // --- Company (shown on invoices later; edit to your details) ---------
  COMPANY: {
    name: "Adil Business Solutions",
    address: "Your address line, City, Country",
    phone: "+00 000 0000000",
    email: "info@adilbusiness.example",
    currency: "PKR",
    currency_symbol: "Rs",
    tax_percent: 0,
    invoice_prefix: "INV-"
  },

  // --- Version ---------------------------------------------------------
  VERSION: "1.3 (Phase 2)",

  // --- Sidebar menu ----------------------------------------------------
  // route = the part after # in the URL. Items without a built screen yet
  // show a friendly "coming soon" placeholder during early phases.
  MENU: [
    { label: "Dashboard", icon: "home", route: "home" },

    { label: "Items", icon: "box", children: [
      { label: "Item List", route: "items" },
      { label: "New Item", route: "new-item" },
      { label: "Inventory Alert", route: "inventory-alert" },
      { label: "Expired Inventory", route: "expired-inventory" },
      { label: "Price Manager", route: "price-manager" }
    ]},

    { label: "Customers", icon: "users", route: "customers" },
    { label: "Suppliers", icon: "truck", route: "suppliers" },

    { label: "Sales", icon: "file-text", children: [
      { label: "Invoices", route: "invoices" },
      { label: "New Invoice", route: "new-invoice" },
      { label: "Quotations", route: "quotations" },
      { label: "Sales Orders", route: "sales-orders" },
      { label: "Sales Receipts", route: "sales-receipts" },
      { label: "Credit Memos / Refunds", route: "credit-memos" }
    ]},

    { label: "Purchases", icon: "cart", children: [
      { label: "Purchase Orders", route: "purchase-orders" },
      { label: "Bills", route: "bills" },
      { label: "Expenses", route: "expenses" }
    ]},

    { label: "Inventory", icon: "layers", children: [
      { label: "Stock Adjustments", route: "inventory-adjustments" },
      { label: "Stock Transfers", route: "inventory-transfer" }
    ]},

    { label: "Reports", icon: "chart", children: [
      { label: "Sales by Item", route: "report-sales-item" },
      { label: "Sales by Customer", route: "report-sales-customer" },
      { label: "Inventory Valuation", route: "report-inventory" },
      { label: "Customer Balances", route: "report-customer-balances" },
      { label: "Supplier Balances", route: "report-supplier-balances" }
    ]},

    { label: "Settings", icon: "settings", children: [
      { label: "Categories", route: "categories" },
      { label: "Brands", route: "brands" },
      { label: "Units (UOM)", route: "uom" },
      { label: "Tax Types", route: "tax-types" },
      { label: "Regions & Areas", route: "areas" },
      { label: "Sales Representatives", route: "sales-representatives" },
      { label: "Users", route: "users" },
      { label: "Company Information", route: "company-information" }
    ]}
  ],

  // Which routes are actually built. Anything not listed shows a
  // "planned for a later phase" placeholder. We add to this each phase.
  BUILT_ROUTES: ["home", "items", "new-item", "customers", "suppliers", "categories", "brands", "uom", "tax-types", "areas", "sales-representatives", "invoices", "new-invoice"]
};
